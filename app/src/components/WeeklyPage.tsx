"use client";

import { useState, useEffect, useCallback } from "react";
import { getWeekDates, getDayLabel, formatDate, slotToTime, getMonthDates, getMonthLabel } from "@/lib/utils";

type TimeEntry = {
  id: string;
  date: string;
  slotIndex: number;
  title: string;
  category: { id: string; name: string };
  genre: { id: string; name: string; color: string };
};

type DailyNote = {
  date: string;
  content: string;
};

type ViewMode = "summary" | "timeline";
type PeriodMode = "weekly" | "monthly";

export default function WeeklyPage() {
  const [baseDate, setBaseDate] = useState(new Date());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [view, setView] = useState<ViewMode>("summary");
  const [period, setPeriod] = useState<PeriodMode>("weekly");

  const weekDates = getWeekDates(baseDate);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const monthRange = getMonthDates(year, month);

  const startDate = period === "weekly" ? formatDate(weekDates[0]) : formatDate(monthRange.start);
  const endDate = period === "weekly" ? formatDate(weekDates[6]) : formatDate(monthRange.end);

  const fetchData = useCallback(async () => {
    const [entriesRes, notesRes] = await Promise.all([
      fetch(`/api/time-entries?startDate=${startDate}&endDate=${endDate}`),
      fetch(`/api/daily-notes?startDate=${startDate}&endDate=${endDate}`),
    ]);
    setEntries(await entriesRes.json());
    setNotes(await notesRes.json());
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

  const periodLabel = period === "weekly"
    ? `${getDayLabel(weekDates[0])} - ${getDayLabel(weekDates[6])}`
    : getMonthLabel(year, month);

  // Summary calculations
  const genreSummary = new Map<string, { name: string; color: string; count: number }>();
  const categorySummary = new Map<string, { name: string; count: number }>();

  entries.forEach((e) => {
    const gKey = e.genre.id;
    const existing = genreSummary.get(gKey) || { name: e.genre.name, color: e.genre.color, count: 0 };
    existing.count += 1;
    genreSummary.set(gKey, existing);

    const cKey = e.category.id;
    const cExisting = categorySummary.get(cKey) || { name: e.category.name, count: 0 };
    cExisting.count += 1;
    categorySummary.set(cKey, cExisting);
  });

  const totalSlots = entries.length;
  const totalHours = totalSlots * 0.5;

  // Group entries by date for timeline view
  const entriesByDate = new Map<string, TimeEntry[]>();
  entries.forEach((e) => {
    const dateKey = e.date.split("T")[0];
    const list = entriesByDate.get(dateKey) || [];
    list.push(e);
    entriesByDate.set(dateKey, list);
  });

  // Timeline dates list
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

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => changePeriod(-1)} className="p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="text-sm font-bold">{periodLabel}</p>
          <button onClick={() => changePeriod(1)} className="p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Period + View toggle */}
        <div className="max-w-lg mx-auto mt-2 space-y-1.5">
          {/* Period toggle: weekly / monthly */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setPeriod("weekly")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === "weekly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              週次
            </button>
            <button
              onClick={() => setPeriod("monthly")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              月次
            </button>
          </div>

          {/* View toggle: summary / timeline */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setView("summary")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "summary" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              サマリー
            </button>
            <button
              onClick={() => setView("timeline")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "timeline" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              タイムライン
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
        {view === "summary" ? (
          <div className="space-y-6">
            {/* Total */}
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-sm text-slate-500">
                {period === "weekly" ? "今週" : "今月"}の記録時間
              </p>
              <p className="text-3xl font-bold text-indigo-600">{totalHours}h</p>
              <p className="text-xs text-slate-400">{totalSlots}スロット</p>
            </div>

            {/* Genre breakdown */}
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">ジャンル別</h3>
              {genreSummary.size === 0 ? (
                <p className="text-sm text-slate-400">記録なし</p>
              ) : (
                <div className="space-y-2">
                  {Array.from(genreSummary.values())
                    .sort((a, b) => b.count - a.count)
                    .map((g) => (
                      <div key={g.name} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                        <span className="text-sm flex-1">{g.name}</span>
                        <span className="text-sm font-medium">{g.count * 0.5}h</span>
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: g.color,
                              width: `${totalSlots > 0 ? (g.count / totalSlots) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Category breakdown */}
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">カテゴリ別</h3>
              {categorySummary.size === 0 ? (
                <p className="text-sm text-slate-400">記録なし</p>
              ) : (
                <div className="space-y-2">
                  {Array.from(categorySummary.values())
                    .sort((a, b) => b.count - a.count)
                    .map((c) => (
                      <div key={c.name} className="flex items-center gap-2">
                        <span className="text-sm flex-1">{c.name}</span>
                        <span className="text-sm font-medium">{c.count * 0.5}h</span>
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${totalSlots > 0 ? (c.count / totalSlots) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Daily notes */}
            {notes.length > 0 && (
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
            {timelineDates.map((wd) => {
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
                          <span className="text-xs text-slate-400 font-mono w-10">{slotToTime(e.slotIndex)}</span>
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: e.genre.color }}
                          />
                          <span className="text-xs text-slate-500">{e.category.name}</span>
                          <span className="text-sm flex-1 truncate">{e.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
