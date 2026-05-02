// ==UserScript==
// @name         Kindle Highlights → My App
// @namespace    https://task-management-three-blond-24.vercel.app/
// @version      1.0.0
// @description  read.amazon.co.jp/notebook のハイライト・図表ハイライト・しおりを自分のアプリに同期する
// @author       self
// @match        https://read.amazon.co.jp/notebook*
// @match        https://read.amazon.com/notebook*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @updateURL    https://task-management-three-blond-24.vercel.app/userscript/kindle-sync.user.js
// @downloadURL  https://task-management-three-blond-24.vercel.app/userscript/kindle-sync.user.js
// ==/UserScript==

/*
 * 動作:
 *   - notebook ページを開くと右上に「📚 Kindle Sync」ボタンが常駐
 *   - 初回クリック時に同期トークン (Vercel の KINDLE_SYNC_TOKEN と同じ値) を入力
 *   - クリックで全書籍のハイライトを取得し、アプリの /api/kindle/sync に POST
 *   - 進捗は同じパネル内に表示
 *
 * 同期エンドポイントとトークンは GM_setValue で永続化。再ログイン後も保持される。
 * 「⚙ 設定」ボタンでエンドポイント・トークンを再入力できる。
 */

(function () {
  "use strict";

  const DEFAULT_ENDPOINT = "https://task-management-three-blond-24.vercel.app/api/kindle/sync";

  const getEndpoint = () => GM_getValue("endpoint", DEFAULT_ENDPOINT);
  const getToken = () => GM_getValue("token", "");
  const setEndpoint = (v) => GM_setValue("endpoint", v);
  const setToken = (v) => GM_setValue("token", v);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ─── UI ───────────────────────────────────────────────────────────
  const panel = document.createElement("div");
  panel.id = "ks-userscript-panel";
  panel.style.cssText = [
    "position:fixed",
    "top:80px",
    "right:16px",
    "z-index:2147483647",
    "background:#1e293b",
    "color:#fff",
    "padding:12px",
    "border-radius:10px",
    "box-shadow:0 6px 24px rgba(0,0,0,.3)",
    "font:12px/1.4 -apple-system,BlinkMacSystemFont,sans-serif",
    "min-width:220px",
    "max-width:320px",
  ].join(";");
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <strong style="font-size:13px">📚 Kindle Sync</strong>
      <button id="ks-settings" title="設定" style="background:transparent;border:0;color:#94a3b8;cursor:pointer;font-size:14px">⚙</button>
    </div>
    <button id="ks-run" style="width:100%;padding:8px;background:#6366f1;border:0;border-radius:6px;color:#fff;font-weight:bold;cursor:pointer">同期実行</button>
    <div id="ks-status" style="margin-top:8px;color:#cbd5e1;font-size:11px;white-space:pre-wrap;max-height:200px;overflow-y:auto"></div>
  `;
  document.body.appendChild(panel);

  const statusEl = panel.querySelector("#ks-status");
  const runBtn = panel.querySelector("#ks-run");
  const settingsBtn = panel.querySelector("#ks-settings");

  function setStatus(msg) {
    console.log("[KindleSync]", msg);
    statusEl.textContent = msg;
  }

  function configure({ force = false } = {}) {
    let token = getToken();
    let endpoint = getEndpoint();
    if (!token || force) {
      const t = prompt(
        "同期トークンを入力 (Vercel の KINDLE_SYNC_TOKEN と同じ値):",
        token,
      );
      if (t == null) return false;
      token = t.trim();
      setToken(token);
    }
    if (force) {
      const e = prompt(
        "API エンドポイント URL (通常は変更不要):",
        endpoint,
      );
      if (e == null) return false;
      endpoint = e.trim();
      setEndpoint(endpoint);
    }
    return Boolean(token);
  }

  settingsBtn.addEventListener("click", () => {
    if (configure({ force: true })) setStatus("設定を更新しました");
  });

  // ─── Scrape & sync ─────────────────────────────────────────────────
  async function syncAll() {
    if (!configure()) {
      setStatus("トークンが未設定です");
      return;
    }
    runBtn.disabled = true;
    runBtn.style.opacity = "0.6";

    try {
      const candidateSelectors = [
        "#kp-notebook-library .kp-notebook-library-each-book",
        ".kp-notebook-library-each-book",
        "[id^='B0'][class*='kp-notebook']",
      ];
      let bookEls = [];
      for (const sel of candidateSelectors) {
        bookEls = Array.from(document.querySelectorAll(sel));
        if (bookEls.length > 0) break;
      }
      if (bookEls.length === 0) {
        setStatus("書籍リストが見つかりません。\n左ペインを下までスクロールしてください。");
        return;
      }

      setStatus(`書籍 ${bookEls.length} 冊から取得中...`);
      const books = [];
      for (let i = 0; i < bookEls.length; i++) {
        const el = bookEls[i];
        const asin = el.getAttribute("id") || el.getAttribute("data-asin");
        const titleEl = el.querySelector("h2") || el.querySelector(".kp-notebook-searchable");
        const authorEl = el.querySelector("p");
        const coverEl = el.querySelector("img");
        if (!asin || !titleEl) continue;

        setStatus(`(${i + 1}/${bookEls.length}) ${titleEl.textContent.trim().slice(0, 30)}...`);

        el.querySelector("a, button, div")?.click?.();
        el.click();
        const start = Date.now();
        while (Date.now() - start < 6000) {
          await sleep(150);
          const container = document.querySelector("#kp-notebook-annotations");
          if (container && container.children.length > 0) break;
        }
        await sleep(250);

        const annotations = Array.from(document.querySelectorAll("#kp-notebook-annotations .a-row.a-spacing-base"));
        const highlights = [];
        const bookmarks = [];

        for (const a of annotations) {
          const externalId = a.getAttribute("id");
          if (!externalId) continue;

          const typeLabel = (a.querySelector("#annotationHighlightHeader")?.textContent || "").trim();
          const isBookmark = /ブックマーク|Bookmark/i.test(typeLabel);

          const locInput = a.querySelector("#kp-annotation-location");
          const locationText = locInput && "value" in locInput ? String(locInput.value || "").trim() : "";
          const pageEl = a.querySelector("#kp-annotation-location-header") || a.querySelector(".kp-notebook-metadata");
          let page = null;
          const pageText = pageEl?.textContent || "";
          const pageMatch = pageText.match(/(?:ページ|Page)\s*(\d+)/i);
          if (pageMatch) page = parseInt(pageMatch[1], 10);

          if (isBookmark) {
            bookmarks.push({ externalId, location: locationText || null, page });
            continue;
          }

          const textEl = a.querySelector("#highlight");
          const noteEl = a.querySelector("#note");
          const imgEl = a.querySelector("img.kp-notebook-print-override");
          const colorMatch = (a.querySelector(".kp-notebook-highlight")?.className || "").match(/kp-notebook-highlight-(\w+)/);
          const color = colorMatch ? colorMatch[1] : null;

          const text = textEl ? textEl.textContent.trim() : null;
          const note = noteEl ? noteEl.textContent.trim() : null;
          const imageUrl = imgEl ? imgEl.src : null;

          if (!text && !note && !imageUrl) continue;

          highlights.push({
            externalId,
            type: imageUrl ? "image" : "text",
            text: text || null,
            note: note || null,
            imageUrl: imageUrl || null,
            color,
            location: locationText || null,
            page,
          });
        }

        books.push({
          asin,
          title: titleEl.textContent.trim(),
          author: authorEl ? authorEl.textContent.replace(/^著者[:：]?/, "").trim() : null,
          coverUrl: coverEl ? coverEl.src : null,
          highlights,
          bookmarks,
        });
      }

      setStatus(`送信中... (${books.length} 冊)`);
      const res = await fetch(getEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sync-Token": getToken(),
        },
        body: JSON.stringify({ books }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setStatus(`失敗: HTTP ${res.status}\n${txt.slice(0, 200)}`);
        return;
      }
      const json = await res.json();
      setStatus(
        `✅ 完了\n` +
          `書籍: ${json.booksTouched}\n` +
          `ハイライト: ${json.highlightsUpserted} (新規/更新)\n` +
          `しおり: ${json.bookmarksUpserted}\n` +
          (json.highlightsArchived ? `削除検出: ${json.highlightsArchived}\n` : "") +
          (json.highlightsRestored ? `復活: ${json.highlightsRestored}` : ""),
      );
    } catch (e) {
      setStatus(`エラー: ${e && e.message ? e.message : e}`);
      console.error("[KindleSync]", e);
    } finally {
      runBtn.disabled = false;
      runBtn.style.opacity = "1";
    }
  }

  runBtn.addEventListener("click", syncAll);

  // 初期表示
  if (!getToken()) {
    setStatus("初回利用: ⚙ から同期トークンを設定してください");
  } else {
    setStatus("「同期実行」ボタンを押してください");
  }
})();
