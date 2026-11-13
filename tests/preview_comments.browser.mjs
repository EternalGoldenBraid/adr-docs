async (page) => {
  const { origin, hostname } = await page.evaluate(() => ({
    origin: window.location.origin, hostname: window.location.hostname,
  }));
  if (hostname !== "127.0.0.1") {
    throw new Error("Open a local document preview before running the browser regression.");
  }
  const assert = {
    equal(actual, expected) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    ok(value) { if (!value) throw new Error("Browser invariant failed"); },
    match(value, pattern) { if (!pattern.test(value)) throw new Error(`Expected ${pattern}, got ${value}`); },
  };
  const check = await page.context().newPage();
  check.setDefaultTimeout(5000);
  const submissions = [];
  const threadUpdates = [];
  const threads = new Map();
  const updates = new Set();
  let revision = 0;
  let reject = true;
  let holdHistory = false;
  let historyStarted;
  let releaseHistory;
  let stage = "initial navigation";
  try {
    await check.addInitScript(() => {
      window.previousVimPreference = localStorage.getItem("preview-comments-vim");
      localStorage.setItem("preview-comments-vim", "on");
      const start = window.setInterval.bind(window);
      const stop = window.clearInterval.bind(window);
      window.historyIntervals = new Set();
      window.historyIntervalStarts = 0;
      window.setInterval = (callback, delay) => {
        const id = start(callback, delay);
        if (delay === 2000) { window.historyIntervals.add(id); window.historyIntervalStarts++; }
        return id;
      };
      window.clearInterval = id => { window.historyIntervals.delete(id); stop(id); };
    });
    await check.route(origin + "/preview-vim-test", route => route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta charset="utf-8"><style>
        body{font:18px/1.6 system-ui;margin:0}
        .VPNav{position:fixed;top:0;height:52px;background:#eee;width:100%}
        .VPLocalNav{position:fixed;top:52px;height:48px;background:#ddd;width:100%}
        .vp-doc{width:460px;margin:120px auto}
        p{margin:30px 0}img{width:120px;height:60px}
      </style></head><body><nav class="VPNav">Outside article</nav>
      <nav class="VPLocalNav">Article outline</nav>
      <main class="vp-doc"><h1 id="article">Keyboard article</h1>
      <p id="first">Alpha beta gamma delta. A second sentence gives the visual cursor
      another rendered line to select without editing the article.</p>
      <details><summary>Geometry caveat</summary><p>Hidden until opened.</p></details>
      <img alt="Test figure" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Crect width='120' height='60' fill='orange'/%3E%3C/svg%3E">
      <mjx-container display="true"><mlabeledtr><mtd>(3)</mtd></mlabeledtr>Equation</mjx-container>
      <svg id="geometry" role="img" aria-label="Interactive geometry" viewBox="0 0 200 80" width="200" height="80">
        <circle cx="40" cy="40" r="15" fill="orange"/><text x="80" y="45">Scene feature X</text>
      </svg>
      <label for="baseline">Camera baseline</label><input id="baseline" type="range" min="0" max="7" step="0.1" value="3">
      ${Array.from({ length: 24 }, (_, i) => `<p>Paragraph ${i}: rendered lines give
      viewport navigation a bounded article to move through. Alpha beta gamma delta.</p>`).join("")}
      <p id="last">Last article text.</p></main>
      <input id="outside" aria-label="Other input"><footer>Outside footer</footer>
      <script src="/__preview_comments/client.js"></script></body></html>`,
    }));
    await check.route("**/__preview_comments/status", route => route.fulfill({
      contentType: "application/json", body: JSON.stringify({ sessionId: "browser-check-session" }),
    }));
    await check.route("**/__preview_comments/comments", route => {
      const input = route.request().postDataJSON();
      submissions.push(input);
      if (!threads.has(input.id)) {
        threads.set(input.id, { ...input, at: new Date().toISOString(), seen: false, resolved: false, replies: [] });
        revision++;
      }
      return route.fulfill({
        status: reject ? 503 : 200, contentType: "application/json",
        body: JSON.stringify(reject
          ? { saved: true, error: "Notification check failure" }
          : { id: input.id, saved: true, awaitingReview: true }),
      });
    });
    await check.route("**/__preview_comments/history", async route => {
      if (holdHistory) {
        holdHistory = false;
        await new Promise(resolve => { releaseHistory = resolve; historyStarted(); });
      }
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ sessionId: "browser-check-session", revision, comments: [...threads.values()] }),
      });
    });
    await check.route("**/__preview_comments/updates", route => {
      const input = route.request().postDataJSON();
      threadUpdates.push(input);
      const thread = threads.get(input.commentId);
      if (!updates.has(input.id)) {
        updates.add(input.id);
        if (input.reply !== undefined) {
          thread.replies.push({ id: input.id, author: "user", at: new Date().toISOString(), comment: input.reply });
        }
        if (input.resolved !== undefined) thread.resolved = input.resolved;
        thread.seen = false;
        revision++;
      }
      return route.fulfill({
        status: reject ? 503 : 200, contentType: "application/json",
        body: JSON.stringify(reject ? { saved: true, error: "Notification check failure" }
          : { id: input.id, saved: true, resolved: thread.resolved }),
      });
    });
    await check.goto(origin + "/preview-vim-test");
    const panel = check.locator("#preview-comment-overlay .panel:not(.history)");
    const mode = check.locator("#preview-comment-overlay .vim-mode");
    const textarea = check.locator("#preview-comment-overlay #comment-body");
    const status = check.locator("#preview-comment-overlay .status");
    await mode.waitFor();
    assert.match(await mode.textContent(), /NORMAL/);
    const cursor = () => check.evaluate(() => {
      const selected = getSelection();
      const range = document.createRange();
      range.setStart(selected.focusNode, selected.focusOffset);
      range.collapse(true);
      return {
        node: selected.focusNode.textContent, offset: selected.focusOffset,
        inside: document.querySelector(".vp-doc").contains(selected.focusNode),
        top: range.getBoundingClientRect().top, text: selected.toString(),
      };
    });
    await check.keyboard.press("g");
    await check.keyboard.press("g");
    await check.keyboard.press("h");
    assert.equal((await cursor()).offset, 0);
    assert.equal((await cursor()).inside, true);
    await check.keyboard.press("l");
    assert.equal((await cursor()).offset, 1);
    await check.locator("#first").evaluate(element => getSelection().collapse(element.firstChild, 0));
    stage = "visual comment";
    await check.keyboard.press("v");
    await check.keyboard.press("w");
    assert.equal((await cursor()).text, "Alpha");
    await check.keyboard.press("j");
    const selected = (await cursor()).text.trim();
    assert.ok(selected.startsWith("Alpha") && selected.length > 5);
    assert.match(await mode.textContent(), /VISUAL/);
    await check.keyboard.press("c");
    await textarea.waitFor({ state: "visible" });
    assert.match(await mode.textContent(), /COMMENT/);
    assert.equal(await panel.locator(".quote").textContent(), selected);
    await textarea.fill("Native input: ");
    await check.keyboard.type("hjklv-c");
    const draft = "Native input: hjklv-c";
    assert.equal(await textarea.inputValue(), draft);
    await check.keyboard.press("Escape");
    assert.equal(await panel.isHidden(), true);
    assert.equal(await textarea.inputValue(), draft);
    await check.keyboard.press("-");
    await check.keyboard.press("c");
    stage = "resuming the draft";
    await textarea.waitFor({ state: "visible" });
    assert.equal(await textarea.inputValue(), draft);
    await check.getByRole("button", { name: "Send", exact: true }).click();
    await status.filter({ hasText: "Your draft is kept" }).waitFor();
    assert.equal(await textarea.inputValue(), draft);
    reject = false;
    stage = "retrying the same comment";
    await check.getByRole("button", { name: "Send", exact: true }).click();
    await status.filter({ hasText: "Saved · awaiting review" }).waitFor();
    assert.equal(submissions.length, 2);
    assert.equal(submissions[0].id, submissions[1].id);
    assert.equal(submissions[1].quote, selected);

    stage = "contextual text comment";
    await check.locator("#first").evaluate(element => {
      const range = document.createRange();
      range.setStart(element.firstChild, 0);
      range.setEnd(element.firstChild, 5);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      element.scrollIntoView({ block: "center" });
    });
    const nearby = check.getByRole("button", { name: "Comment here", exact: true });
    await nearby.waitFor({ state: "visible" });
    await nearby.click();
    await textarea.waitFor({ state: "visible" });
    assert.equal(await panel.locator(".quote").textContent(), "Alpha");
    assert.equal(await panel.evaluate(element => element.classList.contains("contextual-panel")), true);
    const panelBounds = await panel.boundingBox();
    const viewport = check.viewportSize();
    assert.ok(panelBounds.x >= 0 && panelBounds.y >= 0 &&
      panelBounds.x + panelBounds.width <= viewport.width &&
      panelBounds.y + panelBounds.height <= viewport.height);
    await textarea.fill("Text beside its selection.");
    await check.getByRole("button", { name: "Send", exact: true }).click();
    await panel.waitFor({ state: "hidden" });

    stage = "native slider and contextual control snapshot";
    await check.locator("#baseline").scrollIntoViewIfNeeded();
    await check.locator("#baseline").focus();
    await check.keyboard.press("ArrowRight");
    assert.equal(await check.locator("#baseline").inputValue(), "3.1");
    await nearby.waitFor({ state: "visible" });
    await nearby.click();
    await textarea.waitFor({ state: "visible" });
    assert.equal(await panel.locator(".quote").textContent(), "Camera baseline: 3.1");
    await textarea.fill("Control at its current value.");
    await check.getByRole("button", { name: "Send", exact: true }).click();
    await panel.waitFor({ state: "hidden" });
    assert.equal(submissions.at(-1).kind, "text");

    stage = "contextual inline SVG and SVG label";
    await check.locator("#geometry circle").click();
    await nearby.waitFor({ state: "visible" });
    await nearby.click();
    await textarea.waitFor({ state: "visible" });
    assert.equal(await panel.locator(".quote").textContent(), "Interactive geometry");
    await textarea.fill("Interactive figure.");
    await check.getByRole("button", { name: "Send", exact: true }).click();
    await panel.waitFor({ state: "hidden" });
    assert.equal(submissions.at(-1).kind, "figure");
    await check.locator("#geometry text").click();
    await nearby.waitFor({ state: "visible" });
    await nearby.click();
    await textarea.waitFor({ state: "visible" });
    assert.equal(await panel.locator(".quote").textContent(), "Scene feature X");
    await check.keyboard.press("Escape");
    await check.evaluate(() => getSelection().removeAllRanges());

    stage = "mouse figure targeting";
    await check.getByRole("button", { name: "Comment", exact: true }).click();
    await check.locator(".vp-doc img").click();
    await textarea.waitFor({ state: "visible" });
    await textarea.fill("Figure via mouse.");
    await check.getByRole("button", { name: "Send", exact: true }).click();
    await panel.waitFor({ state: "hidden" });
    assert.equal(submissions.at(-1).kind, "figure");
    stage = "mouse equation targeting";
    await check.getByRole("button", { name: "Comment", exact: true }).click();
    await check.locator("mjx-container").click();
    await textarea.waitFor({ state: "visible" });
    assert.equal(await panel.locator(".quote").textContent(), "Equation (3)");
    await check.keyboard.press("Escape");

    stage = "document and viewport bounds";
    await check.keyboard.press("G");
    await check.keyboard.press("l");
    assert.equal((await cursor()).node, "Last article text.");
    assert.equal((await cursor()).inside, true);
    await check.locator(".vp-doc > p").nth(12).scrollIntoViewIfNeeded();
    await check.keyboard.press("L");
    const top = (await cursor()).top;
    assert.ok(top >= 112);
    await check.keyboard.press("H");
    assert.ok((await cursor()).top > top + 100);
    await check.locator(".vp-doc summary").evaluate(element => {
      element.parentElement.open = false;
      element.scrollIntoView();
      getSelection().collapse(element.firstChild, 0);
    });
    await check.keyboard.press("Space");
    assert.equal(await check.locator(".vp-doc details").evaluate(element => element.open), true);

    stage = "toggle and native input";
    await mode.click();
    assert.match(await mode.textContent(), /OFF/);
    const stopped = await cursor();
    await check.keyboard.press("l");
    assert.equal((await cursor()).offset, stopped.offset);
    await mode.click();
    await check.locator("#outside").fill("");
    await check.keyboard.type("hjklv-c");
    assert.equal(await check.locator("#outside").inputValue(), "hjklv-c");
    await check.locator("#outside").evaluate(element => element.blur());
    const nativeCursor = await cursor();
    await check.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "j", ctrlKey: true, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "v", isComposing: true, bubbles: true }));
    });
    assert.equal((await cursor()).offset, nativeCursor.offset);
    assert.match(await mode.textContent(), /NORMAL/);
    await check.evaluate(() => {
      Object.defineProperty(getSelection(), "modify", { value: undefined, configurable: true });
    });
    await check.keyboard.press("v");
    await status.filter({ hasText: "not supported by this browser" }).waitFor();
    await check.evaluate(() => { delete getSelection().modify; });

    stage = "persistent history and replies";
    const firstThread = threads.get(submissions[0].id);
    firstThread.resolved = true;
    firstThread.replies.push({
      id: "11111111-1111-4111-8111-111111111111", author: "copilot",
      at: new Date().toISOString(), comment: "Implemented in abc123.",
    });
    revision++;
    await check.keyboard.press("-");
    await check.keyboard.press("h");
    const history = check.locator("#preview-comment-overlay .history");
    await history.waitFor({ state: "visible" });
    assert.match(await mode.textContent(), /HISTORY/);
    await history.locator(".tab[data-filter=resolved]").click();
    await history.locator(".thread-card").waitFor();
    assert.equal(await history.locator(".thread-card").count(), 1);
    await history.locator(`.thread-card[data-comment-id="${firstThread.id}"]`).click();
    assert.ok((await history.locator(".thread-messages").textContent()).includes("Copilot"));
    assert.ok((await history.locator(".thread-messages").textContent()).includes("Implemented in abc123."));
    const replyInput = history.locator("#thread-reply");
    const hostileText = "<img src=x onerror=alert(1)> Is this resolved?";
    await replyInput.fill(hostileText);
    reject = true;
    await history.getByRole("button", { name: "Reply", exact: true }).click();
    await status.filter({ hasText: "Your reply draft is kept" }).waitFor();
    assert.equal(await replyInput.inputValue(), hostileText);
    reject = false;
    await history.getByRole("button", { name: "Reply", exact: true }).click();
    await status.filter({ hasText: "Reply saved" }).waitFor();
    assert.equal(threadUpdates[0].id, threadUpdates[1].id);
    assert.equal(firstThread.replies.length, 2);
    await history.locator(".note p").filter({ hasText: hostileText }).waitFor();
    assert.equal(await history.locator(".thread-messages img").count(), 0);
    assert.ok((await history.locator(".thread-state").textContent()).startsWith("Resolved"));

    await replyInput.fill("Keep this unsent reply.");
    firstThread.replies.push({
      id: "22222222-2222-4222-8222-222222222222", author: "copilot",
      at: new Date().toISOString(), comment: "Additional context arrived.",
    });
    revision++;
    await history.locator(".note p").filter({ hasText: "Additional context arrived." }).waitFor();
    assert.equal(await replyInput.inputValue(), "Keep this unsent reply.");
    assert.equal(await replyInput.evaluate(element => element === element.getRootNode().activeElement), true);
    await history.locator(".note").first().evaluate(element => { window.originalHistoryNote = element; });
    firstThread.seen = true;
    revision++;
    await history.locator(".thread-state").filter({ hasText: /\bRead by Copilot$/ }).waitFor();
    assert.equal(await history.locator(".note").first().evaluate(element => element === window.originalHistoryNote), true);
    await history.getByRole("button", { name: "Back", exact: true }).click();
    await history.locator(".tab[data-filter=all]").click();
    const otherThread = [...threads.values()].find(thread => thread.id !== firstThread.id);
    await history.locator(`.thread-card[data-comment-id="${otherThread.id}"]`).click();
    assert.equal(await replyInput.inputValue(), "");
    await history.getByRole("button", { name: "Back", exact: true }).click();
    await history.locator(`.thread-card[data-comment-id="${firstThread.id}"]`).click();
    assert.equal(await replyInput.inputValue(), "Keep this unsent reply.");
    await history.getByRole("button", { name: "Reopen", exact: true }).click();
    await history.locator(".thread-state").filter({ hasText: /^Unresolved\b/ }).waitFor();
    await history.getByRole("button", { name: "Resolve", exact: true }).click();
    await history.locator(".thread-state").filter({ hasText: /^Resolved\b/ }).waitFor();
    assert.equal(await replyInput.inputValue(), "Keep this unsent reply.");
    await check.keyboard.press("Escape");
    assert.equal(await history.isHidden(), true);
    await check.keyboard.press("-");
    await check.keyboard.press("h");
    await history.waitFor({ state: "visible" });
    assert.equal(await replyInput.inputValue(), "Keep this unsent reply.");
    await check.keyboard.press("Escape");
    await check.locator("#first").evaluate(element => getSelection().collapse(element.firstChild, 0));
    await check.keyboard.press("v");
    await check.keyboard.press("w");
    await check.keyboard.press("c");
    await textarea.waitFor({ state: "visible" });
    await textarea.fill("Keep the original comment draft.");
    await check.getByRole("button", { name: "History", exact: true }).click();
    await history.waitFor({ state: "visible" });
    assert.equal(await textarea.inputValue(), "Keep the original comment draft.");
    await check.keyboard.press("Escape");
    await check.keyboard.press("-");
    await check.keyboard.press("c");
    await textarea.waitFor({ state: "visible" });
    assert.equal(await textarea.inputValue(), "Keep the original comment draft.");
    stage = "closing and reopening history during its initial request";
    await check.keyboard.press("Escape");
    const intervalStarts = await check.evaluate(() => window.historyIntervalStarts);
    const paused = new Promise(resolve => { historyStarted = resolve; });
    holdHistory = true;
    await check.getByRole("button", { name: "History", exact: true }).click();
    await paused;
    await check.keyboard.press("Escape");
    await check.getByRole("button", { name: "History", exact: true }).click();
    await check.waitForFunction(starts => window.historyIntervalStarts === starts + 1, intervalStarts);
    releaseHistory();
    await check.waitForFunction(starts => window.historyIntervalStarts === starts + 2, intervalStarts);
    assert.equal(await check.evaluate(() => window.historyIntervals.size), 1);
    await check.keyboard.press("Escape");
    assert.equal(await check.evaluate(() => window.historyIntervals.size), 0);
    return {
      navigation: true, visualSelection: true, nativeInput: true, draftAndRetry: true,
      mouseTargets: true, articleBounds: true, viewportBindings: true, folding: true,
      vimToggle: true, unsupportedBrowserNotification: true, liveCommentsSubmitted: false,
      historyFilters: true, copilotReplies: true, userReplyRetry: true, safeTextRendering: true,
      resolution: true, draftPreservedAcrossPollingAndThreads: true,
      historyPollingLifecycle: true,
      contextualTextAndPanel: true, nativeControlSnapshots: true, inlineSvgAndLabels: true,
    };
  } catch (error) {
    const state = await check.evaluate(() => {
      const root = document.querySelector("#preview-comment-overlay")?.shadowRoot;
      return {
        status: root?.querySelector(".status").textContent,
        panelHidden: root?.querySelector(".panel").hidden,
        draftLength: root?.querySelector("textarea").value.length,
      };
    });
    throw new Error(`${stage}: ${error.message}; ${JSON.stringify({ ...state, submissions: submissions.length })}`);
  } finally {
    releaseHistory?.();
    await check.evaluate(() => {
      if (window.previousVimPreference === null) localStorage.removeItem("preview-comments-vim");
      else if (window.previousVimPreference !== undefined) {
        localStorage.setItem("preview-comments-vim", window.previousVimPreference);
      }
    });
    await check.close();
    await page.bringToFront();
  }
}
