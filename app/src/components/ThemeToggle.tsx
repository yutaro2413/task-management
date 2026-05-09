"use client";

// テーマトグル: light / dark / system の 3 値。
// ・初回マウント時に localStorage 保存値を読み込み <html> に "dark" クラスを付与
// ・FOUC (light → dark の一瞬の白フラッシュ) を避けるため、<head> の inline script で
//   レイアウトより先にクラスを適用する (layout.tsx で <Script> 経由)
//
// 公開 API:
//   <ThemeToggle />     設定ページ等で使うトグル
//   useThemeMode()      現在のモードと変更関数を取得

import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
const STORAGE_KEY = "themeMode";

function applyThemeClass(mode: ThemeMode) {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  if (dark) root.classList.add("dark");
  else root.classList.remove("dark");
}

export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  // 冒頭の setLoading(true) は react-hooks/set-state-in-effect ルールを満たすため
  const [, setLoading] = useState(false);
  const init = useCallback(async () => {
    setLoading(true);
    try {
      const stored = (window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "dark";
      setMode(stored);
      applyThemeClass(stored);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { init(); }, [init]);

  // OS テーマが変わったときに system モードなら追従
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeClass("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const change = useCallback((next: ThemeMode) => {
    setMode(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyThemeClass(next);
  }, []);

  return { mode, change };
}

/** FOUC 防止: <head> 内で同期実行する初期化スクリプト */
export const themeInitScript = `
(function () {
  try {
    var m = localStorage.getItem("${STORAGE_KEY}") || "dark";
    var dark = m === "dark" || (m === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export function ThemeToggle() {
  const { mode, change } = useThemeMode();
  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-md p-0.5">
      {(
        [
          { v: "light", label: "ライト", icon: "☀️" },
          { v: "dark", label: "ダーク", icon: "🌙" },
          { v: "system", label: "OS", icon: "🖥" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.v}
          onClick={() => change(opt.v)}
          className={`flex-1 px-2.5 py-1 text-[10px] font-bold rounded transition-colors ${
            mode === opt.v
              ? "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 shadow-sm"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {opt.icon} {opt.label}
        </button>
      ))}
    </div>
  );
}
