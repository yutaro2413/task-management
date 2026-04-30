// Web Clipper bookmarklet body.
//
// 動作:
//   1. 選択範囲があれば選択範囲のテキストを 1 つの highlight として保存
//   2. 選択範囲が無ければ「ページを保存」モード (article 自体だけ登録、後で UI でハイライトを追加可能)
//   3. og:* / meta description / first <p> から excerpt と siteName を自動抽出
//   4. window.__SYNC_ENDPOINT__ / window.__SYNC_TOKEN__ を見て /api/clipper/save に POST
//
// CSP / React の javascript: ブロックを避けるため、KindleSyncSetup と同じく
// Console-paste 主、bookmarklet 副の二刀流で配布する。

(async function () {
  const ENDPOINT = window.__SYNC_ENDPOINT__;
  const TOKEN = window.__SYNC_TOKEN__;

  // 視認用バナーを最優先で出す
  const banner = document.createElement("div");
  banner.style.cssText = "position:fixed;top:12px;right:12px;background:#1e293b;color:#fff;padding:10px 14px;border-radius:8px;font:12px/1.4 -apple-system,sans-serif;z-index:2147483647;box-shadow:0 4px 14px rgba(0,0,0,.2);max-width:320px;white-space:pre-wrap";
  banner.textContent = "Web Clipper: 起動中...";
  (document.body || document.documentElement).appendChild(banner);
  const setStatus = (msg) => {
    console.log("[Clipper]", msg);
    banner.textContent = "Web Clipper: " + msg;
  };

  if (!ENDPOINT || !TOKEN) {
    setStatus("設定が読み込まれていません。/settings で再生成してください。");
    return;
  }

  // 選択範囲を取得 (なければ空文字)
  const selectionText = (window.getSelection && window.getSelection()?.toString()) || "";

  const meta = (name) => {
    const el = document.querySelector(
      `meta[name="${name}" i],meta[property="${name}" i]`,
    );
    return el ? el.getAttribute("content") : null;
  };

  const title =
    meta("og:title") ||
    document.querySelector("title")?.textContent ||
    location.href;

  const excerpt =
    meta("og:description") ||
    meta("description") ||
    document.querySelector("article p, main p, p")?.textContent?.slice(0, 500) ||
    null;

  const siteName = meta("og:site_name") || location.hostname;

  const publishedAt =
    meta("article:published_time") ||
    meta("og:published_time") ||
    document.querySelector("time[datetime]")?.getAttribute("datetime") ||
    null;

  const payload = {
    url: location.href,
    title: (title || "").trim(),
    excerpt: excerpt ? excerpt.trim() : null,
    siteName,
    publishedAt,
    selections: selectionText.trim()
      ? [{ text: selectionText.trim() }]
      : [],
  };

  setStatus(
    selectionText.trim()
      ? `送信中: "${selectionText.trim().slice(0, 40)}..."`
      : "送信中: ページ全体を保存",
  );

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sync-Token": TOKEN,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      setStatus(`失敗: HTTP ${res.status}\n${txt.slice(0, 200)}`);
      return;
    }
    const json = await res.json();
    const created = json.created ?? 0;
    const existed = json.existed ?? 0;
    const note = selectionText.trim()
      ? created
        ? "新規ハイライト 1 件保存"
        : existed
          ? "重複ハイライトのため何もせず"
          : "保存完了"
      : "ページ保存完了 (ハイライトはあとで追加可能)";
    setStatus(`✅ ${note}\n書籍: ${json.book?.title?.slice(0, 40) ?? ""}`);
  } catch (e) {
    setStatus(`エラー: ${e && e.message ? e.message : e}`);
    console.error("[Clipper]", e);
  }

  setTimeout(() => banner.remove(), 8000);
})();
