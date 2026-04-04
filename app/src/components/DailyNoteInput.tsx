"use client";

import { useState, useEffect, useRef } from "react";

export default function DailyNoteInput({ date }: { date: string }) {
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"closed" | "preview" | "edit">("closed");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/daily-notes?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        setContent(data?.content || "");
      });
  }, [date]);

  const handleOpen = () => {
    if (content) {
      setMode("preview");
    } else {
      setDraft("");
      setMode("edit");
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleEdit = () => {
    setDraft(content);
    setMode("edit");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (trimmed === content) {
      setMode("closed");
      return;
    }
    setSaving(true);
    try {
      await fetch("/api/daily-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, content: trimmed }),
      });
      setContent(trimmed);
    } finally {
      setSaving(false);
      setMode("closed");
    }
  };

  const handleClose = () => {
    setDraft(content);
    setMode("closed");
  };

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <>
      {/* ヘッダー内のボタン */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 w-full bg-white rounded-lg border border-slate-200 px-3 py-1.5 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
      >
        <svg
          className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        {content ? (
          <span className="flex-1 text-sm text-slate-700 truncate min-w-0">{content}</span>
        ) : (
          <span className="flex-1 text-sm text-slate-300">今日の一言...</span>
        )}
        {content.length > 20 && (
          <svg
            className="w-3 h-3 text-slate-300 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {/* プレビューポップアップ（保存済みの場合） */}
      {mode === "preview" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">今日の一言</h3>
              <span className="text-xs text-slate-400">{dateLabel}</span>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-4 mb-4 min-h-[6rem] max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{content}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50"
              >
                閉じる
              </button>
              <button
                onClick={handleEdit}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700"
              >
                編集
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {mode === "edit" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold">今日の一言</h3>
              <span className="text-xs text-slate-400">{dateLabel}</span>
            </div>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
                if (e.key === "Escape") handleClose();
              }}
              placeholder="今日の一言を入力..."
              rows={8}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <p className="text-[10px] text-slate-400 mt-1 mb-3">
              Ctrl+Enter で保存 / Esc でキャンセル
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
