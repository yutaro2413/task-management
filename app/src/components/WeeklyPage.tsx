"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getWeekDates, getDayLabel, formatDate, slotToTime, getMonthDates, getMonthLabel } from "@/lib/utils";
import { cachedFetch } from "@/lib/cache";
import { useSwipe } from "@/hooks/useSwipe";

type TimeEntry = {
  id: string;
  date: string;
  startSlot: number;
  endSlot: number;
  title?: string | null;
  category: { id: string; name: string };
  genre: { id: string; name: string; color: string };
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

export default function WeeklyPage() {
  const [baseDate, setBaseDate] = useState(new Date());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [expenses, setExpenses] = useState<SimpleExpense[]>([]);
  const [view, setView] = useState<ViewMode>("summary");
  const [period, setPeriod] = useState<PeriodMode>("weekly");
  const [fetching, setFetching] = useState(false);
  const hasData = useRef(false);

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

  // Summary calculations
  const workEntries = entries.filter((e) => e.category.name !== "プライベート");
  const totalWorkSlots = workEntries.reduce((sum, e) => sum + (e.endSlot - e.startSlot), 0);
  const totalWorkHours = totalWorkSlots * 0.5;
  const allSlots = entries.reduce((sum, e) => sum + (e.endSlot - e.startSlot), 0);
  const avgDays = period === "weekly" ? 5 : 20;
  const avgHoursPerDay = avgDays > 0 ? totalWorkHours / avgDays : 0;
  const avgH = Math.floor(avgHoursPerDay);
  const avgM = Math.round((avgHoursPerDay - avgH) * 60);

  const categorySummary = new Map<string, { name: string; count: number }>();
  entries.forEach((e) => {
    const slots = e.endSlot - e.startSlot;
    const cKey = e.category.id;
    const existing = categorySummary.get(cKey) || { name: e.category.name, count: 0 };
    existing.count += slots;
    categorySummary.set(cKey, existing);
  });

  const genreSummary = new Map<string, { name: string; color: string; count: number }>();
  entries.forEach((e) => {
    const slots = e.endSlot - e.startSlot;
    const gKey = e.genre.id;
    const existing = genreSummary.get(gKey) || { name: e.genre.name, color: e.genre.color, count: 0 };
    existing.count += slots;
    genreSummary.set(gKey, existing);
  });

  const entriesByDate = new Map<string, TimeEntry[]>();
  entries.forEach((e) => {
    const dateKey = e.date.split("T")[0];
    const list = entriesByDate.get(dateKey) || [];
    list.push(e);
    entriesByDate.set(dateKey, list);
  });

  // Daily expense totals
  const dailyExpenseTotals = new Map<string, number>();
  expenses.forEach((e) => {
    if (e.type !== "expense") return;
    const dateKey = e.date.split("T")[0];
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
            <p className="text-sm font-bold">{periodLabel}</p>
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
                      <span className="text-slate-400 ml-1">(プライベート除く)</span>
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

              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">カテゴリ別</h3>
                {showSpinner ? <CardSpinner /> : categorySummary.size === 0 ? (
                  <p className="text-sm text-slate-400">記録なし</p>
                ) : (
                  <div className="space-y-2">
                    {Array.from(categorySummary.values()).sort((a, b) => b.count - a.count).map((c) => (
                      <div key={c.name} className="flex items-center gap-2">
                        <span className="text-sm flex-1">{c.name}</span>
                        <span className="text-sm font-medium">{c.count * 0.5}h</span>
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${allSlots > 0 ? (c.count / allSlots) * 100 : 0}%` }} />
                        </div>
                      </div>
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
                    {Array.from(genreSummary.values()).sort((a, b) => b.count - a.count).map((g) => (
                      <div key={g.name} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                        <span className="text-sm flex-1">{g.name}</span>
                        <span className="text-sm font-medium">{g.count * 0.5}h</span>
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ backgroundColor: g.color, width: `${allSlots > 0 ? (g.count / allSlots) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!showSpinner && notes.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">日記</h3>
                  <div className="space-y-2">
                    {notes.map((n) => (
                      <div key={n.date} className="flex gap-2">
                        <span className="text-xs text-slate-400 w-12 flex-shrink-0">
                          {new Date(n.date + "T00:00:00").toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                        </span>
                        <p className="text-sm text-slate-700">{n.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {showSpinner ? (
                <div className="bg-white rounded-xl p-4 border border-slate-200"><CardSpinner /></div>
              ) : (
                timelineDates.map((wd) => {
                  const dateKey = formatDate(wd);
                  const dayEntries = entriesByDate.get(dateKey) || [];
                  return (
                    <div key={dateKey} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                        <p className="text-sm font-semibold">{getDayLabel(wd)}</p>
                      </div>
                      {dayEntries.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-slate-400">記録なし</p>
                      ) : (
                        <div className="divide-y divide-slate-50">
                          {dayEntries.map((e) => (
                            <div key={e.id} className="px-3 py-2 flex items-center gap-2">
                              <span className="text-xs text-slate-400 font-mono w-10">{slotToTime(e.startSlot)}-{slotToTime(e.endSlot)}</span>
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.genre.color }} />
                              <span className="text-xs text-slate-500">{e.category.name}</span>
                              <span className="text-sm flex-1 truncate">{e.title || e.genre.name}</span>
                            </div>
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
          {/* Day header row */}
          <div
            className="grid flex-shrink-0 border-b border-slate-200 bg-white"
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

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <div
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

              {/* Day columns: grid lines */}
              {weekDates.map((_, colIdx) => (
                Array.from({ length: 48 }, (_, rowIdx) => (
                  <div
                    key={`cell-${colIdx}-${rowIdx}`}
                    className={`border-r border-slate-100 ${rowIdx % 2 === 0 ? "border-b border-slate-100" : "border-b border-slate-50"}`}
                    style={{ gridRow: rowIdx + 1, gridColumn: colIdx + 2 }}
                  />
                ))
              ))}

              {/* Entry blocks */}
              {weekDates.map((wd, colIdx) => {
                const dateKey = formatDate(wd);
                const dayEntries = entriesByDate.get(dateKey) || [];
                return dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded mx-0.5 overflow-hidden cursor-default z-10 pointer-events-none"
                    style={{
                      gridRow: `${entry.startSlot + 1} / ${entry.endSlot + 1}`,
                      gridColumn: colIdx + 2,
                      backgroundColor: `${entry.genre.color}20`,
                      borderLeft: `3px solid ${entry.genre.color}`,
                    }}
                  >
                    <div className="px-1 py-px overflow-hidden h-full">
                      <p
                        className="text-[9px] font-semibold truncate leading-tight"
                        style={{ color: entry.genre.color }}
                      >
                        {entry.title || entry.category.name}
                      </p>
                    </div>
                  </div>
                ));
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
