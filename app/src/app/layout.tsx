import type { Metadata, Viewport } from "next";
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
        {/*
          FOUC 防止: 素の <script> として HTML に直接埋め込み、body 描画より前に同期実行する。
          next/script の beforeInteractive はルートレイアウトでは初回ロード時に確実に
          実行されないケースがあるため、ここでは inline script を使う (next-themes と同じ手法)。
        */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
