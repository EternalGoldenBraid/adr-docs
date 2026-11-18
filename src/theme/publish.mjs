// Published-site build badge and table editing. build.json (src/build-info.mjs) names the repository; without it (preview, exports,
// local builds) nothing happens. Without a token the badge only shows the live commit and detects newer deploys. With a fine-grained
// token (Contents: write, Actions: read, pasted once and kept in this browser) {editable} cells can be edited, queued, and published as
// one commit to the branch, with the build followed as Saved, Building, Deploying, Live or Failed.
import { cellOf, setCell } from "../table-cells.mjs";

const TOKEN = "adr-publish-token", QUEUE = "adr-publish-queue";
const time = iso => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const decode = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), ch => ch.charCodeAt(0)));
const encode = text => btoa(Array.from(new TextEncoder().encode(text), byte => String.fromCharCode(byte)).join(""));

export function installPublishing() {
  const base = import.meta.env.BASE_URL;
  fetch(`${base}build.json`, { cache: "no-store" }).then(res => (res.ok ? res.json() : null)).catch(() => null)
    .then(info => { if (info?.repo) start(info, base); });
}

function start(info, base) {
  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const state = { token: localStorage.getItem(TOKEN) || "", queue: read(QUEUE), stage: "", link: "", newer: false, open: false, error: "" };
  const save = () => (state.queue ? localStorage.setItem(QUEUE, JSON.stringify(state.queue)) : localStorage.removeItem(QUEUE));

  const api = async (path, options = {}) => {
    const res = await fetch(`${info.api}${path}`, { ...options, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${state.token}`, ...(options.body ? { "Content-Type": "application/json" } : {}) } });
    if (res.status === 401 || res.status === 403) throw new Error("GitHub rejected the token (expired, or missing Contents: write / Actions: read).");
    if (!res.ok) throw Object.assign(new Error(`GitHub answered ${res.status}.`), { status: res.status });
    return res.json();
  };

  const style = document.createElement("style");
  style.textContent = `#adr-pub{position:fixed;left:12px;bottom:12px;z-index:900;font:12px/1.4 system-ui,sans-serif;color:#e6edf3}
#adr-pub button.pill{background:#161b22;color:inherit;border:1px solid #30363d;border-radius:14px;padding:3px 10px;cursor:pointer;font:inherit}
#adr-pub .panel{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:10px;margin-bottom:6px;width:300px;display:grid;gap:6px}
#adr-pub .panel button,#adr-pub .panel input{font:inherit;padding:4px 8px;border-radius:5px;border:1px solid #30363d;background:#0d1117;color:inherit}
#adr-pub .panel button.go{background:#238636;border-color:#2ea043}#adr-pub .bad{color:#ff7b72}#adr-pub .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
td.adr-edit-cell{cursor:cell;border-bottom:1px dotted #8b949e}td.adr-unsaved{background:#9e6a0333}td.adr-editing{padding:0!important}
td.adr-editing input{width:100%;box-sizing:border-box;font:inherit;color:inherit;background:#0d1117;border:2px solid #388bfd;padding:6px 10px;margin:0}@media print{#adr-pub{display:none}}`;
  document.head.append(style);
  const box = document.createElement("div");
  box.id = "adr-pub";
  document.body.append(box);

  const status = () => {
    if (state.stage) return { text: state.stage, color: /Failed|rejected/.test(state.stage) ? "#ff7b72" : /Live$/.test(state.stage) ? "#3fb950" : "#d29922" };
    if (state.newer) return { text: "New version live, reload", color: "#d29922" };
    return { text: `Live ${info.sha ? info.sha.slice(0, 7) : ""} · ${time(info.builtAt)}`, color: "#3fb950" };
  };

  const render = () => {
    const edits = state.queue?.edits.length || 0;
    const { text, color } = status();
    box.replaceChildren();
    if (state.open) {
      const panel = Object.assign(document.createElement("div"), { className: "panel" });
      const add = (tag, props, ...kids) => { const el = Object.assign(document.createElement(tag), props); el.append(...kids); panel.append(el); return el; };
      if (state.error) add("div", { className: "bad", textContent: state.error });
      if (!state.token) {
        add("div", { textContent: "Editing and live build status need a fine-grained token for this repository (Contents: write, Actions: read). It stays in this browser only." });
        const input = add("input", { type: "password", placeholder: "Paste token" });
        add("button", { textContent: "Save token", onclick: () => { if (input.value.trim()) { state.token = input.value.trim(); localStorage.setItem(TOKEN, state.token); state.error = ""; poll(); render(); } } });
      } else {
        add("div", { textContent: edits ? `${edits} unpublished edit${edits > 1 ? "s" : ""} on ${state.queue.path}` : "Double-click a marked table cell to edit it." });
        if (edits) {
          add("button", { className: "go", textContent: "Publish", onclick: publish });
          add("button", { textContent: "Discard edits", onclick: () => { state.queue = null; save(); location.reload(); } });
        }
        add("button", { textContent: "Forget token", onclick: () => { state.token = ""; localStorage.removeItem(TOKEN); render(); } });
      }
      if (state.link) add("a", { href: state.link, target: "_blank", rel: "noopener", textContent: "Open the build" });
      box.append(panel);
    }
    const pill = Object.assign(document.createElement("button"), { className: "pill", onclick: () => { state.open = !state.open; render(); } });
    pill.append(Object.assign(document.createElement("span"), { className: "dot", style: `background:${color}` }), edits ? `${text} · ${edits} unpublished` : text);
    box.append(pill);
  };

  // A watched run is the build of the commit just published; otherwise it is the branch's latest run, shown only while running or failed.
  const step = async (run, mine) => {
    state.link = run.html_url;
    if (run.status === "completed") {
      const ok = run.conclusion === "success";
      state.stage = ok ? (mine ? "Live" : "") : `Failed (${run.conclusion})`;
      if (ok && run.head_sha !== info.sha) state.newer = true;
      return true;
    }
    const jobs = await api(`/repos/${info.repo}/actions/runs/${run.id}/jobs`).catch(() => ({ jobs: [] }));
    state.stage = jobs.jobs.some(job => /deploy/i.test(job.name) && job.status === "in_progress") ? "Deploying…" : "Building…";
    return false;
  };

  let timer = null, watched = null, since = 0;
  const poll = async () => {
    clearTimeout(timer);
    if (!state.token) return;
    let again = 60000;
    try {
      const runs = await api(`/repos/${info.repo}/actions/runs?branch=${encodeURIComponent(info.branch)}&per_page=5`);
      const run = watched ? runs.workflow_runs.find(item => item.head_sha === watched) : runs.workflow_runs[0];
      if (run) { const done = await step(run, Boolean(watched)); again = done ? 0 : 6000; if (done) watched = null; }
      else if (watched && Date.now() - since > 90000) { state.stage = "Saved, but no build started"; watched = null; again = 0; }
      else if (watched) { state.stage = "Saved, waiting for the build…"; again = 4000; }
    } catch (error) { state.error = error.message; again = 0; }
    render();
    if (again) timer = setTimeout(poll, again);
  };

  const publish = async () => {
    const { path, sha, text, edits } = state.queue;
    state.error = "";
    try {
      const body = { message: `Edit table cells on ${path}\n\n${edits.map(edit => `- table ${edit.table + 1}, row ${edit.row + 1}, column ${edit.col + 1}: ${edit.value.slice(0, 60)}`).join("\n")}`, content: encode(text), sha, branch: info.branch };
      const out = await api(`/repos/${info.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, { method: "PUT", body: JSON.stringify(body) });
      watched = out.commit.sha; since = Date.now(); state.stage = "Saved"; state.queue = null; save();
      render(); poll();
    } catch (error) {
      state.error = error.status === 409 || error.status === 422 ? "The file changed on the branch since you started. Discard your edits, reload and edit again." : error.message;
      render();
    }
  };

  // Source file for a page: /a/b.html -> a/b.md, /a/ -> a/index.md (the first candidate the repository has).
  const sourcePath = async () => {
    const page = decodeURIComponent(location.pathname).slice(base.length).replace(/\.html$/, "");
    const stem = page === "" || page.endsWith("/") ? `${page}index` : page;
    const dir = info.src ? `${info.src}/` : "";
    for (const name of new Set([`${dir}${stem}.md`, `${dir}${stem}/index.md`])) {
      try { return { path: name, file: await api(`/repos/${info.repo}/contents/${name.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(info.branch)}`) }; } catch (error) { if (error.status !== 404) throw error; }
    }
    throw new Error("Could not find this page's source file in the repository.");
  };

  const mark = () => document.querySelectorAll("tr[data-adr-edit]:not([data-adr-marked])").forEach(row => {
    row.dataset.adrMarked = "1";
    row.dataset.adrCols.split(",").filter(Boolean).forEach(col => row.cells[Number(col)]?.classList.add("adr-edit-cell"));
  });
  new MutationObserver(mark).observe(document.body, { childList: true, subtree: true });
  mark();

  document.addEventListener("dblclick", async event => {
    const cell = event.target.closest?.("td.adr-edit-cell");
    if (!cell || cell.classList.contains("adr-editing")) return;
    if (!state.token) { state.open = true; state.error = "Add a token to edit."; return render(); }
    const row = cell.parentElement;
    const where = { table: Number(row.dataset.adrEdit), row: Number(row.dataset.adrRow), col: cell.cellIndex };
    try {
      const here = await sourcePath();
      if (!state.queue) state.queue = { path: here.path, sha: here.file.sha, text: decode(here.file.content), edits: [] };
      else if (here.path !== state.queue.path) { state.open = true; state.error = `Publish or discard the edits on ${state.queue.path} first.`; return render(); }
      const raw = cellOf(state.queue.text, where.table, where.row, where.col);
      const shown = [...cell.childNodes];
      const input = Object.assign(document.createElement("input"), { value: raw });
      cell.classList.add("adr-editing");
      cell.replaceChildren(input);
      input.focus();
      let done = false;
      const close = () => { done = true; cell.classList.remove("adr-editing"); cell.replaceChildren(...shown); };
      input.addEventListener("keydown", key => {
        key.stopPropagation();
        if (key.key === "Escape") close();
        if (key.key !== "Enter" || done) return;
        try {
          state.queue.text = setCell(state.queue.text, where.table, where.row, where.col, input.value);
          state.queue.edits.push({ ...where, value: input.value.trim() });
          save(); done = true; cell.classList.remove("adr-editing"); cell.classList.add("adr-unsaved"); cell.textContent = input.value; state.error = ""; render();
        } catch (error) { state.error = error.message; state.open = true; render(); }
      });
      input.addEventListener("blur", () => { if (!done) close(); });
    } catch (error) { state.error = error.message; state.open = true; render(); }
  });

  // Without a token, a newer deploy is noticed from build.json.
  setInterval(() => {
    if (state.token) return;
    fetch(`${base}build.json`, { cache: "no-store" }).then(res => res.json()).then(now => { if (now.sha && now.sha !== info.sha) { state.newer = true; render(); } }).catch(() => {});
  }, 60000);

  render();
  poll();
}
