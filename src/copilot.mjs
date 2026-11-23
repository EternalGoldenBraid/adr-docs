import { randomUUID } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { commentAttention } from "../scripts/preview_comments/extension.mjs";
import { remoteBridge, remoteMachine } from "./remote-bridge.mjs";
import { listDeadServers, listServers, recordExit, resolveStore } from "./servers.mjs";
import { readBoard } from "./workstreams.mjs";

const stateRoot = () => join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "agent-doc-review");

export async function connectDocumentReview({
  joinSession: joinOverride, startPreview = async options => (await import("./preview.mjs")).startDocumentPreview(options), // loaded on demand: a client machine needs no preview dependencies
} = {}) {
  const joinSession = joinOverride ?? (await import("@github/copilot-sdk/extension")).joinSession;
  let active;
  let starting;
  let attention;
  // Which standalone `adr` server to talk to: the given store, else this session's own when it has no in-process preview.
  const remoteStore = args => {
    if (args.store) {
      // A store this machine does not know is left as given when previews are reached over the mesh (remote.json).
      try { args = { ...args, store: resolveStore(stateRoot(), args.store) }; } catch (error) { if (!remoteMachine(stateRoot())) throw error; }
    }
    if (args.store && (args.store !== session.sessionId || !active)) return args.store;
    if (!args.store && !active && existsSync(join(stateRoot(), session.sessionId, "connection.json"))) return session.sessionId;
    return undefined;
  };
  // The host reports a thrown handler error only as "Tool execution failed"; hand the cause back as text instead.
  const remoteFailure = error => `Error: ${error.message}`;
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
      description: "Start a loopback-only live Markdown, equation and figure review attached to this session. One preview is active at a time. It ends with this session; for a long-lived, named server that survives crashes and reloads, run `adr <dir> -d --name <name> --store <session id>` from the shell instead.",
      parameters: {
        type: "object", required: ["document_path"],
        properties: {
          document_path: { type: "string", description: "Absolute path to the original Markdown document." },
          port: { type: "integer", minimum: 0, maximum: 65535, description: "Optional HTTP port. Zero selects an available port." },
        },
      },
      handler: async args => {
        if (active || starting) throw new Error("A document preview is already open or starting. Stop it with stop_doc_review first.");
        const storageRoot = stateRoot();
        // A standalone server already serves this folder: use it instead of a second one that would write the same comments.
        const real = path => { try { return realpathSync(path); } catch { return path; } };
        const folder = dirname(real(args.document_path));
        const existing = listServers(storageRoot).find(row => row.standalone && row.root && real(row.root) === folder);
        if (existing) {
          const stem = basename(args.document_path, ".md");
          return JSON.stringify({
            url: existing.url + (stem === "index" ? "/" : "/" + encodeURIComponent(stem)), existing: true,
            store: existing.name ?? existing.store,
            feedback: `A standalone server already serves this folder, so none was started. Open the url; pass store="${existing.name ?? existing.store}" to read_doc_review_comments, update_doc_review_comment and add_doc_review_comment.`,
          });
        }
        starting = startPreview({
          documentPath: args.document_path, sessionId: session.sessionId,
          storageRoot, port: args.port ?? 0,
          notify: () => attention.wakeIfIdle(),
          onError: error => session.log(`Document review notification failed: ${error.message}`, { level: "warning" }),
        });
        try { active = await starting; }
        finally { starting = undefined; }
        // A server inside the agent process ends with it; leave the reason for list_doc_review_servers.
        process.once("exit", code => recordExit(storageRoot, session.sessionId, `agent process exited (code ${code}); this server lives in the agent session, not standalone`));
        return JSON.stringify({ url: active.url, document: active.document, feedback: "Attached to this Copilot session." });
      },
    }, {
      name: "list_workstreams",
      description: "Return the workstream board as JSON: front matter (title, status, owner, summary, requester, date, depends_on) and checklist step progress for each workstreams/*.md file, plus counts per status.",
      parameters: { type: "object", properties: { directory: { type: "string", description: "Absolute path of the workstreams directory (default: ./workstreams)." } } },
      handler: args => JSON.stringify(readBoard(args.directory ?? join(process.cwd(), "workstreams"))),
    }, {
      name: "list_doc_review_servers",
      description: "List the running ADR (document review) servers on this machine: url, folder, pid and comment store; `recentlyStopped` lists servers that stopped in the last 48 h with the recorded reason. Use a store with read_doc_review_comments(as, store) to join one.",
      parameters: { type: "object", properties: {} },
      handler: () => JSON.stringify({ running: listServers(stateRoot()), recentlyStopped: listDeadServers(stateRoot()) }),
    }, {
      name: "read_doc_review_comments",
      description: "Fetch unread document feedback and persist read receipts. Reading does not resolve threads.",
      parameters: {
        type: "object",
        properties: {
          include_seen: { type: "boolean", description: "Also include previously read threads." },
          as: { type: "string", description: "Your agent name: return only threads addressed to it and mark them read for it. Omit when you own the preview." },
          store: { type: "string", description: "Server name (e.g. demo), site directory or store id of the preview that holds the threads. Requires `as`." },
        },
      },
      handler: args => {
        const store = remoteStore(args);
        if (store) {
          if (!args.as && store !== session.sessionId) throw new Error("`as` (your agent name) is required with `store`.");
          const query = new URLSearchParams({ includeSeen: args.include_seen === true ? "1" : "0", ...(args.as ? { as: args.as } : {}) });
          return remoteBridge(stateRoot(), store, `/read?${query}`).then(JSON.stringify, remoteFailure);
        }
        return JSON.stringify(requirePreview().bridge.read({ includeSeen: args.include_seen === true, ...(args.as ? { as: args.as } : {}) }));
      },
    }, {
      name: "unanswered_threads",
      description: "State check for a natural pause (end of a task, before you report): open threads addressed to you whose last word is the user's and which you have not answered since, with age and a one-line quote. Read-only (changes no read receipts). Always states the count, e.g. \"checked: 0 unanswered\". Not an interrupt: call it between tasks, not mid-work.",
      parameters: {
        type: "object",
        properties: {
          as: { type: "string", description: "Your agent name. Omit when you own the preview." },
          store: { type: "string", description: "Server name (e.g. demo), site directory or store id of the preview. Requires `as`." },
        },
      },
      handler: args => {
        const store = remoteStore(args);
        if (store) {
          if (!args.as && store !== session.sessionId) throw new Error("`as` (your agent name) is required with `store`.");
          return remoteBridge(stateRoot(), store, `/unanswered?${new URLSearchParams(args.as ? { as: args.as } : {})}`).then(JSON.stringify, remoteFailure);
        }
        return JSON.stringify(requirePreview().bridge.unanswered(args.as ? { as: args.as } : {}));
      },
    }, {
      name: "update_doc_review_comment",
      description: "Reply to a document comment and/or explicitly resolve or reopen it. Replies alone preserve its status.",
      parameters: {
        type: "object", required: ["comment_id"],
        properties: {
          comment_id: { type: "string" }, reply: { type: "string" },
          as: { type: "string", description: "Your agent slug (required unless this session is in the team roster); shown as the sender of the reply, and your resolve counts under it." },
          resolved: { type: "boolean" },
          to: { type: "array", items: { type: "string" }, description: "Agent names to ping with this reply; they get a mesh note and become members of the thread (members stay; with no `to` every unmuted member is notified), and a reply to someone who had resolved reopens the thread for them. Omit to address the thread's current recipients." },
          whisper: { type: "boolean", description: "With to: only those named (and you) see this reply." },
          mute: { type: "boolean", description: "Mute (true) or unmute (false) this thread for yourself: you stay a member and can read it, but get no notes or nudges for new replies unless one names you in `to`. Self-care rule: you cannot feel your context filling, so mute a thread after two notes in a row that are not addressed to you or a ticket you own; a reply naming you in `to` still reaches you, and you unmute with mute:false when you want it back." },
          proposal: { type: "object", description: "Optional proposed edit shown as a diff card in this thread, with Accept/Reject buttons. Accepting replies to you; apply the edit yourself then.", properties: { before: { type: "string" }, after: { type: "string" } } },
          link_comment_ids: { type: "array", items: { type: "string" }, description: "Link this thread to other threads (ids); the user sees them as jumpable links with backlinks." },
          update_id: { type: "string", description: "UUID reused for an unchanged retry." },
          store: { type: "string", description: "Server name (e.g. demo), site directory or store id of the preview that holds the thread, when it is not yours." },
        },
      },
      handler: args => {
        const input = { id: args.update_id ?? randomUUID(), commentId: args.comment_id };
        if (args.reply !== undefined) input.reply = args.reply;
        if (args.as) input.from = args.as;
        input.fromSession = session.sessionId;
        if (args.resolved !== undefined) input.resolved = args.resolved;
        if (args.to?.length) input.to = args.to;
        if (args.whisper === true) input.whisper = true;
        if (typeof args.mute === "boolean") input.mute = args.mute;
        if (args.proposal !== undefined) input.proposal = args.proposal;
        if (args.link_comment_ids !== undefined) input.addRefs = args.link_comment_ids;
        const store = remoteStore(args);
        if (store) {
          return remoteBridge(stateRoot(), store, "/agent-update", { method: "POST", body: JSON.stringify(input) }).then(JSON.stringify, remoteFailure);
        }
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
          to: { type: "array", items: { type: "string" }, description: "Agent names that should see this thread; omit for the preview's owner only." },
          as: { type: "string", description: "Your agent name, shown as the sender and used as the reply address." },
          store: { type: "string", description: "Server name (e.g. demo), site directory or store id of the preview that holds the page; defaults to your own standalone server." },
        },
      },
      handler: args => {
        const { store: given, as, ...input } = args;
        if (as) input.from = as;
        input.fromSession = session.sessionId;
        const store = remoteStore({ store: given });
        if (store) return remoteBridge(stateRoot(), store, "/agent-add", { method: "POST", body: JSON.stringify(input) }).then(JSON.stringify, remoteFailure);
        return JSON.stringify(requirePreview().bridge.add(input));
      },
    }, {
      name: "set_doc_review_status",
      description: "Show a short status line in the user's browser (e.g. state 'reading', text 'Reading the methods section'). Use state 'idle' with empty text to clear it.",
      parameters: { type: "object", required: ["state"], properties: { state: { type: "string", description: "idle, reading, thinking, editing, waiting (needs attention) or blocked (stuck, needs help; requires text, stays loud until you set another state)." }, text: { type: "string", description: "Up to 120 characters." }, store: { type: "string", description: "Session id of the preview's owner, if not yours." } } },
      handler: args => {
        const { store: given, ...input } = args;
        const store = remoteStore({ store: given });
        if (store) return remoteBridge(stateRoot(), store, "/agent-status", { method: "POST", body: JSON.stringify(input) }).then(JSON.stringify, remoteFailure);
        return JSON.stringify(requirePreview().bridge.setStatus(input));
      },
    }, {
      name: "declare_doc_review_waiting",
      description: "Say what you are waiting on (a refit job, a question to the user) so ADR stops idle nudges for that long. Call with empty what to clear it. Unanswered nudges otherwise back off from 5 to 60 minutes.",
      parameters: { type: "object", required: ["what"], properties: { what: { type: "string", description: "Up to 120 characters; empty clears." }, minutes: { type: "number", description: "How long; default 60. At most 30 with no pid, run or thread; 1440 with one." }, pid: { type: "integer", description: "A process id on the machine running this ADR server; the wait ends when it exits." }, run: { type: "string", description: "<experiment>/<run> in the catalog; ends when it is done, unknown, or silent for 10 min." }, thread: { type: "string", description: "A thread id; ends when someone else replies there." }, as: { type: "string", description: "Your agent slug if it differs from the session's." }, store: { type: "string", description: "Which `adr` server's site." } } },
      handler: args => {
        const { store: given, as, ...rest } = args;
        const input = { ...rest, ...(as ? { from: as } : {}), fromSession: session.sessionId };
        const store = remoteStore({ store: given });
        if (store) return remoteBridge(stateRoot(), store, "/agent-waiting", { method: "POST", body: JSON.stringify(input) }).then(JSON.stringify, remoteFailure);
        return JSON.stringify(requirePreview().bridge.waiting(input));
      },
    }, ...[
      ["request_doc_review_votes", "request", "Ask agents to price an item in a planning-poker round. Each named voter gets a queue item (and a mesh note) until they vote; you get one item when the last vote is in, or after the deadline an item to close on the votes that came.", { voters: { type: "array", items: { type: "string" }, description: "Agent slugs, 1 to 12." }, items: { type: "array", items: { type: "string" }, description: "More tests to price in the same round; each voter gets one note listing all." }, deadline_minutes: { type: "number", description: "Voting window in minutes; default 5." }, close_to: { type: "string", description: "Who is pinged when the window closes; default site-manager." } }, ["voters"]],
      ["cast_doc_review_vote", "vote", "Cast your effort vote on an item (Fibonacci 1 2 3 5 8 13 21), or add a note after a reveal. Casting removes the item from your queue.", { vote: { type: "number", description: "1, 2, 3, 5, 8, 13 or 21." }, note: { type: "string", description: "A justification instead of a vote (after a reveal)." } }, []],
      ["reveal_doc_review_votes", "reveal", "Close the open round on an item: mean, variance, whether it converged. A converged round sets the weight.", {}, []],
    ].map(([name, action, description, extra, required]) => ({
      name, description,
      parameters: { type: "object", required: ["page", "item", ...required], properties: { page: { type: "string", description: "Page path such as /experiments/x." }, item: { type: "string", description: "The test or item id being priced." }, ...extra, as: { type: "string", description: "Your agent slug if it differs from the session's." }, store: { type: "string", description: "Which `adr` server's site." } } },
      handler: args => {
        const { store: given, as, deadline_minutes: deadlineMinutes, close_to: closeTo, ...rest } = args;
        const input = { ...rest, action: rest.note !== undefined && action === "vote" ? "note" : action, ...(deadlineMinutes ? { deadlineMinutes } : {}), ...(closeTo ? { closeTo } : {}), ...(as ? { from: as } : {}), fromSession: session.sessionId };
        const store = remoteStore({ store: given });
        if (store) return remoteBridge(stateRoot(), store, "/agent-vote", { method: "POST", body: JSON.stringify(input) }).then(JSON.stringify, remoteFailure);
        return requirePreview().bridge.vote(input).then(JSON.stringify);
      },
    })), {
      name: "stop_doc_review",
      description: "Stop this session's document preview. Saved feedback remains on disk.",
      parameters: { type: "object", properties: {} },
      handler: async () => { await stop(); return "Document preview stopped; saved feedback retained."; },
    }].map(tool => ({
      ...tool,
      // The host shows a thrown error only as "Tool execution failed"; hand a bad store back as text.
      handler: args => {
        const text = error => { if (error?.storeError) return `Error: ${error.message}`; throw error; };
        try { const result = tool.handler(args); return result?.then ? result.then(undefined, text) : result; } catch (error) { return text(error); }
      },
    })),
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
