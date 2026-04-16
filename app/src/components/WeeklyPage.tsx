"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getWeekDates, getDayLabel, formatDate, slotToTime, getMonthDates, getMonthLabel, toJSTDateKey, toJSTDateString } from "@/lib/utils";
import { cachedFetch, invalidateCache } from "@/lib/cache";
import { NOTE_SECTIONS, NoteSections, parseNote, serializeNote } from "@/lib/dailyNote";
import { useSwipe } from "@/hooks/useSwipe";
import EntryModal from "./EntryModal";

type TimeEntry = {
  id: string;
  date: string;
  startSlot: number;
  endSlot: number;
  title?: string | null;
  detail?: string | null;
  category: { id: string; name: string; excludeFromSummary: boolean };
  genre: { id: string; name: string; color: string; type: string; subType: string };
};

type DailyNote = {
  date: string;
  content: string;
};

type SimpleExpense = {
  date: string;
  amount: number;
  type: string;
};

type ViewMode = "summary" | "timeline" | "calendar";
type PeriodMode = "weekly" | "monthly";

function CardSpinner() {
  return (
    <div className="flex justify-center py-6">
      <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
}

// Slot height in rem for the Outlook-style weekly calendar
const CAL_ROW_REM = 1.875;

/**
 * 重なりエントリを列に割り当てる。
 * 推移的に重なるエントリをクラスタ化し、クラスタ内で空いている列を見つけて配置する。
 * 返り値: entryId → { col, total } （colは0始まり、totalはクラスタ内の列数）
 */
function computeEntryLayout(entries: TimeEntry[]): Map<string, { col: number; total: number }> {
  const result = new Map<string, { col: number; total: number }>();
  const sorted = [...entries].sort((a, b) => a.startSlot - b.startSlot || a.endSlot - b.endSlot);

  let cluster: TimeEntry[] = [];
  let clusterMaxEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const lanes: number[] = []; // 各列の末尾終了スロット
    const cols: number[] = [];
    for (const e of cluster) {
      let col = -1;
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] <= e.startSlot) { col = i; break; }
      }
      if (col === -1) { col = lanes.length; lanes.push(0); }
      lanes[col] = e.endSlot;
      cols.push(col);
    }
    const total = lanes.length;
    cluster.forEach((e, i) => result.set(e.id, { col: cols[i], total }));
    cluster = [];
    clusterMaxEnd = -1;
  };

  for (const e of sorted) {
    if (e.startSlot >= clusterMaxEnd) flush();
    cluster.push(e);
    clusterMaxEnd = Math.max(clusterMaxEnd, e.endSlot);
  }
  flush();
  return result;
}

const NOTE_DRAFT_PREFIX = "dailyNote-draft-";
function saveNoteDraft(date: string, draft: NoteSections) {
  const s = serializeNote(draft);
  if (s) localStorage.setItem(NOTE_DRAFT_PREFIX + date, JSON.stringify(draft));
  else localStorage.removeItem(NOTE_DRAFT_PREFIX + date);
}
function loadNoteDraft(date: string): NoteSections | null {
  try { const r = localStorage.getItem(NOTE_DRAFT_PREFIX + date); return r ? JSON.parse(r) : null; } catch { return null; }
}
function clearNoteDraft(date: string) { localStorage.removeItem(NOTE_DRAFT_PREFIX + date); }

export default function WeeklyPage() {
  const [baseDate, setBaseDate] = useState(() => new Date(toJSTDateString() + "T00:00:00"));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [expenses, setExpenses] = useState<SimpleExpense[]>([]);
  const [view, setView] = useState<ViewMode>("summary");
  const [period, setPeriod] = useState<PeriodMode>("weekly");
  const [fetching, setFetching] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [filterGenreId, setFilterGenreId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null); // "投資" | "経費" | "付随" | null
  const [editingNote, setEditingNote] = useState<DailyNote | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteSections>({});
  const [noteSaving, setNoteSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingTimeEntry, setEditingTimeEntry] = useState<TimeEntry | null>(null);
  const [newEntryContext, setNewEntryContext] = useState<{ date: string; startSlot: number } | null>(null);
  const [masterCategories, setMasterCategories] = useState<{ id: string; name: string }[]>([]);
  const [masterGenres, setMasterGenres] = useState<{ id: string; name: string; color: string; type: string; subType: string }[]>([]);
  const hasData = useRef(false);

  // ── D&D / long-press state ──────────────────────────────────────────────
  const [dragEntry, setDragEntry] = useState<TimeEntry | null>(null);
  const [dropCell, setDropCell] = useState<{ colIdx: number; slot: number } | null>(null);
  const [touchGhost, setTouchGhost] = useState<{ x: number; y: number; entry: TimeEntry } | null>(null);
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchInfoRef = useRef<{ entry: TimeEntry; startX: number; startY: number } | null>(null);
  const touchDragActiveRef = useRef(false);

  const weekDates = getWeekDates(baseDate);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const monthRange = getMonthDates(year, month);

  const startDate = period === "weekly" ? formatDate(weekDates[0]) : formatDate(monthRange.start);
  const endDate = period === "weekly" ? formatDate(weekDates[6]) : formatDate(monthRange.end);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const [entriesData, notesData, expensesData] = await Promise.all([
        cachedFetch<TimeEntry[]>(`/api/time-entries?startDate=${startDate}&endDate=${endDate}`),
        cachedFetch<DailyNote[]>(`/api/daily-notes?startDate=${startDate}&endDate=${endDate}`),
        cachedFetch<SimpleExpense[]>(`/api/expenses?startDate=${startDate}&endDate=${endDate}`),
      ]);
      setEntries(entriesData);
      setNotes(notesData);
      setExpenses(expensesData);
      hasData.current = true;
    } finally {
      setFetching(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch master data for edit modal
  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/genres").then((r) => r.json()),
    ]).then(([cats, gnrs]) => {
      setMasterCategories(cats);
      setMasterGenres(gnrs);
    });
  }, []);

  // ── D&D helpers ────────────────────────────────────────────────────────
  /** グリッド要素からスクロール座標でセルを特定する */
  const getTargetFromPosition = useCallback((clientX: number, clientY: number): { colIdx: number; slot: number } | null => {
    const scrollEl = calendarScrollRef.current;
    if (!scrollEl) return null;
    const gridEl = scrollEl.querySelector("[data-timegrid]") as HTMLElement | null;
    if (!gridEl) return null;
    const rect = gridEl.getBoundingClientRect();
    const rowH = gridEl.offsetHeight / 48;
    if (rowH === 0) return null;
    const timeColPx = 56; // 3.5rem (固定)
    const relX = clientX - rect.left - timeColPx;
    const relY = clientY - rect.top;
    if (relX < 0 || relY < 0) return null;
    const dayW = (rect.width - timeColPx) / 7;
    const colIdx = Math.floor(relX / dayW);
    const slot = Math.floor(relY / rowH);
    if (colIdx < 0 || colIdx > 6 || slot < 0 || slot > 47) return null;
    return { colIdx, slot };
  }, []);

  /** エントリを新しい位置に移動して保存 */
  const executeMove = useCallback(async (entry: TimeEntry, colIdx: number, slot: number) => {
    const duration = entry.endSlot - entry.startSlot;
    const newStart = Math.min(slot, 48 - duration);
    const newEnd = newStart + duration;
    const newDate = formatDate(weekDates[colIdx]);
    if (newDate === toJSTDateKey(entry.date) && newStart === entry.startSlot) return; // 変化なし
    setIsSaving(true);
    try {
      await fetch("/api/time-entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entry.id,
          date: newDate,
          startSlot: newStart,
          endSlot: newEnd,
          categoryId: entry.category.id,
          genreId: entry.genre.id,
          title: entry.title,
          detail: entry.detail,
        }),
      });
      invalidateCache(`time-entries?startDate=${startDate}&endDate=${endDate}`);
      await fetchData();
    } finally {
      setIsSaving(false);
    }
  }, [weekDates, fetchData, startDate, endDate]);

  /** HTML5 D&D: dragover */
  const handleCalendarDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!dragEntry) return;
    const target = getTargetFromPosition(e.clientX, e.clientY);
    setDropCell(target);
  }, [dragEntry, getTargetFromPosition]);

  /** HTML5 D&D: drop */
  const handleCalendarDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragEntry) return;
    const target = getTargetFromPosition(e.clientX, e.clientY);
    if (target) await executeMove(dragEntry, target.colIdx, target.slot);
    setDragEntry(null);
    setDropCell(null);
  }, [dragEntry, getTargetFromPosition, executeMove]);

  /** タッチ: 長押し開始 */
  const handleEntryTouchStart = useCallback((e: React.TouchEvent, entry: TimeEntry) => {
    const touch = e.touches[0];
    touchInfoRef.current = { entry, startX: touch.clientX, startY: touch.clientY };
    touchDragActiveRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      touchDragActiveRef.current = true;
      const info = touchInfoRef.current;
      if (info) {
        setTouchGhost({ x: info.startX, y: info.startY, entry: info.entry });
        setDragEntry(info.entry);
        if (navigator.vibrate) navigator.vibrate(50);
      }
    }, 500);
  }, []);

  /** タッチ: ドラッグ中 */
  const handleEntryTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const info = touchInfoRef.current;
    if (!info) return;
    if (!touchDragActiveRef.current) {
      const dx = touch.clientX - info.startX;
      const dy = touch.clientY - info.startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      }
      return;
    }
    e.preventDefault();
    setTouchGhost(prev => prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null);
    const target = getTargetFromPosition(touch.clientX, touch.clientY);
    setDropCell(target);
  }, [getTargetFromPosition]);

  /** タッチ: ドロップ */
  const handleEntryTouchEnd = useCallback(async (e: React.TouchEvent) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (touchDragActiveRef.current && dropCell && touchInfoRef.current) {
      await executeMove(touchInfoRef.current.entry, dropCell.colIdx, dropCell.slot);
    }
    touchDragActiveRef.current = false;
    touchInfoRef.current = null;
    setTouchGhost(null);
    setDragEntry(null);
    setDropCell(null);
    void e; // suppress unused warning
  }, [dropCell, executeMove]);

  // ── Edit entry from timeline ──
  const handleTimelineSave = async (data: { categoryId: string; genreId: string; startSlot: number; endSlot: number; title?: string; detail?: string }) => {
    if (!editingTimeEntry) return;
    await fetch("/api/time-entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingTimeEntry.id, date: toJSTDateKey(editingTimeEntry.date), ...data }),
    });
    setEditingTimeEntry(null);
    invalidateCache(`time-entries?startDate=${startDate}&endDate=${endDate}`);
    fetchData();
  };
  const handleTimelineDelete = async () => {
    if (!editingTimeEntry) return;
    await fetch(`/api/time-entries?id=${editingTimeEntry.id}`, { method: "DELETE" });
    setEditingTimeEntry(null);
    invalidateCache(`time-entries?startDate=${startDate}&endDate=${endDate}`);
    fetchData();
  };

  // ── Create entry from calendar ──
  const handleCreateSave = async (data: { categoryId: string; genreId: string; startSlot: number; endSlot: number; title?: string; detail?: string }) => {
    if (!newEntryContext) return;
    await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newEntryContext.date, ...data }),
    });
    setNewEntryContext(null);
    invalidateCache(`time-entries?startDate=${startDate}&endDate=${endDate}`);
    fetchData();
  };

  const changePeriod = (delta: number) => {
    const d = new Date(baseDate);
    if (period === "weekly") {
      d.setDate(d.getDate() + delta * 7);
    } else {
      d.setMonth(d.getMonth() + delta);
    }
    setBaseDate(d);
  };

  const swipeHandlers = useSwipe(
    () => changePeriod(1),   // swipe left → next period
    () => changePeriod(-1),  // swipe right → prev period
  );

  const periodLabel = period === "weekly"
    ? `${getDayLabel(weekDates[0])} - ${getDayLabel(weekDates[6])}`
    : getMonthLabel(year, month);

  const showSpinner = fetching && !hasData.current;

  // Summary calculations (overlap-aware: 同一スロットに複数エントリがある場合、按分する)
  const slotMap = new Map<string, Map<number, TimeEntry[]>>();
  entries.forEach((e) => {
    const dk = toJSTDateKey(e.date);
    if (!slotMap.has(dk)) slotMap.set(dk, new Map());
    const dayMap = slotMap.get(dk)!;
    for (let s = e.startSlot; s < e.endSlot; s++) {
      if (!dayMap.has(s)) dayMap.set(s, []);
      dayMap.get(s)!.push(e);
    }
  });

  let allSlots = 0;
  let totalWorkSlots = 0;
  let investSlots = 0;
  let costSlots = 0;
  let lossSlots = 0;
  let investNatureSlots = 0;
  let costNatureSlots = 0;
  const categorySummary = new Map<string, { name: string; count: number }>();
  const genreSummary = new Map<string, { name: string; color: string; type: string; subType: string; count: number }>();

  for (const [, dayMap] of slotMap) {
    for (const [, slotEntries] of dayMap) {
      allSlots += 1;
      if (slotEntries.some((e) => !e.category.excludeFromSummary)) totalWorkSlots += 1;
      const share = 1 / slotEntries.length;
      for (const e of slotEntries) {
        if (e.genre.type === "投資") investSlots += share;
        else if (e.genre.type === "経費") costSlots += share;
        else lossSlots += share;

        if (e.genre.subType === "投資的") investNatureSlots += share;
        else if (e.genre.subType === "経費的") costNatureSlots += share;

        const cKey = e.category.id;
        if (!categorySummary.has(cKey)) categorySummary.set(cKey, { name: e.category.name, count: 0 });
        categorySummary.get(cKey)!.count += share;

        const gKey = e.genre.id;
        if (!genreSummary.has(gKey)) genreSummary.set(gKey, { name: e.genre.name, color: e.genre.color, type: e.genre.type, subType: e.genre.subType, count: 0 });
        genreSummary.get(gKey)!.count += share;
      }
    }
  }

  const totalWorkHours = totalWorkSlots * 0.5;
  const avgDays = period === "weekly" ? 5 : 20;
  const avgHoursPerDay = avgDays > 0 ? totalWorkHours / avgDays : 0;
  const avgH = Math.floor(avgHoursPerDay);
  const avgM = Math.round((avgHoursPerDay - avgH) * 60);

  const fmtHours = (slots: number) => Math.round(slots * 50) / 100;
  const investHours = fmtHours(investSlots);
  const costHours = fmtHours(costSlots);
  const lossHours = fmtHours(lossSlots);
  const totalInvCostSlots = investSlots + costSlots;
  const investPct = totalInvCostSlots > 0 ? Math.round((investSlots / totalInvCostSlots) * 100) : 0;

  // 性質ベースの集計（付随は除外）
  const totalNatureSlots = investNatureSlots + costNatureSlots;
  const investNaturePct = totalNatureSlots > 0 ? Math.round((investNatureSlots / totalNatureSlots) * 100) : 0;

  const entriesByDate = new Map<string, TimeEntry[]>();
  entries.forEach((e) => {
    const dateKey = toJSTDateKey(e.date);
    const list = entriesByDate.get(dateKey) || [];
    list.push(e);
    entriesByDate.set(dateKey, list);
  });

  // Daily expense totals
  const dailyExpenseTotals = new Map<string, number>();
  expenses.forEach((e) => {
    if (e.type !== "expense") return;
    const dateKey = toJSTDateKey(e.date);
    dailyExpenseTotals.set(dateKey, (dailyExpenseTotals.get(dateKey) || 0) + e.amount);
  });

  const timelineDates = period === "weekly"
    ? weekDates
    : (() => {
        const dates: Date[] = [];
        const d = new Date(monthRange.start);
        while (d <= monthRange.end) {
          dates.push(new Date(d));
          d.setDate(d.getDate() + 1);
        }
        return dates;
      })();

  // Hour labels for weekly calendar (0–23)
  const hourLabels = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto lg:max-w-none" {...swipeHandlers}>
          <button onClick={() => changePeriod(-1)} className="p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            {showDatePicker ? (
              <input
                type="date"
                value={formatDate(baseDate)}
                onChange={(e) => {
                  if (e.target.value) {
                    setBaseDate(new Date(e.target.value + "T00:00:00"));
                    setShowDatePicker(false);
                  }
                }}
                onBlur={() => setShowDatePicker(false)}
                autoFocus
                className="text-sm font-bold border border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <button onClick={() => setShowDatePicker(true)} className="text-sm font-bold hover:text-indigo-600 transition-colors">
                {periodLabel}
              </button>
            )}
            {fetching && (
              <div className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            )}
          </div>
          <button onClick={() => changePeriod(1)} className="p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="max-w-lg mx-auto lg:max-w-none mt-2 space-y-1.5">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setPeriod("weekly")} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${period === "weekly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>週次</button>
            <button onClick={() => setPeriod("monthly")} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${period === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>月次</button>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setView("summary")} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${view === "summary" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>サマリー</button>
            <button onClick={() => setView("timeline")} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${view === "timeline" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>タイムライン</button>
            {/* Calendar tab: PC only, weekly only */}
            <button
              onClick={() => setView("calendar")}
              className={`hidden lg:block flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${view === "calendar" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"} ${period !== "weekly" ? "opacity-40 cursor-not-allowed" : ""}`}
              disabled={period !== "weekly"}
            >
              カレンダー
            </button>
          </div>
        </div>
      </header>

      {/* ── Summary / Timeline (mobile + PC) ── */}
      {view !== "calendar" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full lg:max-w-none" {...swipeHandlers}>
          {view === "summary" ? (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                {showSpinner ? <CardSpinner /> : (
                  <>
                    <p className="text-xs text-slate-500">
                      {period === "weekly" ? "今週" : "今月"}の稼働時間
                      <span className="text-slate-400 ml-1">(サマリ除外カテゴリ除く)</span>
                    </p>
                    <p className="text-3xl font-bold text-indigo-600">{totalWorkHours}h</p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-slate-400">{totalWorkSlots}スロット</p>
                      <p className="text-xs text-indigo-500 font-medium">
                        1日平均 {avgH}時間{avgM > 0 ? `${avgM}分` : ""}
                        <span className="text-slate-400 ml-1">({period === "weekly" ? "5" : "20"}日換算)</span>
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* 投資 / 経費 */}
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                {showSpinner ? <CardSpinner /> : (
                  <>
                    <p className="text-xs text-slate-500 mb-2">投資 / 経費</p>
                    <div className="flex items-end gap-4 mb-2">
                      <button className="text-left hover:opacity-70 transition-opacity" onClick={() => { setFilterType("投資"); setFilterCategoryId(null); setFilterGenreId(null); setView("timeline"); }}>
                        <p className="text-xs text-blue-500 font-medium">投資</p>
                        <p className="text-xl font-bold text-blue-600">{investHours}h</p>
                      </button>
                      <button className="text-left hover:opacity-70 transition-opacity" onClick={() => { setFilterType("経費"); setFilterCategoryId(null); setFilterGenreId(null); setView("timeline"); }}>
                        <p className="text-xs text-slate-400 font-medium">経費</p>
                        <p className="text-xl font-bold text-slate-500">{costHours}h</p>
                      </button>
                      <div className="ml-auto text-right">
                        <p className="text-xs text-slate-400">投資率 <span className="text-sm font-bold text-blue-600">{investPct}%</span></p>
                        {totalNatureSlots > 0 && investNaturePct !== investPct && (
                          <p className="text-[10px] text-slate-400">(性質 <span className="font-bold text-blue-500">{investNaturePct}%</span>)</p>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-blue-500 rounded-l-full transition-all" style={{ width: `${investPct}%` }} />
                      <div className="h-full bg-slate-300 flex-1" />
                    </div>
                    {totalNatureSlots > 0 && investNaturePct !== investPct && (
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex mt-1">
                        <div className="h-full bg-blue-300 rounded-l-full transition-all" style={{ width: `${investNaturePct}%` }} />
                        <div className="h-full bg-amber-200 flex-1" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      {lossSlots > 0 && (
                        <p className="text-[10px] text-slate-400">(付随 {lossHours}h) ※投資率の算出に含まず</p>
                      )}
                      {totalNatureSlots > 0 && investNaturePct !== investPct && (
                        <p className="text-[10px] text-slate-400 ml-auto">(投資的 {fmtHours(investNatureSlots)}h / 経費的 {fmtHours(costNatureSlots)}h)</p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* PC: カテゴリ別 / ジャンル別 を横並び */}
              <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">カテゴリ別</h3>
                  {showSpinner ? <CardSpinner /> : categorySummary.size === 0 ? (
                    <p className="text-sm text-slate-400">記録なし</p>
                  ) : (
                    <div className="space-y-2">
                      {Array.from(categorySummary.entries()).sort((a, b) => b[1].count - a[1].count).map(([cId, c]) => (
                        <button key={cId} className="flex items-center gap-2 w-full text-left hover:bg-slate-50 rounded -mx-1 px-1 py-0.5 transition-colors" onClick={() => { setFilterCategoryId(cId); setFilterGenreId(null); setView("timeline"); }}>
                          <span className="text-sm flex-1 min-w-0 truncate">{c.name}</span>
                          <span className="text-sm font-medium tabular-nums flex-shrink-0">{fmtHours(c.count)}h</span>
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${allSlots > 0 ? (c.count / allSlots) * 100 : 0}%` }} />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">ジャンル別</h3>
                  {showSpinner ? <CardSpinner /> : genreSummary.size === 0 ? (
                    <p className="text-sm text-slate-400">記録なし</p>
                  ) : (
                    <div className="space-y-2">
                      {Array.from(genreSummary.entries()).sort((a, b) => b[1].count - a[1].count).map(([gId, g]) => (
                        <button key={gId} className="flex items-center gap-2 w-full text-left hover:bg-slate-50 rounded -mx-1 px-1 py-0.5 transition-colors" onClick={() => { setFilterGenreId(gId); setFilterCategoryId(null); setView("timeline"); }}>
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                          <span className="text-sm flex-1 min-w-0 truncate">{g.name}</span>
                          <span className={`text-[10px] px-1 py-0 rounded-full flex-shrink-0 ${g.type === "投資" ? "bg-blue-100 text-blue-600" : g.type === "付随" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"}`}>{g.type || "経費"}</span>
                          {g.type !== "付随" && g.subType && (
                            <span className={`text-[9px] px-1 py-0 rounded-full flex-shrink-0 ${g.subType === "投資的" ? "bg-blue-50 text-blue-500" : "bg-amber-50 text-amber-500"}`}>{g.subType}</span>
                          )}
                          <span className="text-sm font-medium tabular-nums flex-shrink-0">{fmtHours(g.count)}h</span>
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                            <div className="h-full rounded-full" style={{ backgroundColor: g.color, width: `${allSlots > 0 ? (g.count / allSlots) * 100 : 0}%` }} />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {!showSpinner && notes.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">日記</h3>
                  <div className="space-y-3">
                    {notes.map((n) => {
                      const noteDate = toJSTDateKey(n.date);
                      const d = new Date(noteDate + "T00:00:00");
                      const dow = d.getDay();
                      const days = ["日","月","火","水","木","金","土"];
                      const label = `${d.getMonth() + 1}/${d.getDate()}`;
                      const dowColor = dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-slate-400";
                      const parsed = parseNote(n.content);
                      const filledSections = NOTE_SECTIONS.filter((s) => parsed[s.key]?.trim());
                      return (
                        <div key={n.date} className="flex gap-2 group">
                          <span className="text-xs flex-shrink-0 pt-0.5 w-10 text-center">
                            <span className="text-slate-400">{label}</span>
                            <br />
                            <span className={dowColor}>{days[dow]}</span>
                          </span>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            {filledSections.map((s) => (
                              <div key={s.key}>
                                <p className="text-[10px] font-semibold text-indigo-600">★{s.label}</p>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pl-2 border-l-2 border-slate-100">{parsed[s.key]}</p>
                              </div>
                            ))}
                            {parsed._free && (
                              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{parsed._free}</p>
                            )}
                            {filledSections.length === 0 && !parsed._free && (
                              <p className="text-sm text-slate-400">（内容なし）</p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              const dk = toJSTDateKey(n.date);
                              const stored = loadNoteDraft(dk);
                              setEditingNote(n);
                              setNoteDraft(stored && serializeNote(stored) !== n.content ? stored : parseNote(n.content));
                            }}
                            className="text-slate-300 hover:text-indigo-500 flex-shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity p-0.5 self-start"
                            title="編集"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filter UI + total */}
              {(() => {
                const filteredEntries = entries.filter((e) => {
                  if (filterType && e.genre.type !== filterType) return false;
                  if (filterCategoryId && e.category.id !== filterCategoryId) return false;
                  if (filterGenreId && e.genre.id !== filterGenreId) return false;
                  return true;
                });
                const totalH = filteredEntries.reduce((s, e) => s + (e.endSlot - e.startSlot), 0) * 0.5;
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      {(["すべて", "投資", "経費", "付随"] as const).map((t) => {
                        const val = t === "すべて" ? null : t;
                        const active = filterType === val;
                        return (
                          <button key={t} onClick={() => setFilterType(val)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${active ? (t === "投資" ? "bg-blue-100 text-blue-700 border-blue-300" : t === "付随" ? "bg-red-100 text-red-700 border-red-300" : t === "経費" ? "bg-slate-200 text-slate-700 border-slate-300" : "bg-indigo-100 text-indigo-700 border-indigo-300") : "bg-white text-slate-400 border-slate-200"}`}>{t}</button>
                        );
                      })}
                      <span className="text-sm font-bold text-indigo-600 flex-shrink-0 whitespace-nowrap ml-auto">{totalH}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={filterCategoryId ?? ""}
                        onChange={(e) => setFilterCategoryId(e.target.value || null)}
                        className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
                      >
                        <option value="">カテゴリ: すべて</option>
                        {Array.from(categorySummary.entries()).sort((a, b) => b[1].count - a[1].count).map(([cId, c]) => (
                          <option key={cId} value={cId}>{c.name}</option>
                        ))}
                      </select>
                      <select
                        value={filterGenreId ?? ""}
                        onChange={(e) => setFilterGenreId(e.target.value || null)}
                        className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
                      >
                        <option value="">ジャンル: すべて</option>
                        {Array.from(genreSummary.entries()).sort((a, b) => b[1].count - a[1].count).map(([gId, g]) => (
                          <option key={gId} value={gId}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })()}
              {showSpinner ? (
                <div className="bg-white rounded-xl p-4 border border-slate-200"><CardSpinner /></div>
              ) : (
                timelineDates.map((wd) => {
                  const dateKey = formatDate(wd);
                  const allDayEntries = entriesByDate.get(dateKey) || [];
                  const dayEntries = allDayEntries.filter((e) => {
                    if (filterType && e.genre.type !== filterType) return false;
                    if (filterCategoryId && e.category.id !== filterCategoryId) return false;
                    if (filterGenreId && e.genre.id !== filterGenreId) return false;
                    return true;
                  });
                  const daySlotSet = new Set<number>();
                  dayEntries.forEach((e) => { for (let i = e.startSlot; i < e.endSlot; i++) daySlotSet.add(i); });
                  const dayTotalH = daySlotSet.size * 0.5;
                  return (
                    <div key={dateKey} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <p className="text-sm font-semibold">{getDayLabel(wd)}</p>
                        {dayTotalH > 0 && <span className="text-xs font-medium text-indigo-500">{dayTotalH}h</span>}
                      </div>
                      {dayEntries.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-slate-400">記録なし</p>
                      ) : (
                        <div className="divide-y divide-slate-50">
                          {dayEntries.map((e) => (
                            <button key={e.id} onClick={() => setEditingTimeEntry(e)} className="w-full px-3 py-1.5 flex items-center gap-1 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left">
                              <span className="text-xs text-slate-400 font-mono w-[5.75rem] flex-shrink-0">{slotToTime(e.startSlot)}-{slotToTime(e.endSlot)}</span>
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.genre.color }} />
                              <span className="text-xs text-slate-500 flex-shrink-0">{e.category.name}</span>
                              <span className="text-sm flex-1 truncate min-w-0">{e.title || e.genre.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PC Weekly Calendar view ── */}
      {view === "calendar" && (
        <div className="hidden lg:flex flex-1 flex-col overflow-hidden">
          {isSaving && (
            <div className="absolute inset-0 z-50 bg-white/40 flex items-center justify-center pointer-events-none">
              <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          )}

          {/* Single scroll container — header is sticky inside */}
          <div
            ref={calendarScrollRef}
            className="flex-1 overflow-y-auto relative"
            onDragOver={handleCalendarDragOver}
            onDrop={handleCalendarDrop}
            onDragLeave={() => setDropCell(null)}
            onDragEnd={() => { setDragEntry(null); setDropCell(null); }}
          >
            {/* Sticky day header */}
            <div
              data-calheader
              className="sticky top-0 z-20 grid bg-white border-b border-slate-200"
              style={{ gridTemplateColumns: `3.5rem repeat(7, 1fr)` }}
            >
              <div className="border-r border-slate-100" />
              {weekDates.map((wd) => {
                const dateKey = formatDate(wd);
                const expenseTotal = dailyExpenseTotals.get(dateKey);
                const days = ["日", "月", "火", "水", "木", "金", "土"];
                const dow = wd.getDay();
                const isWeekend = dow === 0 || dow === 6;
                return (
                  <div key={dateKey} className="border-r border-slate-100 px-1 py-2 text-center">
                    <p className={`text-xs font-semibold ${isWeekend ? (dow === 0 ? "text-red-500" : "text-blue-500") : "text-slate-700"}`}>
                      {wd.getMonth() + 1}/{wd.getDate()}({days[dow]})
                    </p>
                    {expenseTotal ? (
                      <p className="text-[10px] text-rose-500 font-medium mt-0.5">
                        -{expenseTotal >= 10000 ? `${Math.round(expenseTotal / 1000)}k` : expenseTotal.toLocaleString()}円
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-300 mt-0.5">—</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div
              data-timegrid
              className="grid"
              style={{
                gridTemplateColumns: `3.5rem repeat(7, 1fr)`,
                gridTemplateRows: `repeat(48, ${CAL_ROW_REM}rem)`,
              }}
            >
              {/* Hour labels */}
              {hourLabels.map((h) => (
                <div
                  key={`h-${h}`}
                  className="flex items-start justify-end pr-1 pt-px border-b border-slate-100 text-[9px] text-slate-400 font-mono"
                  style={{ gridRow: `${h * 2 + 1} / ${h * 2 + 3}`, gridColumn: 1 }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}

              {/* Half-hour grid lines (time column filler) */}
              {Array.from({ length: 48 }, (_, i) => (
                <div
                  key={`tl-${i}`}
                  className={`border-b ${i % 2 === 0 ? "border-slate-100" : "border-slate-50"}`}
                  style={{ gridRow: i + 1, gridColumn: 1 }}
                />
              ))}

              {/* Day columns: grid lines (click to create new entry) */}
              {weekDates.map((wd, colIdx) => {
                const dateKey = formatDate(wd);
                return Array.from({ length: 48 }, (_, rowIdx) => (
                  <div
                    key={`cell-${colIdx}-${rowIdx}`}
                    onClick={() => {
                      // ドラッグ直後のクリックは無視
                      if (dragEntry) return;
                      setNewEntryContext({ date: dateKey, startSlot: rowIdx });
                    }}
                    className={`border-r border-slate-100 hover:bg-indigo-50/50 transition-colors cursor-pointer ${rowIdx % 2 === 0 ? "border-b border-slate-100" : "border-b border-slate-50"}`}
                    style={{ gridRow: rowIdx + 1, gridColumn: colIdx + 2 }}
                    title={`${dateKey} ${slotToTime(rowIdx)} に新規作成`}
                  />
                ));
              })}

              {/* Drop preview */}
              {dragEntry && dropCell && (() => {
                const duration = dragEntry.endSlot - dragEntry.startSlot;
                const previewStart = Math.min(dropCell.slot, 48 - duration);
                const previewEnd = previewStart + duration;
                return (
                  <div
                    className="pointer-events-none z-20 rounded mx-0.5 opacity-60"
                    style={{
                      gridRow: `${previewStart + 1} / ${previewEnd + 1}`,
                      gridColumn: dropCell.colIdx + 2,
                      backgroundColor: `${dragEntry.genre.color}30`,
                      border: `2px dashed ${dragEntry.genre.color}`,
                    }}
                  />
                );
              })()}

              {/* Entry blocks */}
              {weekDates.map((wd, colIdx) => {
                const dateKey = formatDate(wd);
                const dayEntries = entriesByDate.get(dateKey) || [];
                const layout = computeEntryLayout(dayEntries);
                return dayEntries.map((entry) => {
                  const isDragging = dragEntry?.id === entry.id;
                  const lane = layout.get(entry.id) || { col: 0, total: 1 };
                  const widthPct = 100 / lane.total;
                  const leftPct = lane.col * widthPct;
                  return (
                    <div
                      key={entry.id}
                      draggable
                      onClick={(e) => {
                        // ドラッグ後のクリックは無視
                        if (dragEntry) return;
                        e.stopPropagation();
                        setEditingTimeEntry(entry);
                      }}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        setDragEntry(entry);
                        setDropCell(null);
                      }}
                      onDragEnd={() => { setDragEntry(null); setDropCell(null); }}
                      onTouchStart={(e) => handleEntryTouchStart(e, entry)}
                      onTouchMove={handleEntryTouchMove}
                      onTouchEnd={handleEntryTouchEnd}
                      className={`rounded overflow-hidden z-10 cursor-pointer active:cursor-grabbing transition-opacity select-none ${
                        isDragging ? "opacity-30" : "opacity-100"
                      }`}
                      style={{
                        gridRow: `${entry.startSlot + 1} / ${entry.endSlot + 1}`,
                        gridColumn: colIdx + 2,
                        backgroundColor: `${entry.genre.color}20`,
                        borderLeft: `3px solid ${entry.genre.color}`,
                        width: `calc(${widthPct}% - 2px)`,
                        marginLeft: `calc(${leftPct}% + 1px)`,
                      }}
                      title={`${slotToTime(entry.startSlot)}–${slotToTime(entry.endSlot)} [${entry.genre.type || "経費"}${entry.genre.subType ? `/${entry.genre.subType}` : ""}] ${entry.category.name} / ${entry.genre.name}${entry.title ? ` — ${entry.title}` : ""}`}
                    >
                      <div className="px-1 py-px overflow-hidden h-full leading-none">
                        <p
                          className="text-[9px] font-semibold truncate leading-tight"
                          style={{ color: entry.genre.color }}
                        >
                          {entry.title || entry.genre.name}
                        </p>
                        <p className="text-[8px] text-slate-500 truncate leading-tight mt-0.5">
                          <span
                            className={`inline-block px-0.5 rounded-sm mr-0.5 font-semibold ${
                              entry.genre.type === "投資"
                                ? "bg-blue-100 text-blue-600"
                                : entry.genre.type === "付随"
                                ? "bg-red-100 text-red-600"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {(entry.genre.type || "経")[0]}
                          </span>
                          {entry.category.name}・{entry.genre.name}
                        </p>
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          </div>

          {/* Touch drag ghost */}
          {touchGhost && (
            <div
              className="fixed z-50 pointer-events-none rounded shadow-xl opacity-90 overflow-hidden"
              style={{
                left: touchGhost.x - 60,
                top: touchGhost.y - 24,
                width: 120,
                minHeight: 32,
                backgroundColor: `${touchGhost.entry.genre.color}40`,
                borderLeft: `3px solid ${touchGhost.entry.genre.color}`,
                transform: "scale(1.08)",
              }}
            >
              <div className="px-1.5 py-1">
                <p className="text-[10px] font-semibold truncate" style={{ color: touchGhost.entry.genre.color }}>
                  {touchGhost.entry.title || touchGhost.entry.category.name}
                </p>
                <p className="text-[9px] text-slate-500">
                  {slotToTime(touchGhost.entry.startSlot)}–{slotToTime(touchGhost.entry.endSlot)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 日記編集モーダル */}
      {editingNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4"
          onClick={() => { setEditingNote(null); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold">日記を編集</h3>
              <span className="text-xs text-slate-400">
                {new Date(toJSTDateKey(editingNote.date) + "T00:00:00").toLocaleDateString("ja-JP", {
                  year: "numeric", month: "long", day: "numeric", weekday: "short",
                })}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {NOTE_SECTIONS.map((s) => (
                <div key={s.key}>
                  <label className="block text-xs font-semibold text-indigo-600 mb-1">★{s.label}</label>
                  <textarea
                    value={noteDraft[s.key] || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNoteDraft((d) => {
                        const next = { ...d, [s.key]: val };
                        saveNoteDraft(toJSTDateKey(editingNote.date), next);
                        return next;
                      });
                    }}
                    placeholder={s.placeholder}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y leading-relaxed"
                  />
                </div>
              ))}
              {noteDraft._free && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">メモ（旧形式の内容）</label>
                  <textarea
                    value={noteDraft._free || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNoteDraft((d) => {
                        const next = { ...d, _free: val };
                        saveNoteDraft(toJSTDateKey(editingNote.date), next);
                        return next;
                      });
                    }}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y leading-relaxed"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 py-3 border-t border-slate-100">
              <button
                onClick={() => { setEditingNote(null); }}
                className="flex-1 py-2.5 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  const dk = toJSTDateKey(editingNote.date);
                  const serialized = serializeNote(noteDraft);
                  if (serialized === editingNote.content) { clearNoteDraft(dk); setEditingNote(null); setNoteDraft({}); return; }
                  setNoteSaving(true);
                  try {
                    await fetch("/api/daily-notes", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ date: dk, content: serialized }),
                    });
                    setNotes((prev) => prev.map((n) => n.date === editingNote.date ? { ...n, content: serialized } : n));
                    clearNoteDraft(dk);
                    setEditingNote(null);
                    setNoteDraft({});
                  } finally {
                    setNoteSaving(false);
                  }
                }}
                disabled={noteSaving}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
              >
                {noteSaving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit entry modal */}
      {editingTimeEntry && (
        <EntryModal
          key={editingTimeEntry.id}
          slotIndex={editingTimeEntry.startSlot}
          date={toJSTDateKey(editingTimeEntry.date)}
          categories={masterCategories}
          genres={masterGenres}
          editEntry={editingTimeEntry}
          onSave={handleTimelineSave}
          onDelete={() => handleTimelineDelete()}
          onClose={() => setEditingTimeEntry(null)}
        />
      )}

      {/* New entry modal (from calendar view) */}
      {newEntryContext && (
        <EntryModal
          key={`new-${newEntryContext.date}-${newEntryContext.startSlot}`}
          slotIndex={newEntryContext.startSlot}
          date={newEntryContext.date}
          categories={masterCategories}
          genres={masterGenres}
          onSave={handleCreateSave}
          onClose={() => setNewEntryContext(null)}
        />
      )}
    </div>
  );
}
