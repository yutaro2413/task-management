"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toJSTDateString } from "@/lib/utils";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type Exercise = {
  menuId?: string;
  name: string;
  weight: string;
  reps: number;
  sets: number;
  type: string;
  distance?: string;
  duration?: string;
  pace?: string;
};

type WorkoutLogEntry = {
  id: string;
  date: string;
  exercises: Exercise[];
};

type BookTitle = { id: string; title: string };
type ReadingEntry = {
  id: string;
  bookTitleId: string;
  bookTitle: { id: string; title: string };
  review?: string | null;
};

type Tab = "workout" | "reading";

const CHART_COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#10b981",
  "#e11d48", "#0ea5e9", "#84cc16", "#d946ef", "#14b8a6",
  "#a855f7", "#f43f5e", "#2563eb", "#65a30d", "#c026d3",
];

const CIRCLED_NUMBERS: Record<string, number> = {
  "①": 1, "②": 2, "③": 3, "④": 4, "⑤": 5,
  "⑥": 6, "⑦": 7, "⑧": 8, "⑨": 9, "⑩": 10,
  "⑪": 11, "⑫": 12, "⑬": 13, "⑭": 14, "⑮": 15,
  "⑯": 16, "⑰": 17, "⑱": 18, "⑲": 19, "⑳": 20,
};

function parseWeight(w: string): number | null {
  if (!w || !w.trim()) return null;
  const trimmed = w.trim();
  if (CIRCLED_NUMBERS[trimmed] !== undefined) return CIRCLED_NUMBERS[trimmed];
  const num = parseFloat(trimmed.replace(/[kgKG㎏番]/g, ""));
  return isNaN(num) ? null : num;
}

function getWeekLabel(dateStr: string): string {
  const m = new Date(dateStr + "T00:00:00");
  return `${m.getMonth() + 1}/${m.getDate()}~`;
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dayOfWeek = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - (dayOfWeek - 1));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

export default function HobbyPage() {
  const [tab, setTab] = useState<Tab>("workout");
  const [date, setDate] = useState(() => toJSTDateString());

  // Workout chart state
  const [allWorkouts, setAllWorkouts] = useState<WorkoutLogEntry[]>([]);

  // Reading state
  const [bookTitles, setBookTitles] = useState<BookTitle[]>([]);
  const [readings, setReadings] = useState<ReadingEntry[]>([]);
  const [readingSaving, setReadingSaving] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [showBookInput, setShowBookInput] = useState(false);

  const isToday = date === toJSTDateString();

  const fetchWorkouts = useCallback(async () => {
    const data = await fetch("/api/workout-logs?startDate=2020-01-01&endDate=2099-12-31").then((r) => r.json());
    if (Array.isArray(data)) {
      setAllWorkouts(data);
    }
  }, []);

  const fetchReading = useCallback(async (d: string) => {
    const [booksData, logsData] = await Promise.all([
      fetch("/api/book-titles").then((r) => r.json()),
      fetch(`/api/reading-logs?date=${d}`).then((r) => r.json()),
    ]);
    setBookTitles(booksData);
    setReadings(logsData);
  }, []);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  useEffect(() => {
    if (tab === "reading") fetchReading(date);
  }, [date, tab, fetchReading]);

  const changeDate = (delta: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setDate(`${y}-${m}-${day}`);
  };

  // ── Chart data ──
  const chartData = useMemo(() => {
    const weekMenuMax = new Map<string, Map<string, number>>();
    const menuNames = new Set<string>();
    const weekKeys = new Set<string>();

    for (const log of allWorkouts) {
      const dateKey = typeof log.date === "string" && log.date.includes("T")
        ? log.date.split("T")[0]
        : log.date;
      const wk = getWeekKey(dateKey);
      weekKeys.add(wk);

      for (const ex of log.exercises) {
        if (ex.type === "running") continue;
        const w = parseWeight(ex.weight);
        if (w === null) continue;
        menuNames.add(ex.name);
        if (!weekMenuMax.has(wk)) weekMenuMax.set(wk, new Map());
        const menuMap = weekMenuMax.get(wk)!;
        menuMap.set(ex.name, Math.max(menuMap.get(ex.name) || 0, w));
      }
    }

    const sortedWeeks = Array.from(weekKeys).sort();
    const labels = sortedWeeks.map((wk) => getWeekLabel(wk));
    const sortedMenus = Array.from(menuNames).sort();

    const datasets = sortedMenus.map((menu, i) => ({
      label: menu,
      data: sortedWeeks.map((wk) => weekMenuMax.get(wk)?.get(menu) ?? null),
      borderColor: CHART_COLORS[i % CHART_COLORS.length],
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + "33",
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.3,
      spanGaps: true,
    }));

    return { labels, datasets };
  }, [allWorkouts]);

  // ── Reading handlers ──
  const addReading = async (bookTitle: string) => {
    if (!bookTitle.trim()) return;
    setReadingSaving(true);
    try {
      await fetch("/api/reading-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, bookTitle: bookTitle.trim(), review: "" }),
      });
      await fetchReading(date);
      setNewBookTitle("");
      setShowBookInput(false);
    } finally {
      setReadingSaving(false);
    }
  };

  const updateReview = async (entry: ReadingEntry, review: string) => {
    await fetch("/api/reading-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, bookTitle: entry.bookTitle.title, review }),
    });
  };

  const removeReading = async (id: string) => {
    await fetch(`/api/reading-logs?id=${id}`, { method: "DELETE" });
    await fetchReading(date);
  };

  const formatDateLabel = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("ja-JP", {
      month: "long", day: "numeric", weekday: "short",
    });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4">
        <div className="max-w-lg mx-auto">
          <div className="py-2 text-center">
            <span className="text-base font-bold">趣味</span>
          </div>

          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 mb-2">
            <button
              onClick={() => setTab("workout")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                tab === "workout" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"
              }`}
            >
              💪 筋トレ推移
            </button>
            <button
              onClick={() => setTab("reading")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                tab === "reading" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"
              }`}
            >
              📚 読書
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20 px-4">
        <div className="max-w-lg mx-auto py-4 space-y-3">

          {/* ══ Workout trend chart ══ */}
          {tab === "workout" && (
            <>
              {chartData.datasets.length > 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">重量推移（週ごとの最大重量）</h3>
                  <div className="h-64">
                    <Line
                      data={chartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: "index", intersect: false },
                        scales: {
                          x: {
                            ticks: { font: { size: 10 }, maxRotation: 45 },
                          },
                          y: {
                            title: { display: true, text: "重量", font: { size: 11 } },
                            ticks: { font: { size: 10 } },
                            beginAtZero: true,
                          },
                        },
                        plugins: {
                          legend: {
                            position: "bottom",
                            labels: { font: { size: 10 }, boxWidth: 12, padding: 8 },
                          },
                          tooltip: {
                            callbacks: {
                              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`,
                            },
                          },
                        },
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-slate-400">筋トレの記録がまだありません</p>
                  <p className="text-xs text-slate-300 mt-1">記録タブの「今日の一言」から記録してください</p>
                </div>
              )}
            </>
          )}

          {/* ══ Reading tab ══ */}
          {tab === "reading" && (
            <>
              {/* Date nav */}
              <div className="flex items-center justify-between py-1">
                <button onClick={() => changeDate(-1)} className="p-2 rounded-lg hover:bg-slate-100">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="text-center">
                  <div className="flex items-center gap-2 justify-center">
                    <span className="text-sm font-bold">{formatDateLabel(date)}</span>
                    {!isToday && (
                      <button onClick={() => setDate(toJSTDateString())} className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                        今日
                      </button>
                    )}
                  </div>
                </div>
                <button onClick={() => changeDate(1)} className="p-2 rounded-lg hover:bg-slate-100">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Reading entries for this date */}
              {readings.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-blue-50">
                    <span className="text-sm font-bold text-blue-800">{entry.bookTitle.title}</span>
                    <button onClick={() => removeReading(entry.id)} className="text-slate-300 hover:text-red-500 p-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="px-3 py-2">
                    <textarea
                      defaultValue={entry.review || ""}
                      onBlur={(e) => updateReview(entry, e.target.value)}
                      placeholder="感想・メモ..."
                      rows={3}
                      className="w-full px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y leading-relaxed"
                    />
                  </div>
                </div>
              ))}

              {/* Add book */}
              {showBookInput ? (
                <div className="rounded-lg border border-blue-200 p-3 space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={newBookTitle}
                      onChange={(e) => setNewBookTitle(e.target.value)}
                      placeholder="本のタイトルを入力..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      list="book-suggestions"
                    />
                    <datalist id="book-suggestions">
                      {bookTitles
                        .filter((b) => !readings.some((r) => r.bookTitleId === b.id))
                        .map((b) => (
                          <option key={b.id} value={b.title} />
                        ))}
                    </datalist>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowBookInput(false); setNewBookTitle(""); }}
                      className="flex-1 py-1.5 rounded-lg text-xs text-slate-500 border border-slate-200"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => addReading(newBookTitle)}
                      disabled={!newBookTitle.trim() || readingSaving}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
                    >
                      追加
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowBookInput(true)}
                  className="w-full py-2.5 rounded-lg border-2 border-dashed border-blue-300 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors"
                >
                  + 本を追加
                </button>
              )}

              {/* Registered book titles */}
              {bookTitles.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-slate-400 mb-2">登録済みの本</p>
                  <div className="flex flex-wrap gap-1.5">
                    {bookTitles
                      .filter((b) => !readings.some((r) => r.bookTitleId === b.id))
                      .map((b) => (
                        <button
                          key={b.id}
                          onClick={() => addReading(b.title)}
                          className="px-3 py-1 rounded-full text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          {b.title}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
