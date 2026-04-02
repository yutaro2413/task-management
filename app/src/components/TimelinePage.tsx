"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { slotToTime, formatDate } from "@/lib/utils";
import EntryModal from "./EntryModal";
import DailyNoteInput from "./DailyNoteInput";

type Category = { id: string; name: string };
type Genre = { id: string; name: string; color: string };
type TimeEntry = {
  id: string;
  slotIndex: number;
  title: string;
  detail?: string | null;
  category: Category;
  genre: Genre;
};

export default function TimelinePage() {
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const fetchEntries = useCallback(async () => {
    const res = await fetch(`/api/time-entries?date=${date}`);
    const data = await res.json();
    setEntries(data);
  }, [date]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/genres").then((r) => r.json()),
    ]).then(([cats, gnrs]) => {
      setCategories(cats);
      setGenres(gnrs);
    });
  }, []);

  const isToday = date === formatDate(new Date());

  // Scroll to current time on mount and date change
  useEffect(() => {
    if (timelineRef.current) {
      const now = new Date();
      const currentSlot = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);
      const targetSlot = isToday ? Math.max(0, currentSlot - 2) : 12; // 6:00 for non-today
      const targetEl = timelineRef.current.children[targetSlot] as HTMLElement;
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "auto", block: "start" });
      }
    }
  }, [date, isToday]);

  const entryMap = new Map(entries.map((e) => [e.slotIndex, e]));

  const changeDate = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(formatDate(d));
  };

  const handleSlotClick = (slotIndex: number) => {
    const existing = entryMap.get(slotIndex);
    if (existing) {
      setEditEntry(existing);
    } else {
      setEditEntry(null);
    }
    setSelectedSlot(slotIndex);
  };

  const handleSave = async (data: {
    categoryId: string;
    genreId: string;
    title: string;
    detail?: string;
  }) => {
    if (selectedSlot === null) return;
    await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, slotIndex: selectedSlot, ...data }),
    });
    setSelectedSlot(null);
    setEditEntry(null);
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/time-entries?id=${id}`, { method: "DELETE" });
    setSelectedSlot(null);
    setEditEntry(null);
    fetchEntries();
  };

  // Generate slots 6:00-23:30 (indices 12-47) as primary, but show all
  const slots = Array.from({ length: 48 }, (_, i) => i);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={() => changeDate(-1)}
            className="p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <button
              onClick={() => setDate(formatDate(new Date()))}
              className={`text-lg font-bold ${isToday ? "text-indigo-600" : ""}`}
            >
              {new Date(date + "T00:00:00").toLocaleDateString("ja-JP", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </button>
            {!isToday && (
              <button
                onClick={() => setDate(formatDate(new Date()))}
                className="ml-2 text-xs text-indigo-600 underline"
              >
                今日
              </button>
            )}
          </div>
          <button
            onClick={() => changeDate(1)}
            className="p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </header>

      {/* Daily Note */}
      <div className="px-4 py-2 max-w-lg mx-auto w-full">
        <DailyNoteInput date={date} />
      </div>

      {/* Timeline */}
      <div ref={timelineRef} className="flex-1 overflow-y-auto timeline-scroll px-4 max-w-lg mx-auto w-full">
        {slots.map((slotIndex) => {
          const entry = entryMap.get(slotIndex);
          const now = new Date();
          const currentSlot = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);
          const isCurrent = isToday && slotIndex === currentSlot;

          return (
            <button
              key={slotIndex}
              onClick={() => handleSlotClick(slotIndex)}
              className={`w-full flex items-stretch border-b border-slate-100 min-h-[3rem] transition-colors text-left ${
                isCurrent ? "bg-indigo-50" : "hover:bg-slate-50 active:bg-slate-100"
              }`}
            >
              {/* Time label */}
              <div className={`w-14 flex-shrink-0 flex items-center justify-center text-xs font-mono ${
                slotIndex % 2 === 0 ? "text-slate-600 font-semibold" : "text-slate-400"
              }`}>
                {slotToTime(slotIndex)}
              </div>

              {/* Entry content */}
              <div className="flex-1 flex items-center py-1.5 pl-2">
                {entry ? (
                  <div className="flex items-center gap-2 w-full">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: entry.genre.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500">{entry.category.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: entry.genre.color }}>
                          {entry.genre.name}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">{entry.title}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-300 text-sm">-</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Entry Modal */}
      {selectedSlot !== null && (
        <EntryModal
          slotIndex={selectedSlot}
          categories={categories}
          genres={genres}
          editEntry={editEntry}
          onSave={handleSave}
          onDelete={editEntry ? () => handleDelete(editEntry.id) : undefined}
          onClose={() => {
            setSelectedSlot(null);
            setEditEntry(null);
          }}
        />
      )}
    </div>
  );
}
