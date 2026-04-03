"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { slotToTime, slotToTimeLabel, toJSTDateString, getCurrentSlotJST } from "@/lib/utils";
import { cachedFetch, invalidateCache, MASTER_TTL } from "@/lib/cache";
import { useSwipe } from "@/hooks/useSwipe";
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

// ─── Sub-component: renders a portion of the timeline grid ───────────────────
type TimeGridProps = {
  startSlot: number;
  endSlot: number;
  entries: TimeEntry[];
  occupiedSlots: Set<number>;
  entryColumns: Map<string, number>;
  isToday: boolean;
  currentSlot: number;
  rowHeightRem: number;
  onSlotClick: (slotIndex: number) => void;
  onEntryClick: (entry: TimeEntry) => void;
  onNewEntry: (slotIndex: number) => void;
  gridRef?: React.RefObject<HTMLDivElement | null>;
};

function TimeGrid({
  startSlot,
  endSlot,
  entries,
  occupiedSlots,
  entryColumns,
  isToday,
  currentSlot,
  rowHeightRem,
  onSlotClick,
  onEntryClick,
  onNewEntry,
  gridRef,
}: TimeGridProps) {
  const count = endSlot - startSlot;
  const slots = Array.from({ length: count }, (_, i) => i + startSlot);

  return (
    <div
      ref={gridRef}
      data-grid
      className="grid relative"
      style={{
        gridTemplateColumns: "3rem 1fr 0.875rem",
        gridTemplateRows: `repeat(${count}, ${rowHeightRem}rem)`,
      }}
    >
      {slots.map((slotIndex) => {
        const localRow = slotIndex - startSlot + 1;
        const isCurrent = isToday && slotIndex === currentSlot;
        const isOccupied = occupiedSlots.has(slotIndex);
        return (
          <div key={`row-${slotIndex}`} className="contents">
            <div
              data-slot={slotIndex}
              className={`flex items-center justify-center text-[10px] font-mono border-b border-slate-100 ${
                isCurrent ? "bg-indigo-50" : ""
              } ${slotIndex % 2 === 0 ? "text-slate-600 font-semibold" : "text-slate-400"}`}
              style={{ gridRow: localRow, gridColumn: 1 }}
            >
              {slotToTime(slotIndex)}
            </div>
            {!isOccupied && (
              <button
                onClick={() => onSlotClick(slotIndex)}
                className={`flex items-center pl-2 border-b border-slate-100 transition-colors text-left ${
                  isCurrent ? "bg-indigo-50 hover:bg-indigo-100" : "hover:bg-slate-50 active:bg-slate-100"
                }`}
                style={{ gridRow: localRow, gridColumn: 2 }}
              >
                <span className="text-slate-300 text-xs">-</span>
              </button>
            )}
            {/* Right-side strip: always visible, click to add new entry at this slot */}
            <button
              onClick={(e) => { e.stopPropagation(); onNewEntry(slotIndex); }}
              title="ここから新規登録"
              className={`border-b border-slate-100 border-l border-l-slate-100 transition-colors ${
                isCurrent ? "bg-indigo-50 hover:bg-indigo-200" : "bg-slate-50 hover:bg-indigo-100"
              }`}
              style={{ gridRow: localRow, gridColumn: 3 }}
            />
          </div>
        );
      })}

      {entries.map((entry) => {
        const effectiveStart = Math.max(entry.startSlot, startSlot);
        const effectiveEnd = Math.min(entry.endSlot, endSlot);
        if (effectiveStart >= effectiveEnd) return null;

        const localStartRow = effectiveStart - startSlot + 1;
        const localEndRow = effectiveEnd - startSlot + 1;
        const spanSlots = entry.endSlot - entry.startSlot;
        const col = entryColumns.get(entry.id) ?? -1;
        const isOverlap = col >= 0;

        const style: React.CSSProperties = {
          gridRow: `${localStartRow} / ${localEndRow}`,
          gridColumn: 2,
          backgroundColor: `${entry.genre.color}15`,
        };
        if (isOverlap) {
          style.width = "50%";
          style.marginLeft = col === 1 ? "50%" : "0";
        }

        return (
          <button
            key={`${entry.id}-${startSlot}`}
            onClick={() => onEntryClick(entry)}
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
                        {slotToTime(entry.startSlot)}-{slotToTimeLabel(entry.endSlot)}
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
  );
}
// ─────────────────────────────────────────────────────────────────────────────

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

  // 最新リクエスト対象日付を追跡し、古いレスポンスを破棄する
  const latestFetchDateRef = useRef(date);

  const fetchEntries = useCallback(async (targetDate: string, bustCache = false) => {
    latestFetchDateRef.current = targetDate;
    setFetching(true);
    try {
      const prevDate = (() => {
        const d = new Date(targetDate + "T00:00:00");
        d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();

      if (bustCache) {
        invalidateCache(`time-entries?date=${targetDate}`);
        invalidateCache(`time-entries?date=${prevDate}`);
      }

      const [currentData, prevData] = await Promise.all([
        cachedFetch<TimeEntry[]>(`/api/time-entries?date=${targetDate}`),
        cachedFetch<TimeEntry[]>(`/api/time-entries?date=${prevDate}`),
      ]);

      // 日付を高速変更した場合、古いレスポンスは無視する
      if (latestFetchDateRef.current !== targetDate) return;

      const crossMidnightEntries: TimeEntry[] = prevData
        .filter((e) => e.endSlot >= 48)
        .map((e) => ({
          ...e,
          startSlot: 0,
          endSlot: Math.min(e.endSlot - 48, 48),
        }));

      setEntries([...crossMidnightEntries, ...currentData]);
    } finally {
      if (latestFetchDateRef.current === targetDate) {
        setFetching(false);
        initialLoadDone.current = true;
      }
    }
  }, []);

  // 150ms デバウンスで高速連打によるリクエスト爆発を防ぐ
  useEffect(() => {
    scrollDoneRef.current = false;
    const timer = setTimeout(() => fetchEntries(date), 150);
    return () => clearTimeout(timer);
  }, [date, fetchEntries]);

  useEffect(() => {
    Promise.all([
      cachedFetch<Category[]>("/api/categories", MASTER_TTL),
      cachedFetch<Genre[]>("/api/genres", MASTER_TTL),
    ]).then(([cats, gnrs]) => {
      setCategories(cats);
      setGenres(gnrs);
    });
  }, []);

  // Auto-scroll mobile timeline to current/9am slot
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

  // Work hours (excluding プライベート) — deduplicate overlapping slots
  const workSlotSet = new Set<number>();
  entries
    .filter((e) => e.category.name !== "プライベート")
    .forEach((e) => {
      for (let i = e.startSlot; i < e.endSlot; i++) workSlotSet.add(i);
    });
  const workSlots = workSlotSet.size;
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
    for (let i = e.startSlot; i < e.endSlot; i++) occupiedSlots.add(i);
  });

  // Assign columns for overlapping entries
  const entryColumns = new Map<string, number>();
  entries.forEach((entry) => {
    let hasOverlap = false;
    for (let i = entry.startSlot; i < entry.endSlot; i++) {
      const list = slotEntriesMap.get(i) || [];
      if (list.length > 1) { hasOverlap = true; break; }
    }
    if (!hasOverlap && !entryColumns.has(entry.id)) entryColumns.set(entry.id, -1);
  });
  for (const [, list] of slotEntriesMap) {
    if (list.length <= 1) continue;
    list.forEach((entry, idx) => {
      if (!entryColumns.has(entry.id)) entryColumns.set(entry.id, idx);
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

  const swipeHandlers = useSwipe(
    () => changeDate(1),   // swipe left → next day
    () => changeDate(-1),  // swipe right → prev day
  );

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
    setShowExpenseModal(false);
  };

  const handleEntryClick = (entry: TimeEntry) => {
    setEditEntry(entry);
    setSelectedSlot(entry.startSlot);
    setShowExpenseModal(false);
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
      await fetchEntries(date, true);
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
      await fetchEntries(date, true);
    } finally {
      setSaving(false);
    }
  };

  const handleNewAtSlot = (slotIndex: number) => {
    setEditEntry(null);
    setSelectedSlot(slotIndex);
    setShowExpenseModal(false);
  };

  const closePanel = () => {
    setSelectedSlot(null);
    setEditEntry(null);
    setShowExpenseModal(false);
  };

  const currentSlot = getCurrentSlotJST();

  const panelHasContent = selectedSlot !== null || showExpenseModal;
  const panelTitle = showExpenseModal
    ? "家計簿を追加"
    : editEntry
    ? "記録を編集"
    : "記録を追加";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {saving && <LoadingOverlay />}

      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4">
        <div className="max-w-lg mx-auto lg:max-w-none">
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

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Mobile: single scrollable column ── */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-y-auto timeline-scroll px-2 max-w-lg mx-auto w-full lg:hidden"
          {...swipeHandlers}
        >
          <TimeGrid
            startSlot={0}
            endSlot={48}
            entries={entries}
            occupiedSlots={occupiedSlots}
            entryColumns={entryColumns}
            isToday={isToday}
            currentSlot={currentSlot}
            rowHeightRem={2.25}
            onSlotClick={handleSlotClick}
            onEntryClick={handleEntryClick}
            onNewEntry={handleNewAtSlot}
          />
        </div>

        {/* ── PC: AM/PM side-by-side + right panel ── */}
        <div className="hidden lg:flex flex-1 overflow-hidden" {...swipeHandlers}>
          {/* AM column 00:00–12:00 */}
          <div className="flex-1 overflow-y-auto border-r border-slate-100 px-1">
            <div className="text-center text-[10px] font-semibold text-slate-400 py-1 border-b border-slate-100">
              午前
            </div>
            <TimeGrid
              startSlot={0}
              endSlot={24}
              entries={entries}
              occupiedSlots={occupiedSlots}
              entryColumns={entryColumns}
              isToday={isToday}
              currentSlot={currentSlot}
              rowHeightRem={1.875}
              onSlotClick={handleSlotClick}
              onEntryClick={handleEntryClick}
              onNewEntry={handleNewAtSlot}
            />
          </div>

          {/* PM column 12:00–24:00 */}
          <div className="flex-1 overflow-y-auto border-r border-slate-100 px-1">
            <div className="text-center text-[10px] font-semibold text-slate-400 py-1 border-b border-slate-100">
              午後
            </div>
            <TimeGrid
              startSlot={24}
              endSlot={48}
              entries={entries}
              occupiedSlots={occupiedSlots}
              entryColumns={entryColumns}
              isToday={isToday}
              currentSlot={currentSlot}
              rowHeightRem={1.875}
              onSlotClick={handleSlotClick}
              onEntryClick={handleEntryClick}
              onNewEntry={handleNewAtSlot}
            />
          </div>

          {/* Right panel */}
          <div className="w-80 flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm font-semibold text-slate-700">
                {panelHasContent ? panelTitle : "詳細"}
              </h3>
              {panelHasContent && (
                <button onClick={closePanel} className="p-1 rounded-lg hover:bg-slate-100">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Panel content */}
            {selectedSlot !== null && (
              <EntryModal
                slotIndex={selectedSlot}
                categories={categories}
                genres={genres}
                editEntry={editEntry}
                onSave={handleSave}
                onDelete={editEntry ? () => handleDelete(editEntry.id) : undefined}
                onClose={closePanel}
                panelMode
              />
            )}
            {showExpenseModal && (
              <ExpenseModal
                date={date}
                onSave={() => { setShowExpenseModal(false); }}
                onClose={() => setShowExpenseModal(false)}
                panelMode
              />
            )}
            {!panelHasContent && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                <p className="text-xs text-slate-400 text-center">
                  タイムラインをクリックして<br />記録を追加
                </p>
                <button
                  onClick={() => {
                    setEditEntry(null);
                    setSelectedSlot(isToday ? currentSlot : 18);
                    setShowExpenseModal(false);
                  }}
                  className="w-full py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  ＋ 記録を追加
                </button>
                <button
                  onClick={() => {
                    setSelectedSlot(null);
                    setShowExpenseModal(true);
                  }}
                  className="w-full py-2.5 rounded-lg text-sm font-medium bg-rose-500 text-white hover:bg-rose-600"
                >
                  ¥ 家計簿を追加
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FABs — mobile only */}
      <div className="fixed bottom-16 right-4 z-40 flex flex-col gap-3 lg:hidden">
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

      {/* Mobile modals */}
      <div className="lg:hidden">
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
    </div>
  );
}
