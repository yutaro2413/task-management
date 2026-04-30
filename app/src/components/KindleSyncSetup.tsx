"use client";

import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "kindleSyncToken";

export default function KindleSyncSetup() {
  const [token, setToken] = useState("");
  const [origin, setOrigin] = useState("");
  const [scriptSource, setScriptSource] = useState("");
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
      // ブックマークレットの本体を取得してインライン化する。
      // read.amazon.co.jp の CSP は外部 <script src> を拒否することが多いため、
      // 全コードを javascript: URL に直接埋め込んで CSP を回避する。
      const res = await fetch("/bookmarklet/kindle-sync.js", { cache: "no-store" });
      if (res.ok) setScriptSource(await res.text());
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

  // 本体スクリプトをインライン化したブックマークレットを組み立てる。
  // 先頭で env globals を仕込んでから、本体 IIFE を即時実行。
  // encodeURI で URI 予約文字を処理しつつ、encodeURI が処理しない `#` だけ手動でエスケープ。
  const bookmarklet = (() => {
    if (!origin || !token || !scriptSource) return "";
    const wrapper =
      "(()=>{" +
      `window.__KINDLE_SYNC_ENDPOINT__=${JSON.stringify(origin + "/api/kindle/sync")};` +
      `window.__KINDLE_SYNC_TOKEN__=${JSON.stringify(token)};` +
      "console.log('[KindleSync] starting...');" +
      scriptSource +
      "})();";
    return "javascript:" + encodeURI(wrapper).replace(/#/g, "%23");
  })();

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
          <li>下のリンクをブックマークバーへドラッグ（または「コピー」を押して新規ブックマークの URL に貼り付け）</li>
          <li>read.amazon.co.jp/notebook を開き、ブックマークをクリック</li>
          <li>ブラウザの DevTools → Console を開いておくと <code>[KindleSync]</code> ログで進行状況が確認できる</li>
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
            <p className="text-[10px] text-slate-400">サイズ: {bookmarklet.length.toLocaleString()} 文字</p>
          </div>
        ) : !scriptSource ? (
          <p className="text-[11px] text-slate-400">ブックマークレット本体を読み込み中...</p>
        ) : (
          <p className="text-[11px] text-slate-400">トークンを入力するとブックマークレットが表示されます。</p>
        )}
      </div>
    </div>
  );
}
