"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { slotToTime, toJSTDateString, getCurrentSlotJST } from "@/lib/utils";
import EntryModal from "./EntryModal";
import ExpenseModal from "./ExpenseModal";
import DailyNoteInput from "./DailyNoteInput";
import SearchPanel from "./SearchPanel";

type Category = { id: string; name: string };
type Genre = { id: string; name: string; color: string };
type TimeEntry = {
  id: string;
  startSlot: number;
  endSlot: number;
  title?: string | null;
  detail?: string | null;
  category: Category;
  genre: Genre;
};

export default function TimelinePage() {
  const [date, setDate] = useState(() => toJSTDateString());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const isToday = date === toJSTDateString();

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

  // Scroll to 9:00 or current time
  useEffect(() => {
    if (timelineRef.current) {
      const currentSlot = getCurrentSlotJST();
      const targetSlot = isToday ? Math.max(0, currentSlot - 2) : 18; // 18 = 9:00
      const targetEl = timelineRef.current.children[targetSlot] as HTMLElement;
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "auto", block: "start" });
      }
    }
  }, [date, isToday]);

  // Build a map: slotIndex -> entry (for entries spanning multiple slots)
  const slotEntryMap = new Map<number, TimeEntry>();
  const entryStartSlots = new Set<number>();
  entries.forEach((e) => {
    entryStartSlots.add(e.startSlot);
    for (let i = e.startSlot; i < e.endSlot; i++) {
      slotEntryMap.set(i, e);
    }
  });

  const changeDate = (delta: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  };

  const handleSlotClick = (slotIndex: number) => {
    const existing = slotEntryMap.get(slotIndex);
    if (existing) {
      setEditEntry(existing);
      setSelectedSlot(existing.startSlot);
    } else {
      setEditEntry(null);
      setSelectedSlot(slotIndex);
    }
  };

  const handleSave = async (data: {
    categoryId: string;
    genreId: string;
    startSlot: number;
    endSlot: number;
    title?: string;
    detail?: string;
  }) => {
    if (editEntry) {
      await fetch("/api/time-entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editEntry.id, ...data }),
      });
    } else {
      await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, ...data }),
      });
    }
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

  const slots = Array.from({ length: 48 }, (_, i) => i);
  const currentSlot = getCurrentSlotJST();

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
          <div className="text-center flex items-center gap-2">
            <span className="text-lg font-bold">
              {new Date(date + "T00:00:00").toLocaleDateString("ja-JP", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </span>
            {!isToday && (
              <button
                onClick={() => setDate(toJSTDateString())}
                className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium"
              >
                今日
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 rounded-lg hover:bg-slate-100"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
            <button
              onClick={() => changeDate(1)}
              className="p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Search Panel */}
      {showSearch && <SearchPanel onClose={() => setShowSearch(false)} />}

      {/* Daily Note */}
      <div className="px-4 py-2 max-w-lg mx-auto w-full">
        <DailyNoteInput date={date} />
      </div>

      {/* Timeline */}
      <div ref={timelineRef} className="flex-1 overflow-y-auto timeline-scroll px-4 max-w-lg mx-auto w-full">
        {slots.map((slotIndex) => {
          const entry = slotEntryMap.get(slotIndex);
          const isStart = entry && entryStartSlots.has(slotIndex);
          const isContinuation = entry && !isStart;
          const isCurrent = isToday && slotIndex === currentSlot;

          return (
            <button
              key={slotIndex}
              onClick={() => handleSlotClick(slotIndex)}
              className={`w-full flex items-stretch border-b border-slate-100 min-h-[3rem] transition-colors text-left ${
                isCurrent ? "bg-indigo-50" : isContinuation ? "bg-slate-50/50" : "hover:bg-slate-50 active:bg-slate-100"
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
                {isStart && entry ? (
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
                        <span className="text-xs text-slate-400">
                          {slotToTime(entry.startSlot)}-{slotToTime(entry.endSlot)}
                        </span>
                      </div>
                      {entry.title && <p className="text-sm font-medium truncate">{entry.title}</p>}
                    </div>
                  </div>
                ) : isContinuation ? (
                  <div className="w-full border-l-2 pl-2 ml-1" style={{ borderColor: entry?.genre.color }}>
                    <span className="text-xs text-slate-300">...</span>
                  </div>
                ) : (
                  <span className="text-slate-300 text-sm">-</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* FAB for expense */}
      <div className="fixed bottom-20 right-4 z-40">
        <button
          onClick={() => setShowExpenseModal(true)}
          className="w-12 h-12 rounded-full bg-rose-500 text-white shadow-lg hover:bg-rose-600 active:bg-rose-700 flex items-center justify-center"
          title="家計簿を追加"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
        </button>
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

      {/* Expense Modal */}
      {showExpenseModal && (
        <ExpenseModal
          date={date}
          onSave={() => setShowExpenseModal(false)}
          onClose={() => setShowExpenseModal(false)}
        />
      )}
    </div>
  );
}
