import { startCommentBridge } from "./server.mjs";
import { randomUUID } from "node:crypto";

export function commentAttention(session, pending, readTool = "get_preview_comments") {
  let announced;
  function hint() {
    const { count, latestId } = pending();
    if (!count || latestId === announced) return;
    announced = latestId;
    return `${count} unread browser comment(s) available. ` +
      `Use ${readTool} if relevant to the current work; otherwise leave them pending.`;
  }
  return {
    hint,
    wakeIfIdle: async () => {
      if ((await session.rpc.metadata.isProcessing()).processing) return;
      const previous = announced;
      const prompt = hint();
      if (!prompt) return;
      const current = announced;
      try { await session.send({ prompt, mode: "immediate" }); }
      catch (error) {
        if (announced === current) announced = previous;
        throw error;
      }
    },
  };
}

export async function withdrawLegacyComments(session, comments) {
  const known = new Set(comments.filter(comment => comment.queued).map(comment => comment.id));
  const { items } = await session.rpc.queue.pendingItems();
  for (const item of items) {
    const match = /^\[Browser comment ([\da-f-]+)\]\n/.exec(item.displayText);
    if (item.kind === "message" && match && known.has(match[1])) {
      const { removed } = await session.rpc.queue.removeAt({ id: item.id });
      if (!removed) await session.log("A legacy browser comment left the queue before withdrawal.", { level: "warning" });
    }
  }
}

export async function connectPreviewComments(config) {
  const { joinSession } = await import("@github/copilot-sdk/extension");
  let bridge;
  let attention;
  const availability = () => {
    const text = attention?.hint();
    if (text) return { additionalContext: text };
  };
  const session = await joinSession({
    hooks: {
      onSessionEnd: async () => { if (bridge) await bridge.close(); },
      onPostToolUse: availability,
      onPostToolUseFailure: availability,
    },
    tools: [{
      name: "get_preview_comments",
      description: "Fetch unread browser comments and mark them seen. Reading does not resolve them. Optionally include previously seen feedback.",
      parameters: {
        type: "object",
        properties: { include_seen: { type: "boolean", description: "Include previously seen comments." } },
      },
      handler: (args) => JSON.stringify(bridge.read({ includeSeen: args.include_seen === true })),
    }, {
      name: "update_preview_comment",
      description: "Post a Copilot reply and/or explicitly resolve or reopen a saved browser comment. Reading and resolution are separate. Replies and status changes appear in the browser history.",
      parameters: {
        type: "object",
        required: ["comment_id"],
        properties: {
          comment_id: { type: "string", description: "The saved comment ID." },
          reply: { type: "string", description: "Reply text to display in the comment thread." },
          resolved: { type: "boolean", description: "True to resolve; false to reopen. Omit to keep the status." },
          proposal: { type: "object", description: "Optional proposed edit shown as a diff card in this thread, with Accept/Reject buttons. Accepting replies to you; apply the edit yourself then.", properties: { before: { type: "string" }, after: { type: "string" } } },
          link_comment_ids: { type: "array", items: { type: "string" }, description: "Link this thread to other threads (ids); the user sees them as jumpable links with backlinks." },
          update_id: { type: "string", description: "Optional UUID reused when retrying the same update." },
        },
      },
      handler: args => {
        const input = { id: args.update_id ?? randomUUID(), commentId: args.comment_id };
        if (args.reply !== undefined) input.reply = args.reply;
        if (args.resolved !== undefined) input.resolved = args.resolved;
        if (args.proposal !== undefined) input.proposal = args.proposal;
        if (args.link_comment_ids !== undefined) input.addRefs = args.link_comment_ids;
        return JSON.stringify(bridge.update(input));
      },
    }, {
      name: "add_preview_comment",
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
      handler: args => JSON.stringify(bridge.add(args)),
    }, {
      name: "set_preview_status",
      description: "Show a short status line in the user's browser (e.g. state 'reading', text 'Reading the methods section'). Use state 'idle' with empty text to clear it.",
      parameters: { type: "object", required: ["state"], properties: { state: { type: "string", description: "idle, reading, thinking, editing, waiting (needs attention) or blocked (stuck, needs help; requires text, stays loud until you set another state)." }, text: { type: "string", description: "Up to 120 characters." } } },
      handler: args => JSON.stringify({ bridge }.bridge.setStatus(args)),
    }],
  });
  attention = commentAttention(session, () => bridge?.pending() ?? { count: 0 });
  const report = error => session.log(`Preview comment notification failed: ${error.message}`, { level: "warning" });
  bridge = await startCommentBridge({
    ...config,
    sessionId: session.sessionId,
    notify: () => attention.wakeIfIdle(),
    onError: report,
  });
  await withdrawLegacyComments(session, bridge.list());
  session.on("assistant.idle", event => {
    if (!event.agentId) attention.wakeIfIdle().catch(report);
  });
  await attention.wakeIfIdle();
  await session.log(`Preview comments connected: ${bridge.connectionFile}`);
}
