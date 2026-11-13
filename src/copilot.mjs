import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { commentAttention } from "../scripts/preview_comments/extension.mjs";
import { startDocumentPreview } from "./preview.mjs";
import { readBoard } from "./workstreams.mjs";

export async function connectDocumentReview({
  joinSession: joinOverride, startPreview = startDocumentPreview,
} = {}) {
  const joinSession = joinOverride ?? (await import("@github/copilot-sdk/extension")).joinSession;
  let active;
  let starting;
  let attention;
  const requirePreview = () => {
    if (!active) throw new Error("Start a document preview with start_doc_review first.");
    return active;
  };
  const hint = () => {
    const additionalContext = attention?.hint();
    if (additionalContext) return { additionalContext };
  };
  const stop = async () => {
    if (starting) await starting;
    if (active) { await active.close(); active = undefined; }
  };
  const session = await joinSession({
    hooks: {
      onSessionEnd: stop,
      onPostToolUse: hint,
      onPostToolUseFailure: hint,
    },
    tools: [{
      name: "start_doc_review",
      description: "Start a loopback-only live Markdown, equation and figure review attached to this session. One preview is active at a time.",
      parameters: {
        type: "object", required: ["document_path"],
        properties: {
          document_path: { type: "string", description: "Absolute path to the original Markdown document." },
          port: { type: "integer", minimum: 0, maximum: 65535, description: "Optional HTTP port. Zero selects an available port." },
        },
      },
      handler: async args => {
        if (active || starting) throw new Error("A document preview is already open or starting. Stop it with stop_doc_review first.");
        const storageRoot = join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "agent-doc-review");
        starting = startPreview({
          documentPath: args.document_path, sessionId: session.sessionId,
          storageRoot, port: args.port ?? 0,
          notify: () => attention.wakeIfIdle(),
          onError: error => session.log(`Document review notification failed: ${error.message}`, { level: "warning" }),
        });
        try { active = await starting; }
        finally { starting = undefined; }
        return JSON.stringify({ url: active.url, document: active.document, feedback: "Attached to this Copilot session." });
      },
    }, {
      name: "list_workstreams",
      description: "Return the workstream board as JSON: front matter (title, status, owner, summary, requester, date, depends_on) and checklist step progress for each workstreams/*.md file, plus counts per status.",
      parameters: { type: "object", properties: { directory: { type: "string", description: "Absolute path of the workstreams directory (default: ./workstreams)." } } },
      handler: args => JSON.stringify(readBoard(args.directory ?? join(process.cwd(), "workstreams"))),
    }, {
      name: "read_doc_review_comments",
      description: "Fetch unread document feedback and persist read receipts. Reading does not resolve threads.",
      parameters: {
        type: "object",
        properties: { include_seen: { type: "boolean", description: "Also include previously read threads." } },
      },
      handler: args => JSON.stringify(requirePreview().bridge.read({ includeSeen: args.include_seen === true })),
    }, {
      name: "update_doc_review_comment",
      description: "Reply to a document comment and/or explicitly resolve or reopen it. Replies alone preserve its status.",
      parameters: {
        type: "object", required: ["comment_id"],
        properties: {
          comment_id: { type: "string" }, reply: { type: "string" },
          resolved: { type: "boolean" },
          link_comment_ids: { type: "array", items: { type: "string" }, description: "Link this thread to other threads (ids); the user sees them as jumpable links with backlinks." },
          update_id: { type: "string", description: "UUID reused for an unchanged retry." },
        },
      },
      handler: args => {
        const input = { id: args.update_id ?? randomUUID(), commentId: args.comment_id };
        if (args.reply !== undefined) input.reply = args.reply;
        if (args.resolved !== undefined) input.resolved = args.resolved;
        if (args.link_comment_ids !== undefined) input.addRefs = args.link_comment_ids;
        return JSON.stringify(requirePreview().bridge.update(input));
      },
    }, {
      name: "add_doc_review_comment",
      description: "Start a new comment thread on a page, to point the user at a passage, equation, figure, graph node or edge. Appears red in their browser; the user can reply to continue the thread.",
      parameters: {
        type: "object", required: ["page", "kind", "quote", "comment"],
        properties: {
          page: { type: "string", description: "Preview page path, e.g. /review or /graph." },
          kind: { type: "string", enum: ["text", "equation", "figure", "node", "edge", "page", "session"], description: "What the comment points at. page: the whole page (quote: its title). session: general chat not tied to a page." },
          quote: { type: "string", description: "text: exact passage as rendered. equation: 'Equation (1)'. node/edge: the target's quote from its comment or title." },
          anchor: { type: "string", description: "node/edge only: 'node-<id>' or 'edge-<id>'." },
          comment: { type: "string", description: "What you want the user to look at, and why." },
          proposal: { type: "object", description: "Optional proposed edit shown as a diff card with Accept/Reject buttons. Accepting replies to you; apply the edit yourself then.", properties: { before: { type: "string" }, after: { type: "string" } } },
          refs: { type: "array", items: { type: "string" }, description: "Ids of existing threads this one relates to; shown as links with backlinks." },
          color: { type: "string", enum: ["red", "yellow", "green", "blue", "pink"], description: "Defaults to red (the agent colour)." },
        },
      },
      handler: args => JSON.stringify(requirePreview().bridge.add(args)),
    }, {
      name: "set_doc_review_status",
      description: "Show a short status line in the user's browser (e.g. state 'reading', text 'Reading the methods section'). Use state 'idle' with empty text to clear it.",
      parameters: { type: "object", required: ["state"], properties: { state: { type: "string", description: "idle, reading, thinking, editing or waiting." }, text: { type: "string", description: "Up to 120 characters." } } },
      handler: args => JSON.stringify(requirePreview().bridge.setStatus(args)),
    }, {
      name: "stop_doc_review",
      description: "Stop this session's document preview. Saved feedback remains on disk.",
      parameters: { type: "object", properties: {} },
      handler: async () => { await stop(); return "Document preview stopped; saved feedback retained."; },
    }],
  });
  attention = commentAttention(session, () => active?.bridge.pending() ?? { count: 0 }, "read_doc_review_comments");
  session.on("assistant.idle", event => {
    if (!event.agentId) {
      attention.wakeIfIdle().catch(error =>
        session.log(`Document review notification failed: ${error.message}`, { level: "warning" }));
    }
  });
  return session;
}
