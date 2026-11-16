(() => {
  if (document.getElementById("preview-comment-overlay")) return;
  if (!window.__adrKeymap?.page) {
    const bar = document.createElement("div");
    bar.textContent = "Agent Doc Review: this preview server is older than its client. Reload extensions and restart the preview.";
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:8px 14px;background:#b62324;color:#fff;font:14px system-ui";
    document.body.append(bar);
    return;
  }
  const host = document.createElement("div");
  host.id = "preview-comment-overlay";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host{position:fixed;right:24px;bottom:24px;z-index:10000;color:#eee;font:14px/1.5 system-ui}
      *{box-sizing:border-box}button,textarea{font:inherit}
      button{border:1px solid #59616d;border-radius:8px;padding:8px 14px;cursor:pointer;background:#292d35;color:#eee}
      button:hover{background:#363e4b}button:focus-visible,textarea:focus-visible{outline:2px solid #74c0fc;outline-offset:3px}textarea[data-vmode=normal]{border-color:#ffb02e;caret-color:transparent}textarea[data-vmode=visual]{border-color:#b197fc;caret-color:transparent}textarea[data-vmode=normal]::selection,textarea[data-vmode=visual]::selection{background:#ffb02e88}
      button:disabled{opacity:.6;cursor:wait}button.primary{background:#164a75;border-color:#74c0fc}
      [hidden]{display:none!important}.panel{width:min(var(--pw,540px),calc(100vw - 48px));padding:20px;background:#1b1d22;border:1px solid #59616d;border-radius:12px;box-shadow:0 12px 40px #0008;margin-bottom:12px}
      h2{font-size:17px;margin:0 0 4px}small{color:#b7c1ce}.quote{margin:12px 0;padding:10px;border-left:3px solid #74c0fc;background:#252a32;max-height:120px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
      label{display:block;margin:12px 0 6px}textarea{width:100%;min-height:110px;max-height:240px;resize:vertical;padding:10px;background:#111318;color:#eee;border:1px solid #59616d;border-radius:6px}
      .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.status{max-width:390px;margin:8px 0;padding:10px 12px;border:1px solid #59616d;border-radius:8px;background:#1b1d22;white-space:pre-wrap}.status:empty{display:none}.error{color:#ffb4a9}
      .hint{margin:10px 0 0;color:#b7c1ce}
      .proposal{margin:10px 0;border:1px solid #59616d;border-radius:8px;padding:8px}.proposal pre{margin:0 0 6px;padding:6px;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.4 ui-monospace,monospace;border-radius:4px}.proposal .del{background:#4a1d24}.proposal .add{background:#16402a}
      .banners[hidden]{display:none}.banners{position:fixed;top:72px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;z-index:5}.banner{max-width:min(640px,90vw);padding:8px 14px;border:1px solid #ff5a4f;border-radius:10px;background:#2a1517;color:#eee;text-align:left}.banner small{color:#ffb3ae;display:block}
      .statusbar{position:fixed;left:0;right:0;bottom:0;display:flex;gap:18px;align-items:center;padding:3px 14px;background:#111318;border-top:1px solid #3a404a;font:12px/1.4 ui-monospace,monospace;color:#b7c1ce;pointer-events:none}.sb-mode{font-weight:700;color:#74c0fc}.sb-hint{order:3;margin-left:auto}.sb-stale{color:#e3b341;font-weight:700;white-space:nowrap}.sb-mode{white-space:nowrap}.agent-status::before{content:"● ";color:#51cf66}.agent-status.await::before{color:#ff6b6b}.agent-status.blocked{color:#fff;background:#d6336c;font-weight:700;padding:0 8px;border-radius:3px}.agent-status.blocked::before{content:"⛔ "}.dot.blocked{background:#f03e3e;animation:adrblink 1s infinite}@keyframes adrblink{50%{opacity:.3}}
      .grep{position:fixed;left:50%;bottom:44px;transform:translateX(-50%);width:min(860px,94vw);max-height:50vh;display:flex;flex-direction:column;background:#17191f;border:1px solid #59616d;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.5);font:13px/1.4 ui-monospace,monospace;color:#d6dbe3;z-index:5}
      .grep header{padding:6px 12px;border-bottom:1px solid #2f343d;color:#9aa4b2}.grep .grep-list{overflow:auto;padding:4px}
      .grep-hit{display:block;width:100%;text-align:left;background:none;border:0;border-radius:6px;color:inherit;font:inherit;padding:3px 8px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .grep-hit:focus,.grep-hit:hover{background:#2a3140;outline:0}.grep-hit b{color:#74c0fc;font-weight:600}.grep-hit i{color:#8b949e;font-style:normal}.grep-hit mark{background:rgba(255,208,0,.35);color:inherit}
      .cmdbar{position:fixed;left:0;right:0;bottom:0;display:flex;gap:6px;padding:6px 14px;background:#111318;border-top:1px solid #59616d;font:14px/1.4 ui-monospace,monospace}.cmdbar input{flex:1;background:none;border:0;color:#eee;font:inherit;outline:0}
      .contextual{position:fixed}
      .panel.contextual-panel{position:fixed;margin:0;max-height:calc(100vh - 140px);overflow:auto}
      .vim-caret{position:fixed;width:2px;background:#74c0fc;pointer-events:none}
      .toolbar{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:calc(100vw - 48px)}
      .history{width:min(var(--pw,720px),calc(100vw - 48px));max-height:min(var(--ph,100vh),calc(100vh - 120px));overflow:auto}
      .history-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
      select{font:inherit;padding:6px;background:#292d35;color:#eee;border:1px solid #59616d;border-radius:6px}
      .history{padding:0}.history>*{margin-left:20px;margin-right:20px}
      .history-head{margin:0!important;padding:14px 20px 8px;position:sticky;top:0;background:#1b1d22;z-index:2}
      .thread{margin:0!important}.thread>*{margin-left:20px;margin-right:20px}
      .history-head h2{margin:0}.history-head .history-counts{margin-left:auto;margin-right:12px}
      .icon{padding:2px 9px;border-radius:6px;line-height:1.4}
      .help-panel{width:min(640px,94vw)}.help-tabs,.help-tabs-look{display:flex;gap:6px;margin:8px 0;flex-wrap:wrap}.help-tabs button,.help-tabs-look button{background:#2a2e36;color:inherit;border:1px solid #59616d;border-radius:6px;padding:3px 10px;cursor:pointer}.help-tabs button[aria-selected=true],.help-tabs-look button[aria-selected=true]{background:#3b4a63;border-color:#8ab4f8}.help-body{white-space:pre-wrap;font:13px/1.5 ui-monospace,monospace;margin:0;max-height:50vh;overflow:auto}
      .mesh-panel{width:min(640px,94vw)}.mesh-panel.peek{position:fixed;left:auto;top:auto;right:12px;bottom:52px;margin:0;max-height:70vh;overflow:auto;opacity:.97}.mesh-corner{position:fixed;right:0;bottom:130px;padding:10px 3px;z-index:2147483000;background:#1b1d22cc;color:#aab;border:1px solid #3a404a;border-right:0;border-radius:8px 0 0 8px;font:11px/1 ui-monospace,monospace;writing-mode:vertical-rl;cursor:pointer;opacity:.55}.mesh-corner:hover{opacity:1}.mesh-table td:nth-child(2){white-space:nowrap}.mesh-tabs{margin:0 8px}.mesh-graph[hidden]{display:none}.mesh-graph{width:100%;height:auto;display:block}.mesh-graph text{fill:#d7dde6;font:11px ui-monospace,monospace;text-anchor:middle}.mesh-edges{font-size:12px;color:#aab;margin-top:8px}.mesh-table{width:100%;border-collapse:collapse;font-size:13px}.mesh-table th,.mesh-table td{text-align:left;padding:4px 8px;border-bottom:1px solid #3a404a}
      .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:#59616d}.dot.active{background:#51cf66}.dot.idle{background:#fcc419}
      .tabs{display:flex;gap:2px;margin-top:4px!important;margin-bottom:6px!important;border-bottom:1px solid #3a404a}
      .tab{border:0;border-bottom:2px solid transparent;border-radius:0;background:none;padding:6px 10px;color:#b7c1ce}
      .tab[aria-selected=true]{color:#fff;border-bottom-color:#74c0fc}
      .thread-list{padding-bottom:12px}.thread-list:empty{display:none}
      .thread-card{display:block;width:100%;text-align:left;margin:3px 0;padding:7px 10px;border-radius:6px;border:1px solid transparent;background:#22262d;border-left:4px solid #444c56}
      .thread-card:focus-visible{outline:0;border-color:#74c0fc;background:#2a3140}
      .thread-card .row-top{display:flex;gap:8px;align-items:baseline}.thread-card .row-top strong{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .badge{font-size:11px;color:#b7c1ce;white-space:nowrap}
      .thread-card.unread{border-left-color:#e3b341;background:rgba(227,179,65,.12)}
      .thread-card.waiting{border-left-color:#f85149;background:rgba(248,81,73,.14)}
      .thread-card.open{border-left-color:#58a6ff}
      .thread-card.done{opacity:.55}
      .thread-card:focus-visible.unread,.thread-card:focus-visible.waiting{border-color:#74c0fc}
      .thread-card small{display:block}.preview{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;color:#c9d1d9}
      .thread-head{display:flex;gap:8px;align-items:center;margin:0 0 8px!important;padding:10px 20px;position:sticky;top:44px;background:#1b1d22;z-index:1;border-bottom:1px solid #3a404a}
      .thread-title{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .thread-head a{white-space:nowrap}.thread-head button{padding:4px 10px}
      .thread-state{display:block;width:max-content;margin:2px 20px 8px;padding:1px 10px;border-radius:999px;background:#2a2f38;color:#b7c1ce;font-size:12px}.thread-state.resolved{color:#a2d8b1}
      .thread-links{display:flex;flex-wrap:wrap;gap:6px;margin:4px 20px 8px}
      .chip{padding:2px 10px;border-radius:999px;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .chip-x{margin-left:-6px;padding:2px 7px}
      .thread-links select{width:auto;max-width:180px;border-radius:999px;padding:2px 8px;font-size:12px}
      details.quote-box{margin-bottom:8px}details.quote-box summary{cursor:pointer;color:#b7c1ce;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .reply-form{position:sticky;bottom:0;margin:0!important;padding:10px 20px 14px;background:#1b1d22;border-top:1px solid #3a404a}
      .reply-form textarea{min-height:56px}.reply-form .actions{margin-top:8px}
      .thread-messages{padding-bottom:6px}
      .note{margin:8px 0;padding:8px 12px;background:#252a32;border-radius:10px}.note.copilot{background:#1e2a3a;margin-right:36px}.note.mine{margin-left:36px}
      .note .tools{opacity:0;transition:opacity .1s}.note:hover .tools,.note:focus-within .tools{opacity:1}
      .note p{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}.note .speak{background:none;border:0;padding:0 2px;cursor:pointer;opacity:.5;font-size:12px}.note .speak:hover{opacity:1}.reader{display:flex;align-items:center;gap:6px;max-width:390px;margin:8px 0;padding:6px 10px;border:1px solid #74c0fc;border-radius:8px;background:#1b1d22}.reader[hidden]{display:none}.reader button{background:#2a2f38;border:1px solid #3a404a;border-radius:6px;color:inherit;padding:2px 8px;cursor:pointer}.reader button:focus-visible{outline:2px solid #74c0fc}.reader .reader-pos{margin-left:auto;font-size:12px;opacity:.8}.reply-target{display:flex;gap:8px;align-items:baseline;margin:0 0 6px;padding:4px 8px;border-left:3px solid #74c0fc;background:#23272e;font-size:12px}.reply-target[hidden]{display:none}.reply-target span{flex:1;overflow-wrap:anywhere}.reply-target button,.note .quote-ref{background:none;border:0;color:inherit;cursor:pointer;padding:0}.note .quote-ref{display:block;text-align:left;margin-top:6px;padding:2px 8px;border-left:3px solid #74c0fc;opacity:.8;font-size:12px;overflow-wrap:anywhere}.note .quote-ref:hover{opacity:1}.note a{color:#74c0fc}.note p img{display:block;max-width:100%;border-radius:6px;margin:6px 0}.note code{background:#2a2f38;padding:0 4px;border-radius:3px;font:12px ui-monospace,monospace}
      a{color:#74c0fc}
      .contextual{display:flex;gap:6px;align-items:center;padding:6px;background:#1b1d22;border:1px solid #59616d;border-radius:10px;box-shadow:0 8px 24px #0008}
      .contextual button{padding:5px 10px;border-radius:7px}
      .swatch{width:22px;height:22px;padding:0!important;border-radius:50%!important;border:2px solid #0006!important}
      .c-yellow{background:#ffd000!important}.c-green{background:#58c97a!important}.c-blue{background:#5aa9ff!important}.c-pink{background:#ff7eb6!important}.c-red{background:#ff5a4f!important}
      .swatch.on{outline:2px solid #fff;outline-offset:1px}
      .pill{display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;opacity:.75}
      .pill:hover,.pill[aria-expanded=true]{opacity:1}
      .dot{width:9px;height:9px;border-radius:50%;background:#58c97a}.dot.waiting{background:#ffb02e}
      .toolbar[hidden]{display:none!important}.toolbar{margin-bottom:8px}
      .dock{display:flex;flex-direction:column;align-items:flex-end;transform-origin:bottom right;transform:translate(var(--dx,0px),var(--dy,0px)) scale(var(--ds,1))}
      .rail{position:fixed;top:0;right:0;width:0;height:100vh;pointer-events:none}
      .bubble{position:fixed;transform:scale(var(--s,1));transform-origin:center;width:24px;height:24px;padding:0;border-radius:50%;pointer-events:auto;border:2px solid #0006;font-size:11px;line-height:1;opacity:.8}
      .tick{position:fixed;right:0;width:12px;height:5px;padding:0;border-radius:2px;border:1px solid #0008;pointer-events:auto;cursor:pointer;opacity:.95}.tick:hover{width:18px}
      .bubble:hover{opacity:1}.bubble.fresh{box-shadow:0 0 0 3px #fff8}
      .bubble.resolved{opacity:.35}
      .bubble.fresh::after,.pill.alert::before{content:"";position:absolute;top:-5px;right:-5px;width:10px;height:10px;border-radius:50%;background:#ff5a4f;border:2px solid #1b1d22;animation:ping 1.6s ease-out infinite}
      .pill{position:relative}.pill.alert{border-color:#ff5a4f}.pill.alert::before{top:-4px;right:-2px}
      @keyframes ping{0%{box-shadow:0 0 0 0 #ff5a4faa}100%{box-shadow:0 0 0 9px #ff5a4f00}}
      .note{position:relative}.thread-messages>*:focus-visible{outline:2px solid #74c0fc;outline-offset:1px}.note .tools{display:flex;gap:6px;position:absolute;top:4px;right:8px;margin:0}.note .tools button{padding:2px 8px;font-size:12px}
      .note.private{border-left:3px solid #ffb02e}.note textarea{width:100%;box-sizing:border-box;min-height:54px}
      .shots{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.shots:empty{display:none}
      .shot{position:relative}.shot img{display:block;max-width:120px;max-height:90px;border:1px solid #59616d;border-radius:6px}
      .shot button{position:absolute;top:2px;right:2px;padding:0 6px;border-radius:50%;font-size:12px;line-height:18px}
      .thumbs{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.thumbs img{display:block;max-width:100%;max-height:200px;border:1px solid #59616d;border-radius:6px;cursor:zoom-in;background:#fff}
      .to{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px;align-items:center;margin:6px 0}.to small{opacity:.7;grid-column:1/-1}.to button{padding:1px 9px;border:1px solid #59616d;border-radius:999px;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer;opacity:.7}.to button.on{opacity:1;border-color:#74c0fc;background:rgba(116,192,252,.18)}
      .region{position:fixed;inset:0;cursor:crosshair;background:rgba(0,0,0,.3);touch-action:none;user-select:none}
      .region-box{position:fixed;border:2px dashed #74c0fc;background:rgba(116,192,252,.15);pointer-events:none}
      .region-tip{position:fixed;top:12px;left:50%;transform:translateX(-50%);padding:6px 12px;border-radius:999px;background:#1b1d22;border:1px solid #59616d;pointer-events:none}
    </style>
    <section class="panel" hidden aria-labelledby="comment-title">
      <h2 id="comment-title">Comment to Copilot</h2><small class="receiver"></small><div class="to to-new" hidden></div>
      <div class="quote"></div>
      <form><label for="comment-body">Your comment</label>
      <textarea id="comment-body" required maxlength="4000"></textarea>
      <div class="shots"></div>
      <div class="actions"><button type="button" class="attach-region" title="Attach a screenshot of a region (s)">Region</button><button type="button" class="cancel">Cancel</button><button type="button" class="note-save">Save as note</button><button class="primary" type="submit">Send</button></div></form>
    </section>
    <section class="panel history" hidden aria-labelledby="history-title">
      <div class="history-head"><h2 id="history-title">Comment history</h2><small class="history-counts"></small>
      <button class="history-team" type="button" title="Team status (:mesh)">Team</button>
      <button class="history-refresh icon" type="button" title="Refresh">↻</button>
      <button class="history-close icon" type="button" title="Close (Esc)" aria-label="Close">✕</button></div>
      <div class="tabs" role="tablist"></div>
      <div class="thread-list" role="listbox"></div>
      <section class="thread" hidden>
        <div class="thread-head"><button class="thread-back icon" type="button" title="Back (h)">‹</button>
        <span class="thread-title"></span>
        <a class="thread-source" title="Open page (o)">↗ page</a>
        <button class="thread-resolve" type="button" title="Resolve / reopen (r)">Resolve</button></div>
        <div class="thread-state"></div>
        <details class="quote-box"><summary class="quote-summary">Selected content</summary><div class="quote thread-quote"></div></details>
        <div class="thread-links"></div>
        <div class="thread-messages"></div>
        <form class="reply-form"><div class="reply-target" hidden><span></span><button type="button" title="Drop (Esc in the field, or click)">✕</button></div><div class="to to-reply" hidden></div><textarea id="thread-reply" aria-label="Your reply" placeholder="Reply (i to focus · Ctrl+Enter sends · Esc/jk normal mode, again leaves)" required maxlength="4000"></textarea>
        <div class="actions"><button class="thread-region" type="button" title="Attach a screenshot of a region (s)">Region</button>
        <button class="thread-branch" type="button" title="Start a linked child thread from the selected text or focused message (n)">↳ New thread</button>
        <button class="primary reply-send" type="submit">Reply</button></div></form>
      </section>
    </section>
    <section class="panel mesh-panel" hidden aria-label="Team status">
      <div class="history-head"><h2>Team</h2><span class="mesh-tabs help-tabs-look"><button type="button" data-tab="table">Table</button><button type="button" data-tab="graph">Graph</button></span><small class="mesh-note"></small><button class="mesh-close icon" type="button" aria-label="Close">✕</button></div>
      <table class="mesh-table"><thead><tr><th>Who</th><th>Status</th><th>Doing</th><th>Machine</th></tr></thead><tbody></tbody></table><svg class="mesh-graph" viewBox="0 0 600 320" hidden></svg><div class="mesh-edges"></div>
    </section>
    <section class="panel help-panel" hidden aria-label="Help">
      <div class="history-head"><h2>Help</h2><small>[ ] or h/l switch tab · Esc closes</small><button class="help-close icon" type="button" aria-label="Close">✕</button></div>
      <div class="help-tabs" role="tablist"></div><pre class="help-body"></pre>
    </section>
    <div class="reader" hidden><button type="button" data-act="prev" title="Previous (<)">⏮</button><button type="button" data-act="pause" title="Pause / resume (p)">⏯</button><button type="button" data-act="next" title="Next (>)">⏭</button><button type="button" data-act="stop" title="Stop (Esc)">⏹</button><span class="reader-pos"></span></div><div class="status" role="status" aria-live="polite"></div>
    <div class="region" hidden><div class="region-box" hidden></div><div class="region-tip">Drag to select a region · Esc cancels</div></div>
    <div class="vim-caret" hidden aria-hidden="true"></div>
    <div class="banners"></div><div class="statusbar" hidden><span class="sb-mode"></span><span class="sb-hint"></span><span class="sb-stale" hidden></span><span class="agent-status" hidden></span></div>
    <section class="grep" hidden aria-label="Search results"><header></header><div class="grep-list"></div></section>
    <form class="cmdbar" hidden><span>:</span><input class="cmdinput" autocomplete="off" spellcheck="false" aria-label="Command"></form>
    <div class="contextual" hidden><button class="ctx-comment" type="button">Comment</button><span class="swatches" style="display:flex;gap:5px"></span></div><div class="rail"></div>
    <div class="dock"><div class="toolbar" hidden>
    <button class="vim-mode" type="button" title="h/j/k/l: move · v: select · c: comment (page if nothing selected) · -m: session chat · s: region screenshot · -h: history · Esc: normal">Vim</button>
    <button class="history-toggle" type="button">History</button>
    <button class="export-page" type="button" title="Download this page as a file that opens offline (:export)">Export</button>
    <button class="figure-save" type="button" title="Save a graph, SVG, image or canvas as a large figure file (:figure)">Figure</button>
    <button class="toggle" type="button">Comment</button></div>
    <button class="pill" type="button" aria-expanded="false"><span class="dot"></span><span class="pill-label">Comments</span></button></div>`;
  document.body.append(host);
  const pagePath = url => new URL(url).pathname.replace(/\.html$/, "").replace(/\/index$/, "/");
  const find = selector => shadow.querySelector(selector);
  const panel = find(".panel");
  const textarea = find("textarea");
  const toggle = find(".toggle");
  const status = find(".status");
  const contextual = find(".contextual");
  let offeredTarget;
  let offeredAnchor;
  let targetAnchor;
  let target;
  let selecting = false;
  let draftId;
  let noteRequested = false;
  let submittedText;
  let sessionId;
  let statusTimer;
  const history = find(".history");
  const replyInput = find("#thread-reply");
  const replyDrafts = new Map();
  let historyComments = [];
  let historyRevision = -1;
  let serverSeenInit = false;
  let selectedThread;
  let historyFilter = "page";
  let tabChord;
  let pendingFocus;
  const FILTERS = [["page", "This page"], ["pagehist", "Page history"], ["chat", "Chat"], ["unresolved", "Open"], ["all", "All"], ["resolved", "Resolved"], ["notes", "Notes"]];
  // Highlights and notes carry no resolve state and stay out of triage.
  const isNote = comment => Boolean(comment.note || comment.highlight && !comment.comment);
  let historyTimer;
  let historySaving = false;
  const vimButton = find(".vim-mode");
  const caret = find(".vim-caret");
  let vimEnabled = localStorage.getItem("preview-comments-vim") !== "off";
  const KM = window.__adrKeymap;
  const keyIs = (event, spec) => {
    const m = /^((?:[ACS]-)*)(.+)$/.exec(spec || "");
    if (!m) return false;
    const mods = m[1];
    return event.key === m[2] && event.altKey === mods.includes("A-") && event.ctrlKey === mods.includes("C-");
  };
  // Alt+hjkl resizes the open panel; sizes persist across reloads.
  const sizes = JSON.parse(localStorage.getItem("preview-comments-size") || "{}");
  const applySizes = () => {
    if (sizes.w) document.documentElement.style.setProperty("--pw", sizes.w + "px");
    if (sizes.h) document.documentElement.style.setProperty("--ph", sizes.h + "px");
  };
  applySizes();
  function resizeKey(event) {
    const r = KM.resize, step = r.step;
    const open = [panel, history, pop].find(node => node && !node.hidden);
    const change = keyIs(event, r.wider) ? ["w", step] : keyIs(event, r.narrower) ? ["w", -step]
      : keyIs(event, r.taller) ? ["h", step] : keyIs(event, r.shorter) ? ["h", -step] : null;
    if (!open || !change) return false;
    const [axis, delta] = change;
    const now = axis === "w" ? open.offsetWidth * uiScale() : open.offsetHeight * uiScale();
    sizes[axis] = Math.round(Math.max(axis === "w" ? 320 : 160, Math.min(axis === "w" ? innerWidth - 48 : innerHeight - 80, (sizes[axis] || now) + delta)));
    localStorage.setItem("preview-comments-size", JSON.stringify(sizes));
    applySizes();
    return true;
  }
  let visual = false;
  // Normal mode scrolls the page smoothly; `i` (or `v`) enters caret mode where motions move the caret.
  let caretMode = false;
  let scrollDir = 0, scrollFrame, scrollLast;
  function scrollTick(now) {
    scrollBy(0, scrollDir * 1.4 * Math.min(now - scrollLast, 50));
    scrollLast = now;
    scrollFrame = scrollDir ? requestAnimationFrame(scrollTick) : undefined;
  }
  function holdScroll(dir) {
    scrollDir = dir;
    if (!dir || scrollFrame) return;
    scrollLast = performance.now();
    scrollFrame = requestAnimationFrame(scrollTick);
  }
  addEventListener("keyup", event => { if (scrollDir && (event.key === "j" || event.key === "k")) holdScroll(0); });
  addEventListener("blur", () => holdScroll(0));
  let prefix;
  let prefixTimer;
  let externalMode; // set by pages that run their own modal keys (e.g. the graph)
  document.addEventListener("preview-comment-mode", event => { externalMode = event.detail?.mode; modeLabel(); });

  function modeLabel() {
    const mode = !vimEnabled ? "OFF" : !history.hidden ? "HISTORY" : !panel.hidden ? "COMMENT" : externalMode || (visual ? "VISUAL" : caretMode ? "CARET" : "NORMAL");
    vimButton.textContent = "Vim";
    const bar = find(".statusbar");
    bar.hidden = !vimEnabled && !find(".agent-status")?.classList.contains("blocked");
    find(".sb-hint").textContent = !history.hidden ? (selectedThread
      ? "j/k scroll messages · J/K next/prev thread · q reply to message · p read · r resolve · i reply · o page · h back · Esc"
      : "j/k move · l open · o go to page · r resolve · [ ] tabs · A all P page O open · PA page history · Esc") : visual ? "c comment · Esc cancel · hjkl extend" : caretMode ? `hjklwb move caret · ${KM.page.visual} select · V paragraph · ${KM.page.comment} comment · Esc scroll mode` : `j/k scroll · i caret · ${KM.page.visual} select text · ${KM.page.comment} comment · ${KM.leader}${KM.leaderKeys.history} threads · ] next awaiting · : commands · :help`;
    find(".sb-mode").textContent = `-- ${mode}${prefix ? " " + prefix : ""} --`;
    vimButton.setAttribute("aria-pressed", String(vimEnabled));
  }
  const cmdbar = find(".cmdbar"), cmdinput = find(".cmdinput");
  const helpTabs = () => [
    ["Page", [
      `j/k scroll smoothly · i caret mode (h/j/k/l/w/b/0/$ move, Esc leaves)`,
      `${KM.page.visual} select · V paragraph · ${KM.page.comment} comment (page if nothing selected)`,
      `] / [ next / previous thread awaiting you (across pages)`,
      `${KM.page.region} region screenshot · ${KM.leader}${KM.leaderKeys.history} history · ${KM.leader}${KM.leaderKeys.chat} session chat`,
      `${KM.resize.narrower}/${KM.resize.wider}/${KM.resize.shorter}/${KM.resize.taller} resize panel · t page tree`,
    ]],
    ["History", [
      "j/k move · l or Enter open · r resolve · p read aloud · o go to page · g/G ends",
      "Tabs: [ ] switch · A all · P this page · O open · C chat · R resolved · N notes · P then A page history",
      "In a thread: j/k messages · J/K next/previous thread · r resolve · p read aloud (p pause · < > skip) · q reply to a message or selection · u jump to the quoted message · i reply · n new child thread · s attach region · h back",
    ]],
    ["Graph", [
      ":present (or ▶ Present on a graph) shows a DocGraph full screen, one node at a time",
      "→/← or l/h follow the story (solid edges) · ↓/↑ or j/k go into / out of a drill-down (dashed edges) · gg/G first/last · Enter preview link · o open page · Esc exit",
      "`c` comments on the slide in presentation mode. Click a graph to enter it: hjkl pan, + - 0 zoom, v select nodes, i edit, : commands (:present :fit :w :help), Esc back to the page",
    ]],
    ["Text fields", [
      "Esc or jk → normal mode (h j k l w b e 0 ^ $ gg G · x dd D cc cw yy p P u Ctrl-r · i a I A o O · v V then y d c)",
      "Esc or jk again leaves the field",
    ]],
    ["Export", [
      ":export downloads this page for offline use: one .html, or a .zip when videos or large files are included. The Export button does the same.",
      ":export single makes one self-contained .html file (images and videos inlined, so it can be large). Open it directly in a browser; type : and then present for the presenter.",
      ":export compress is :export single with videos re-encoded smaller (lossy, ffmpeg; originals are untouched).",
      "Several pages: open the tree (t), press v for select mode, Space/x ticks a page, X adds descendants, a/A all/none, e exports a .zip with working links between pages.",
      "From a terminal: npm run export -- doc.md --page /p --out deck.html [--single] [--compress] [--zip]",
    ]],
    ["Search & commands", [
      "/ or :grep [-d N] [-u N] [-s] [-p|-c] <regex> searches pages and threads (no flag: all pages; -d 0: this page; -d N: N levels below; -u N: N ancestors; -1 = all)",
      "Commands: :help [section] :man :history :chat :comment :tree :present :export [single|compress] :read [stop] :figure :restart :grep :vim off|on :keys",
      "Keys are configured in ~/.config/agent-doc-review/keymap.json",
    ]],
  ];
  let helpIndex = 0;
  const helpPanel = find(".help-panel");
  function showHelp(index = helpIndex) {
    const tabs = helpTabs();
    helpIndex = (index + tabs.length) % tabs.length;
    find(".help-panel .help-tabs").replaceChildren(...tabs.map(([name], i) => {
      const b = document.createElement("button");
      b.type = "button"; b.role = "tab"; b.textContent = name; b.setAttribute("aria-selected", String(i === helpIndex));
      b.addEventListener("click", () => showHelp(i));
      return b;
    }));
    find(".help-body").textContent = tabs[helpIndex][1].join("\n\n");
    helpPanel.hidden = false;
  }
  find(".help-close").addEventListener("click", () => { helpPanel.hidden = true; });
  document.addEventListener("keydown", event => {
    if (helpPanel.hidden || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const next = ["]", "l", "ArrowRight", "Tab"].includes(event.key), prev = ["[", "h", "ArrowLeft"].includes(event.key);
    if (event.key === "Escape") helpPanel.hidden = true;
    else if (next || prev) showHelp(helpIndex + (next ? 1 : -1));
    else return;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  const commands = {
    help: arg => showHelp(arg ? Math.max(0, helpTabs().findIndex(([name]) => name.toLowerCase().startsWith(arg.toLowerCase()))) : undefined), man: arg => commands.help(arg),
    keys: () => message(JSON.stringify(KM.resize) + "\n" + JSON.stringify(KM.leaderKeys)),
    history: () => openHistory(), chat: () => open(sessionTarget()),
    comment: () => commentSelection(),
    present: () => document.dispatchEvent(new CustomEvent("adr-present")),
    tree: () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "t", bubbles: true })),
    settings: () => loadSettings().then(() => message(`owner: ${settings.owner}\nteam: ${settings.team.join(", ") || "(none)"}\ndefault recipients: ${settings.default}\n:owner NAME · :team A B C · :default owner|last`)),
    mesh: () => openMesh(),
    read: arg => {
      if (arg === "stop") { stopReading(); return message("Stopped reading"); }
      const thread = currentThread();
      const threads = thread ? [thread] : [...find(".thread-list").children].map(card => historyComments.find(c => c.id === card.dataset.commentId)).filter(Boolean);
      if (!threads.length) return message("Open history (-h) or a thread first, then :read.", true);
      readThreads(threads);
    },
    owner: name => name ? api("settings", { owner: name }).then(v => { settings = v; message("Owner: " + name); }).catch(e => message(e.message, true)) : message("Usage: :owner NAME (this preview's agent)", true),
    team: (_first, line = "") => api("settings", { team: line.trim().split(/[\s,]+/).filter(Boolean) }).then(v => { settings = v; message("Team: " + (v.team.join(", ") || "(none)")); }).catch(e => message(e.message, true)),
    default: arg => ["owner", "last"].includes(arg) ? api("settings", { default: arg }).then(v => { settings = v; message("Default recipients: " + arg); }).catch(e => message(e.message, true)) : message("Usage: :default owner|last", true),
    vim: arg => { if ((arg === "off") === vimEnabled) vimButton.click(); },
  };
  let exporting = false;
  // pages: site paths to export; default is the current page. Polls the server job and shows a progress bar.
  async function exportPage(pages = [pagePath(location.href)], mode = "") {
    if (exporting) return message("An export is already running.", true);
    exporting = true;
    const bar = (done, total) => "█".repeat(Math.round(10 * done / total)).padEnd(10, "░");
    try {
      message(`Exporting ${pages.length} page${pages.length > 1 ? "s" : ""}… starting`);
      const started = await fetch("/__adr/export/start?" + pages.map(page => "page=" + encodeURIComponent(page)).join("&") + (mode === "single" ? "&single=1" : mode === "compress" ? "&compress=1" : ""));
      const { id, error } = await started.json();
      if (!id) throw new Error(error || "could not start");
      for (;;) {
        await new Promise(resolve => setTimeout(resolve, 400));
        const job = await (await fetch(`/__adr/export/status?id=${id}`)).json();
        if (job.error && job.state !== "failed") throw new Error(job.error);
        if (job.state === "failed") throw new Error(job.error);
        if (job.state === "done") {
          const link = document.createElement("a");
          link.href = `/__adr/export/file?id=${id}`;
          link.download = "";
          link.click();
          message(`Export ready ${bar(1, 1)} downloading${job.warnings?.length ? ` (${job.warnings.length} warning${job.warnings.length > 1 ? "s" : ""}: ${job.warnings[0]})` : ""}`);
          return;
        }
        message(`Exporting ${bar(job.done, job.total)} ${job.done}/${job.total} ${job.stage}`);
      }
    } catch (error) {
      message(`Export failed: ${error.message}`, true);
    } finally {
      exporting = false;
    }
  }
  document.addEventListener("adr-export", event => exportPage(event.detail?.pages?.length ? event.detail.pages : undefined));
  // :export (zip or page), :export single (one self-contained HTML file), :export compress (single, videos re-encoded smaller).
  commands.export = arg => {
    if (arg && !["single", "compress"].includes(arg)) return message("Usage: :export [single|compress]", true);
    exportPage(undefined, arg);
  };
  // :figure — click a graph, inline SVG, image or canvas; it downloads at print size (graphs 4x PNG, SVG as SVG).
  let picking = false;
  function saveBlob(blob, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  }
  async function figureBlob(node) {
    let graph = node;
    while (graph && !graph._cyreg?.cy) graph = graph.parentElement;
    if (graph) {
      const dark = document.documentElement.classList.contains("dark");
      if (graph._adrExportPng) return { blob: await graph._adrExportPng(4), ext: "png" };
      return { blob: graph._cyreg.cy.png({ output: "blob", full: true, scale: 4, bg: dark ? "#1b1b1f" : "#ffffff" }), ext: "png" };
    }
    const svg = node.closest("svg");
    if (svg && !svg.closest("mjx-container")) {
      const copy = svg.cloneNode(true);
      const box = svg.getBoundingClientRect();
      copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      if (!copy.getAttribute("viewBox")) copy.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      copy.setAttribute("width", Math.round(box.width * 2));
      copy.setAttribute("height", Math.round(box.height * 2));
      return { blob: new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml" }), ext: "svg" };
    }
    const canvas = node.closest("canvas");
    if (canvas) return { blob: await new Promise(done => canvas.toBlob(done, "image/png")), ext: "png" };
    const image = node.closest("img");
    if (image) {
      const response = await fetch(image.currentSrc || image.src);
      const blob = await response.blob();
      return { blob, ext: (blob.type.split("/")[1] || "png").replace("svg+xml", "svg") };
    }
    return null;
  }
  function stopPicking() { picking = false; find(".figure-save").classList.remove("on"); document.body.style.cursor = ""; }
  async function pickFigure(event) {
    if (host.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    stopPicking();
    try {
      const found = await figureBlob(event.target);
      if (!found) { message("That is not a graph, SVG, image or canvas", true); return; }
      saveBlob(await found.blob, `${pagePath(location.href).replace(/\W+/g, "-").replace(/^-|-$/g, "") || "page"}-figure.${found.ext}`);
      message(`Saved figure (${found.ext})`);
    } catch (error) { message(`Figure failed: ${error.message}`, true); }
  }
  function startFigure() {
    if (picking) { stopPicking(); message(""); return; }
    picking = true;
    find(".figure-save").classList.add("on");
    document.body.style.cursor = "crosshair";
    message("Click a graph, SVG, image or canvas to save it (Esc cancels)");
  }
  document.addEventListener("click", event => { if (picking) pickFigure(event); }, true);
  document.addEventListener("keydown", event => { if (picking && event.key === "Escape") { stopPicking(); message(""); } }, true);
  commands.figure = startFigure;
  // :restart — a server started with `adr` restarts itself; the page reloads once it answers again.
  commands.restart = async () => {
    try { await api("restart", {}); } catch (error) { message(error.message, true); return; }
    message("Restarting server…");
    const began = Date.now();
    let down = false;
    const timer = setInterval(async () => {
      try {
        const alive = (await fetch(location.href, { cache: "no-store" })).ok;
        if (alive && (down || Date.now() - began > 8000)) { clearInterval(timer); location.reload(); }
      } catch { down = true; }
      if (Date.now() - began > 40000) { clearInterval(timer); message("The server did not come back; check adr tui.", true); }
    }, 700);
  };
  find(".figure-save").addEventListener("click", startFigure);
  const grepPanel = find(".grep"), grepList = find(".grep-list");
  const closeGrep = () => { grepPanel.hidden = true; };
  // :grep [-d N] [-u N] [-s] <regex>. No depth flag searches every page; -d N searches this page plus N
  // levels below it (0 = this page only) and -u N adds N ancestors. Smart-case unless -s.
  async function grep(_first, line = "") {
    const words = line.split(/\s+/).filter(Boolean);
    const query = new URLSearchParams();
    let scoped = false, only;
    while (words[0]?.startsWith("-") && words[0].length > 1) {
      const flag = words.shift();
      if (flag === "-s") query.set("case", "1");
      else if (flag === "-p" || flag === "-c") only = flag;
      else if (flag === "-d" || flag === "-u") {
        const n = Number(words.shift());
        if (!Number.isInteger(n) || n < -1) return message(`${flag} needs a whole number ≥ 0, or -1 for all`, true);
        query.set(flag === "-d" ? "down" : "up", String(n));
        scoped = true;
      } else return message(`Unknown flag ${flag} (use -d N, -u N, -s, -p pages only, -c comments only)`, true);
    }
    const pattern = words.join(" ");
    if (!pattern) return message("Usage: :grep [-d N] [-u N] [-s] [-p|-c] <regex>", true);
    query.set("q", pattern);
    if (scoped) query.set("from", pagePath(location.href));
    message(`Searching “${pattern}”…`);
    const response = await fetch("/__adr/search?" + query);
    const result = await response.json();
    if (!response.ok) return message(`Bad pattern: ${result.error}`, true);
    const sensitive = query.get("case") === "1" || /[A-Z]/.test(pattern);
    const regex = new RegExp(pattern, sensitive ? "" : "i");
    const inScope = new Set(result.links);
    const threads = only === "-p" ? [] : historyComments.filter(c => !c.removed &&
      (c.kind === "session" ? !scoped : inScope.has(pagePath(c.url) === "/" ? "/" : pagePath(c.url)))).flatMap(c => {
      const texts = [c.comment, c.quote, ...c.replies.map(r => r.comment)].filter(Boolean);
      const found = texts.map(t => regex.exec(t)).find(Boolean);
      return found ? [{ thread: c, text: texts.find(t => regex.test(t)).replace(/\s+/g, " ").slice(0, 200), match: found[0] }] : [];
    });
    const pageHits = only === "-c" ? [] : result.hits;
    const total = pageHits.length + threads.length;
    message(`${total}${result.truncated ? "+" : ""} match${total === 1 ? "" : "es"} (${pageHits.length} in ${result.pages} page${result.pages === 1 ? "" : "s"}, ${threads.length} in threads)`);
    if (!total) return closeGrep();
    grepPanel.querySelector("header").textContent = `grep ${pattern} · ${total}${result.truncated ? "+ (first 200 page lines)" : ""} match${total === 1 ? "" : "es"} · j/k move · Enter open · Esc close`;
    const row = (label, hit, activate) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "grep-hit";
      const where = document.createElement("b");
      where.textContent = label;
      const text = document.createElement("span");
      const at = hit.text.indexOf(hit.match);
      if (at < 0) text.textContent = " " + hit.text;
      else {
        const mark = document.createElement("mark");
        mark.textContent = hit.match;
        text.append(" " + hit.text.slice(0, at), mark, hit.text.slice(at + hit.match.length));
      }
      button.append(where, text);
      button.addEventListener("click", () => { closeGrep(); activate(); });
      return button;
    };
    grepList.replaceChildren(
      ...pageHits.map(hit => row(`${hit.title}:${hit.line}`, hit, () => {
        sessionStorage.setItem("adr-find", JSON.stringify({ text: hit.match, sensitive }));
        if (pagePath(new URL(hit.link, location.origin)) === pagePath(location.href)) findPending(); else location.assign(hit.link);
      })),
      ...threads.map(hit => row(`💬 ${hit.thread.kind === "session" ? "session" : hit.thread.section || pagePath(hit.thread.url)}${hit.thread.resolved ? " ✓" : ""}`, hit, () => goToThread(hit.thread))));
    grepPanel.hidden = false;
    grepList.firstElementChild.focus();
  }
  function findPending() {
    const raw = sessionStorage.getItem("adr-find");
    if (!raw) return;
    sessionStorage.removeItem("adr-find");
    const { text, sensitive } = JSON.parse(raw);
    setTimeout(() => { getSelection().removeAllRanges(); window.find(text, sensitive, false, true); }, 400);
  }
  grepPanel.addEventListener("keydown", event => {
    const hits = [...grepList.children], at = hits.indexOf(shadow.activeElement);
    const move = step => hits[Math.max(0, Math.min(hits.length - 1, at + step))]?.focus();
    if (event.key === "Enter") return event.stopPropagation();
    if (event.key === "Escape") closeGrep();
    else if (event.key === "j" || event.key === "ArrowDown") move(1);
    else if (event.key === "k" || event.key === "ArrowUp") move(-1);
    else if (event.key === "g") hits[0]?.focus();
    else if (event.key === "G") hits.at(-1)?.focus();
    else return;
    event.preventDefault();
    event.stopPropagation();
  });
  commands.grep = grep;
  commands.find = grep;
  findPending();
  function openCmdline(initial = "") { cmdbar.hidden = false; cmdinput.value = initial; cmdinput.focus(); }
  function closeCmdline() { cmdbar.hidden = true; cmdinput.blur(); }
  // Tab completes the command name; repeated Tab cycles through the matches (Shift+Tab backwards).
  let completion = null;
  cmdinput.addEventListener("input", () => { completion = null; });
  cmdinput.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeCmdline(); return; }
    if (event.key !== "Tab") return;
    event.preventDefault();
    const typed = cmdinput.value.replace(/^:/, "");
    if (!completion) {
      if (/\s/.test(typed)) return;
      const matches = Object.keys(commands).filter(name => name.startsWith(typed)).sort();
      if (!matches.length) { message(`No command starts with '${typed}'`, true); return; }
      let common = matches[0];
      for (const name of matches) while (!name.startsWith(common)) common = common.slice(0, -1);
      completion = { matches, at: -1 };
      if (matches.length === 1) { cmdinput.value = matches[0] + " "; completion = null; return; }
      message(matches.map(name => ":" + name).join("  "));
      if (common.length > typed.length) { cmdinput.value = common; completion = null; return; }
    }
    const { matches } = completion;
    completion.at = (completion.at + (event.shiftKey ? -1 : 1) + matches.length) % matches.length;
    cmdinput.value = matches[completion.at];
  });
  cmdbar.addEventListener("submit", event => {
    event.preventDefault();
    const [name, ...rest] = cmdinput.value.trim().replace(/^:/, "").split(/\s+/);
    closeCmdline();
    if (!name) return;
    if (commands[name]) commands[name](rest[0], rest.join(" "));
    else message(`Not a command: ${name} (try :help)`, true);
  });
  function clearPrefix() {
    clearTimeout(prefixTimer);
    prefix = undefined;
    modeLabel();
  }
  function textNodes() {
    const doc = document.querySelector(".vp-doc");
    if (!doc) return [];
    const walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.data.trim() || node.parentElement.closest("mjx-assistive-mml, [hidden], [aria-hidden='true']")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if (range.getClientRects().length) nodes.push(node);
    }
    return nodes;
  }
  function edgeRange(last) {
    const nodes = textNodes();
    const node = last ? nodes.at(-1) : nodes[0];
    if (!node) return;
    const range = document.createRange();
    range.setStart(node, last ? node.length : 0);
    range.collapse(true);
    return range;
  }
  function viewportTop() {
    return Math.max(0, ...[...document.querySelectorAll(".VPNav, .VPLocalNav")]
      .map(node => node.getBoundingClientRect().bottom)) + 12;
  }
  function viewRange(last = false) {
    const nodes = textNodes();
    if (last) nodes.reverse();
    const top = viewportTop();
    for (const node of nodes) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()];
      if (last) rects.reverse();
      for (const rect of rects) {
        if (rect.bottom <= top || rect.top >= innerHeight - 24 || !rect.width) continue;
        const x = last ? rect.right - 1 : rect.left + 1;
        const y = Math.max(top, rect.top) + Math.min(8, rect.height / 2);
        const point = document.caretPositionFromPoint?.(x, y);
        const chosen = document.createRange();
        if (point) {
          chosen.setStart(point.offsetNode, point.offset);
          chosen.collapse(true);
        } else {
          const fallback = document.caretRangeFromPoint?.(x, y);
          if (!fallback) continue;
          chosen.setStart(fallback.startContainer, fallback.startOffset);
          chosen.collapse(true);
        }
        if (document.querySelector(".vp-doc").contains(chosen.startContainer)) return chosen;
      }
    }
    return edgeRange(last);
  }
  // Where the reader is most likely looking: the visible text line closest to the viewport's vertical centre.
  function centerRange() {
    const top = viewportTop();
    const middle = (top + innerHeight) / 2;
    let best;
    for (const node of textNodes()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.bottom <= top || rect.top >= innerHeight - 24 || !rect.width) continue;
        const distance = Math.abs((rect.top + rect.bottom) / 2 - middle);
        if (!best || distance < best.distance) best = { distance, rect };
      }
    }
    if (!best) return viewRange();
    const { rect } = best;
    const x = rect.left + Math.min(rect.width / 2, 200);
    const y = (rect.top + rect.bottom) / 2;
    const point = document.caretPositionFromPoint?.(x, y);
    const fallback = point ? null : document.caretRangeFromPoint?.(x, y);
    const node = point?.offsetNode ?? fallback?.startContainer;
    if (!node || !document.querySelector(".vp-doc").contains(node)) return viewRange();
    const chosen = document.createRange();
    chosen.setStart(node, point?.offset ?? fallback.startOffset);
    chosen.collapse(true);
    return chosen;
  }
  function cursorInView() {
    const selected = getSelection();
    if (!document.querySelector(".vp-doc").contains(selected.focusNode)) return false;
    const range = document.createRange();
    range.setStart(selected.focusNode, selected.focusOffset);
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    return rect.height > 0 && rect.bottom > viewportTop() && rect.top < innerHeight - 24;
  }
  function showCaret(reveal = false) {
    modeLabel();
    const selected = getSelection();
    const doc = document.querySelector(".vp-doc");
    caret.hidden = !vimEnabled || !caretMode || !panel.hidden || !history.hidden || !doc?.contains(selected?.focusNode);
    if (caret.hidden) return;
    const range = document.createRange();
    range.setStart(selected.focusNode, selected.focusOffset);
    range.collapse(true);
    let rect = range.getBoundingClientRect();
    const top = viewportTop();
    if (reveal) {
      if (rect.top < top) scrollBy(0, rect.top - top);
      else if (rect.bottom > innerHeight - 24) scrollBy(0, rect.bottom - innerHeight + 24);
      rect = range.getBoundingClientRect();
    }
    caret.hidden = !rect.height || rect.bottom <= top || rect.top >= innerHeight - 24;
    caret.style.left = rect.left + "px";
    caret.style.top = rect.top + "px";
    caret.style.height = rect.height + "px";
  }
  function useRange(range) {
    if (!range) { message("No selectable document text is available.", true); return false; }
    const selected = getSelection();
    if (visual && document.querySelector(".vp-doc").contains(selected.anchorNode)) {
      selected.extend(range.startContainer, range.startOffset);
    } else {
      selected.removeAllRanges();
      selected.addRange(range);
    }
    showCaret(true);
    return true;
  }
  function ensureCursor() {
    const doc = document.querySelector(".vp-doc");
    const selected = getSelection();
    return doc.contains(selected.anchorNode) && doc.contains(selected.focusNode) || useRange(viewRange());
  }
  function move(direction, granularity) {
    if (!ensureCursor()) return;
    const selected = getSelection();
    selected.modify(visual ? "extend" : "move", direction, granularity);
    if (!document.querySelector(".vp-doc").contains(selected.focusNode)) {
      useRange(edgeRange(direction === "forward"));
    }
    showCaret(true);
  }
  function commentSelection() {
    const chosen = selection() || (textarea.value.trim() && target) || pageTarget();
    open(chosen);
  }
  const pageTarget = () => ({ kind: "page", quote: document.title, anchor: "", url: location.href, section: "Whole page" });
  const sessionTarget = () => ({ kind: "session", quote: "General message to Copilot", anchor: "", url: location.href, section: "Session chat" });
  vimButton.addEventListener("mousedown", event => event.preventDefault());
  vimButton.addEventListener("click", () => {
    vimEnabled = !vimEnabled;
    visual = false;
    clearPrefix();
    localStorage.setItem("preview-comments-vim", vimEnabled ? "on" : "off");
    document.dispatchEvent(new CustomEvent("preview-comment-vim", { detail: { enabled: vimEnabled } }));
    showCaret();
  });
  document.addEventListener("selectionchange", () => {
    showCaret();
    const chosen = selection();
    if (chosen) offer(chosen, getSelection().getRangeAt(0).cloneRange());
    else if (offeredAnchor instanceof Range) contextual.hidden = true;
  });
  const reposition = () => {
    showCaret();
    if (!contextual.hidden) position(contextual, offeredAnchor);
    if (!panel.hidden && targetAnchor) position(panel, targetAnchor);
  };
  document.addEventListener("scroll", reposition, { passive: true, capture: true });
  addEventListener("resize", reposition);
  modeLabel();

  function message(text, error = false) {
    clearTimeout(statusTimer);
    status.textContent = text;
    status.classList.toggle("error", error);
  }
  let meshTimer, meshPinned = false;
  const ago = at => { const m = Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000)); return m < 1 ? "now" : m < 60 ? `${m}m` : `${Math.round(m / 60)}h`; };
  let meshTab = localStorage.getItem("preview-comments-mesh-tab") || "table";
  // Same indicators as the desktop mesh panel: blue working, pink waiting, yellow asking, green idle, hollow grey ring = active, state unknown.
  const MESH_COLOURS = { working: "#6fb7e8", waiting: "#f38ba8", asking: "#ffd500", idle: "#9ccc65", active: "#9399b2", offline: "#9399b2", human: "#e6edf7" };
  function meshState(m) {
    if (!m.session) return "human";
    if (m.status !== "active" || (m.lastSeen && Date.now() - Date.parse(m.lastSeen) > 30 * 60000)) return "offline";
    if (MESH_COLOURS[m.activity] && !["active", "offline", "human"].includes(m.activity)) return m.activity;
    const line = m.statusLine?.state;
    return line === "running" ? "working" : line === "waiting" || line === "blocked" ? "waiting" : line === "idle" ? "idle" : "active";
  }
  function showMeshTab(tab) {
    meshTab = tab;
    localStorage.setItem("preview-comments-mesh-tab", tab);
    find(".mesh-table").hidden = tab !== "table";
    find(".mesh-graph").toggleAttribute("hidden", tab !== "graph");
    for (const b of find(".mesh-tabs").children) b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  }
  find(".mesh-tabs").addEventListener("click", event => { const t = event.target.dataset?.tab; if (t) showMeshTab(t); });
  function drawMeshGraph(members, edges) {
    const ns = "http://www.w3.org/2000/svg", svg = find(".mesh-graph");
    const mk = (tag, attrs, text) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text) e.textContent = text; return e; };
    const at = new Map(members.map((m, i) => { const a = (i / Math.max(1, members.length)) * 2 * Math.PI - Math.PI / 2; return [m.session || m.slug, { x: 300 + 210 * Math.cos(a), y: 160 + 115 * Math.sin(a) }]; }));
    const out = [];
    for (const e of edges) {
      const a = at.get(e.from), b = at.get(e.to);
      if (a && b) out.push(mk("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "#adb5bd", "stroke-width": Math.min(5, 1 + e.count), "stroke-dasharray": "5 4", opacity: ".6" }));
    }
    for (const m of members) {
      const p = at.get(m.session || m.slug), state = meshState(m);
      const colour = MESH_COLOURS[state], solid = !["active", "offline"].includes(state);
      if (solid && state !== "human") {
        const halo = mk("circle", { cx: p.x, cy: p.y, r: 20, fill: colour, opacity: ".22" });
        const pulse = state === "working" ? ["r", "20;23;20", "2s"] : state === "waiting" || state === "asking" ? ["r", "20;25;20", "1.6s"] : null;
        if (pulse) halo.append(mk("animate", { attributeName: pulse[0], values: pulse[1], dur: pulse[2], repeatCount: "indefinite" }));
        out.push(halo);
      }
      out.push(mk("circle", { cx: p.x, cy: p.y, r: 11, fill: solid ? colour : "none", stroke: solid ? "#1b1d22" : colour, "stroke-width": solid ? 3 : 2, opacity: state === "offline" ? ".4" : "1" }));
      if (state === "working") {
        const arc = mk("path", { d: `M ${p.x + 17} ${p.y} A 17 17 0 0 1 ${p.x + 17 * Math.cos(1.6)} ${p.y + 17 * Math.sin(1.6)}`, fill: "none", stroke: "#e6edf7", "stroke-width": 2.5, "stroke-linecap": "round" });
        arc.append(mk("animateTransform", { attributeName: "transform", type: "rotate", from: `0 ${p.x} ${p.y}`, to: `360 ${p.x} ${p.y}`, dur: "3.1s", repeatCount: "indefinite" }));
        out.push(arc);
      }
      out.push(mk("text", { x: p.x, y: p.y + 26 }, m.name));
      const doing = m.statusLine?.doing || "";
      if (doing) out.push(mk("text", { x: p.x, y: p.y + 38, opacity: ".7" }, doing.length > 30 ? doing.slice(0, 29) + "…" : doing));
    }
    svg.replaceChildren(...out);
  }
  function openMesh(peek = false) {
    showMeshTab(meshTab);
    const panelEl = find(".mesh-panel"), body = find(".mesh-table tbody");
    meshPinned = peek !== true;
    panelEl.classList.add("peek");
    const load = () => api("mesh").then(({ members, edges = [], errors = {} }) => {
      body.replaceChildren(...members.map(m => {
        const row = document.createElement("tr");
        const cell = (text, dot) => { const td = document.createElement("td"); if (dot) { const d = document.createElement("span"); d.className = "dot " + dot; td.append(d); } td.append(text); row.append(td); };
        const l = m.statusLine;
        const st = meshState(m);
        cell(m.name);
        cell(st === "offline" ? m.status : st === "active" ? "active" : st, st);
        const d = row.lastChild.querySelector(".dot");
        if (d) { d.style.background = ["active", "offline"].includes(st) ? "none" : MESH_COLOURS[st]; if (["active", "offline"].includes(st)) d.style.boxShadow = `inset 0 0 0 2px ${MESH_COLOURS[st]}`; if (st === "offline") d.style.opacity = ".4"; }
        cell(l ? `${l.ticket ? l.ticket + " · " : ""}${l.state} · ${l.doing}${l.next ? " → " + l.next : ""} (${ago(l.at)})` : "—");
        cell(m.machine || "—");
        return row;
      }));
      const name = id => members.find(m => m.session === id)?.name ?? id.slice(0, 8);
      drawMeshGraph(members, edges);
      find(".mesh-edges").textContent = edges.length ? "Last hour: " + edges.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6).map(e => `${name(e.from)} → ${name(e.to)} ×${e.count} (${ago(e.at)})`).join(" · ") : "";
      find(".mesh-note").textContent = members.length ? Object.entries(errors).map(([machine, text]) => `${machine}: ${text}`).join(" · ") : "No team page with a Session column found.";
    }).catch(e => message(e.message, true));
    panelEl.hidden = false; load(); clearInterval(meshTimer); meshTimer = setInterval(load, 10000);
  }
  function closeMesh() { find(".mesh-panel").hidden = true; clearInterval(meshTimer); }
  find(".mesh-close").addEventListener("click", closeMesh);
  // Edge tab: hovering the small Team tab on the right edge peeks at the team; it hides again unless opened with -m / :mesh.
  const corner = Object.assign(document.createElement("div"), { className: "mesh-corner", textContent: "Team", title: "Hover to peek at the team; -m pins" });
  find(".mesh-panel").before(corner);
  let peekTimer;
  corner.addEventListener("mouseenter", () => { if (find(".mesh-panel").hidden) { openMesh(true); meshPinned = false; } });
  const leavePeek = () => { clearTimeout(peekTimer); peekTimer = setTimeout(() => { if (!meshPinned) closeMesh(); }, 700); };
  find(".mesh-panel").addEventListener("mouseleave", leavePeek);
  find(".mesh-panel").addEventListener("mouseenter", () => clearTimeout(peekTimer));
  corner.addEventListener("mouseleave", leavePeek);
  find(".history-team").addEventListener("click", () => openMesh());
  let settings = { owner: "owner", team: [], default: "owner", last: [] };
  const loadSettings = () => api("settings").then(value => { settings = value; }).catch(() => {});
  const recipients = () => [...new Set([settings.owner, ...settings.team])];
  const defaultTo = () => settings.default === "last" && settings.last.length ? settings.last : [settings.owner];
  // Chips choose who a message is for. Hidden until a team is configured (:team), so single-agent use is unchanged.
  function chipRow(holder, selected, onChange) {
    holder.hidden = recipients().length < 2;
    if (holder.hidden) return;
    const label = document.createElement("small");
    label.textContent = "To:";
    holder.replaceChildren(label, ...recipients().map(name => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.textContent = name;
      chip.classList.toggle("on", selected.has(name));
      chip.addEventListener("click", () => {
        if (selected.has(name)) selected.delete(name); else selected.add(name);
        if (!selected.size) selected.add(settings.owner);
        onChange?.();
        chipRow(holder, selected, onChange);
        [...holder.querySelectorAll("button")].find(button => button.textContent === name)?.focus();
      });
      return chip;
    }));
  }
  // Recipients form a grid whose width follows the panel, so j/k move between visual rows.
  function chipNeighbour(chips, at, key) {
    if (at < 0) return chips[0];
    if (key === "h" || key === "l") return chips[at + (key === "l" ? 1 : -1)];
    const here = chips[at].getBoundingClientRect();
    const down = key === "j";
    let best = null, bestScore = Infinity;
    for (const chip of chips) {
      const box = chip.getBoundingClientRect();
      const dy = box.top - here.top;
      if (down ? dy < 4 : dy > -4) continue;
      const score = Math.abs(dy) * 1000 + Math.abs(box.left - here.left);
      if (score < bestScore) { best = chip; bestScore = score; }
    }
    return best;
  }
  const toValue = (selected, shown) => shown && recipients().length > 1 ? { to: [...selected] } : {};
  const rememberTo = selected => {
    if (recipients().length > 1) api("settings", { last: [...selected] }).then(value => { settings = value; }).catch(() => {});
  };
  async function api(path, body) {
    const response = await fetch("/__preview_comments/" + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", "X-Preview-Comment": "1" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.saved ? "Saved locally; notification failed. " : "") + result.error);
    return result;
  }
  function currentThread() {
    return historyComments.find(comment => comment.id === selectedThread);
  }
  // Read aloud: each message goes to the local text-to-speech server in short chunks; the next chunk is fetched while one plays.
  let readToken = 0, readAudio = null;
  const speechChunks = text => {
    const plain = text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/[ \t]+/g, " ").trim();
    const out = [];
    for (const paragraph of plain.split(/\n+/)) {
      let chunk = "";
      for (const sentence of paragraph.match(/[^.!?]+[.!?]*\s*/g) || []) {
        if (chunk && (chunk + sentence).length > 280) { out.push(chunk.trim()); chunk = ""; }
        chunk += sentence;
      }
      if (chunk.trim()) out.push(chunk.trim());
    }
    return out;
  };
  const readThreads = threads => readAloud(threads.flatMap(c => [c.comment, ...c.replies.map(r => r.comment)]).filter(Boolean));
  const reader = find(".reader");
  let readState = null;
  const stopReading = () => { readToken++; readAudio?.pause(); readAudio = null; readState = null; reader.hidden = true; };
  const readerPos = () => { find(".reader-pos").textContent = readState ? `${readState.i + 1}/${readState.chunks.length}${readState.paused ? " · paused" : ""}` : ""; };
  // Skip by chunk (delta), or pause/resume (0).
  function readerStep(delta) {
    if (!readState) return false;
    if (!delta) { readState.paused = !readState.paused; if (readState.paused) readAudio?.pause(); else readAudio?.play(); readerPos(); return true; }
    readState.paused = false;
    const target = readState.i + delta;
    if (target < 0 || target >= readState.chunks.length) { if (delta > 0) { stopReading(); message("Done reading"); } return true; }
    readState.jump = target;
    readAudio?.pause();
    readAudio?.dispatchEvent(new Event("ended"));
    return true;
  }
  reader.addEventListener("click", event => {
    const act = event.target.closest("button")?.dataset.act;
    if (act === "stop") { stopReading(); message("Stopped reading"); }
    else if (act) readerStep(act === "prev" ? -1 : act === "next" ? 1 : 0);
  });
  async function readAloud(texts) {
    stopReading();
    const token = readToken, chunks = texts.flatMap(speechChunks);
    if (!chunks.length) return message("Nothing to read.", true);
    const urls = new Map();
    const fetchUrl = i => {
      if (!urls.has(i)) {
        const request = api("tts", { text: chunks[i] })
          .then(result => fetch("/__preview_comments/tts/" + result.id, { headers: { "X-Preview-Comment": "1" } }))
          .then(response => { if (!response.ok) throw new Error("Could not load audio."); return response.blob(); })
          .then(blob => URL.createObjectURL(blob));
        request.catch(() => {});
        urls.set(i, request);
      }
      return urls.get(i);
    };
    const state = readState = { chunks, i: 0, jump: undefined, paused: false };
    reader.hidden = false;
    try {
      while (state.i < chunks.length) {
        readerPos();
        message("Loading speech…");
        const url = await fetchUrl(state.i);
        if (token !== readToken) return;
        if (state.i + 1 < chunks.length) fetchUrl(state.i + 1);
        status.textContent = "";
        const audio = readAudio = new Audio(url);
        readerPos();
        await new Promise((resolve, reject) => { audio.onended = resolve; audio.onerror = () => reject(new Error("Could not play audio.")); audio.play().catch(reject); if (state.paused) audio.pause(); });
        if (token !== readToken) return;
        state.i = state.jump ?? state.i + 1;
        state.jump = undefined;
      }
      stopReading();
      message("Done reading");
    } catch (error) {
      if (token === readToken) { stopReading(); message(error.message, true); }
    }
  }
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && readState) { stopReading(); message("Stopped reading"); }
  }, true);
  // Inline Markdown for messages (bold, italic, code), built from DOM nodes so message text is never parsed as HTML.
  function inlineMarkdown(text) {
    const fragment = document.createDocumentFragment();
    const pattern = /(!?)\[([^\]\n]*)\]\(((?:https?:\/\/|\/(?!\/))[^\s)]+)\)|\*\*([^*\n]+?)\*\*|`([^`\n]+)`|(?<![\w*])\*([^*\s][^*\n]*?)\*(?![\w*])/g;
    let last = 0, match;
    while ((match = pattern.exec(text))) {
      if (match.index > last) fragment.append(text.slice(last, match.index));
      const [, bang, label, href, bold, code, italic] = match;
      if (href && bang) {
        const link = document.createElement("a");
        const img = document.createElement("img");
        img.src = img.alt = ""; img.src = href; img.alt = label; img.loading = "lazy";
        link.href = href; link.target = "_blank"; link.rel = "noopener"; link.append(img);
        fragment.append(link);
        last = pattern.lastIndex;
        continue;
      }
      const el = document.createElement(href ? "a" : bold ? "strong" : code ? "code" : "em");
      el.textContent = label || href || bold || code || italic;
      if (href) { el.href = href; el.target = "_blank"; el.rel = "noopener"; }
      fragment.append(el);
      last = pattern.lastIndex;
    }
    if (last < text.length) fragment.append(text.slice(last));
    return fragment;
  }
  function renderNote(author, text, at, opts = {}) {
    const note = document.createElement("article");
    note.className = `${opts.note ? "note private" : "note"} ${author !== "You" ? "copilot" : "mine"}`;
    if (opts.mid) note.dataset.mid = opts.mid;
    if (opts.from) note.dataset.from = opts.from;
    const label = document.createElement("small");
    label.textContent = `${author}${opts.note ? " · private note" : ""} · ${new Date(at).toLocaleString()}${opts.edited ? " · edited" : ""}`;
    const body = document.createElement("p");
    body.append(inlineMarkdown(text));
    const speak = document.createElement("button");
    speak.type = "button"; speak.className = "speak"; speak.textContent = "🔊"; speak.title = "Read aloud (:read)";
    speak.addEventListener("click", () => readAloud([text]));
    label.append(" ", speak);
    if (opts.ref) {
      const ref = document.createElement("button");
      ref.type = "button"; ref.className = "quote-ref"; ref.title = "Jump to the message (u)";
      ref.textContent = `↩ ${opts.ref.author}: “${opts.ref.quote}”`;
      ref.addEventListener("click", () => {
        const target = find(`.thread-messages [data-mid="${opts.ref.id}"]`);
        if (target) { target.focus(); target.scrollIntoView({ block: "nearest" }); }
      });
      note.append(label, ref, body);
    } else note.append(label, body);
    if (opts.onEdit || opts.onDelete) {
      const tools = document.createElement("div");
      tools.className = "tools";
      const tool = (name, run) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = name;
        button.addEventListener("click", run);
        tools.append(button);
      };
      if (opts.onEdit) tool("Edit", () => {
        const input = document.createElement("textarea");
        input.value = text;
        const save = () => input.value.trim() && input.value !== text ? opts.onEdit(input.value) : cancel();
        const cancel = () => { input.replaceWith(body); tools.hidden = false; };
        input.addEventListener("keydown", event => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); save(); }
          if (event.key === "Escape") { event.stopPropagation(); cancel(); }
        });
        body.replaceWith(input);
        tools.hidden = true;
        const row = document.createElement("div");
        row.className = "tools";
        for (const [name, run] of [["Save", save], ["Cancel", cancel]]) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = name;
          button.addEventListener("click", () => { row.remove(); run(); });
          row.append(button);
        }
        note.append(row);
        input.focus();
      });
      if (opts.onDelete) tool("Delete", opts.onDelete);
      note.append(tools);
    }
    return note;
  }
  const imageUrls = new Map();
  function imageUrl(id) {
    if (!imageUrls.has(id)) {
      imageUrls.set(id, fetch(`/__preview_comments/attachments/${id}`, { headers: { "X-Preview-Comment": "1" } })
        .then(response => response.ok ? response.blob() : Promise.reject(new Error("Image unavailable.")))
        .then(blob => URL.createObjectURL(blob))
        .catch(error => { imageUrls.delete(id); throw error; }));
    }
    return imageUrls.get(id);
  }
  function thumbnails(ids) {
    const row = document.createElement("div");
    row.className = "thumbs";
    for (const id of ids) {
      const image = document.createElement("img");
      image.alt = "Attached region screenshot";
      image.addEventListener("click", () => image.src && open_(image.src));
      imageUrl(id).then(url => { image.src = url; }, () => { image.alt = "Screenshot unavailable"; });
      row.append(image);
    }
    return row;
  }
  const open_ = url => window.open(url, "_blank", "noopener");
  function proposalCard(proposal, comment, from, run) {
    const card = document.createElement("div");
    card.className = "proposal";
    for (const [cls, label, text] of [["del", "−", proposal.before], ["add", "+", proposal.after]]) {
      const pre = document.createElement("pre");
      pre.className = cls;
      pre.textContent = text.split("\n").map(line => `${label} ${line}`).join("\n");
      card.append(pre);
    }
    const verdict = comment.replies.slice(from).find(reply => reply.author !== "copilot" && /^(✓ Accepted|✗ Rejected)/.test(reply.comment));
    const row = document.createElement("div");
    row.className = "actions";
    if (verdict) row.textContent = verdict.comment.split(/[ .—]/).slice(0, 2).join(" ");
    else {
      const accept = document.createElement("button");
      accept.type = "button"; accept.className = "primary"; accept.textContent = "Accept";
      accept.addEventListener("click", () => run({ id: crypto.randomUUID(), reply: "✓ Accepted — please apply this edit." }));
      const reject = document.createElement("button");
      reject.type = "button"; reject.textContent = "Reject";
      reject.addEventListener("click", () => run({ id: crypto.randomUUID(), reply: "✗ Rejected.", resolved: true }));
      row.append(reject, accept);
    }
    card.append(row);
    return card;
  }
  function threadNodes(comment, run) {
    const nodes = [];
    if (comment.comment) {
      nodes.push(renderNote(comment.author === "copilot" ? "Copilot" : "You", comment.comment, comment.at, {
        note: comment.note, edited: comment.commentEdited, mid: comment.id,
        onEdit: text => run({ editComment: text }),
      }));
    }
    if (comment.proposal) nodes.push(proposalCard(comment.proposal, comment, 0, run));
    if (comment.images?.length) nodes.push(thumbnails(comment.images));
    for (const reply of comment.replies) {
      const mine = reply.author !== "copilot";
      const sender = reply.from || "Copilot";
      const target = reply.inReplyTo;
      const targetAuthor = target && (target.id === comment.id ? comment : comment.replies.find(r => r.id === target.id));
      nodes.push(renderNote(mine ? "You" : sender, target ? reply.comment.replace(/^> [^\n]*\n\n/, "") : reply.comment, reply.at, {
        note: reply.note, edited: reply.edited, mid: reply.id, from: reply.from,
        ref: target && { id: target.id, quote: (target.quote || "").slice(0, 140), author: targetAuthor?.author === "copilot" ? targetAuthor.from || "Copilot" : "You" },
        onEdit: mine ? text => run({ editReply: { id: reply.id, text } }) : undefined,
        onDelete: () => run({ removeReply: reply.id }),
      }));
      if (reply.proposal) nodes.push(proposalCard(reply.proposal, comment, comment.replies.indexOf(reply) + 1, run));
    }
    return nodes;
  }
  function renderHistory() {
    if (historyRevision < 0) {
      find(".thread-list").textContent = "Loading comment history...";
      return;
    }
    const threads = historyComments.filter(comment => !comment.removed && !isNote(comment));
    const resolved = threads.filter(comment => comment.resolved).length;
    const noteCount = historyComments.filter(comment => !comment.removed && isNote(comment)).length;
    find(".history-counts").textContent = `${threads.length - resolved} unresolved · ${resolved} resolved · ${noteCount} notes`;
    const list = find(".thread-list");
    const focusedComment = pendingFocus ?? shadow.activeElement?.dataset.commentId;
    pendingFocus = undefined;
    find(".tabs").replaceChildren(...FILTERS.map(([value, label]) => {
      const tab = document.createElement("button");
      tab.type = "button"; tab.className = "tab"; tab.textContent = label; tab.dataset.filter = value;
      tab.setAttribute("role", "tab"); tab.setAttribute("aria-selected", String(value === historyFilter));
      tab.addEventListener("click", () => setFilter(value));
      return tab;
    }));
    list.replaceChildren();
    const filter = historyFilter;
    const rows = [...historyComments].sort((a, b) => new Date(b.updatedAt || b.at) - new Date(a.updatedAt || a.at));
    for (const comment of rows) {
      if (comment.removed) continue;
      // A resolved thread with a reply you have not seen stays listed as open until viewed.
      const closed = comment.resolved && !hasFresh(comment);
      if (filter === "notes" ? !isNote(comment) : isNote(comment) && filter !== "all") continue;
      if (filter !== "notes" && (filter === "chat" ? closed || (comment.kind !== "page" && comment.kind !== "session")
        : filter === "page" ? closed || (comment.kind !== "session" && pagePath(comment.url) !== pagePath(location.href))
        : filter === "pagehist" ? comment.kind === "session" || pagePath(comment.url) !== pagePath(location.href)
        : filter === "unresolved" ? closed
        : filter === "resolved" ? !comment.resolved : false)) continue;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "thread-card";
      card.dataset.commentId = comment.id;
      card.classList.add(comment.resolved && !hasFresh(comment) ? "done" : awaiting(comment) ? "waiting" : comment.seen || comment.note ? "open" : "unread");
      const top = document.createElement("div");
      top.className = "row-top";
      const section = document.createElement("strong");
      section.textContent = comment.section;
      const badge = document.createElement("span");
      badge.className = "badge";
      const links = (comment.refs?.length || 0) + historyComments.filter(c => !c.removed && c.refs?.includes(comment.id)).length;
      badge.textContent = [comment.resolved ? (hasFresh(comment) ? "resolved · new reply" : "resolved") : awaiting(comment) ? "awaiting you" : comment.seen || comment.note ? "" : "unread",
        comment.replies.length ? `💬${comment.replies.length}` : "", links ? `🔗${links}` : "",
        comment.kind !== "session" && pagePath(comment.url) !== pagePath(location.href) ? pagePath(comment.url) : ""].filter(Boolean).join(" · ");
      top.append(section, badge);
      const text = document.createElement("div");
      text.className = "preview";
      text.textContent = comment.comment || "Highlight";
      card.append(top, text);
      card.addEventListener("click", () => selectThread(comment.id));
      list.append(card);
    }
    if (!list.children.length) list.textContent = "No comments match this filter.";
    const comment = currentThread();
    find(".thread").hidden = !comment;
    list.hidden = Boolean(comment);
    if (!comment && focusedComment) {
      [...list.children].find(card => card.dataset.commentId === focusedComment)?.focus();
    }
    modeLabel();
    if (!comment) return;
    find(".thread-title").textContent = comment.section;
    find(".thread-source").href = here(comment.url);
    if (find(".thread-quote").textContent !== comment.quote) find(".thread-quote").textContent = comment.quote;
    const state = find(".thread-state");
    state.textContent = `${isNote(comment) ? "Note" : comment.resolved ? "Resolved" : "Unresolved"} · ${comment.note ? "Private note" : comment.seen ? "Read by Copilot" : "Unread by Copilot"}`;
    const quoteLine = (comment.quote || "").replace(/\s+/g, " ");
    find(".quote-summary").textContent = quoteLine ? `“${quoteLine.slice(0, 90)}${quoteLine.length > 90 ? "…" : ""}”` : "Selected content";
    state.classList.toggle("resolved", comment.resolved);
    find(".thread-resolve").textContent = isNote(comment) ? "Remove" : comment.resolved ? "Reopen" : "Resolve";
    markSeen(comment);
    renderLinks(comment);
    if (find(".to-reply").dataset.for !== comment.id) { setReplyTarget(null); find(".to-reply").dataset.for = comment.id; renderReplyTo(comment); }
    find(".thread-messages").replaceChildren(...threadNodes(comment, values => updateThread(values)));
    for (const item of find(".thread-messages").children) item.tabIndex = -1;
  }
  function selectThread(id) {
    selectedThread = id;
    replyInput.value = replyDrafts.get(id)?.text || "";
    renderHistory();
    find(".thread-back").focus();
  }
  function setFilter(value) {
    historyFilter = value;
    selectedThread = undefined;
    renderHistory();
    find(`.tab[data-filter="${value}"]`)?.focus();
  }
  function leaveThread() {
    pendingFocus = selectedThread;
    selectedThread = undefined;
    renderHistory();
  }
  // Resolve a thread and land on its neighbour so a run of `r` clears the list.
  function triage(id) {
    const comment = historyComments.find(c => c.id === id);
    if (!comment || historySaving) return;
    if (isNote(comment)) return;
    if (comment.resolved && hasFresh(comment)) {
      const rows = [...find(".thread-list").children].map(card => card.dataset.commentId);
      pendingFocus = rows[rows.indexOf(id) + 1] ?? rows[rows.indexOf(id) - 1];
      markSeen(comment);
      renderHistory();
      return;
    }
    const ids = [...find(".thread-list").children].map(card => card.dataset.commentId);
    const at = ids.indexOf(id);
    pendingFocus = selectedThread === id && comment.resolved ? id : ids[at + 1] ?? ids[at - 1];
    return updateThread({ id: crypto.randomUUID(), resolved: !comment.resolved }, id);
  }
  // Awaiting: a thread the agent started, still open, with the agent's message last.
  const awaiting = comment => !comment.resolved && !comment.removed && !isNote(comment) && comment.author === "copilot" &&
    (comment.replies.at(-1)?.author ?? "copilot") === "copilot";
    const banners = find(".banners");
  const linkLabel = c => `${c.section} · ${(c.comment || c.quote || "").slice(0, 40)}`;
  // Comments store the canonical 127.0.0.1 origin; keep navigation on the address you opened (e.g. NAME.localhost).
  function here(url) {
    const u = new URL(url);
    if (u.port === location.port && /^(127\.0\.0\.1|localhost|[a-z0-9-]+\.localhost)$/.test(u.hostname)) u.host = location.host;
    return u.href;
  }
  function goToThread(other) {
    if (other.kind === "session" || pagePath(other.url) === pagePath(location.href)) { openThreadById(other.id); return; }
    sessionStorage.setItem("adr-open-thread", other.id);
    location.assign(here(other.url));
  }
  function renderLinks(comment) {
    const box = find(".thread-links");
    const live = historyComments.filter(c => !c.removed && c.id !== comment.id);
    const out = (comment.refs || []).map(id => live.find(c => c.id === id)).filter(Boolean);
    const back = live.filter(c => c.refs?.includes(comment.id));
    const row = (arrow, other, removable) => {
      const line = document.createElement("span");
      line.className = "link-row";
      const go = document.createElement("button");
      go.type = "button"; go.className = "chip"; go.title = linkLabel(other);
      go.textContent = `${arrow} ${linkLabel(other).slice(0, 34)}`;
      go.addEventListener("click", () => goToThread(other));
      line.append(go);
      if (removable) {
        const drop = document.createElement("button");
        drop.type = "button"; drop.className = "chip chip-x"; drop.textContent = "✕"; drop.title = "Remove link";
        drop.addEventListener("click", () => updateThread({ id: crypto.randomUUID(), removeRefs: [other.id] }));
        line.append(drop);
      }
      return line;
    };
    const picker = document.createElement("select");
    picker.append(new Option("+ link", ""));
    picker.title = "Link to another thread";
    for (const c of live) if (!c.resolved && !out.includes(c)) picker.append(new Option(linkLabel(c), c.id));
    picker.addEventListener("change", () => picker.value && updateThread({ id: crypto.randomUUID(), addRefs: [picker.value] }));
    box.replaceChildren(...out.map(c => row("→", c, true)), ...back.map(c => row("←", c, false)), picker);
  }
  // Cycle through threads awaiting you, across pages; remembers the last stop.
  // Needs your eyes: the agent started it and waits, or it has an agent reply you have not seen (resolved ones only if the reply came after resolving).
  const attention = comment => !comment.removed && !isNote(comment) && (awaiting(comment) || hasFresh(comment));
  function jumpToAwaiting(step) {
    const queue = historyComments.filter(attention).sort((x, y) => new Date(x.at) - new Date(y.at));
    if (!queue.length) { message("Nothing awaiting you"); return; }
    const last = queue.findIndex(c => c.id === sessionStorage.getItem("adr-beacon"));
    const next = queue[(last + step + queue.length) % queue.length];
    sessionStorage.setItem("adr-beacon", next.id);
    message(`Awaiting ${(last + step + queue.length) % queue.length + 1}/${queue.length}`);
    goToThread(next);
  }
  async function openThreadById(id) {
    await openHistory();
    historyFilter = "all";
    selectedThread = id;
    replyInput.value = replyDrafts.get(id)?.text || "";
    renderHistory();
  }
  const syncBanners = () => {
    const banners = find(".banners"), hide = !history.hidden || !panel.hidden;
    if (banners.hidden !== hide) banners.hidden = hide;
  };
  function announceAwaiting() {
    const pages = {};
    const colors = {};
    const latest = {};
    for (const comment of historyComments) if (attention(comment)) {
      const key = comment.kind === "session" ? "*" : pagePath(comment.url);
      pages[key] = (pages[key] || 0) + 1;
      const at = Date.parse(comment.replies.at(-1)?.at || comment.at) || 0;
      if (!(latest[key] >= at)) { latest[key] = at; colors[key] = comment.color || "yellow"; }
    }
    const total = Object.values(pages).reduce((a, b) => a + b, 0);
    const base = document.title.replace(/^\(\d+\) /, "");
    const here = pagePath(location.href);
    banners.replaceChildren(...historyComments.filter(c => awaiting(c) && (c.kind === "session" || c.kind === "page" && pagePath(c.url) === here)).map(c => {
      const banner = document.createElement("button");
      banner.type = "button";
      banner.className = "banner";
      const label = document.createElement("small");
      label.textContent = c.kind === "session" ? "Copilot · session message" : "Copilot · about this page";
      banner.append(label, (c.comment || "").slice(0, 160));
      banner.addEventListener("click", () => openThreadById(c.id));
      return banner;
    }));
    syncBanners();
    document.title = total ? `(${total}) ${base}` : base;
    document.dispatchEvent(new CustomEvent("preview-comment-awaiting", { detail: { pages, total, colors, palette: COLORS } }));
  }
  async function refreshHistory() {
    const result = await api("history");
    sessionId = result.sessionId;
    serverSeenInit = Boolean(result.seenInit);
    if (result.revision < historyRevision) return;
    if (result.revision !== historyRevision) {
      historyRevision = result.revision;
      historyComments = result.comments;
      renderHistory();
      announceAwaiting();
    }
  }
  function historyError(error) {
    message(error.message, true);
    if (historyRevision < 0) find(".thread-list").textContent = "History unavailable. Use Refresh to retry.";
  }
  function closeHistory() {
    if (historySaving) return;
    clearInterval(historyTimer);
    shadow.activeElement?.blur();
    history.hidden = true;
    showCaret();
  }
  async function openHistory() {
    if (find("button[type=submit]").disabled) return;
    selecting = false;
    visual = false;
    clearPrefix();
    toggle.textContent = "Comment";
    shadow.activeElement?.blur();
    panel.hidden = true;
    contextual.hidden = true;
    history.hidden = false;
    showCaret();
    message("");
    renderHistory();
    clearInterval(historyTimer);
    const load = () => refreshHistory().catch(historyError);
    await load();
    if (history.hidden) return;
    clearInterval(historyTimer);
    historyTimer = setInterval(load, 2000);
    (find(".thread-list").querySelector(".thread-card") || find(`.tab[data-filter="${historyFilter}"]`) || find(".history-close")).focus();
  }
  async function updateThread(values, commentId = selectedThread) {
    historySaving = true;
    for (const selector of [".reply-send", ".thread-resolve", ".thread-back", ".history-close", ".history-toggle", ".toggle"]) find(selector).disabled = true;
    find(".thread-source").setAttribute("aria-disabled", "true");
    replyInput.readOnly = true;
    try {
      const result = await api("updates", { ...values, sessionId, commentId });
      if (values.reply !== undefined) {
        replyDrafts.delete(commentId);
        replyInput.value = "";
        setReplyTarget(null);
        host.dataset.replyDrafts = String([...replyDrafts.values()].filter(draft => draft.text.trim()).length);
        message("Reply saved");
      } else if (values.resolved !== undefined) message(result.resolved ? "Comment resolved" : "Comment reopened");
      else message("Saved");
      if (values.resolved === true && result.resolved) selectedThread = undefined;
      await refreshHistory();
    } catch (error) {
      message(error.message + (values.reply !== undefined ? " Your reply draft is kept; press Reply to retry." : ""), true);
    } finally {
      historySaving = false;
      for (const selector of [".reply-send", ".thread-resolve", ".thread-back", ".history-close", ".history-toggle", ".toggle"]) find(selector).disabled = false;
      find(".thread-source").removeAttribute("aria-disabled");
      replyInput.readOnly = false;
    }
  }
  find(".export-page").addEventListener("click", () => exportPage());
  find(".history-toggle").addEventListener("click", () => history.hidden ? openHistory() : closeHistory());
  find(".history-close").addEventListener("click", closeHistory);
  find(".history-refresh").addEventListener("click", () => refreshHistory().catch(historyError));
  find(".thread-back").addEventListener("click", () => {
    leaveThread();
  });
  find(".thread-quote").addEventListener("click", () => {
    const m = find(".thread-quote").textContent.match(/^Video (.+) @ (\d+):([\d.]+)$/);
    const video = m && [...document.querySelectorAll(".vp-doc video")].find(v => videoName(v) === m[1]);
    if (!video) return;
    video.currentTime = Number(m[2]) * 60 + Number(m[3]);
    closeHistory();
    video.scrollIntoView({ block: "center" });
  });
  find(".thread-source").addEventListener("click", event => {
    if (historySaving) event.preventDefault();
    else closeHistory();
  });
  replyInput.addEventListener("input", () => {
    replyDrafts.set(selectedThread, { ...replyDrafts.get(selectedThread), text: replyInput.value });
    host.dataset.replyDrafts = String([...replyDrafts.values()].filter(draft => draft.text.trim()).length);
  });
  let replyTo = new Set();
  function renderReplyTo(comment) {
    replyTo = new Set(comment?.to?.length ? comment.to : defaultTo());
    chipRow(find(".to-reply"), replyTo);
  }
  // Replying to one message (optionally one highlighted passage of it): the reply is linked to it.
  let replyTarget = null;
  function setReplyTarget(target) {
    replyTarget = target;
    const row = find(".reply-target");
    row.hidden = !target;
    if (target) row.firstElementChild.textContent = `↩ ${target.author}: “${target.quote.slice(0, 160)}${target.quote.length > 160 ? "…" : ""}”`;
  }
  find(".reply-target button").addEventListener("click", () => setReplyTarget(null));
  function replyToMessage(item) {
    const note = item?.closest?.(".note");
    if (!note?.dataset.mid) { message("Focus a message (j/k), optionally select text in it, then q", true); return; }
    const picked = shadow.getSelection?.() ?? getSelection();
    let quote = picked.rangeCount && note.contains(picked.getRangeAt(0).commonAncestorContainer) ? picked.toString().trim() : "";
    quote ||= (note.querySelector("p")?.textContent || "").trim();
    const author = note.classList.contains("copilot") ? note.dataset.from || "Copilot" : "You";
    setReplyTarget({ id: note.dataset.mid, author, quote: quote.slice(0, 600) });
    // Address the reply like the quoted message. Agent replies don't record which agent wrote them, so use whoever the message before it was sent to.
    const thread = currentThread(), items = thread ? [thread, ...thread.replies] : [], at = items.findIndex(m => m.id === note.dataset.mid);
    let to = items[at]?.from ? [items[at].from] : undefined;
    for (let i = author === "You" ? at : at - 1; i >= 0 && !to; i--) if (items[i].author !== "copilot" && items[i].to?.length) to = items[i].to;
    if (to) { replyTo = new Set(to); chipRow(find(".to-reply"), replyTo); }
    replyInput.focus();
  }
  find(".reply-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!replyInput.value.trim() || historySaving) return;
    const draft = replyDrafts.get(selectedThread) || {};
    if (!draft.id || draft.submitted !== replyInput.value) draft.id = crypto.randomUUID();
    draft.submitted = replyInput.value;
    replyDrafts.set(selectedThread, draft);
    const target = replyTarget;
    const quoted = target ? "> " + target.quote.replace(/\s+/g, " ").slice(0, 300) + "\n\n" : "";
    updateThread({ id: draft.id, reply: quoted + replyInput.value, ...(target ? { inReplyTo: { id: target.id, quote: target.quote } } : {}), ...toValue(replyTo, !find(".to-reply").hidden) });
    rememberTo(replyTo);
  });
  find(".thread-resolve").addEventListener("click", () => {
    const comment = historyComments.find(c => c.id === selectedThread);
    if (comment && isNote(comment)) {
      pendingFocus = undefined;
      selectedThread = undefined;
      updateThread({ id: crypto.randomUUID(), removed: true }, comment.id).then(applyMarks);
    } else triage(selectedThread);
  });
  let draftImages = [];
  let composeTo = new Set();
  const shots = find(".shots");
  function renderShots() {
    shots.replaceChildren(...draftImages.map(shot => {
      const item = document.createElement("div");
      item.className = "shot";
      const image = document.createElement("img");
      image.src = shot.url;
      image.alt = "Region screenshot to attach";
      image.addEventListener("load", () => { if (!panel.hidden && targetAnchor) position(panel, targetAnchor); });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.title = "Remove screenshot";
      remove.textContent = "×";
      remove.addEventListener("click", () => { draftImages = draftImages.filter(other => other !== shot); renderShots(); });
      item.append(image, remove);
      return item;
    }));
    if (!panel.hidden && targetAnchor) position(panel, targetAnchor);
  }
  const regionLayer = find(".region");
  const regionBox = find(".region-box");
  let regioning = false;
  let displayStream;
  let displayVideo;
  async function frameSource() {
    const live = displayStream?.getVideoTracks()[0]?.readyState === "live";
    if (!live) {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include",
      });
      const track = stream.getVideoTracks()[0];
      const surface = track.getSettings().displaySurface;
      if (surface && surface !== "browser") {
        stream.getTracks().forEach(item => item.stop());
        throw new Error("Share this browser tab (not a window or screen) so the region matches the page.");
      }
      displayStream = stream;
      displayVideo = document.createElement("video");
      displayVideo.muted = true;
      displayVideo.srcObject = stream;
      track.addEventListener("ended", () => { displayStream = undefined; });
      await displayVideo.play();
    }
    return displayVideo;
  }
  function pickRegion() {
    return new Promise(resolve => {
      let start;
      const finish = rect => {
        document.removeEventListener("keydown", onKey, true);
        regionLayer.hidden = true;
        regionBox.hidden = true;
        resolve(rect);
      };
      const onKey = event => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        finish(null);
      };
      const rectOf = event => ({
        x: Math.min(start.x, event.clientX), y: Math.min(start.y, event.clientY),
        width: Math.abs(event.clientX - start.x), height: Math.abs(event.clientY - start.y),
      });
      regionLayer.onpointerdown = event => {
        start = { x: event.clientX, y: event.clientY };
        regionLayer.setPointerCapture(event.pointerId);
        regionBox.hidden = false;
        regionLayer.onpointermove(event);
      };
      regionLayer.onpointermove = event => {
        if (!start) return;
        const rect = rectOf(event);
        Object.assign(regionBox.style, { left: rect.x + "px", top: rect.y + "px", width: rect.width + "px", height: rect.height + "px" });
      };
      regionLayer.onpointerup = event => {
        if (!start) return;
        const rect = rectOf(event);
        finish(rect.width >= 8 && rect.height >= 8 ? rect : null);
      };
      regionLayer.onpointercancel = () => finish(null);
      document.addEventListener("keydown", onKey, true);
      regionLayer.hidden = false;
    });
  }
  const nextFrame = video => new Promise(done => {
    const timer = setTimeout(done, 400);
    video.requestVideoFrameCallback?.(() => { clearTimeout(timer); done(); });
  });
  // Resolves to { id, url, element } once the cropped PNG is stored, or null if cancelled.
  async function captureRegion() {
    if (regioning) return null;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      message("Region screenshots need a browser with screen capture (getDisplayMedia).", true);
      return null;
    }
    regioning = true;
    try {
      const video = await frameSource();
      message("");
      const rect = await pickRegion();
      if (!rect) return null;
      // The overlay is hidden so it is not in the crop, unless an overlay panel is what is being captured.
      const capturingOverlay = !history.hidden || !panel.hidden || !pop.hidden;
      if (!capturingOverlay) host.style.visibility = "hidden";
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      await nextFrame(video);
      await new Promise(done => setTimeout(done, 60));
      const scale = video.videoWidth / innerWidth;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(rect.width * scale);
      canvas.height = Math.round(rect.height * scale);
      canvas.getContext("2d").drawImage(video, rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale, 0, 0, canvas.width, canvas.height);
      const element = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      host.style.visibility = "";
      const blob = await new Promise(done => canvas.toBlob(done, "image/png"));
      if (!blob) throw new Error("The region could not be captured.");
      const response = await fetch("/__preview_comments/attachments", {
        method: "POST", headers: { "Content-Type": "image/png", "X-Preview-Comment": "1" }, body: blob,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      imageUrls.set(result.id, Promise.resolve(URL.createObjectURL(blob)));
      return { id: result.id, url: await imageUrls.get(result.id), element };
    } catch (error) {
      message(error.name === "NotAllowedError" ? "Screen capture was not allowed." : error.message, true);
      return null;
    } finally {
      host.style.visibility = "";
      regioning = false;
    }
  }
  function addDraftImage(shot) {
    if (draftImages.length >= 4) { message("A comment can carry at most 4 screenshots.", true); return; }
    draftImages.push(shot);
    renderShots();
  }
  async function regionComment() {
    const shot = await captureRegion();
    if (!shot) return;
    const doc = document.querySelector(".vp-doc");
    const element = shot.element && doc.contains(shot.element) ? shot.element : doc;
    const text = selection();
    open(text || context(element, "figure", "Region screenshot"), text ? undefined : element);
    addDraftImage(shot);
  }
  async function regionDraft() {
    const shot = await captureRegion();
    if (!shot) return;
    addDraftImage(shot);
    textarea.focus();
  }
  async function regionThread(addTo) {
    const shot = await captureRegion();
    if (shot) await addTo([shot.id]);
  }
  const branchButton = find(".thread-branch");
  branchButton.addEventListener("mousedown", event => event.preventDefault());
  // Quote = the text selected in the thread, else the focused message (keyboard use).
  function branchThread() {
    const parent = currentThread();
    const picked = (shadow.getSelection?.() ?? getSelection());
    const messages = find(".thread-messages");
    let quote = picked.toString().trim();
    if (!(picked.rangeCount && messages.contains(picked.getRangeAt(0).commonAncestorContainer))) quote = "";
    if (!quote) {
      const focused = [...messages.children].find(node => node === shadow.activeElement || node.contains(shadow.activeElement));
      quote = (focused?.querySelector(".body, p, div")?.textContent || focused?.textContent || "").trim();
    }
    if (!parent || !quote) { message("Select text in this thread, or focus a message (j/k), then n", true); return; }
    open({ kind: parent.kind, url: parent.url, section: parent.section, anchor: parent.anchor, quote: quote.slice(0, 1000) }, undefined);
    branchOf = parent.id;
  }
  branchButton.addEventListener("click", branchThread);
  find(".attach-region").addEventListener("click", regionDraft);
  find(".thread-region").addEventListener("click", () => regionThread(ids => updateThread({ id: crypto.randomUUID(), addImages: ids })));
  document.addEventListener("keydown", event => {
    if (history.hidden || !vimEnabled || historySaving || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const field = shadow.activeElement;
    if (field?.matches("textarea, input, select")) return;
    const cards = [...find(".thread-list").querySelectorAll(".thread-card")];
    const ids = cards.map(card => card.dataset.commentId);
    const at = cards.indexOf(field);
    const step = delta => {
      const next = cards[Math.max(0, Math.min(cards.length - 1, (at < 0 ? (delta > 0 ? -1 : cards.length) : at) + delta))];
      next?.focus();
      next?.scrollIntoView({ block: "nearest" });
    };
    const key = event.key;
    let handled = true;
    const values = FILTERS.map(([value]) => value);
    const tabKey = { A: "all", P: "page", O: "unresolved", C: "chat", R: "resolved", N: "notes" }[key];
    if (!selectedThread && tabKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Capitals pick a tab; P with A (either order, within a moment) is the page's whole history.
      const live = tabChord && Date.now() - tabChord.at < 800 ? tabChord.key : undefined;
      const pair = tabKey === "page" && live === "all" || tabKey === "all" && live === "page";
      setFilter(pair ? "pagehist" : tabKey);
      tabChord = pair ? undefined : { key: tabKey, at: Date.now() };
    } else if (!selectedThread && field?.classList.contains("tab")) {
      const i = values.indexOf(field.dataset.filter);
      if ((key === "l" || key === "ArrowRight") && i < values.length - 1) setFilter(values[i + 1]);
      else if ((key === "h" || key === "ArrowLeft") && i > 0) setFilter(values[i - 1]);
      else if (key === "j" || key === "ArrowDown") cards[0]?.focus();
      else if (key === "G") step(Infinity);
      else handled = key === "h" || key === "l";
    } else if (selectedThread) {
      const here = ids.indexOf(selectedThread);
      if (key === "h" || key === "ArrowLeft") leaveThread();
      else if (key === "r") triage(selectedThread);
      else if (readState && (key === "p" || key === "<" || key === ">")) readerStep(key === "p" ? 0 : key === "<" ? -1 : 1);
      else if (key === "p") readThreads([currentThread()]);
      else if (key === "q") replyToMessage(field);
      else if (key === "u") field.querySelector?.(".quote-ref")?.click();
      else if (key === "i") replyInput.focus();
      else if (key === "n") branchThread();
      else if (key === "o") find(".thread-source").click();
      else if (key === KM.page.region) find(".thread-region").click();
      else if (key === "J" && ids[here + 1]) selectThread(ids[here + 1]);
      else if (key === "K" && here > 0) selectThread(ids[here - 1]);
      else if (key === "j" || key === "k" || key === "ArrowDown" || key === "ArrowUp") {
        const items = [...find(".thread-messages").children];
        const down = key === "j" || key === "ArrowDown";
        const next = items[items.indexOf(field) + (down ? 1 : -1)] || (field === find(".thread-back") && down ? items[0] : undefined);
        if (next) { next.focus(); next.scrollIntoView({ block: "nearest" }); }
        else find(".history").scrollBy({ top: down ? 120 : -120 });
      } else if (key === "g" || key === "G") (key === "g" ? find(".thread-messages").firstElementChild : find(".thread-messages").lastElementChild)?.focus();
      else handled = false;
      if (key === "o") event.preventDefault();
    } else if (key === "j" || key === "ArrowDown") step(1);
    else if (key === "k" || key === "ArrowUp") { if (at <= 0) find(`.tab[data-filter="${historyFilter}"]`)?.focus(); else step(-1); }
    else if (key === "g") step(-Infinity);
    else if (key === "G") step(Infinity);
    else if (key === "l" || key === "ArrowRight") { if (at >= 0) cards[at].click(); }
    else if (key === "r") { if (at >= 0) triage(ids[at]); }
    else if (readState && (key === "p" || key === "<" || key === ">")) readerStep(key === "p" ? 0 : key === "<" ? -1 : 1);
    else if (key === "p") { if (at >= 0) readThreads([historyComments.find(c => c.id === ids[at])]); }
    else if (key === "o") { if (at >= 0) { selectThread(ids[at]); find(".thread-source").click(); } }
    else if (key === "[" || key === "]") {
      setFilter(values[(values.indexOf(historyFilter) + (key === "]" ? 1 : values.length - 1)) % values.length]);
    } else handled = false;
    if (handled) event.preventDefault();
  });
  let popComment;
  document.addEventListener("keydown", event => {
    if (event.key !== KM.page.region || event.isComposing || event.repeat || !vimEnabled || event.ctrlKey || event.metaKey || event.altKey ||
        regioning || historySaving || find("button[type=submit]").disabled || !document.querySelector(".vp-doc") ||
        event.composedPath().some(node => node.matches?.("input, textarea, select, button, [contenteditable]:not([contenteditable='false']), [role='textbox']"))) return;
    if (!history.hidden) {
      if (!selectedThread) return;
      event.preventDefault();
      find(".thread-region").click();
    } else if (!panel.hidden) {
      event.preventDefault();
      regionDraft();
    } else if (!pop.hidden && popComment) {
      event.preventDefault();
      const comment = popComment;
      regionThread(ids => update(comment, { addImages: ids }));
    } else {
      event.preventDefault();
      regionComment();
    }
  });
  function context(element, kind, quote) {
    const doc = element.closest(".vp-doc");
    const before = node => node === element || node.contains(element) ||
      Boolean(node.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING);
    const headings = [...doc.querySelectorAll("h1,h2,h3,h4")].filter(before);
    const anchors = [...doc.querySelectorAll("h1[id],h2[id],h3[id],h4[id],a[id]")].filter(before);
    const anchor = anchors.at(-1)?.id || "";
    const url = new URL(location.href);
    url.hash = anchor;
    return { kind, quote, anchor, url: url.href, section: headings.at(-1)?.textContent.replace(/#$/, "").trim() || document.title };
  }
  function selection() {
    const selected = getSelection();
    if (!selected?.rangeCount || !selected.toString().trim()) return null;
    const range = selected.getRangeAt(0);
    const element = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (!element?.closest(".vp-doc")) return null;
    return context(element, "text", selected.toString().trim());
  }
  function elementSelection(element) {
    if (!element?.closest?.(".vp-doc")) return null;
    const equation = element.closest("mjx-container");
    if (equation) {
      const label = equation.querySelector("mlabeledtr > mtd")?.textContent;
      return { element: equation, chosen: context(equation, "equation",
        label ? `Equation ${label}` : equation.textContent.trim()) };
    }
    const control = element.closest("input, textarea, select, button") || element.closest("label")?.control;
    if (control && !control.matches("input[type=password], input[type=hidden], input[type=file]")) {
      const label = control.getAttribute("aria-label") ||
        [...(control.labels || [])].map(node => node.textContent.trim()).join(" ") ||
        control.textContent.trim() || control.getAttribute("placeholder") || control.tagName.toLowerCase();
      const value = control.matches("input[type=checkbox], input[type=radio]")
        ? control.checked ? "checked" : "unchecked" : control.value;
      const quote = (value ? `${label}: ${value}` : label).slice(0, 1000);
      return { element: control, chosen: context(control, "text", quote) };
    }
    const text = element.closest("svg text, label");
    if (text?.textContent.trim()) return { element: text, chosen: context(text, "text", text.textContent.trim().slice(0, 1000)) };
    const figure = element.closest("img, svg, figure, [role=figure], [role=img]");
    if (!figure) return null;
    const quote = figure.getAttribute("alt") || figure.getAttribute("aria-label") ||
      figure.querySelector("title, figcaption")?.textContent || figure.textContent.trim() ||
      figure.getAttribute("src") || "Figure";
    return { element: figure, chosen: context(figure, "figure", quote.slice(0, 1000)) };
  }
  function position(node, anchor) {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    if (node === contextual && (rect.bottom <= viewportTop() || rect.top >= innerHeight - 12)) {
      contextual.hidden = true;
      return;
    }
    const width = node.offsetWidth, height = node.offsetHeight;
    const top0 = viewportTop();
    const clampX = x => Math.max(12, Math.min(x, innerWidth - width - 12));
    const clampY = y => Math.max(top0, Math.min(y, innerHeight - height - 12));
    // Try below, above, right and left of the anchor; keep the spot that covers the least of it.
    const overlap = (x, y) => Math.max(0, Math.min(x + width, rect.right) - Math.max(x, rect.left)) * Math.max(0, Math.min(y + height, rect.bottom) - Math.max(y, rect.top));
    const spots = [
      [clampX(rect.left), clampY(rect.bottom + 8)],
      [clampX(rect.left), clampY(rect.top - height - 8)],
      [clampX(rect.right + 12), clampY(rect.top)],
      [clampX(rect.left - width - 12), clampY(rect.top)],
    ];
    let best = spots[0], least = overlap(...best);
    for (const spot of spots.slice(1)) {
      const covered = overlap(...spot);
      if (covered < least) { best = spot; least = covered; }
    }
    node.style.left = best[0] + "px";
    node.style.top = best[1] + "px";
  }
  function offer(chosen, anchor) {
    if (document.querySelector(".gp")) { contextual.hidden = true; return; }
    if (!panel.hidden || !history.hidden || historySaving || find("button[type=submit]").disabled) return;
    offeredTarget = chosen;
    offeredAnchor = anchor;
    contextual.hidden = false;
    position(contextual, anchor);
  }
  document.addEventListener("adr-presenting", () => { contextual.hidden = true; });
  contextual.addEventListener("mousedown", event => event.preventDefault());
  document.addEventListener("focusin", event => {
    const picked = elementSelection(event.target);
    if (picked) offer(picked.chosen, picked.element);
  });
  document.addEventListener("input", event => {
    if (contextual.hidden || offeredAnchor !== event.target) return;
    const picked = elementSelection(event.target);
    if (picked) offer(picked.chosen, picked.element);
  });
  let branchOf;
  async function open(chosen, anchor) {
    if (historySaving) return;
    branchOf = undefined;
    closeHistory();
    if (JSON.stringify(chosen) !== JSON.stringify(target)) { draftId = undefined; draftImages = []; renderShots(); }
    targetAnchor = anchor || (selection() && getSelection().getRangeAt(0).cloneRange()) ||
      (JSON.stringify(chosen) === JSON.stringify(target) ? targetAnchor : undefined);
    target = chosen;
    contextual.hidden = true;
    selecting = false;
    visual = false;
    clearPrefix();
    toggle.textContent = "Comment";
    find(".quote").textContent = chosen.quote;
    panel.hidden = false;
    panel.classList.toggle("contextual-panel", Boolean(targetAnchor));
    panel.style.left = "";
    panel.style.top = "";
    if (targetAnchor) position(panel, targetAnchor);
    showCaret();
    message("");
    textarea.focus();
    try {
      const ready = await api("status");
      sessionId = ready.sessionId;
      await loadSettings();
      composeTo = new Set(defaultTo());
      chipRow(find(".to-new"), composeTo);
      find(".receiver").textContent = `This conversation · ${sessionId.slice(0, 8)}`;
    } catch (error) {
      message(error.message, true);
    }
  }
  toggle.addEventListener("mousedown", event => event.preventDefault());
  toggle.addEventListener("click", () => {
    const chosen = selection();
    if (chosen) { open(chosen); return; }
    if (textarea.value.trim() && target) { open(target); return; }
    selecting = !selecting;
    toggle.textContent = selecting ? "Cancel selection" : "Comment";
    message(selecting ? "Select text, or click an equation, figure, label or control." : "");
  });
  document.addEventListener("mouseup", event => {
    if (host.contains(event.target)) return;
    const selected = selection();
    const picked = selected ? null : elementSelection(event.target);
    const chosen = selected || picked?.chosen;
    if (!chosen) { contextual.hidden = true; return; }
    const anchor = picked?.element || getSelection().getRangeAt(0).cloneRange();
    if (selecting) open(chosen, anchor);
    else offer(chosen, anchor);
  });
  // Vim inside text fields. Insert → (Esc | jk) → normal → (Esc | jk) leaves the field; v/V visual.
  // The cursor in normal/visual mode is the selected character, so the browser's own selection draws it.
  const textState = new WeakMap();
  let textReg = { text: "", line: false };
  const tstate = field => textState.get(field) || textState.set(field, { mode: "insert", cur: 0, anchor: 0, col: 0, pending: "", lastJ: 0, jFrom: null, line: false }).get(field);
  function textVim(event) {
    const t = event.target;
    if (!vimEnabled || !t.matches?.("textarea") || event.isComposing || event.metaKey || event.altKey) return;
    const st = tstate(t), key = event.key;
    const stop = () => { event.preventDefault(); event.stopImmediatePropagation(); };
    const v = () => t.value;
    const ls = i => i <= 0 ? 0 : v().lastIndexOf("\n", i - 1) + 1;
    const le = i => { const n = v().indexOf("\n", i); return n < 0 ? v().length : n; };
    const clamp = c => {
      c = Math.max(0, Math.min(c, v().length));
      return (c === v().length || v()[c] === "\n") && c > ls(c) ? c - 1 : c;
    };
    const render = () => {
      t.dataset.vmode = st.mode;
      if (st.mode === "insert") return;
      let lo = Math.min(st.anchor, st.cur), hi = Math.max(st.anchor, st.cur) + 1;
      if (st.mode === "normal") { lo = st.cur; hi = st.cur + 1; }
      else if (st.line) { lo = ls(lo); hi = le(hi - 1); }
      if (hi > v().length || v()[hi - 1] === "\n") hi = Math.max(lo, hi - 1);
      t.setSelectionRange(lo, hi, "forward");
    };
    const normal = c => { st.mode = "normal"; st.pending = ""; st.cur = clamp(c); st.col = st.cur - ls(st.cur); render(); };
    const insertAt = pos => { st.mode = "insert"; st.pending = ""; t.dataset.vmode = "insert"; t.setSelectionRange(pos, pos); };
    const edit = (s, e, text) => { t.setSelectionRange(s, e); document.execCommand(text ? "insertText" : "delete", false, text); };
    const yank = (text, line) => { textReg = { text, line }; navigator.clipboard?.writeText(text).catch(() => {}); };
    const tokens = () => [...v().matchAll(/[A-Za-z0-9_]+|[^\sA-Za-z0-9_]+/g)].map(m => [m.index, m.index + m[0].length]);
    const wordFwd = c => (tokens().find(([s]) => s > c) || [v().length])[0];
    const wordBack = c => ([...tokens()].reverse().find(([s]) => s < c) || [0])[0];
    const wordEnd = c => { const hit = tokens().find(([, e]) => e - 1 > c); return hit ? hit[1] - 1 : Math.max(0, v().length - 1); };
    const firstNonBlank = i => { const s = ls(i); return s + (/^\s*/.exec(v().slice(s, le(i)))[0].length); };
    const vertical = delta => {
      const s = delta > 0 ? le(st.cur) + 1 : ls(st.cur) - 1;
      if (delta > 0 ? s > v().length : s < 0) return st.cur;
      const start = ls(s), end = le(start);
      return Math.min(start + st.col, Math.max(start, end - 1));
    };
    const move = k => {
      const c = st.cur;
      switch (k) {
        case "h": case "ArrowLeft": return Math.max(ls(c), c - 1);
        case "l": case "ArrowRight": return Math.min(Math.max(ls(c), le(c) - 1), c + 1);
        case "j": case "ArrowDown": return vertical(1);
        case "k": case "ArrowUp": return vertical(-1);
        case "w": return wordFwd(c);
        case "b": return wordBack(c);
        case "e": return wordEnd(c);
        case "0": return ls(c);
        case "^": return firstNonBlank(c);
        case "$": return Math.max(ls(c), le(c) - 1);
        case "G": return ls(v().length);
        default: return null;
      }
    };
    const vertKeys = new Set(["j", "k", "ArrowUp", "ArrowDown"]);
    const lineOf = i => [ls(i), le(i)];
    const delLine = (s, e) => {
      const from = e >= v().length && s > 0 ? s - 1 : s, to = e < v().length ? e + 1 : e;
      edit(from, to, "");
      normal(from >= v().length ? ls(Math.max(0, v().length - 1)) : from);
    };
    const run = (op, s, e, line) => {
      if (op === "y") { yank(v().slice(s, e), line); normal(s); return; }
      yank(v().slice(s, e), line);
      if (line && op === "d") { delLine(s, e); return; }
      edit(s, e, "");
      if (op === "c") insertAt(s); else normal(s);
    };

    if (event.ctrlKey) {
      if (st.mode !== "insert" && key === "r") { stop(); document.execCommand("redo"); normal(t.selectionStart); }
      return;
    }
    if (st.mode === "insert") {
      if (key === "Escape") { stop(); normal(t.selectionStart - 1); return; }
      if (key === "j") { st.lastJ = Date.now(); return; }
      if (key === "k" && Date.now() - st.lastJ < 400 && v()[t.selectionStart - 1] === "j" && t.selectionStart === t.selectionEnd) {
        stop();
        st.lastJ = 0;
        const at = t.selectionStart;
        edit(at - 1, at, "");
        normal(at - 2);
        return;
      }
      st.lastJ = 0;
      return;
    }

    if (key === "Escape") {
      if (st.mode === "visual") { stop(); normal(st.cur); }
      else st.pending = "";
      return;
    }
    if (["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab"].includes(key)) return;
    stop();
    const visual = st.mode === "visual";
    const pending = st.pending;
    st.pending = "";

    if (!visual && "dcy".includes(pending) && pending) {
      if (key === pending) { const [s, e] = lineOf(st.cur); if (pending === "c") { yank(v().slice(s, e), true); edit(s, e, ""); insertAt(s); } else run(pending, s, e, true); return; }
      const c = st.cur;
      let range = null;
      if (key === "w") range = [c, pending === "c" && /\S/.test(v()[c] || "") ? wordEnd(c) + 1 : Math.max(c + 1, Math.min(wordFwd(c), le(c)))];
      else if (key === "e") range = [c, wordEnd(c) + 1];
      else if (key === "b") range = [wordBack(c), c];
      else if (key === "$") range = [c, le(c)];
      else if (key === "0") range = [ls(c), c];
      else if (key === "^") range = [Math.min(firstNonBlank(c), c), Math.max(firstNonBlank(c), c)];
      else if (key === "h") range = [Math.max(ls(c), c - 1), c];
      else if (key === "l") range = [c, Math.min(le(c), c + 1)];
      if (range && range[1] > range[0]) run(pending, range[0], range[1], false);
      else if (range) normal(c);
      return;
    }
    if (pending === "g") { if (key === "g") { st.cur = 0; st.col = 0; render(); } return; }

    if (key === "j" && !visual) st.jFrom = { cur: st.cur, col: st.col, at: Date.now() };
    if (key === "k" && !visual && st.jFrom && Date.now() - st.jFrom.at < 400) {
      st.cur = st.jFrom.cur; st.col = st.jFrom.col; st.jFrom = null; render();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      return;
    }
    if (key !== "j") st.jFrom = null;

    const target = move(key);
    if (target !== null) {
      st.cur = clamp(target);
      if (!vertKeys.has(key)) st.col = st.cur - ls(st.cur);
      render();
      return;
    }
    if (key === "g") { st.pending = "g"; return; }

    if (visual) {
      if (key === "o") { [st.anchor, st.cur] = [st.cur, st.anchor]; render(); return; }
      if (key === "v") { if (st.line) st.line = false; else { normal(st.cur); return; } render(); return; }
      if (key === "V") { if (!st.line) st.line = true; else { normal(st.cur); return; } render(); return; }
      if ("ydxc".includes(key)) {
        let lo = Math.min(st.anchor, st.cur), hi = Math.max(st.anchor, st.cur) + 1;
        if (st.line) { lo = ls(lo); hi = le(hi - 1); }
        const op = key === "x" ? "d" : key;
        if (op === "y") { yank(v().slice(lo, hi), st.line); normal(lo); }
        else if (st.line && op === "d") { yank(v().slice(lo, hi), true); delLine(lo, hi); }
        else { run(op, lo, hi, st.line && op === "c"); }
      }
      return;
    }

    const c = st.cur;
    switch (key) {
      case "i": insertAt(c); break;
      case "a": insertAt(Math.min(c + 1, le(c))); break;
      case "I": insertAt(firstNonBlank(c)); break;
      case "A": insertAt(le(c)); break;
      case "o": edit(le(c), le(c), "\n"); insertAt(t.selectionStart); break;
      case "O": { const s = ls(c); edit(s, s, "\n"); insertAt(s); break; }
      case "v": st.mode = "visual"; st.line = false; st.anchor = c; render(); break;
      case "V": st.mode = "visual"; st.line = true; st.anchor = c; render(); break;
      case "d": case "c": case "y": st.pending = key; break;
      case "x": if (c < v().length && v()[c] !== "\n") run("d", c, c + 1, false); break;
      case "D": if (le(c) > c) run("d", c, le(c), false); break;
      case "C": run("c", c, le(c), false); break;
      case "p": case "P": {
        if (!textReg.text) break;
        if (textReg.line) {
          if (key === "p") { const e = le(c); edit(e, e, "\n" + textReg.text); normal(e + 1); }
          else { const s = ls(c); edit(s, s, textReg.text + "\n"); normal(s); }
        } else {
          const at = key === "p" && le(c) > c ? c + 1 : c;
          edit(at, at, textReg.text);
          normal(at + textReg.text.length - 1);
        }
        break;
      }
      case "u": document.execCommand("undo"); normal(t.selectionStart); break;
      default: break;
    }
  }
  shadow.addEventListener("keydown", textVim, true);
  shadow.addEventListener("focusout", event => {
    if (!event.target.matches?.("textarea")) return;
    const st = tstate(event.target);
    st.mode = "insert"; st.pending = ""; st.line = false;
    delete event.target.dataset.vmode;
  });
  document.addEventListener("keydown", event => {
    if (event.isComposing) return;
    if (vimEnabled && event.altKey && resizeKey(event)) { event.preventDefault(); return; }
    if (event.key === "Escape") {
      contextual.hidden = true;
      if (find("button[type=submit]").disabled || historySaving) return;
      if (!history.hidden) {
        event.preventDefault();
        const field = shadow.activeElement;
        if (field?.matches("textarea, input, select")) field.blur();
        else if (selectedThread) leaveThread();
        else closeHistory();
        return;
      }
      // In the composer, Esc leaves the field first (keeping the draft) so h/l can pick recipients; Esc again closes.
      const composing = !panel.hidden && shadow.activeElement?.matches("textarea");
      if (composing) {
        event.preventDefault();
        shadow.activeElement.blur();
        find(".to-new button")?.focus();
        message(find(".to-new").hidden ? "" : "h j k l pick recipients · Space toggles · i back to the comment · Esc closes");
        return;
      }
      if (panel.hidden && !visual && !prefix && !selecting) {
        if (caretMode) { caretMode = false; showCaret(); }
        message("");
        return;
      }
      if (!panel.hidden || visual || prefix || selecting) event.preventDefault();
      if (visual) {
        const selected = getSelection();
        if (selected.focusNode) selected.collapse(selected.focusNode, selected.focusOffset);
      }
      visual = false;
      clearPrefix();
      selecting = false;
      toggle.textContent = "Comment";
      shadow.activeElement?.blur();
      panel.hidden = true;
      message("");
      showCaret();
      return;
    }
    if (vimEnabled && !panel.hidden && history.hidden && panel.contains(shadow.activeElement) && !shadow.activeElement.matches("textarea, input, select") && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const chips = [...find(".to-new").querySelectorAll("button")];
      const at = chips.indexOf(shadow.activeElement);
      if (event.key === "i") { event.preventDefault(); find("#comment-body").focus(); return; }
      if (chips.length && "hjkl".includes(event.key) && event.key.length === 1) {
        event.preventDefault();
        (chipNeighbour(chips, at, event.key) || chips[Math.max(0, at)]).focus();
        return;
      }
    }
    if (!vimEnabled || externalMode || !panel.hidden || !history.hidden || event.ctrlKey || event.metaKey || event.altKey ||
        event.composedPath().some(node => node.matches?.("input, textarea, select, button, [contenteditable]:not([contenteditable='false']), [role='textbox']"))) return;
    // Pages without a prose body (layout: page, e.g. graphs) still get threads, chat and commands.
    const hasDoc = Boolean(document.querySelector(".vp-doc"));
    const previous = prefix;
    clearPrefix();
    if (event.key === KM.leaderKeys.history && previous === KM.leader) {
      event.preventDefault();
      openHistory();
      return;
    }
    if (event.key === "m" && previous === KM.leader) {
      event.preventDefault();
      if (find(".mesh-panel").hidden || !meshPinned) openMesh(); else closeMesh();
      return;
    }
    if (event.key === KM.leaderKeys.chat && previous === KM.leader) {
      event.preventDefault();
      open(sessionTarget());
      return;
    }
    if (event.key === KM.page.comment) {
      event.preventDefault();
      if (hasDoc) commentSelection(); else open(pageTarget());
      return;
    }
    if (event.key === KM.leader || event.key === KM.page.documentStart && previous !== KM.page.documentStart) {
      event.preventDefault();
      prefix = event.key;
      modeLabel();
      prefixTimer = setTimeout(clearPrefix, 1000);
      return;
    }
    if (event.key === ":") { event.preventDefault(); openCmdline(); return; }
    if (event.key === "/") { event.preventDefault(); openCmdline("grep "); return; }
    if (event.key === "]" || event.key === "[") { event.preventDefault(); jumpToAwaiting(event.key === "]" ? 1 : -1); return; }
    if (!hasDoc) return;
    if (event.key === "i" && !caretMode) {
      event.preventDefault();
      caretMode = true;
      if (cursorInView()) showCaret(); else useRange(centerRange());
      return;
    }
    if (event.key === "V" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (ensureCursor()) {
        const selected = getSelection();
        const node = selected.focusNode;
        const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
        const block = element?.closest("p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th, dd, dt, figcaption");
        if (block && document.querySelector(".vp-doc").contains(block)) {
          event.preventDefault();
          caretMode = true;
          selected.selectAllChildren(block);
          visual = true;
          modeLabel();
          showCaret(true);
          return;
        }
      }
    }
    const { motions, visual: vKey, documentStart, documentEnd, viewTop, viewBottom, details: dKey } = KM.page;
    if (!motions[event.key] && ![vKey, documentStart, documentEnd, viewTop, viewBottom, dKey].includes(event.key)) return;
    if (typeof getSelection().modify !== "function") {
      message("Vim selection is not supported by this browser. Mouse commenting remains available.", true);
      return;
    }
    if (event.key === dKey) {
      const node = getSelection().focusNode;
      const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
      const details = element?.closest(".vp-doc details");
      if (!details) return;
      event.preventDefault();
      details.open = !details.open;
      showCaret();
      return;
    }
    event.preventDefault();
    if (!caretMode && event.key !== vKey) {
      const line = motions[event.key]?.[1] === "line";
      if (line) {
        const dir = motions[event.key][0] === "forward" ? 1 : -1;
        if (!event.repeat) scrollBy(0, dir * 60);
        holdScroll(dir);
      }
      else if (event.key === documentStart || event.key === documentEnd) {
        scrollTo({ top: event.key === documentEnd ? document.documentElement.scrollHeight : 0, behavior: "smooth" });
      } else message("Press i to move the caret");
      return;
    }
    caretMode = true;
    if (motions[event.key]) move(...motions[event.key]);
    else if (event.key === documentStart || event.key === documentEnd) useRange(edgeRange(event.key === documentEnd));
    else if (event.key === viewBottom || event.key === viewTop) useRange(viewRange(event.key === viewTop));
    else {
      if (!ensureCursor()) return;
      const selected = getSelection();
      if (visual) selected.collapse(selected.focusNode, selected.focusOffset);
      else if (selected.isCollapsed) {
        selected.modify("extend", "forward", "character");
        if (!document.querySelector(".vp-doc").contains(selected.focusNode) || selected.isCollapsed) {
          selected.collapse(selected.anchorNode, selected.anchorOffset);
          selected.modify("extend", "backward", "character");
        }
      }
      visual = !visual;
      modeLabel();
      showCaret(true);
    }
  });
  find(".note-save").addEventListener("click", () => {
    noteRequested = true;
    find("form").requestSubmit();
  });
  find(".cancel").addEventListener("click", () => {
    shadow.activeElement?.blur();
    panel.hidden = true;
    message("");
    showCaret();
  });
  find("form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!target || !textarea.value.trim()) return;
    if (!draftId || submittedText !== textarea.value) draftId = crypto.randomUUID();
    submittedText = textarea.value;
    const send = find("button[type=submit]");
    send.disabled = true;
    toggle.disabled = true;
    find(".cancel").disabled = true;
    textarea.readOnly = true;
    message("Saving…");
    try {
      if (!sessionId) sessionId = (await api("status")).sessionId;
      const asNote = noteRequested;
      noteRequested = false;
      await api("comments", { ...target, id: draftId, sessionId, comment: submittedText, ...(draftImages.length ? { images: draftImages.map(shot => shot.id) } : {}), ...(asNote ? { note: true } : {}), ...(branchOf ? { refs: [branchOf] } : {}), ...toValue(composeTo, !find(".to-new").hidden) });
      branchOf = undefined;
      rememberTo(composeTo);
      message(asNote ? "Saved as private note" : "Saved · awaiting review");
      statusTimer = setTimeout(() => message(""), 5000);
      textarea.value = "";
      draftId = undefined;
      draftImages = [];
      renderShots();
      shadow.activeElement?.blur();
      panel.hidden = true;
      getSelection()?.removeAllRanges();
      showCaret();
    } catch (error) {
      message(error.message + " Your draft is kept; press Send to retry.", true);
    } finally {
      send.disabled = false;
      toggle.disabled = false;
      find(".cancel").disabled = false;
      textarea.readOnly = false;
    }
  });

  const COLORS = { yellow: "255,208,0", green: "88,201,122", blue: "90,169,255", pink: "255,126,182", red: "255,90,79" };
  const markStyle = document.createElement("style");
  markStyle.textContent = Object.entries(COLORS).map(([name, rgb]) =>
    `::highlight(preview-comment-${name}){background:rgba(${rgb},.4)}`).join("") +
    "";
  markStyle.textContent += "[data-adr-point]{outline:2px solid #ff5a4f;outline-offset:4px;border-radius:6px}";
  document.head.append(markStyle);
  const popStyle = document.createElement("style");
  popStyle.textContent = ".mark-pop{position:fixed;transform:scale(var(--s,1));transform-origin:top left;width:min(var(--pw,480px),calc(100vw - 24px));max-height:70vh;overflow:auto;" +
    "padding:12px;background:#1b1d22;border:1px solid #59616d;border-radius:12px;box-shadow:0 12px 40px #0008;margin:0}" +
    ".mark-pop .note{margin:8px 0}.mark-pop textarea{width:100%;min-height:54px;box-sizing:border-box}" +
    ".mark-pop .row{display:flex;gap:6px;align-items:center;margin:6px 0}" +
    ".mark-pop .actions{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}" +
    ".mark-pop .actions button{padding:5px 10px;font-size:13px;white-space:nowrap}";
  shadow.append(popStyle);
  const pop = document.createElement("section");
  pop.className = "mark-pop";
  pop.hidden = true;
  shadow.append(pop);
  const rail = find(".rail");
  const pill = find(".pill");
  const toolbar = find(".toolbar");
  let marks = [];
  // Browser zoom shrinks fixed UI with the page; counter-scale so it stays readable when zoomed out.
  const uiScale = () => {
    // devicePixelRatio tracks browser zoom; the largest ratio seen is the 100% baseline (HiDPI screens).
    const base = Math.max(1, Number(localStorage.getItem("preview-comments-dpr")) || 1, devicePixelRatio);
    localStorage.setItem("preview-comments-dpr", base);
    const zoom = devicePixelRatio / base;
    return zoom < 0.95 ? Math.min(3, 1 / zoom) : 1;
  };
  // Pinch-zoom leaves fixed elements on the layout viewport; pull the dock back to the visible corner.
  const applyDock = () => {
    const v = window.visualViewport, root = document.documentElement;
    const k = v ? v.scale : 1;
    const dx = v ? v.offsetLeft + v.width - root.clientWidth : 0;
    const dy = v ? v.offsetTop + v.height - root.clientHeight : 0;
    host.style.setProperty("--dx", `${dx}px`);
    host.style.setProperty("--dy", `${dy}px`);
    host.style.setProperty("--ds", uiScale() / k);
  };
  const applyScale = () => { host.style.setProperty("--s", uiScale()); applyDock(); placeBubbles(); };
  addEventListener("resize", applyScale);
  if (window.visualViewport) { visualViewport.addEventListener("resize", applyDock); visualViewport.addEventListener("scroll", applyDock); }
  const SEEN_KEY = "preview-comments-seen-replies";
  const firstRun = localStorage.getItem(SEEN_KEY) === null;
  let seenMigrated = false;
  const seenReplies = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}");
  // The newest thing the agent said: its latest reply, or the opening comment of an agent-authored thread.
  const lastFromCopilot = comment => {
    const last = comment.replies.at(-1);
    if (last) return last.author === "copilot" ? last.id : undefined;
    return comment.author === "copilot" ? "root" : undefined;
  };
  // A resolved thread resurfaces only for a Copilot reply that arrived after it was resolved.
  const hasFresh = comment => {
    const key = lastFromCopilot(comment);
    if (!key || seenReplies[comment.id] === key || comment.userSeen === key) return false;
    if (!comment.resolved) return true;
    const last = comment.replies.at(-1);
    return Boolean(last && comment.resolvedAt && new Date(last.at) > new Date(comment.resolvedAt));
  };
  function markSeen(comment) {
    const key = lastFromCopilot(comment);
    if (!key || seenReplies[comment.id] === key && comment.userSeen === key) return;
    seenReplies[comment.id] = key;
    comment.userSeen = key;
    localStorage.setItem(SEEN_KEY, JSON.stringify(seenReplies));
    api("userseen", { seen: { [comment.id]: key } }).catch(() => {});
    placeBubbles();
    applyMarks();
    announceAwaiting();
  }
  let hoverColor = localStorage.getItem("preview-comments-color") || "yellow";
  const squash = text => text.normalize("NFKC").replace(/\s+/g, "");
  function swatches(container, chosen, pick) {
    container.replaceChildren();
    for (const name of Object.keys(COLORS)) {
      const button = document.createElement("button");
      button.type = "button";
      button.title = `Highlight ${name}`;
      button.className = `swatch c-${name}${name === chosen ? " on" : ""}`;
      button.addEventListener("mousedown", event => event.preventDefault());
      button.addEventListener("click", () => pick(name));
      container.append(button);
    }
  }
  function locate(doc, quote) {
    const wanted = squash(quote);
    if (!wanted) return;
    let flat = "";
    const index = [];
    const walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, mjx-assistive-mml, [aria-hidden='true']") || !parent.checkVisibility()) continue;
      for (let i = 0; i < node.data.length; i++) {
        for (const char of node.data[i].normalize("NFKC")) {
          if (/\s/.test(char)) continue;
          flat += char;
          index.push([node, i]);
        }
      }
    }
    const at = flat.indexOf(wanted);
    if (at < 0) return;
    const range = document.createRange();
    range.setStart(...index[at]);
    const [endNode, endOffset] = index[at + wanted.length - 1];
    range.setEnd(endNode, endOffset + 1);
    return range;
  }
  // Pages with canvas content (graphs) expose window.previewCommentTargets.get(id) →
  // { kind: "node"|"edge", quote, rect } (rect in viewport coordinates, null if not visible)
  const customTarget = id => window.previewCommentTargets?.get?.(id) || null;
  function customChosen(id) {
    const item = customTarget(id);
    if (!item) return null;
    const url = new URL(location.href);
    url.hash = `${item.kind}-${id}`;
    return {
      chosen: { kind: item.kind, quote: item.quote, anchor: `${item.kind}-${id}`, url: url.href, section: document.title },
      anchor: { getBoundingClientRect: () => customTarget(id)?.rect || { top: -1e4, bottom: -1e4, left: 0, right: 0 } },
    };
  }
  document.addEventListener("preview-comment-pick", event => {
    setTimeout(() => { const item = customChosen(event.detail?.id); if (item) offer(item.chosen, item.anchor); }, 0);
  });
  document.addEventListener("preview-comment-open", event => {
    const item = customChosen(event.detail?.id);
    if (item) open(item.chosen, item.anchor);
  });
  document.addEventListener("preview-comment-reflow", () => { if (marks.length) requestAnimationFrame(placeBubbles); });
  // Bubbles sit at the comment: left of the text block, on a graph node's top-right
  // corner, above an edge label. Overlapping bubbles are nudged apart.
  function bubbleSpot(mark) {
    const rect = mark.range.getBoundingClientRect();
    if (!(rect.top >= 0) && !(rect.top < 0)) return null;
    const size = 24 * uiScale();
    if (mark.custom) {
      const edge = mark.comment.kind === "edge";
      return edge ? { x: (rect.left + rect.right) / 2 - size / 2, y: rect.top - size - 4, dx: 0, dy: -size - 2 }
        : { x: rect.right - size / 2, y: rect.top - size / 2, dx: size + 2, dy: 0 };
    }
    const doc = document.querySelector(".vp-doc");
    const left = doc ? doc.getBoundingClientRect().left : rect.left;
    return { x: Math.max(4, left - size - 6), y: rect.top, dx: 0, dy: size + 2 };
  }
  function placeBubbles() {
    rail.replaceChildren();
    const top = viewportTop();
    const taken = [];
    const size = 24 * uiScale();
    const total = Math.max(document.documentElement.scrollHeight, 1);
    for (const mark of marks) {
      if (mark.comment.resolved && !hasFresh(mark.comment)) continue;
      const rect = mark.range.getBoundingClientRect();
      if (Number.isFinite(rect.top)) {
        const docY = rect.top + scrollY;
        const tick = document.createElement("button");
        tick.type = "button";
        tick.className = `tick c-${mark.comment.color || "yellow"}`;
        tick.title = (mark.comment.comment || mark.comment.quote || "Comment").slice(0, 80);
        tick.style.top = `${Math.min(innerHeight - 4, docY / total * innerHeight)}px`;
        tick.addEventListener("click", event => { event.stopPropagation(); scrollTo({ top: Math.max(0, docY - innerHeight / 3), behavior: "smooth" }); });
        rail.append(tick);
      }
      const spot = bubbleSpot(mark);
      if (!spot || !(spot.y >= top) || spot.y > innerHeight - 40) continue;
      let { x, y } = spot;
      while (taken.some(t => Math.abs(t.x - x) < size && Math.abs(t.y - y) < size)) {
        x += spot.dx; y += spot.dy;
        if (y > innerHeight - 40 || y < top || x > innerWidth - size) break;
      }
      taken.push({ x, y });
      const bubble = document.createElement("button");
      bubble.type = "button";
      bubble.className = `bubble c-${mark.comment.color || "yellow"}${hasFresh(mark.comment) ? " fresh" : ""}`;
      const count = mark.comment.replies.length + (mark.comment.comment ? 1 : 0);
      bubble.textContent = count ? String(count) : "";
      bubble.style.left = `${x}px`;
      bubble.style.top = `${y}px`;
      bubble.addEventListener("click", event => { event.stopPropagation(); showMark(mark, bubble.getBoundingClientRect()); });
      rail.append(bubble);
    }
  }
  function findEquation(doc, quote) {
    return [...doc.querySelectorAll("mjx-container")].find(el => {
      const label = el.querySelector("mlabeledtr > mtd")?.textContent;
      return (label ? `Equation ${label}` : el.textContent.trim()) === quote;
    });
  }
  function applyMarks() {
    const doc = document.querySelector(".vp-doc");
    marks = [];
    const here = pagePath(location.href);
    document.querySelectorAll("[data-adr-point]").forEach(el => delete el.dataset.adrPoint);
    for (const comment of historyComments) {
      if (comment.removed || pagePath(comment.url) !== here) continue;
      if (comment.kind === "node" || comment.kind === "edge") {
        const id = comment.anchor.replace(/^(node|edge)-/, "");
        marks.push({ custom: true, comment, range: { getBoundingClientRect: () => customTarget(id)?.rect || { top: NaN } } });
      } else if (comment.kind === "equation" && doc) {
        const el = findEquation(doc, comment.quote);
        if (el) {
          if (comment.author === "copilot" && !comment.resolved) el.dataset.adrPoint = "";
          marks.push({ custom: true, comment, range: { getBoundingClientRect: () => el.getBoundingClientRect() } });
        }
      } else if (comment.kind === "figure" && doc && /^Video .+ @ /.test(comment.quote)) {
        const name = comment.quote.slice(6, comment.quote.lastIndexOf(" @ "));
        const el = [...doc.querySelectorAll("video")].find(v => videoName(v) === name);
        if (el) marks.push({ custom: true, comment, range: { getBoundingClientRect: () => el.getBoundingClientRect() } });
      } else if (doc && CSS.highlights) {
        const range = locate(doc, comment.quote);
        if (range) marks.push({ range, comment });
      }
    }
    if (!CSS.highlights) { placeBubbles(); return; }
    for (const name of Object.keys(COLORS)) {
      const ranges = marks.filter(mark => !mark.custom && (mark.comment.color || "yellow") === name)
        .map(mark => mark.range);
      if (ranges.length) CSS.highlights.set(`preview-comment-${name}`, new Highlight(...ranges));
      else CSS.highlights.delete(`preview-comment-${name}`);
    }
    const open = marks.filter(mark => !mark.comment.resolved || hasFresh(mark.comment)).length;
    const waiting = marks.some(mark => mark.comment.comment && !mark.comment.seen && !mark.comment.resolved);
    // Seen state lives on the server. The first browser to meet a store without it uploads what it knows
    // (a brand-new browser counts every existing reply as seen); later browsers just read the server's.
    if (!serverSeenInit && !seenMigrated && historyRevision >= 0) {
      seenMigrated = true;
      if (firstRun && localStorage.getItem(SEEN_KEY) === null) {
        for (const item of historyComments) { const last = item.replies.at(-1); if (last) seenReplies[item.id] = last.id; }
        localStorage.setItem(SEEN_KEY, JSON.stringify(seenReplies));
      }
      const entries = Object.entries(seenReplies).filter(([id]) => historyComments.some(item => item.id === id));
      if (!entries.length) api("userseen", { seen: {} }).catch(() => {});
      for (let from = 0; from < entries.length; from += 100) {
        api("userseen", { seen: Object.fromEntries(entries.slice(from, from + 100)) }).catch(() => {});
      }
    }
    const fresh = marks.filter(mark => hasFresh(mark.comment)).length;
    pill.classList.toggle("alert", fresh > 0);
    find(".pill-label").textContent = fresh ? `${fresh} new ${fresh === 1 ? "reply" : "replies"}` : open ? `${open} on this page` : "Comments";
    find(".dot").classList.toggle("waiting", waiting);
    placeBubbles();
  }
  async function update(comment, values) {
    await api("updates", { ...values, id: crypto.randomUUID(), sessionId, commentId: comment.id });
    await refreshHistory();
    applyMarks();
  }
  function showMark(mark, at) {
    const { comment } = mark;
    popComment = comment;
    setTimeout(() => markSeen(comment), 0);
    const state = document.createElement("small");
    const replies = comment.replies.length;
    state.textContent = `${comment.resolved ? "Resolved" : comment.note ? "Private note" : comment.comment ? "Open" : "Highlight"}` +
      (replies ? ` · ${replies} ${replies === 1 ? "reply" : "replies"}` : "");
    const colors = document.createElement("div");
    colors.className = "row";
    swatches(colors, comment.color || "yellow", name => update(comment, { color: name }).then(() => { pop.hidden = true; }));
    const redo = values => update(comment, values).then(() => {
      const fresh = marks.find(item => item.comment.id === comment.id);
      if (fresh) showMark(fresh, at);
      else pop.hidden = true;
    });
    const notes = threadNodes(comment, redo);
    const input = document.createElement("textarea");
    input.placeholder = comment.comment ? "Reply… (Ctrl+Enter)" : "Add a comment… (Ctrl+Enter)";
    const popTo = new Set(comment.to?.length ? comment.to : defaultTo());
    const popRow = document.createElement("div");
    popRow.className = "to";
    chipRow(popRow, popTo);
    const send = async (note = false) => {
      if (!input.value.trim()) return;
      await update(comment, { reply: input.value, ...(note ? { note: true } : {}), ...toValue(popTo, !popRow.hidden) });
      rememberTo(popTo);
      pop.hidden = true;
    };
    input.addEventListener("keydown", event => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); send(); }
      if (event.key === "Escape") { event.stopPropagation(); pop.hidden = true; }
    });
    const actions = document.createElement("div");
    actions.className = "actions";
    const button = (label, run) => {
      const node = document.createElement("button");
      node.type = "button";
      node.textContent = label;
      node.addEventListener("click", run);
      return node;
    };
    actions.append(button("Close", () => { pop.hidden = true; }));
    if (comment.comment) {
      actions.append(button(comment.resolved ? "Reopen" : "Resolve",
        () => update(comment, { resolved: !comment.resolved }).then(() => { pop.hidden = true; })));
      actions.append(button("Delete comment", () => update(comment, { clear: true }).then(() => { pop.hidden = true; })));
    }
    actions.append(button("Remove highlight", () => update(comment, { removed: true }).then(() => { pop.hidden = true; })));
    if (comment.note) actions.append(button("Send to Copilot", () => redo({ promote: true })));
    actions.append(button("Region", () => regionThread(ids => redo({ addImages: ids }))),
      button("Note", () => send(true)), button("Send", () => send()));
    pop.replaceChildren(state, colors, ...notes, popRow, input, actions);
    pop.hidden = false;
    pop.style.left = `${Math.max(12, Math.min(at.left, innerWidth - pop.offsetWidth * uiScale() - 12))}px`;
    pop.style.top = `${Math.max(12, Math.min(at.top + 14, innerHeight - pop.offsetHeight * uiScale() - 12))}px`;
    input.focus();
  }
  document.addEventListener("click", event => {
    if (host.contains(event.target) || !getSelection().isCollapsed) return;
    const caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const hit = caret && marks.filter(mark => !mark.custom && mark.range.isPointInRange(caret.offsetNode, caret.offset))
      .sort((a, b) => a.range.toString().length - b.range.toString().length)[0];
    if (hit) showMark(hit, { left: event.clientX, top: event.clientY });
    else pop.hidden = true;
  });
  swatches(find(".swatches"), hoverColor, async name => {
    hoverColor = name;
    localStorage.setItem("preview-comments-color", name);
    if (!offeredTarget) return;
    try {
      if (!sessionId) sessionId = (await api("status")).sessionId;
      await api("comments", { ...offeredTarget, id: crypto.randomUUID(), sessionId, highlight: true, color: name });
      getSelection().removeAllRanges();
      contextual.hidden = true;
      await refreshHistory();
      applyMarks();
    } catch (error) { message(error.message, true); }
  });
  find(".ctx-comment").addEventListener("click", () => open(offeredTarget, offeredAnchor));
  pill.addEventListener("click", () => {
    if (pill.classList.contains("alert")) {
      const next = historyComments.find(c => !c.removed && (hasFresh(c) || awaiting(c)));
      if (next) { openThreadById(next.id); return; }
    }
    toolbar.hidden = !toolbar.hidden;
    pill.setAttribute("aria-expanded", String(!toolbar.hidden));
  });
  textarea.addEventListener("keydown", event => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); find("form").requestSubmit(); }
  });
  replyInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); find(".reply-form").requestSubmit(); }
  });
  const clock = seconds => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;
  const videoName = video => (video.currentSrc || video.src || "video").split("/").pop().split("?")[0];
  function enhanceVideos() {
    for (const video of document.querySelectorAll(".vp-doc video")) {
      if (video.dataset.adrBar) continue;
      video.dataset.adrBar = "1";
      let fps = 25;
      if (video.requestVideoFrameCallback) {
        let last;
        const probe = (now, meta) => {
          if (last !== undefined && meta.mediaTime > last) fps = Math.round(1 / (meta.mediaTime - last)) || fps;
          last = meta.mediaTime;
          if (!video.paused) video.requestVideoFrameCallback(probe);
        };
        video.addEventListener("play", () => { last = undefined; video.requestVideoFrameCallback(probe); });
      }
      const bar = document.createElement("div");
      bar.style.cssText = "display:flex;gap:6px;align-items:center;margin:4px 0 16px;font:13px system-ui;color:#b7c1ce";
      const time = document.createElement("span");
      time.style.cssText = "min-width:70px;font-variant-numeric:tabular-nums";
      const make = (label, title, action) => {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = label; b.title = title;
        b.style.cssText = "padding:3px 9px;border:1px solid #444c56;border-radius:6px;background:#22272e;color:#d0d7de;cursor:pointer";
        b.addEventListener("click", action);
        return b;
      };
      const step = frames => { video.pause(); video.currentTime = Math.max(0, video.currentTime + frames / fps); };
      bar.append(
        make("◀ frame", "Back one frame", () => step(-1)),
        make("frame ▶", "Forward one frame", () => step(1)),
        time,
        make("💬 Comment at this time", "Comment on this moment", () => {
          video.pause();
          open(context(video, "figure", `Video ${videoName(video)} @ ${clock(video.currentTime)}`), video);
        }));
      const refresh = () => { time.textContent = clock(video.currentTime); };
      video.addEventListener("timeupdate", refresh);
      video.addEventListener("seeked", refresh);
      refresh();
      video.after(bar);
    }
  }
  // The plugin may be updated under a running preview; say so instead of leaving old code in place.
  async function checkVersion() {
    try {
      const { running, onDisk } = await (await fetch("/__adr/version")).json();
      const stale = find(".sb-stale");
      stale.hidden = !running || !onDisk || running === onDisk;
      stale.textContent = `ADR ${onDisk} installed · restart preview`;
      stale.title = `This preview runs ADR ${running}`;
    } catch { /* static or offline */ }
  }
  checkVersion();
  setInterval(checkVersion, 60000);
  async function syncMarks() {
    enhanceVideos();
    try { await refreshHistory(); } catch { /* the bridge may be offline; keep the last marks */ }
    const pendingOpen = sessionStorage.getItem("adr-open-thread");
    if (pendingOpen && historyComments.some(c => c.id === pendingOpen)) {
      sessionStorage.removeItem("adr-open-thread");
      openThreadById(pendingOpen);
    }
    applyMarks();
    announceAwaiting();
  }
  let markTimer;
  new MutationObserver(() => { syncBanners(); clearTimeout(markTimer); markTimer = setTimeout(applyMarks, 150); })
    .observe(document.body, { attributes: true, attributeFilter: ["hidden"], subtree: true });
  new MutationObserver(syncBanners).observe(shadow, { attributes: true, attributeFilter: ["hidden"], subtree: true });
  addEventListener("scroll", () => { if (marks.length) requestAnimationFrame(placeBubbles); }, { passive: true });
  addEventListener("resize", applyMarks);
  applyScale();
  syncMarks();
  setInterval(syncMarks, 3000);
  // Landing on #anchor (also after SPA navigation): scroll the target clear of the nav bar and flash it.
  const landing = document.createElement("style");
  landing.textContent = `@keyframes adr-land{0%,60%{background:rgba(250,204,21,.38);outline:2px solid #facc15}100%{background:transparent;outline:2px solid transparent}}
    .adr-landed{animation:adr-land 2s ease-out;border-radius:4px;scroll-margin-top:calc(var(--vp-nav-height,64px) + 56px)}
    @media (prefers-reduced-motion:reduce){.adr-landed{animation:none;background:rgba(250,204,21,.3);transition:background 2s}}`;
  document.head.append(landing);
  let landed = "", landTries;
  function land() {
    const hash = decodeURIComponent(location.hash.slice(1));
    const key = location.pathname + "#" + hash;
    if (key === landed) return;
    if (!hash || /^(node|edge)-/.test(hash)) { landed = key; return; }
    const target = document.getElementById(hash);
    if (!target || !target.closest(".vp-doc")) { if ((landTries = (landTries ?? 0) + 1) > 20) landed = key; return; }
    landed = key; landTries = undefined;
    const mark = target.textContent.trim() ? target : target.parentElement;
    mark.classList.remove("adr-landed");
    void mark.offsetWidth;
    mark.classList.add("adr-landed");
    mark.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setTimeout(() => mark.classList.remove("adr-landed"), 2200);
  }
  addEventListener("hashchange", () => { landed = ""; });
  setInterval(land, 250);
  const agentLine = find(".agent-status");
  let blocked = false;
  async function pollAgent() {
    try {
      const { agent } = await api("status");
      const now = agent?.state === "blocked";
      agentLine.hidden = !agent || agent.state === "idle" || !agent.text;
      agentLine.classList.toggle("blocked", now);
      if (!agentLine.hidden) agentLine.textContent = now ? `Copilot needs help: ${agent.text}` : `Copilot · ${agent.state}: ${agent.text}`;
      find(".dot").classList.toggle("blocked", now);
      if (now && !blocked) {
        find(".statusbar").hidden = false;
        if (globalThis.Notification?.permission === "granted") new Notification("Copilot is blocked", { body: agent.text });
        else if (globalThis.Notification?.permission === "default") Notification.requestPermission();
      }
      if (now !== blocked) {
        blocked = now;
        document.title = now ? `⛔ ${document.title}` : document.title.replace(/^⛔ /, "");
      }
    } catch { agentLine.hidden = true; }
  }
  setInterval(pollAgent, 2500);
  loadSettings();
  setInterval(loadSettings, 15000);
})();
