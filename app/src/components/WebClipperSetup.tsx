"use client";

import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "kindleSyncToken"; // KindleSyncSetup と同じローカルキーを共有

export default function WebClipperSetup() {
  const [token, setToken] = useState("");
  const [origin, setOrigin] = useState("");
  const [scriptSource, setScriptSource] = useState("");
  const [copied, setCopied] = useState(false);

  // SettingsPage.tsx:fetchData と同じ流儀で react-hooks/set-state-in-effect を満たす
  const [, setLoading] = useState(false);
  const initFromBrowser = useCallback(async () => {
    setLoading(true);
    try {
      setOrigin(window.location.origin);
      setToken(window.localStorage.getItem(TOKEN_KEY) || "");
      const res = await fetch("/bookmarklet/web-clipper.js", { cache: "no-store" });
      if (res.ok) setScriptSource(await res.text());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { initFromBrowser(); }, [initFromBrowser]);

  const consolePaste = (() => {
    if (!origin || !token || !scriptSource) return "";
    return (
      `window.__SYNC_ENDPOINT__=${JSON.stringify(origin + "/api/clipper/save")};\n` +
      `window.__SYNC_TOKEN__=${JSON.stringify(token)};\n` +
      `console.log('[Clipper] starting...');\n` +
      scriptSource
    );
  })();

  const bookmarklet = (() => {
    if (!consolePaste) return "";
    const wrapper = "(()=>{" + consolePaste + "})();";
    return "javascript:" + encodeURI(wrapper).replace(/#/g, "%23");
  })();

  const copyConsole = async () => {
    if (!consolePaste) return;
    await navigator.clipboard.writeText(consolePaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const copyBookmarklet = async () => {
    if (!bookmarklet) return;
    await navigator.clipboard.writeText(bookmarklet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <h2 className="text-sm font-semibold">Web Clipper（記事・選択範囲を保存）</h2>
      </div>
      <div className="px-4 py-3 space-y-3 text-xs text-slate-600">
        <p className="leading-relaxed">
          任意の Web ページで実行すると、ページを書籍ライブラリに保存します。テキストを<b>選択した状態で実行</b>するとその選択範囲がハイライトとして保存されます。
          認証トークンは Kindle 同期と<b>同じものを使用</b>します。
        </p>

        {!scriptSource ? (
          <p className="text-[11px] text-slate-400">スクリプト本体を読み込み中...</p>
        ) : !token ? (
          <p className="text-[11px] text-slate-400">先に上の Kindle 同期セクションでトークンを入力してください。</p>
        ) : (
          <>
            <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold">推奨</span>
                <span className="text-xs font-bold text-emerald-700">Console 貼り付け方式</span>
              </div>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-600">
                <li>保存したいページを開く（必要なら本文を選択）</li>
                <li>DevTools を開く（Mac: <code className="px-1 bg-white rounded">⌥⌘I</code> / Win: <code className="px-1 bg-white rounded">F12</code>）→ Console</li>
                <li>下のボタンでコードをコピー → Console に貼り付け → Enter</li>
              </ol>
              <button onClick={copyConsole} className="w-full px-3 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700">
                {copied ? "✓ コピーしました — Console に貼り付けて Enter" : "📋 コードをコピー"}
              </button>
            </div>

            <details className="border border-slate-200 rounded-lg p-3">
              <summary className="text-xs font-bold text-slate-500 cursor-pointer">代替: ブックマークレット</summary>
              <div className="space-y-2 mt-2">
                <p className="text-[10px] text-slate-400">
                  React 製ページではブロックされる場合があります。動かなければ Console 方式に切り替えてください。
                </p>
                <a
                  href={bookmarklet}
                  onClick={(e) => e.preventDefault()}
                  draggable
                  className="block px-3 py-2 rounded-lg text-center text-xs font-bold text-white bg-slate-500 hover:bg-slate-600 cursor-grab active:cursor-grabbing"
                >
                  ✂️ Web Clipper (ブックマークバーへドラッグ)
                </a>
                <button onClick={copyBookmarklet} className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50">
                  javascript: URL をコピー
                </button>
              </div>
            </details>

            <p className="text-[10px] text-slate-400">スクリプトサイズ: {consolePaste.length.toLocaleString()} 文字</p>
          </>
        )}
      </div>
    </div>
  );
}
