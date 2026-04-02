"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { slotToTime, toJSTDateString, getCurrentSlotJST } from "@/lib/utils";
import EntryModal from "./EntryModal";
import ExpenseModal from "./ExpenseModal";
import DailyNoteInput from "./DailyNoteInput";
import SearchPanel from "./SearchPanel";
import LoadingOverlay from "./LoadingOverlay";

type Category = { id: string; name: string };
type Genre = { id: string; name: string; color: string };
type TimeEntry = {
  id: string;
  date?: string;
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollDoneRef = useRef(false);

  const isToday = date === toJSTDateString();

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch current date entries + previous day (for cross-midnight entries)
      const prevDate = (() => {
        const d = new Date(date + "T00:00:00");
        d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();

      const [currentRes, prevRes] = await Promise.all([
        fetch(`/api/time-entries?date=${date}`),
        fetch(`/api/time-entries?date=${prevDate}`),
      ]);
      const currentData: TimeEntry[] = await currentRes.json();
      const prevData: TimeEntry[] = await prevRes.json();

      // Include previous day entries that cross midnight (endSlot > 48 equivalent)
      // In our system, cross-midnight means endSlot > startSlot wraps, or endSlot == 48
      // For simplicity: if previous day entry has endSlot > 47 (i.e. goes to 24:00 / midnight),
      // we show it as a continuation on this day starting at slot 0
      const crossMidnightEntries: TimeEntry[] = prevData
        .filter((e) => e.endSlot >= 48)
        .map((e) => ({
          ...e,
          startSlot: 0,
          endSlot: Math.min(e.endSlot - 48, 48),
          _crossDate: true,
        }));

      setEntries([...crossMidnightEntries, ...currentData]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    scrollDoneRef.current = false;
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

  // Scroll to 9:00 (JST) by default, or near current time if today
  useEffect(() => {
    if (loading || !timelineRef.current || scrollDoneRef.current) return;
    scrollDoneRef.current = true;
    const slot = getCurrentSlotJST();
    const targetSlot = isToday && slot >= 18 ? Math.max(0, slot - 2) : 18;
    // Find the time label element for the target slot in the grid
    const gridEl = timelineRef.current.querySelector("[data-grid]");
    if (gridEl) {
      const label = gridEl.querySelector(`[data-slot="${targetSlot}"]`);
      if (label) {
        label.scrollIntoView({ behavior: "auto", block: "start" });
        return;
      }
    }
    // Fallback: estimate scroll position (each row ~3rem = 48px)
    timelineRef.current.scrollTop = targetSlot * 48;
  }, [date, isToday, loading]);

  // Build slot -> entries map (supports up to 2 overlapping entries per slot)
  const slotEntriesMap = new Map<number, TimeEntry[]>();
  entries.forEach((e) => {
    for (let i = e.startSlot; i < e.endSlot; i++) {
      const list = slotEntriesMap.get(i) || [];
      list.push(e);
      slotEntriesMap.set(i, list);
    }
  });

  // Build occupied set
  const occupiedSlots = new Set<number>();
  entries.forEach((e) => {
    for (let i = e.startSlot; i < e.endSlot; i++) {
      occupiedSlots.add(i);
    }
  });

  // Detect which slots have overlapping entries (2 entries)
  const overlapSlots = new Set<number>();
  for (const [slot, list] of slotEntriesMap) {
    if (list.length > 1) overlapSlots.add(slot);
  }

  // Group entries by column (for overlapping entries, assign col 0 or 1)
  const entryColumns = new Map<string, number>();
  const processedOverlaps = new Set<string>();
  entries.forEach((entry) => {
    if (processedOverlaps.has(entry.id)) return;
    // Check if this entry overlaps with any other
    let hasOverlap = false;
    for (let i = entry.startSlot; i < entry.endSlot; i++) {
      const list = slotEntriesMap.get(i) || [];
      if (list.length > 1) {
        hasOverlap = true;
        break;
      }
    }
    if (!hasOverlap) {
      entryColumns.set(entry.id, -1); // full width
    }
  });

  // For overlapping entries, assign columns
  for (const [, list] of slotEntriesMap) {
    if (list.length <= 1) continue;
    list.forEach((entry, idx) => {
      if (!entryColumns.has(entry.id)) {
        entryColumns.set(entry.id, idx);
        processedOverlaps.add(entry.id);
      }
    });
  }

  const changeDate = (delta: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setDate(`${y}-${m}-${day}`);
  };

  const handleSlotClick = (slotIndex: number) => {
    const list = slotEntriesMap.get(slotIndex);
    if (list && list.length > 0) {
      const existing = list[0];
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
    setSaving(true);
    try {
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
      await fetchEntries();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      await fetch(`/api/time-entries?id=${id}`, { method: "DELETE" });
      setSelectedSlot(null);
      setEditEntry(null);
      await fetchEntries();
    } finally {
      setSaving(false);
    }
  };

  const slots = Array.from({ length: 48 }, (_, i) => i);
  const currentSlot = getCurrentSlotJST();

  return (
    <div className="flex-1 flex flex-col">
      {/* Fullscreen saving overlay */}
      {saving && <LoadingOverlay />}

      {/* Header with daily note */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between py-3">
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
          {/* Daily Note in header */}
          <div className="pb-2">
            <DailyNoteInput date={date} />
          </div>
        </div>
      </header>

      {/* Search Modal */}
      {showSearch && <SearchPanel onClose={() => setShowSearch(false)} />}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-2">
          <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Timeline - CSS Grid */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-y-auto timeline-scroll px-4 max-w-lg mx-auto w-full"
      >
        <div
          data-grid
          className="grid relative"
          style={{
            gridTemplateColumns: "3.5rem 1fr",
            gridTemplateRows: "repeat(48, minmax(3rem, auto))",
          }}
        >
          {/* Time labels + empty slot click targets */}
          {slots.map((slotIndex) => {
            const isCurrent = isToday && slotIndex === currentSlot;
            const isOccupied = occupiedSlots.has(slotIndex);
            return (
              <div
                key={`row-${slotIndex}`}
                className="contents"
              >
                {/* Time label */}
                <div
                  data-slot={slotIndex}
                  className={`flex items-center justify-center text-xs font-mono border-b border-slate-100 ${
                    isCurrent ? "bg-indigo-50" : ""
                  } ${slotIndex % 2 === 0 ? "text-slate-600 font-semibold" : "text-slate-400"}`}
                  style={{ gridRow: slotIndex + 1, gridColumn: 1 }}
                >
                  {slotToTime(slotIndex)}
                </div>

                {/* Empty slot - clickable area */}
                {!isOccupied && (
                  <button
                    onClick={() => handleSlotClick(slotIndex)}
                    className={`flex items-center pl-3 border-b border-slate-100 transition-colors text-left ${
                      isCurrent
                        ? "bg-indigo-50 hover:bg-indigo-100"
                        : "hover:bg-slate-50 active:bg-slate-100"
                    }`}
                    style={{ gridRow: slotIndex + 1, gridColumn: 2 }}
                  >
                    <span className="text-slate-300 text-sm">-</span>
                  </button>
                )}
              </div>
            );
          })}

          {/* Entry blocks - spanning multiple rows */}
          {entries.map((entry) => {
            const spanSlots = entry.endSlot - entry.startSlot;
            const col = entryColumns.get(entry.id) ?? -1;
            const isOverlap = col >= 0;

            // For overlapping entries, use sub-grid positioning via CSS
            const style: React.CSSProperties = {
              gridRow: `${entry.startSlot + 1} / ${entry.endSlot + 1}`,
              gridColumn: 2,
              backgroundColor: `${entry.genre.color}15`,
            };

            if (isOverlap) {
              // Position side by side: left half or right half
              style.width = "50%";
              style.marginLeft = col === 1 ? "50%" : "0";
            }

            return (
              <button
                key={entry.id}
                onClick={() => {
                  setEditEntry(entry);
                  setSelectedSlot(entry.startSlot);
                }}
                className={`relative flex text-left rounded-lg overflow-hidden transition-colors hover:brightness-95 active:brightness-90 ${
                  isOverlap ? "mx-0.5 my-0.5" : "mx-1 my-0.5"
                }`}
                style={style}
              >
                {/* Color band on left */}
                <div
                  className="w-1 flex-shrink-0 rounded-l-lg"
                  style={{ backgroundColor: entry.genre.color }}
                />

                {/* Content - vertically centered */}
                <div className="flex-1 flex flex-col justify-center px-2 py-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-medium">{entry.category.name}</span>
                    <span
                      className="text-[10px] px-1 py-0.5 rounded-full text-white font-medium leading-none"
                      style={{ backgroundColor: entry.genre.color }}
                    >
                      {entry.genre.name}
                    </span>
                    {!isOverlap && (
                      <span className="text-[10px] text-slate-400">
                        {slotToTime(entry.startSlot)}-{slotToTime(entry.endSlot)}
                      </span>
                    )}
                  </div>
                  {entry.title && (
                    <p className={`font-medium truncate mt-0.5 ${spanSlots > 2 && !isOverlap ? "text-sm" : "text-xs"}`}>
                      {entry.title}
                    </p>
                  )}
                  {entry.detail && spanSlots >= 3 && !isOverlap && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{entry.detail}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* FABs */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col gap-3">
        {/* Add time entry */}
        <button
          onClick={() => {
            setEditEntry(null);
            const now = getCurrentSlotJST();
            setSelectedSlot(isToday ? now : 18);
          }}
          className="w-12 h-12 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 active:bg-indigo-800 flex items-center justify-center"
          title="予定を追加"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        {/* Add expense */}
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
