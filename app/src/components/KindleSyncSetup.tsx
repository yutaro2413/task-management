"use client";

import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "kindleSyncToken";

export default function KindleSyncSetup() {
  const [token, setToken] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  // window/localStorage はクライアントでしか参照できないため、effect 経由で読み込む。
  // 冒頭の setLoading(true) は react-hooks/set-state-in-effect ルールを満たすために必要
  // （SettingsPage.tsx:fetchData と同じ流儀）。
  const [, setLoading] = useState(false);
  const initFromBrowser = useCallback(async () => {
    setLoading(true);
    try {
      const o = window.location.origin;
      const t = window.localStorage.getItem(TOKEN_KEY) || "";
      setOrigin(o);
      setToken(t);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { initFromBrowser(); }, [initFromBrowser]);

  const saveToken = (val: string) => {
    setToken(val);
    if (val) window.localStorage.setItem(TOKEN_KEY, val);
    else window.localStorage.removeItem(TOKEN_KEY);
  };

  // Build the bookmarklet wrapper: it injects globals then loads our hosted script.
  const bookmarklet = origin && token
    ? `javascript:(()=>{window.__KINDLE_SYNC_ENDPOINT__=${JSON.stringify(origin + "/api/kindle/sync")};window.__KINDLE_SYNC_TOKEN__=${JSON.stringify(token)};const s=document.createElement('script');s.src=${JSON.stringify(origin + "/bookmarklet/kindle-sync.js")}+'?v='+Date.now();document.body.appendChild(s);})();`
    : "";

  const copy = async () => {
    if (!bookmarklet) return;
    await navigator.clipboard.writeText(bookmarklet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <h2 className="text-sm font-semibold">Kindle ハイライト同期</h2>
      </div>
      <div className="px-4 py-3 space-y-3 text-xs text-slate-600">
        <p className="leading-relaxed">
          Kindleの<a href="https://read.amazon.co.jp/notebook" target="_blank" rel="noreferrer" className="text-indigo-600 underline">notebookページ</a>でブックマークレットを実行すると、ハイライト・しおりがこのアプリに同期されます。
        </p>

        <ol className="list-decimal list-inside space-y-1 text-slate-500">
          <li>Vercelダッシュボードで環境変数 <code className="px-1 bg-slate-100 rounded">KINDLE_SYNC_TOKEN</code> を任意の文字列で設定（例: ランダム32文字）</li>
          <li>下のフォームに同じ値を入力</li>
          <li>「コピー」を押してブックマークバーに新規ブックマークとして貼り付け</li>
          <li>read.amazon.co.jp/notebook を開き、ブックマークをクリック</li>
        </ol>

        <div>
          <label className="text-[10px] text-slate-400">同期トークン (KINDLE_SYNC_TOKEN と同じ値)</label>
          <input
            type="password"
            value={token}
            onChange={(e) => saveToken(e.target.value)}
            placeholder="ランダムな文字列を入力"
            className="w-full px-3 py-1.5 rounded border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {bookmarklet ? (
          <div className="space-y-2">
            <a
              href={bookmarklet}
              onClick={(e) => e.preventDefault()}
              draggable
              className="block px-3 py-2 rounded-lg text-center text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-grab active:cursor-grabbing"
            >
              📚 Kindle Sync (このリンクをブックマークバーへドラッグ)
            </a>
            <button onClick={copy} className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50">
              {copied ? "コピーしました" : "javascript: コードをコピー"}
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">トークンを入力するとブックマークレットが表示されます。</p>
        )}
      </div>
    </div>
  );
}
