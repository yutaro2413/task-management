"use client";

import { useState, useEffect, useCallback } from "react";

export default function DailyNoteInput({ date }: { date: string }) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);

  const fetchNote = useCallback(async () => {
    const res = await fetch(`/api/daily-notes?date=${date}`);
    const data = await res.json();
    setContent(data?.content || "");
    setSaved(false);
  }, [date]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  const saveNote = async () => {
    if (!content.trim()) return;
    await fetch("/api/daily-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, content: content.trim() }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={saveNote}
        onKeyDown={(e) => e.key === "Enter" && saveNote()}
        placeholder="今日の一言..."
        className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-slate-300"
      />
      {saved && <span className="text-xs text-green-600">保存済</span>}
    </div>
  );
}
