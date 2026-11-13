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
          update_id: { type: "string", description: "Optional UUID reused when retrying the same update." },
        },
      },
      handler: args => {
        const input = { id: args.update_id ?? randomUUID(), commentId: args.comment_id };
        if (args.reply !== undefined) input.reply = args.reply;
        if (args.resolved !== undefined) input.resolved = args.resolved;
        return JSON.stringify(bridge.update(input));
      },
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
