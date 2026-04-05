"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { slotToTime, slotToTimeLabel, toJSTDateString, getCurrentSlotJST, getWeekDates, formatDate, getDayLabel, toJSTDateKey } from "@/lib/utils";
import { cachedFetch, invalidateCache, MASTER_TTL } from "@/lib/cache";
import { useSwipe } from "@/hooks/useSwipe";
import EntryModal from "./EntryModal";
import ExpenseModal from "./ExpenseModal";
import DailyNoteInput from "./DailyNoteInput";
import SearchPanel from "./SearchPanel";
import LoadingOverlay from "./LoadingOverlay";

type Category = { id: string; name: string };
type Genre = { id: string; name: string; color: string; type: string };
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
  const [isPanelDirty, setIsPanelDirty] = useState(false);
  const [showDirtyWarning, setShowDirtyWarning] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [weekEntriesMap, setWeekEntriesMap] = useState<Map<string, TimeEntry[]>>(new Map());
  const timelineRef = useRef<HTMLDivElement>(null);
  const landscapeScrollRef = useRef<HTMLDivElement>(null);
  const scrollDoneRef = useRef(false);
  const initialLoadDone = useRef(false);
  const dirtyWarnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isToday = date === toJSTDateString();
  const weekDates = getWeekDates(new Date(date + "T00:00:00"));
  const weekStart = formatDate(weekDates[0]);
  const weekEnd = formatDate(weekDates[6]);

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

  // Landscape detection
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (max-width: 1023px)");
    setIsLandscape(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Fetch week entries for landscape view
  const fetchWeekEntries = useCallback(async (bustCache = false) => {
    const cacheKey = `time-entries?startDate=${weekStart}&endDate=${weekEnd}`;
    if (bustCache) invalidateCache(cacheKey);
    const data = await cachedFetch<TimeEntry[]>(`/api/time-entries?startDate=${weekStart}&endDate=${weekEnd}`);
    const map = new Map<string, TimeEntry[]>();
    data.forEach((e) => {
      const key = e.date ? toJSTDateKey(e.date) : "";
      map.set(key, [...(map.get(key) || []), e]);
    });
    setWeekEntriesMap(map);
  }, [weekStart, weekEnd]);

  useEffect(() => {
    if (isLandscape) fetchWeekEntries();
  }, [isLandscape, fetchWeekEntries]);

  // Auto-scroll landscape grid to current time / 9am
  useEffect(() => {
    if (!isLandscape || !landscapeScrollRef.current) return;
    const grid = landscapeScrollRef.current.querySelector("[data-weekgrid]") as HTMLElement | null;
    if (!grid) return;
    const slot = getCurrentSlotJST();
    const targetSlot = isToday ? Math.max(0, slot - 2) : 18;
    const pxPerSlot = grid.clientHeight / 48;
    landscapeScrollRef.current.scrollTop = targetSlot * pxPerSlot;
  }, [isLandscape, weekEntriesMap, isToday]);

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
    d.setDate(d.getDate() + (isLandscape ? delta * 7 : delta));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setDate(`${y}-${m}-${day}`);
  };

  const swipeHandlers = useSwipe(
    () => changeDate(1),   // swipe left → next day
    () => changeDate(-1),  // swipe right → prev day
  );

  const triggerDirtyWarning = () => {
    setShowDirtyWarning(true);
    if (dirtyWarnTimerRef.current) clearTimeout(dirtyWarnTimerRef.current);
    dirtyWarnTimerRef.current = setTimeout(() => setShowDirtyWarning(false), 2500);
  };

  const handleSlotClick = (slotIndex: number) => {
    if (isPanelDirty) { triggerDirtyWarning(); return; }
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
    if (isPanelDirty) { triggerDirtyWarning(); return; }
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
      setIsPanelDirty(false);
      setShowDirtyWarning(false);
      await fetchEntries(date, true);
      if (isLandscape) await fetchWeekEntries(true);
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
      setIsPanelDirty(false);
      setShowDirtyWarning(false);
      await fetchEntries(date, true);
      if (isLandscape) await fetchWeekEntries(true);
    } finally {
      setSaving(false);
    }
  };

  const handleNewAtSlot = (slotIndex: number) => {
    if (isPanelDirty) { triggerDirtyWarning(); return; }
    setEditEntry(null);
    setSelectedSlot(slotIndex);
    setShowExpenseModal(false);
  };

  const closePanel = () => {
    setSelectedSlot(null);
    setEditEntry(null);
    setShowExpenseModal(false);
    setIsPanelDirty(false);
    setShowDirtyWarning(false);
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
                  {isLandscape
                    ? `${getDayLabel(weekDates[0])} - ${getDayLabel(weekDates[6])}`
                    : new Date(date + "T00:00:00").toLocaleDateString("ja-JP", {
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

        {/* ── Mobile portrait: single scrollable column ── */}
        {!isLandscape && (
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
        )}

        {/* ── Mobile landscape: 7-day week view ── */}
        {isLandscape && (
          <div ref={landscapeScrollRef} className="flex-1 overflow-y-auto lg:hidden" {...swipeHandlers}>
            {/* Sticky day headers */}
            <div
              className="sticky top-0 z-20 grid bg-white border-b border-slate-200"
              style={{ gridTemplateColumns: "2rem repeat(7, 1fr)" }}
            >
              <div className="border-r border-slate-100" />
              {weekDates.map((wd) => {
                const dk = formatDate(wd);
                const isTodayCol = dk === toJSTDateString();
                const dow = wd.getDay();
                return (
                  <div
                    key={dk}
                    className={`text-center py-1 border-r border-slate-100 text-[10px] font-semibold leading-tight ${
                      isTodayCol ? "text-indigo-600 bg-indigo-50" : dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-slate-600"
                    }`}
                  >
                    {wd.getMonth() + 1}/{wd.getDate()}
                    <br />
                    {["日","月","火","水","木","金","土"][dow]}
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div
              data-weekgrid
              className="grid relative"
              style={{
                gridTemplateColumns: "2rem repeat(7, 1fr)",
                gridTemplateRows: "repeat(48, 1.25rem)",
              }}
              onClick={(ev) => {
                const grid = ev.currentTarget;
                const rect = grid.getBoundingClientRect();
                const x = ev.clientX - rect.left;
                const y = ev.clientY - rect.top;
                const timeColPx = 32;
                if (x < timeColPx) return;
                const dayW = (rect.width - timeColPx) / 7;
                const colIdx = Math.min(6, Math.floor((x - timeColPx) / dayW));
                const rowH = grid.clientHeight / 48;
                const slot = Math.min(47, Math.floor(y / rowH));
                const dk = formatDate(weekDates[colIdx]);
                setDate(dk);
                setEditEntry(null);
                setSelectedSlot(slot);
              }}
            >
              {/* Hour labels */}
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={`h${h}`}
                  className="flex items-start justify-center text-[8px] font-mono text-slate-400 border-b border-slate-100"
                  style={{ gridRow: `${h * 2 + 1} / ${h * 2 + 3}`, gridColumn: 1 }}
                >
                  {h}
                </div>
              ))}

              {/* Grid lines */}
              {weekDates.map((_, colIdx) =>
                Array.from({ length: 48 }, (_, rowIdx) => (
                  <div
                    key={`c${colIdx}r${rowIdx}`}
                    className={`border-r border-slate-100 ${rowIdx % 2 === 0 ? "border-b border-b-slate-100" : "border-b border-b-slate-50"}`}
                    style={{ gridRow: rowIdx + 1, gridColumn: colIdx + 2 }}
                  />
                ))
              )}

              {/* Current time indicator */}
              {weekDates.map((wd, colIdx) => {
                const dk = formatDate(wd);
                if (dk !== toJSTDateString()) return null;
                return (
                  <div
                    key="now"
                    className="bg-indigo-500 z-20 pointer-events-none"
                    style={{
                      gridRow: currentSlot + 1,
                      gridColumn: colIdx + 2,
                      height: "2px",
                      alignSelf: "center",
                    }}
                  />
                );
              })}

              {/* Entry blocks */}
              {weekDates.map((wd, colIdx) => {
                const dk = formatDate(wd);
                const dayEntries = weekEntriesMap.get(dk) || [];
                return dayEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setDate(dk);
                      handleEntryClick(entry);
                    }}
                    className="rounded-sm overflow-hidden z-10 text-left mx-px"
                    style={{
                      gridRow: `${entry.startSlot + 1} / ${entry.endSlot + 1}`,
                      gridColumn: colIdx + 2,
                      backgroundColor: `${entry.genre.color}20`,
                      borderLeft: `2px solid ${entry.genre.color}`,
                    }}
                  >
                    <p
                      className="text-[7px] font-medium truncate px-0.5 leading-tight"
                      style={{ color: entry.genre.color }}
                    >
                      {entry.title || entry.genre.name}
                    </p>
                  </button>
                ));
              })}
            </div>
          </div>
        )}

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

            {/* 未保存警告バナー */}
            {showDirtyWarning && (
              <div className="mx-3 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 flex-shrink-0">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-xs text-amber-700 font-medium">変更を保存してください</p>
              </div>
            )}

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
                onDirtyChange={setIsPanelDirty}
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
