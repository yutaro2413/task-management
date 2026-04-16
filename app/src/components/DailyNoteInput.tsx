"use client";

import { useState, useEffect, useCallback } from "react";
import { NOTE_SECTIONS, NoteSections, parseNote, serializeNote } from "@/lib/dailyNote";

const DRAFT_KEY_PREFIX = "dailyNote-draft-";

function saveDraftToStorage(date: string, draft: NoteSections) {
  const serialized = serializeNote(draft);
  if (serialized) {
    localStorage.setItem(DRAFT_KEY_PREFIX + date, JSON.stringify(draft));
  } else {
    localStorage.removeItem(DRAFT_KEY_PREFIX + date);
  }
}

function loadDraftFromStorage(date: string): NoteSections | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY_PREFIX + date);
    if (!raw) return null;
    return JSON.parse(raw) as NoteSections;
  } catch {
    return null;
  }
}

function clearDraftFromStorage(date: string) {
  localStorage.removeItem(DRAFT_KEY_PREFIX + date);
}

export default function DailyNoteInput({ date }: { date: string }) {
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState<NoteSections>({});
  const [mode, setMode] = useState<"closed" | "preview" | "edit">("closed");
  const [saving, setSaving] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    fetch(`/api/daily-notes?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        const saved = data?.content || "";
        setContent(saved);
        const stored = loadDraftFromStorage(date);
        if (stored && serializeNote(stored) !== saved) {
          setHasDraft(true);
        } else {
          clearDraftFromStorage(date);
          setHasDraft(false);
        }
      });
  }, [date]);

  const updateDraft = useCallback((updater: (prev: NoteSections) => NoteSections) => {
    setDraft((prev) => {
      const next = updater(prev);
      saveDraftToStorage(date, next);
      return next;
    });
  }, [date]);

  const handleOpen = () => {
    const stored = loadDraftFromStorage(date);
    if (stored && serializeNote(stored) !== content) {
      setDraft(stored);
      setMode("edit");
      setHasDraft(false);
      return;
    }
    if (content) {
      setMode("preview");
    } else {
      setDraft({});
      setMode("edit");
    }
  };

  const handleEdit = () => {
    const stored = loadDraftFromStorage(date);
    if (stored && serializeNote(stored) !== content) {
      setDraft(stored);
    } else {
      setDraft(parseNote(content));
    }
    setMode("edit");
  };

  const handleSave = async () => {
    const serialized = serializeNote(draft);
    if (serialized === content) {
      clearDraftFromStorage(date);
      setMode("closed");
      return;
    }
    setSaving(true);
    try {
      await fetch("/api/daily-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, content: serialized }),
      });
      setContent(serialized);
      clearDraftFromStorage(date);
      setHasDraft(false);
    } finally {
      setSaving(false);
      setMode("closed");
    }
  };

  const handleClose = () => {
    setMode("closed");
  };

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const parsed = content ? parseNote(content) : {};
  const firstSection = NOTE_SECTIONS.find((s) => parsed[s.key]?.trim());
  const summaryText = firstSection
    ? parsed[firstSection.key]!.split("\n")[0]
    : parsed._free?.split("\n")[0] || "";

  return (
    <>
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
          <span className="flex-1 text-sm text-slate-700 truncate min-w-0">
            {firstSection && <span className="text-[10px] text-slate-400 mr-1">★{firstSection.label}</span>}
            {summaryText}
          </span>
        ) : (
          <span className="flex-1 text-sm text-slate-300">今日の一言...</span>
        )}
        {hasDraft && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="下書きあり" />}
        <svg
          className="w-3 h-3 text-slate-300 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {mode === "preview" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold">今日の一言</h3>
              <span className="text-xs text-slate-400">{dateLabel}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {NOTE_SECTIONS.filter((s) => parsed[s.key]?.trim()).map((s) => (
                <div key={s.key}>
                  <p className="text-xs font-semibold text-indigo-600 mb-1">★{s.label}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pl-3 border-l-2 border-slate-100">{parsed[s.key]}</p>
                </div>
              ))}
              {parsed._free && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1">メモ</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pl-3 border-l-2 border-slate-100">{parsed._free}</p>
                </div>
              )}
              {!NOTE_SECTIONS.some((s) => parsed[s.key]?.trim()) && !parsed._free && (
                <p className="text-sm text-slate-400">（内容なし）</p>
              )}
            </div>
            <div className="flex gap-2 px-5 py-3 border-t border-slate-100">
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

      {mode === "edit" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold">今日の一言</h3>
              <span className="text-xs text-slate-400">{dateLabel}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {NOTE_SECTIONS.map((s) => (
                <div key={s.key}>
                  <label className="block text-xs font-semibold text-indigo-600 mb-1">★{s.label}</label>
                  <textarea
                    value={draft[s.key] || ""}
                    onChange={(e) => updateDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                    placeholder={s.placeholder}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y leading-relaxed"
                  />
                </div>
              ))}
              {draft._free && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">メモ（旧形式の内容）</label>
                  <textarea
                    value={draft._free || ""}
                    onChange={(e) => updateDraft((d) => ({ ...d, _free: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y leading-relaxed"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 py-3 border-t border-slate-100">
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
