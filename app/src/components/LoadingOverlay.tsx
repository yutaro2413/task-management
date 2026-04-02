"use client";

export default function LoadingOverlay({ message = "保存中..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 border-r-indigo-400 animate-spin" />
          <div className="absolute inset-3 rounded-full bg-indigo-500/20 animate-pulse" />
          <div className="absolute inset-5 rounded-full bg-indigo-500/30 animate-ping" style={{ animationDuration: "1.5s" }} />
        </div>
        <span className="text-sm font-medium text-indigo-600 animate-pulse">{message}</span>
      </div>
    </div>
  );
}
