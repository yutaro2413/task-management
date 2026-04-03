"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { slotToTime, toJSTDateString, getCurrentSlotJST } from "@/lib/utils";
import { cachedFetch, invalidateCache, MASTER_TTL } from "@/lib/cache";
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
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollDoneRef = useRef(false);
  const initialLoadDone = useRef(false);

  const isToday = date === toJSTDateString();

  const fetchEntries = useCallback(async (bustCache = false) => {
    setFetching(true);
    try {
      const prevDate = (() => {
        const d = new Date(date + "T00:00:00");
        d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();

      if (bustCache) {
        invalidateCache(`time-entries?date=${date}`);
        invalidateCache(`time-entries?date=${prevDate}`);
      }

      const [currentData, prevData] = await Promise.all([
        cachedFetch<TimeEntry[]>(`/api/time-entries?date=${date}`),
        cachedFetch<TimeEntry[]>(`/api/time-entries?date=${prevDate}`),
      ]);

      const crossMidnightEntries: TimeEntry[] = prevData
        .filter((e) => e.endSlot >= 48)
        .map((e) => ({
          ...e,
          startSlot: 0,
          endSlot: Math.min(e.endSlot - 48, 48),
        }));

      setEntries([...crossMidnightEntries, ...currentData]);
    } finally {
      setFetching(false);
      initialLoadDone.current = true;
    }
  }, [date]);

  useEffect(() => {
    scrollDoneRef.current = false;
    fetchEntries();
  }, [fetchEntries]);

  // Load master data once (cached for 5 min)
  useEffect(() => {
    Promise.all([
      cachedFetch<Category[]>("/api/categories", MASTER_TTL),
      cachedFetch<Genre[]>("/api/genres", MASTER_TTL),
    ]).then(([cats, gnrs]) => {
      setCategories(cats);
      setGenres(gnrs);
    });
  }, []);

  // Scroll to 9:00 by default
  useEffect(() => {
    if (fetching || !timelineRef.current || scrollDoneRef.current) return;
    scrollDoneRef.current = true;
    const slot = getCurrentSlotJST();
    const targetSlot = isToday && slot >= 18 ? Math.max(0, slot - 2) : 18;
    const gridEl = timelineRef.current.querySelector("[data-grid]");
    if (gridEl) {
      const label = gridEl.querySelector(`[data-slot="${targetSlot}"]`);
      if (label) {
        label.scrollIntoView({ behavior: "auto", block: "start" });
        return;
      }
    }
    timelineRef.current.scrollTop = targetSlot * 36;
  }, [date, isToday, fetching]);

  // Work hours (excluding プライベート)
  const workSlots = entries
    .filter((e) => e.category.name !== "プライベート")
    .reduce((sum, e) => sum + (e.endSlot - e.startSlot), 0);
  const workHours = Math.floor(workSlots / 2);
  const workMinutes = (workSlots % 2) * 30;

  // Build slot -> entries map
  const slotEntriesMap = new Map<number, TimeEntry[]>();
  entries.forEach((e) => {
    for (let i = e.startSlot; i < e.endSlot; i++) {
      const list = slotEntriesMap.get(i) || [];
      list.push(e);
      slotEntriesMap.set(i, list);
    }
  });

  const occupiedSlots = new Set<number>();
  entries.forEach((e) => {
    for (let i = e.startSlot; i < e.endSlot; i++) {
      occupiedSlots.add(i);
    }
  });

  // Assign columns for overlapping entries
  const entryColumns = new Map<string, number>();
  entries.forEach((entry) => {
    let hasOverlap = false;
    for (let i = entry.startSlot; i < entry.endSlot; i++) {
      const list = slotEntriesMap.get(i) || [];
      if (list.length > 1) { hasOverlap = true; break; }
    }
    if (!hasOverlap && !entryColumns.has(entry.id)) {
      entryColumns.set(entry.id, -1);
    }
  });
  for (const [, list] of slotEntriesMap) {
    if (list.length <= 1) continue;
    list.forEach((entry, idx) => {
      if (!entryColumns.has(entry.id)) {
        entryColumns.set(entry.id, idx);
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
      await fetchEntries(true);
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
      await fetchEntries(true);
    } finally {
      setSaving(false);
    }
  };

  const slots = Array.from({ length: 48 }, (_, i) => i);
  const currentSlot = getCurrentSlotJST();

  return (
    <div className="flex-1 flex flex-col">
      {/* Full-screen overlay ONLY for saves */}
      {saving && <LoadingOverlay />}

      {/* Header with daily note */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between py-2">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <div className="flex items-center gap-2 justify-center">
                <span className="text-base font-bold">
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
                {/* Inline fetching indicator */}
                {fetching && (
                  <div className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                )}
              </div>
              {workSlots > 0 && (
                <p className="text-xs text-indigo-600 font-medium">
                  稼働 {workHours}時間{workMinutes > 0 ? `${workMinutes}分` : ""}
                </p>
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
          <div className="pb-2">
            <DailyNoteInput date={date} />
          </div>
        </div>
      </header>

      {showSearch && <SearchPanel onClose={() => setShowSearch(false)} />}

      {/* Timeline */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-y-auto timeline-scroll px-2 max-w-lg mx-auto w-full"
      >
        <div
          data-grid
          className="grid relative"
          style={{
            gridTemplateColumns: "3rem 1fr",
            gridTemplateRows: "repeat(48, 2.25rem)",
          }}
        >
          {slots.map((slotIndex) => {
            const isCurrent = isToday && slotIndex === currentSlot;
            const isOccupied = occupiedSlots.has(slotIndex);
            return (
              <div key={`row-${slotIndex}`} className="contents">
                <div
                  data-slot={slotIndex}
                  className={`flex items-center justify-center text-[10px] font-mono border-b border-slate-100 ${
                    isCurrent ? "bg-indigo-50" : ""
                  } ${slotIndex % 2 === 0 ? "text-slate-600 font-semibold" : "text-slate-400"}`}
                  style={{ gridRow: slotIndex + 1, gridColumn: 1 }}
                >
                  {slotToTime(slotIndex)}
                </div>
                {!isOccupied && (
                  <button
                    onClick={() => handleSlotClick(slotIndex)}
                    className={`flex items-center pl-2 border-b border-slate-100 transition-colors text-left ${
                      isCurrent ? "bg-indigo-50 hover:bg-indigo-100" : "hover:bg-slate-50 active:bg-slate-100"
                    }`}
                    style={{ gridRow: slotIndex + 1, gridColumn: 2 }}
                  >
                    <span className="text-slate-300 text-xs">-</span>
                  </button>
                )}
              </div>
            );
          })}

          {entries.map((entry) => {
            const spanSlots = entry.endSlot - entry.startSlot;
            const col = entryColumns.get(entry.id) ?? -1;
            const isOverlap = col >= 0;

            const style: React.CSSProperties = {
              gridRow: `${entry.startSlot + 1} / ${entry.endSlot + 1}`,
              gridColumn: 2,
              backgroundColor: `${entry.genre.color}15`,
            };

            if (isOverlap) {
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
                className="relative flex text-left rounded-md overflow-hidden transition-colors hover:brightness-95 active:brightness-90 mx-0.5 my-px"
                style={style}
              >
                <div
                  className="w-1 flex-shrink-0 rounded-l-md"
                  style={{ backgroundColor: entry.genre.color }}
                />
                <div className="flex-1 flex flex-col justify-center px-1.5 py-0.5 min-w-0 overflow-hidden">
                  {spanSlots === 1 ? (
                    <div className="flex items-center gap-1 min-w-0">
                      <span
                        className="text-[9px] px-1 py-px rounded text-white font-medium leading-none flex-shrink-0"
                        style={{ backgroundColor: entry.genre.color }}
                      >
                        {entry.genre.name}
                      </span>
                      <span className="text-[10px] text-slate-500 flex-shrink-0">{entry.category.name}</span>
                      {entry.title && <span className="text-[10px] font-medium truncate">{entry.title}</span>}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-medium">{entry.category.name}</span>
                        <span
                          className="text-[10px] px-1 py-px rounded-full text-white font-medium leading-none"
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
                        <p className={`font-medium truncate ${spanSlots > 2 && !isOverlap ? "text-xs" : "text-[10px]"}`}>
                          {entry.title}
                        </p>
                      )}
                      {entry.detail && spanSlots >= 4 && !isOverlap && (
                        <p className="text-[10px] text-slate-400 truncate">{entry.detail}</p>
                      )}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* FABs */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col gap-3">
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

      {selectedSlot !== null && (
        <EntryModal
          slotIndex={selectedSlot}
          categories={categories}
          genres={genres}
          editEntry={editEntry}
          onSave={handleSave}
          onDelete={editEntry ? () => handleDelete(editEntry.id) : undefined}
          onClose={() => { setSelectedSlot(null); setEditEntry(null); }}
        />
      )}

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
