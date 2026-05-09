import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SleepTracker from "@/components/SleepTracker";
import HabitModal from "@/components/HabitModal";
import { themeInitScript } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "TimeTracker",
  description: "日々の時間記録・家計簿・日記アプリ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TimeTracker",
  },
};

export function generateViewport(): Viewport {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: "#1e293b",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        {/* FOUC 防止: 初期化スクリプトをレイアウトより先に同期実行して dark クラスを付ける */}
        <Script id="theme-init" strategy="beforeInteractive">{themeInitScript}</Script>
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans lg:pl-16">
        <Sidebar />
        <SleepTracker />
        {children}
        <HabitModal />
      </body>
    </html>
  );
}
