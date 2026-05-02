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

  // 同じスクリプトを 2 通りの形で配布する：
  //   (1) javascript: ブックマークレット (ワンクリック実行、CSP に依存)
  //   (2) DevTools Console に貼り付ける生コード (CSP 完全回避)
  // どちらも env globals を先頭で仕込んで本体 IIFE を即時実行する。
  const consolePaste = (() => {
    if (!origin || !token || !scriptSource) return "";
    return (
      `window.__KINDLE_SYNC_ENDPOINT__=${JSON.stringify(origin + "/api/kindle/sync")};\n` +
      `window.__KINDLE_SYNC_TOKEN__=${JSON.stringify(token)};\n` +
      `console.log('[KindleSync] starting...');\n` +
      scriptSource
    );
  })();

  const bookmarklet = (() => {
    if (!consolePaste) return "";
    const wrapper = "(()=>{" + consolePaste + "})();";
    return "javascript:" + encodeURI(wrapper).replace(/#/g, "%23");
  })();

  const copyBookmarklet = async () => {
    if (!bookmarklet) return;
    await navigator.clipboard.writeText(bookmarklet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const copyConsole = async () => {
    if (!consolePaste) return;
    await navigator.clipboard.writeText(consolePaste);
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
          Kindleの<a href="https://read.amazon.co.jp/notebook" target="_blank" rel="noreferrer" className="text-indigo-600 underline">notebookページ</a>でスクリプトを実行すると、ハイライト・しおりがこのアプリに同期されます。
        </p>

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

        {!scriptSource ? (
          <p className="text-[11px] text-slate-400">スクリプト本体を読み込み中...</p>
        ) : !consolePaste ? (
          <p className="text-[11px] text-slate-400">トークンを入力すると同期コードが表示されます。</p>
        ) : (
          <>
            {/* 推奨: Tampermonkey ユーザースクリプト方式 (notebook を開くと右上にボタン常駐) */}
            <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold">最推奨</span>
                <span className="text-xs font-bold text-emerald-700">ユーザースクリプト方式（ボタン1つで同期）</span>
              </div>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-600">
                <li>
                  <a href="https://www.tampermonkey.net/" target="_blank" rel="noreferrer" className="text-emerald-700 underline">Tampermonkey 拡張機能</a>
                  を初回のみブラウザに入れる（無料・5秒）
                </li>
                <li>
                  下のボタンを押す → Tampermonkey が「インストール」ダイアログを表示 → 同意
                </li>
                <li>read.amazon.co.jp/notebook を開く → 右上に「📚 Kindle Sync」パネルが常駐</li>
                <li>初回だけ ⚙ から同期トークン (KINDLE_SYNC_TOKEN と同じ値) を入力 → 「同期実行」</li>
              </ol>
              <a
                href={origin ? `${origin}/userscript/kindle-sync.user.js` : "#"}
                className="block px-3 py-2 rounded-lg text-center text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
              >
                ⬇️ ユーザースクリプトをインストール
              </a>
              <p className="text-[10px] text-slate-500">
                スクリプトはこの URL から自動アップデートされる: <code className="text-[9px] break-all">/userscript/kindle-sync.user.js</code>
              </p>
            </div>

            {/* 折り畳み: Console 貼り付け方式 (Tampermonkey が嫌な場合のフォールバック) */}
            <details className="border border-indigo-200 bg-indigo-50/40 rounded-lg p-3">
              <summary className="text-xs font-bold text-indigo-700 cursor-pointer">代替: DevTools Console 貼り付け方式</summary>
              <div className="space-y-2 mt-2">
                <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-600">
                  <li><a href="https://read.amazon.co.jp/notebook" target="_blank" rel="noreferrer" className="text-indigo-600 underline">read.amazon.co.jp/notebook</a> を開く</li>
                  <li>DevTools を開く（Mac: <code className="px-1 bg-white rounded">⌥⌘I</code> / Win: <code className="px-1 bg-white rounded">F12</code>）→ Console タブ</li>
                  <li>下の「コードをコピー」を押して、Console に貼り付け → <code className="px-1 bg-white rounded">Enter</code></li>
                </ol>
                <button onClick={copyConsole} className="w-full px-3 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700">
                  {copied ? "✓ コピーしました — Console に貼り付けて Enter" : "📋 コードをコピー"}
                </button>
              </div>
            </details>

            <details className="border border-slate-200 rounded-lg p-3">
              <summary className="text-xs font-bold text-slate-500 cursor-pointer">代替: ブックマークレット方式（React にブロックされる場合あり）</summary>
              <div className="space-y-2 mt-2">
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Amazon の notebook ページは React 製で、<code>javascript:</code> URL を「セキュリティ上の理由」で実行ブロックすることがあります。
                </p>
                <a
                  href={bookmarklet}
                  onClick={(e) => e.preventDefault()}
                  draggable
                  className="block px-3 py-2 rounded-lg text-center text-xs font-bold text-white bg-slate-500 hover:bg-slate-600 cursor-grab active:cursor-grabbing"
                >
                  📚 Kindle Sync (ブックマークバーへドラッグ)
                </a>
                <button onClick={copyBookmarklet} className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50">
                  javascript: URL をコピー
                </button>
              </div>
            </details>

            <p className="text-[10px] text-slate-400">スクリプトサイズ: {consolePaste.length.toLocaleString()} 文字</p>
          </>
        )}

        <details className="border-t border-slate-100 pt-2">
          <summary className="text-[10px] text-slate-400 cursor-pointer">セットアップ手順（初回のみ）</summary>
          <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-slate-500 mt-1">
            <li>Vercel ダッシュボードで環境変数 <code className="px-1 bg-slate-100 rounded">KINDLE_SYNC_TOKEN</code> を任意の文字列で設定</li>
            <li>上の「同期トークン」に同じ値を入力</li>
            <li>read.amazon.co.jp に Amazon アカウントでログインしておく</li>
            <li>左ペインの書籍一覧を一番下までスクロール（Amazon の遅延読込で全冊表示するため）</li>
          </ol>
        </details>
      </div>
    </div>
  );
}
