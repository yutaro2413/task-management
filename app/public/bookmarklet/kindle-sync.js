// Kindle highlights sync bookmarklet
//
// Run on https://read.amazon.co.jp/notebook (or read.amazon.com/notebook).
// Scrapes the left book list and the right annotation pane for each book,
// then POSTs the collected payload to KINDLE_SYNC_ENDPOINT with KINDLE_SYNC_TOKEN.
//
// The script is loaded by the wrapper "javascript:(()=>{...})()" string that the
// Settings page generates. The wrapper sets window.__KINDLE_SYNC_ENDPOINT__ and
// window.__KINDLE_SYNC_TOKEN__ before fetching this file via <script>.
//
// DOM selectors are based on Amazon's notebook page structure. They may break if
// Amazon changes the markup; the script reports a useful error in that case.

(async function () {
  const ENDPOINT = window.__KINDLE_SYNC_ENDPOINT__;
  const TOKEN = window.__KINDLE_SYNC_TOKEN__;

  if (!ENDPOINT || !TOKEN) {
    alert("Kindle Sync: 設定が読み込まれていません。設定ページからブックマークレットを再生成してください。");
    return;
  }

  if (!/read\.amazon\.(co\.jp|com)\/notebook/.test(location.href)) {
    alert("Kindle Sync: read.amazon.co.jp/notebook を開いた状態で実行してください。");
    return;
  }

  // Floating status banner
  const banner = document.createElement("div");
  banner.style.cssText = "position:fixed;top:12px;right:12px;background:#1e293b;color:#fff;padding:10px 14px;border-radius:8px;font:12px/1.4 -apple-system,sans-serif;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,.2);max-width:280px";
  banner.textContent = "Kindle Sync: 起動中...";
  document.body.appendChild(banner);
  const setStatus = (msg) => { banner.textContent = "Kindle Sync: " + msg; };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 1. Collect the list of books from the left pane.
  const bookEls = Array.from(document.querySelectorAll("#kp-notebook-library .kp-notebook-library-each-book"));
  if (bookEls.length === 0) {
    setStatus("書籍リストが見つかりません。ページをスクロールしてから再実行してください。");
    return;
  }

  const books = [];

  for (let i = 0; i < bookEls.length; i++) {
    const el = bookEls[i];
    const asin = el.getAttribute("id"); // Amazon stores ASIN as the element id
    const titleEl = el.querySelector("h2");
    const authorEl = el.querySelector("p");
    const coverEl = el.querySelector("img");
    if (!asin || !titleEl) continue;

    setStatus(`(${i + 1}/${bookEls.length}) ${titleEl.textContent.trim().slice(0, 30)}...`);

    // Click the book to load its annotations into the right pane.
    el.querySelector("a, button, div")?.click?.();
    el.click();

    // Wait until the annotation pane updates. Amazon uses an async XHR; we poll
    // for #annotations container with the right book id, capped at ~6s.
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

      // Bookmarks have a span "kp-notebook-row-separator" containing "ブックマーク" / "Bookmark".
      const typeLabel = (a.querySelector("#annotationHighlightHeader")?.textContent || "").trim();
      const isBookmark = /ブックマーク|Bookmark/i.test(typeLabel);

      const locationText = (a.querySelector("#kp-annotation-location")?.value || "").trim();
      const pageEl = a.querySelector("#kp-annotation-location-header") || a.querySelector(".kp-notebook-metadata");
      let page = null;
      const pageText = (pageEl?.textContent || "");
      const pageMatch = pageText.match(/(?:ページ|Page)\s*(\d+)/i);
      if (pageMatch) page = parseInt(pageMatch[1], 10);

      if (isBookmark) {
        bookmarks.push({
          externalId,
          location: locationText || null,
          page,
        });
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

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kindle-Sync-Token": TOKEN,
      },
      body: JSON.stringify({ books }),
    });
    if (!res.ok) {
      const txt = await res.text();
      setStatus(`失敗: ${res.status} ${txt.slice(0, 80)}`);
      return;
    }
    const json = await res.json();
    setStatus(`完了: ${json.booksTouched}冊 / ハイライト${json.highlightsUpserted} / しおり${json.bookmarksUpserted}`);
  } catch (e) {
    setStatus(`エラー: ${e && e.message ? e.message : e}`);
  }

  setTimeout(() => banner.remove(), 8000);
})();
