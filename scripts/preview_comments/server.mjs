import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import {
  appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync,
  readFileSync, realpathSync, unlinkSync, writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

function append(file, record) {
  const fd = openSync(file, "a", 0o600);
  try {
    appendFileSync(fd, JSON.stringify(record) + "\n");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function reply(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

function field(value, name, limit) {
  if (typeof value !== "string" || !value.trim() || Buffer.byteLength(value) > limit) {
    throw new Error(`${name} must contain 1–${limit} UTF-8 bytes.`);
  }
  return value.trim();
}

const COLORS = ["yellow", "green", "blue", "pink", "red"];

function identifier(value, name) {
  const id = field(value, name, 36);
  if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) throw new Error(`Invalid ${name}.`);
  return id;
}

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_ID = /^[\da-f]{64}$/;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

class CommentConflict extends Error {}

export async function startCommentBridge({
  sessionId, documentRoot, previewOrigin, storageRoot, notify, onError,
}) {
  const root = realpathSync(documentRoot);
  const directory = join(storageRoot, sessionId);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const attachments = join(directory, "attachments");
  mkdirSync(attachments, { recursive: true, mode: 0o700 });
  const imageFile = id => join(attachments, id + ".png");
  const log = join(directory, "comments.jsonl");
  const connectionFile = join(directory, "connection.json");
  const records = existsSync(log)
    ? readFileSync(log, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line))
    : [];
  const comments = new Map();
  const updates = new Map();
  const settingsFile = join(directory, "settings.json");
  let settings = { owner: "owner", team: [], default: "owner", last: [] };
  try { settings = { ...settings, ...JSON.parse(readFileSync(settingsFile, "utf8")) }; } catch { /* first run: defaults */ }
  const NAME = /^[\w.-]{1,40}$/;
  const names = (value, label) => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.length > 12 || !value.every(name => typeof name === "string" && NAME.test(name))) {
      throw new Error(`${label} must list at most 12 short names.`);
    }
    return [...new Set(value)];
  };
  const addressed = (comment, name) => comment.to?.length ? comment.to.includes(name) : name === settings.owner;
  const readBy = (comment, name) => name === settings.owner ? comment.seen : Boolean(comment.readBy?.[name]);
  let revision = 0;
  let latestFeedbackId;
  let seenInit = false;
  let agentStatus = { state: "idle", text: "" };
  function apply(record) {
    if (record.event === "comment") {
      const quiet = Boolean(record.highlight || record.note || record.author === "copilot");
      comments.set(record.id, { ...record, seen: quiet, wake: !quiet, readBy: {}, resolved: false, replies: [] });
      if (!quiet) latestFeedbackId = record.id;
    }
    else if (record.event === "queued") {
      const comment = comments.get(record.id);
      if (!comment) throw new Error(`Receipt has no comment: ${record.id}`);
      comment.queued = true;
    } else if (record.event === "seen") {
      for (const id of record.ids) {
        const comment = comments.get(id);
        if (!comment) throw new Error(`Read receipt has no comment: ${id}`);
        if (record.by && record.by !== settings.owner) comment.readBy[record.by] = true;
        else comment.seen = true;
      }
    } else if (record.event === "userseen") {
      // The user has read up to this reply (or "root" for an agent-started thread); shared by every browser.
      for (const [id, key] of Object.entries(record.seen)) if (comments.has(id)) comments.get(id).userSeen = key;
      seenInit = true;
    } else if (record.event === "update") {
      const comment = comments.get(record.commentId);
      if (!comment) throw new Error(`Update has no comment: ${record.commentId}`);
      updates.set(record.id, record);
      comment.updatedAt = record.at;
      if (record.reply !== undefined) {
        comment.replies.push({
          id: record.id, at: record.at, author: record.author, comment: record.reply,
          ...(record.note ? { note: true } : {}),
          ...(record.proposal ? { proposal: record.proposal } : {}),
        });
      }
      let wake = (record.reply !== undefined && !record.note) || record.resolved !== undefined;
      if (record.promote) { comment.note = false; wake = true; }
      if (record.editComment !== undefined) {
        comment.comment = record.editComment;
        comment.commentEdited = true;
        wake ||= !comment.note;
      }
      if (record.editReply) {
        const target = comment.replies.find(item => item.id === record.editReply.id);
        if (target) {
          target.comment = record.editReply.text;
          target.edited = true;
          wake ||= !target.note && !comment.note;
        }
      }
      if (record.addImages) {
        comment.images = [...new Set([...(comment.images || []), ...record.addImages])];
        wake = true;
      }
      if (record.addRefs) comment.refs = [...new Set([...(comment.refs || []), ...record.addRefs])];
      if (record.removeRefs) comment.refs = (comment.refs || []).filter(id => !record.removeRefs.includes(id));
      if (record.removeReply) comment.replies = comment.replies.filter(item => item.id !== record.removeReply);
      if (record.resolved !== undefined) {
        if (record.resolved && !comment.resolved) comment.resolvedAt = record.at;
        comment.resolved = record.resolved;
      }
      if (record.to) comment.to = record.to;
      if (record.color !== undefined) comment.color = record.color;
      if (record.removed !== undefined) comment.removed = record.removed;
      if (record.clear) Object.assign(comment, { comment: "", note: false, highlight: true, replies: [], resolved: false, seen: true });
      if (record.author === "user" && wake) {
        comment.seen = false;
        comment.wake = true;
        comment.readBy = {};
        latestFeedbackId = record.id;
      }
    } else throw new Error(`Unknown comment-log event: ${record.event}`);
    revision++;
  }
  for (const record of records) apply(record);
  const token = randomUUID();

  function imageIds(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > MAX_IMAGES) throw new Error(`images must list at most ${MAX_IMAGES} attachments.`);
    return [...new Set(value.map(id => {
      if (typeof id !== "string" || !IMAGE_ID.test(id) || !existsSync(imageFile(id))) throw new Error("Unknown image attachment.");
      return id;
    }))];
  }
  function saveImage(bytes) {
    if (bytes.length < PNG.length || !bytes.subarray(0, PNG.length).equals(PNG)) throw new Error("Attachments must be PNG images.");
    const id = createHash("sha256").update(bytes).digest("hex");
    if (!existsSync(imageFile(id))) writeFileSync(imageFile(id), bytes, { mode: 0o600 });
    return id;
  }
  const withFiles = comment => comment.images?.length
    ? { ...comment, imageFiles: comment.images.map(imageFile) } : comment;

  function unread(as = settings.owner) {
    return [...comments.values()].filter(comment => comment.wake && addressed(comment, as) && !readBy(comment, as));
  }

  function normalize(input) {
    if (input.sessionId !== sessionId) throw new Error("The receiving session changed. Reload before sending.");
    const id = identifier(input.id, "Comment ID");
    if (updates.has(id)) throw new CommentConflict("This ID already identifies a thread update.");
    const url = new URL(field(input.url, "Page URL", 2048));
    if (url.origin !== previewOrigin) throw new Error("The page is not the configured preview.");
    const pathname = decodeURIComponent(url.pathname).replace(/\.html$/, "");
    const stem = resolve(root, "." + pathname);
    const source = realpathSync(pathname.endsWith("/") ? join(stem, "index.md") : stem + ".md");
    const within = relative(root, source);
    if (isAbsolute(within) || within === ".." || within.startsWith(".." + sep)) {
      throw new Error("The document is outside the preview root.");
    }
    if (!["text", "equation", "figure", "node", "edge", "page", "session"].includes(input.kind)) throw new Error("Invalid comment target.");
    const images = imageIds(input.images);
    return {
      id, url: url.href, source,
      section: field(input.section, "Section", 512),
      anchor: typeof input.anchor === "string" ? input.anchor.slice(0, 256) : "",
      kind: input.kind,
      quote: field(input.quote, "Selected content", 4096),
      comment: input.highlight === true && !input.comment ? "" : field(input.comment, "Comment", 8192),
      ...(input.highlight === true ? { highlight: true } : {}),
      ...(input.note === true && input.highlight !== true ? { note: true } : {}),
      color: COLORS.includes(input.color) ? input.color : "yellow",
      ...(images.length ? { images } : {}),
      ...(names(input.to, "to")?.length ? { to: names(input.to, "to") } : {}),
    };
  }

  function normalizeUpdate(input, author) {
    if (!["user", "copilot"].includes(author)) throw new Error("Invalid reply author.");
    if (author === "user" && input.sessionId !== sessionId) {
      throw new Error("The receiving session changed. Reload before sending.");
    }
    const value = {
      id: identifier(input.id, "Update ID"),
      commentId: identifier(input.commentId, "Comment ID"), author,
    };
    if (comments.has(value.id)) throw new CommentConflict("This update ID already identifies a comment.");
    if (!comments.has(value.commentId)) throw new Error("The comment does not exist in this session.");
    if (Object.hasOwn(input, "reply")) value.reply = field(input.reply, "Reply", 8192);
    if (Object.hasOwn(input, "resolved")) {
      if (typeof input.resolved !== "boolean") throw new Error("Resolved must be a boolean.");
      value.resolved = input.resolved;
    }
    if (author === "user" && names(input.to, "to")?.length) value.to = names(input.to, "to");
    if (author === "user" && COLORS.includes(input.color)) value.color = input.color;
    if (author === "user" && input.clear === true) value.clear = true;
    if (author === "user" && input.note === true && value.reply !== undefined) value.note = true;
    if (author === "user" && input.promote === true) value.promote = true;
    if (author === "user" && Object.hasOwn(input, "editComment")) value.editComment = field(input.editComment, "Comment", 8192);
    if (author === "user" && input.editReply) {
      value.editReply = { id: identifier(input.editReply.id, "Reply ID"), text: field(input.editReply.text, "Reply", 8192) };
    }
    if (author === "user" && input.addImages !== undefined) {
      const ids = imageIds(input.addImages);
      if (ids.length) value.addImages = ids;
    }
    for (const [key, name] of [["addRefs", "addRefs"], ["removeRefs", "removeRefs"]]) {
      if (input[key] === undefined) continue;
      if (!Array.isArray(input[key]) || input[key].length > 20) throw new Error(`${name} must list at most 20 comment IDs.`);
      const ids = [...new Set(input[key].map(id => identifier(id, "Linked comment ID")))];
      if (name === "addRefs" && ids.some(id => id === value.commentId || !comments.has(id))) throw new Error("Linked comments must be other threads in this session.");
      if (ids.length) value[name] = ids;
    }
    if (author === "copilot" && input.proposal && typeof input.proposal === "object") {
      value.proposal = { before: String(input.proposal.before ?? "").slice(0, 8000), after: String(input.proposal.after ?? "").slice(0, 8000) };
      value.reply ??= "Proposed edit:";
    }
    if (author === "user" && input.removeReply) value.removeReply = identifier(input.removeReply, "Reply ID");
    if (author === "user" && typeof input.removed === "boolean") value.removed = input.removed;
    if (value.reply === undefined && value.resolved === undefined && value.color === undefined && value.removed === undefined && !value.clear &&
        !value.promote && value.editComment === undefined && !value.editReply && !value.removeReply &&
        !value.to && !value.addImages && !value.addRefs && !value.removeRefs) {
      throw new Error("An update needs a reply, resolved state, colour, image, link, edit or removal.");
    }
    const previous = updates.get(value.id);
    if (previous && JSON.stringify(previous.input) !== JSON.stringify(value)) {
      throw new CommentConflict("This update ID already has different content.");
    }
    return value;
  }

  function saveUpdate(input) {
    if (!updates.has(input.id)) {
      const record = { ...input, input, event: "update", at: new Date().toISOString() };
      append(log, record);
      apply(record);
    }
    return {
      id: input.id, commentId: input.commentId, saved: true, revision,
      resolved: comments.get(input.commentId).resolved,
    };
  }

  function readAs(as, includeSeen = false) {
    const rows = unread(as);
    const result = (includeSeen ? [...comments.values()].filter(comment => addressed(comment, as)) : rows).map(withFiles);
    if (rows.length) {
      const receipt = { event: "seen", ids: rows.map(comment => comment.id), by: as, at: new Date().toISOString() };
      append(log, receipt);
      apply(receipt);
    }
    return result;
  }

  const server = createServer(async (request, response) => {
    let saved = false;
    try {
      if (request.headers.authorization !== `Bearer ${token}`) {
        return reply(response, 403, { error: "Unauthorized comment bridge request." });
      }
      if (request.method === "GET" && request.url === "/status") {
        return reply(response, 200, { sessionId, pendingCount: unread().length, agent: agentStatus });
      }
      if (request.method === "GET" && request.url === "/history") {
        return reply(response, 200, { sessionId, revision, seenInit, comments: [...comments.values()] });
      }
      if (request.method === "GET" && request.url === "/settings") return reply(response, 200, settings);
      const readRoute = request.method === "GET" && /^\/read\?(.*)$/.exec(request.url);
      if (readRoute) {
        const query = new URLSearchParams(readRoute[1]);
        const as = query.get("as") || settings.owner;
        if (!NAME.test(as)) return reply(response, 400, { error: "Invalid agent name." });
        return reply(response, 200, { sessionId, comments: readAs(as, query.get("includeSeen") === "1") });
      }
      const download = request.method === "GET" && /^\/attachments\/([\da-f]{64})$/.exec(request.url);
      if (download) {
        if (!existsSync(imageFile(download[1]))) return reply(response, 404, { error: "Unknown image attachment." });
        response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "private, max-age=31536000, immutable" });
        return response.end(readFileSync(imageFile(download[1])));
      }
      if (request.method !== "POST" || !["/comments", "/updates", "/attachments", "/userseen", "/settings", "/agent-update"].includes(request.url)) {
        return reply(response, 404, { error: "Unknown comment endpoint." });
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > (request.url === "/attachments" ? MAX_IMAGE_BYTES : 24_576)) {
          return reply(response, 413, { error: "Comment request is too large." });
        }
        chunks.push(chunk);
      }
      if (request.url === "/attachments") {
        try {
          return reply(response, 200, { id: saveImage(Buffer.concat(chunks)) });
        } catch (error) {
          return reply(response, 400, { error: error.message });
        }
      }
      if (request.url === "/settings" || request.url === "/agent-update") {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (request.url === "/agent-update") return reply(response, 200, saveUpdate(normalizeUpdate(body, "copilot")));
          const next = { ...settings };
          if (body.owner !== undefined) {
            if (typeof body.owner !== "string" || !NAME.test(body.owner)) throw new Error("Owner must be a short name.");
            next.owner = body.owner;
          }
          if (body.team !== undefined) next.team = names(body.team, "team");
          if (body.last !== undefined) next.last = names(body.last, "last");
          if (body.default !== undefined) {
            if (!["owner", "last"].includes(body.default)) throw new Error("Default must be owner or last.");
            next.default = body.default;
          }
          settings = next;
          writeFileSync(settingsFile, JSON.stringify(settings), { mode: 0o600 });
          revision++;
          return reply(response, 200, settings);
        } catch (error) {
          return reply(response, 400, { error: error.message });
        }
      }
      if (request.url === "/userseen") {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const entries = Object.entries(body.seen || {}).slice(0, 200).map(([id, key]) => [identifier(id, "Comment ID"), field(key, "Reply ID", 36)]);
          if (entries.length || !seenInit) {
            const record = { event: "userseen", seen: Object.fromEntries(entries), at: new Date().toISOString() };
            append(log, record);
            apply(record);
          }
          return reply(response, 200, { saved: true, seenInit });
        } catch (error) {
          return reply(response, 400, { error: error.message });
        }
      }
      let input;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        input = request.url === "/updates" ? normalizeUpdate(body, "user") : normalize(body);
      } catch (error) {
        return reply(response, error instanceof CommentConflict ? 409 : 400, { error: error.message });
      }
      if (request.url === "/updates") {
        const result = saveUpdate(input);
        saved = true;
        await notify();
        return reply(response, 200, { ...result, awaitingReview: !comments.get(input.commentId).seen });
      }
      let comment = comments.get(input.id);
      if (comment) {
        if (JSON.stringify(comment.input) !== JSON.stringify(input)) {
          return reply(response, 409, { error: "This comment ID already has different content." });
        }
      } else {
        comment = {
          ...input, input, event: "comment", at: new Date().toISOString(), seen: false,
          sourceHash: createHash("sha256").update(readFileSync(input.source)).digest("hex"),
        };
        append(log, comment);
        apply(comment);
        comment = comments.get(comment.id);
      }
      saved = true;
      await notify();
      reply(response, 200, { id: comment.id, saved: true, awaitingReview: !comment.seen });
    } catch (error) {
      await onError(error);
      reply(response, 503, { saved, error: error.message });
    }
  });
  await new Promise((accept, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", accept);
  });
  writeFileSync(connectionFile, JSON.stringify({
    port: server.address().port, token, sessionId, previewOrigin,
  }), { mode: 0o600 });
  return {
    connectionFile,
    list: () => [...comments.values()].map(withFiles),
    // Agent-authored thread: quiet (the agent already knows), red by default, shown in the browser.
    add: input => {
      const value = normalize({
        ...input, sessionId, id: randomUUID(), color: input.color || "red", section: input.section || input.page,
        url: new URL(field(input.page, "Page", 2048), previewOrigin).href,
      });
      const proposal = input.proposal && typeof input.proposal === "object"
        ? { before: String(input.proposal.before ?? "").slice(0, 8000), after: String(input.proposal.after ?? "").slice(0, 8000) } : undefined;
      const refs = Array.isArray(input.refs) ? [...new Set(input.refs.filter(id => comments.has(id)))].slice(0, 20) : [];
      const record = {
        ...value, ...(proposal ? { proposal } : {}), ...(refs.length ? { refs } : {}), input: value, event: "comment", author: "copilot", at: new Date().toISOString(), seen: true,
        sourceHash: createHash("sha256").update(readFileSync(value.source)).digest("hex"),
      };
      append(log, record);
      apply(record);
      return { id: record.id, saved: true, url: record.url };
    },
    setStatus: ({ state = "working", text = "" }) => {
      agentStatus = { state: String(state).slice(0, 24), text: String(text).slice(0, 120), at: new Date().toISOString() };
      return { saved: true };
    },
    update: (input, author = "copilot") => saveUpdate(normalizeUpdate(input, author)),
    pending: (as) => {
      const rows = unread(as);
      return { count: rows.length, latestId: rows.length ? latestFeedbackId : undefined };
    },
    read: ({ includeSeen = false, as = settings.owner } = {}) => readAs(as, includeSeen),
    close: async () => {
      unlinkSync(connectionFile);
      await new Promise((accept, reject) => server.close(error => error ? reject(error) : accept()));
    },
  };
}
