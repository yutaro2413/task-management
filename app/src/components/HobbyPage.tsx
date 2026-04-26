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

type Habit = {
  id: string;
  name: string;
  color: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
  level5: string;
  active: boolean;
  sortOrder: number;
};

type HabitLog = {
  id: string;
  date: string;
  habitId: string;
  level: number;
};

type Tab = "workout" | "reading" | "habit" | "sleep";

type SleepSession = {
  date: string;
  sleepAt: string;
  wakeAt: string;
  durationMinutes: number;
};

function formatJSTHHMM(iso: string) {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDurationHM(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

const HABIT_GRID_WEEKS = 12;
const HABIT_LEVEL_OPACITIES = [0.18, 0.34, 0.52, 0.74, 1.0];
const HABIT_COLOR_PRESETS = [
  "#6366f1", "#10b981", "#ef4444", "#f59e0b", "#3b82f6",
  "#ec4899", "#8b5cf6", "#06b6d4", "#f97316", "#14b8a6",
];

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function habitLevelColor(hex: string, level: number) {
  const { r, g, b } = hexToRgb(hex);
  const op = HABIT_LEVEL_OPACITIES[level - 1];
  const mr = Math.round(255 + (r - 255) * op);
  const mg = Math.round(255 + (g - 255) * op);
  const mb = Math.round(255 + (b - 255) * op);
  return `rgb(${mr}, ${mg}, ${mb})`;
}

type HabitGridCell = { date: string; isFuture: boolean; isToday: boolean };

function buildHabitGrid(weeks: number, todayStr: string): HabitGridCell[][] {
  const today = new Date(todayStr + "T00:00:00");
  const dow = today.getDay() || 7; // 1-7 (Mon=1, Sun=7)
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow - 1));
  const start = new Date(monday);
  start.setDate(monday.getDate() - (weeks - 1) * 7);

  const grid: HabitGridCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: HabitGridCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      const y = day.getFullYear();
      const m = String(day.getMonth() + 1).padStart(2, "0");
      const dd = String(day.getDate()).padStart(2, "0");
      const ds = `${y}-${m}-${dd}`;
      week.push({ date: ds, isFuture: ds > todayStr, isToday: ds === todayStr });
    }
    grid.push(week);
  }
  return grid;
}

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

  // Habit state
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [hName, setHName] = useState("");
  const [hColor, setHColor] = useState(HABIT_COLOR_PRESETS[0]);
  const [hLevels, setHLevels] = useState<[string, string, string, string, string]>(["", "", "", "", ""]);
  const [habitSaving, setHabitSaving] = useState(false);

  // Sleep state
  const [sleepSessions, setSleepSessions] = useState<SleepSession[]>([]);

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

  const habitGrid = useMemo(
    () => buildHabitGrid(HABIT_GRID_WEEKS, toJSTDateString()),
    []
  );

  const fetchHabits = useCallback(async () => {
    const data = await fetch("/api/habits").then((r) => r.json());
    if (Array.isArray(data)) setHabits(data);
  }, []);

  const fetchHabitLogs = useCallback(async () => {
    const startDate = habitGrid[0][0].date;
    const endDate = habitGrid[habitGrid.length - 1][6].date;
    const data = await fetch(
      `/api/habit-logs?startDate=${startDate}&endDate=${endDate}`
    ).then((r) => r.json());
    if (Array.isArray(data)) setHabitLogs(data);
  }, [habitGrid]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  useEffect(() => {
    if (tab === "reading") fetchReading(date);
  }, [date, tab, fetchReading]);

  useEffect(() => {
    if (tab === "habit") {
      fetchHabits();
      fetchHabitLogs();
    }
  }, [tab, fetchHabits, fetchHabitLogs]);

  const fetchSleepSessions = useCallback(async () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    const startDate = toJSTDateString(start);
    const endDate = toJSTDateString(today);
    const data = await fetch(
      `/api/sleep-sessions?startDate=${startDate}&endDate=${endDate}`
    ).then((r) => r.json());
    if (Array.isArray(data)) setSleepSessions(data);
  }, []);

  useEffect(() => {
    if (tab === "sleep") fetchSleepSessions();
  }, [tab, fetchSleepSessions]);

  const habitLogMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const log of habitLogs) {
      const dateKey =
        typeof log.date === "string" && log.date.includes("T")
          ? log.date.split("T")[0]
          : log.date;
      if (!map.has(log.habitId)) map.set(log.habitId, new Map());
      map.get(log.habitId)!.set(dateKey, log.level);
    }
    return map;
  }, [habitLogs]);

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

  // ── Habit handlers ──
  const openHabitAdd = () => {
    setEditHabit(null);
    setHName("");
    setHColor(HABIT_COLOR_PRESETS[0]);
    setHLevels(["", "", "", "", ""]);
    setHabitModalOpen(true);
  };

  const openHabitEdit = (h: Habit) => {
    setEditHabit(h);
    setHName(h.name);
    setHColor(h.color);
    setHLevels([h.level1, h.level2, h.level3, h.level4, h.level5]);
    setHabitModalOpen(true);
  };

  const saveHabit = async () => {
    if (!hName.trim()) return;
    setHabitSaving(true);
    try {
      const payload = {
        name: hName.trim(),
        color: hColor,
        level1: hLevels[0],
        level2: hLevels[1],
        level3: hLevels[2],
        level4: hLevels[3],
        level5: hLevels[4],
      };
      if (editHabit) {
        await fetch("/api/habits", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, id: editHabit.id, active: editHabit.active }),
        });
      } else {
        await fetch("/api/habits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setHabitModalOpen(false);
      await Promise.all([fetchHabits(), fetchHabitLogs()]);
    } finally {
      setHabitSaving(false);
    }
  };

  const deleteHabit = async (id: string) => {
    if (!confirm("この習慣を削除しますか？\n記録も全て削除されます。")) return;
    await fetch(`/api/habits?id=${id}`, { method: "DELETE" });
    await Promise.all([fetchHabits(), fetchHabitLogs()]);
  };

  const toggleHabitActive = async (h: Habit) => {
    await fetch("/api/habits", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: h.id,
        name: h.name,
        color: h.color,
        level1: h.level1,
        level2: h.level2,
        level3: h.level3,
        level4: h.level4,
        level5: h.level5,
        active: !h.active,
      }),
    });
    await fetchHabits();
  };

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
            <button
              onClick={() => setTab("habit")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                tab === "habit" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
              }`}
            >
              🎯 習慣
            </button>
            <button
              onClick={() => setTab("sleep")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                tab === "sleep" ? "bg-white text-sky-700 shadow-sm" : "text-slate-500"
              }`}
            >
              🌙 睡眠
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

          {/* ══ Habit tab ══ */}
          {tab === "habit" && (
            <>
              {/* Tracking grids per habit */}
              {habits.filter((h) => h.active).length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-400">アクティブな習慣がまだありません</p>
                  <p className="text-xs text-slate-300 mt-1">下の「習慣の管理」から追加してください</p>
                </div>
              ) : (
                habits
                  .filter((h) => h.active)
                  .map((h) => (
                    <div key={h.id} className="bg-white rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: h.color }}
                        />
                        <span className="text-sm font-bold text-slate-700 flex-1 truncate">
                          {h.name}
                        </span>
                        <button
                          onClick={() => openHabitEdit(h)}
                          className="text-[10px] text-slate-400 hover:text-slate-600"
                        >
                          編集
                        </button>
                      </div>
                      <div className="flex gap-0.5">
                        {habitGrid.map((week, wIdx) => (
                          <div key={wIdx} className="flex flex-col gap-0.5 flex-1">
                            {week.map((cell) => {
                              const level = habitLogMap.get(h.id)?.get(cell.date);
                              const bg = cell.isFuture
                                ? "transparent"
                                : level
                                ? habitLevelColor(h.color, level)
                                : "#f1f5f9";
                              return (
                                <div
                                  key={cell.date}
                                  title={`${cell.date}${level ? ` Lv.${level}` : ""}`}
                                  className={`aspect-square rounded-sm ${
                                    cell.isToday ? "ring-1 ring-slate-400" : ""
                                  }`}
                                  style={{ backgroundColor: bg }}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-slate-400">
                        <span>少</span>
                        {[1, 2, 3, 4, 5].map((lv) => (
                          <span
                            key={lv}
                            className="w-2.5 h-2.5 rounded-sm"
                            style={{ backgroundColor: habitLevelColor(h.color, lv) }}
                          />
                        ))}
                        <span>多</span>
                      </div>
                    </div>
                  ))
              )}

              {/* Management */}
              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-700">習慣の管理</h3>
                  <button
                    onClick={openHabitAdd}
                    className="text-xs px-3 py-1 rounded-full bg-indigo-600 text-white font-bold hover:bg-indigo-700"
                  >
                    + 追加
                  </button>
                </div>
                {habits.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">
                    習慣を追加して記録を始めましょう
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {habits.map((h) => (
                      <div key={h.id} className="py-2 flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: h.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${
                              h.active ? "" : "text-slate-400"
                            }`}
                          >
                            {h.name}
                          </p>
                          {!h.active && (
                            <p className="text-[10px] text-slate-400">非表示中</p>
                          )}
                        </div>
                        <button
                          onClick={() => toggleHabitActive(h)}
                          className="text-[10px] px-2 py-1 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                        >
                          {h.active ? "非表示" : "表示"}
                        </button>
                        <button
                          onClick={() => openHabitEdit(h)}
                          className="p-1.5 rounded hover:bg-slate-100"
                          aria-label="編集"
                        >
                          <svg
                            className="w-4 h-4 text-slate-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteHabit(h.id)}
                          className="p-1.5 rounded hover:bg-red-50"
                          aria-label="削除"
                        >
                          <svg
                            className="w-4 h-4 text-slate-300 hover:text-red-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══ Sleep tab ══ */}
          {tab === "sleep" && (
            <>
              {sleepSessions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-400">睡眠データがまだありません</p>
                  <p className="text-xs text-slate-300 mt-1">
                    iOSショートカットで <code className="bg-slate-100 px-1 rounded">/api/unlock-events</code> に POST してください
                  </p>
                </div>
              ) : (
                <>
                  {/* Duration chart */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">睡眠時間（直近30日）</h3>
                    <div className="h-48">
                      <Line
                        data={{
                          labels: sleepSessions.map((s) => {
                            const d = new Date(s.date + "T00:00:00");
                            return `${d.getMonth() + 1}/${d.getDate()}`;
                          }),
                          datasets: [
                            {
                              label: "睡眠時間 (時間)",
                              data: sleepSessions.map((s) => +(s.durationMinutes / 60).toFixed(2)),
                              borderColor: "#0ea5e9",
                              backgroundColor: "#0ea5e933",
                              borderWidth: 2,
                              pointRadius: 3,
                              tension: 0.3,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          scales: {
                            x: { ticks: { font: { size: 10 } } },
                            y: {
                              beginAtZero: true,
                              suggestedMax: 10,
                              ticks: { font: { size: 10 } },
                              title: { display: true, text: "時間", font: { size: 11 } },
                            },
                          },
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                label: (ctx) => `${(ctx.parsed.y ?? 0).toFixed(2)} 時間`,
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>

                  {/* Log list */}
                  <div className="bg-white rounded-xl border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-700 px-3 pt-3">睡眠ログ</h3>
                    <div className="divide-y divide-slate-100">
                      {[...sleepSessions].reverse().map((s) => {
                        const dateLabel = new Date(s.date + "T00:00:00").toLocaleDateString("ja-JP", {
                          month: "numeric", day: "numeric", weekday: "short",
                        });
                        const widthPct = Math.min(100, (s.durationMinutes / (10 * 60)) * 100);
                        return (
                          <div key={s.date} className="px-3 py-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-slate-600">{dateLabel}</span>
                              <span className="text-xs font-bold text-sky-700">{formatDurationHM(s.durationMinutes)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1">
                              <span>🌙 {formatJSTHHMM(s.sleepAt)}</span>
                              <span className="text-slate-300">→</span>
                              <span>☀️ {formatJSTHHMM(s.wakeAt)}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-sky-400 rounded-full" style={{ width: `${widthPct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Habit Add/Edit Modal */}
      {habitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4"
          onClick={() => setHabitModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold">
                {editHabit ? "習慣を編集" : "習慣を追加"}
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {/* Name */}
              <div className="flex items-center bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-500 w-16 flex-shrink-0">名前</span>
                <input
                  type="text"
                  value={hName}
                  onChange={(e) => setHName(e.target.value)}
                  placeholder="例: ストレッチ"
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                />
              </div>

              {/* Color */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">カラー</p>
                <div className="flex flex-wrap gap-2">
                  {HABIT_COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setHColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        hColor === c ? "border-slate-700 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`色 ${c}`}
                    />
                  ))}
                </div>
              </div>

              {/* Levels */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">
                  レベル別ラベル（空欄は表示されません）
                </p>
                <div className="space-y-1.5">
                  {[0, 1, 2, 3, 4].map((i) => {
                    const lv = i + 1;
                    const bg = habitLevelColor(hColor, lv);
                    const textDark = lv >= 4;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                        style={{ backgroundColor: bg }}
                      >
                        <span
                          className="text-[10px] font-bold w-8 flex-shrink-0"
                          style={{ color: textDark ? "#fff" : "#475569" }}
                        >
                          Lv.{lv}
                        </span>
                        <input
                          type="text"
                          value={hLevels[i]}
                          onChange={(e) => {
                            const next = [...hLevels] as typeof hLevels;
                            next[i] = e.target.value;
                            setHLevels(next);
                          }}
                          placeholder={`レベル${lv}の説明`}
                          className="flex-1 text-sm bg-white/70 px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Save */}
              <button
                onClick={saveHabit}
                disabled={!hName.trim() || habitSaving}
                className="w-full py-3 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                {habitSaving ? "保存中..." : editHabit ? "更新" : "追加"}
              </button>
              {editHabit && (
                <button
                  onClick={async () => {
                    setHabitModalOpen(false);
                    await deleteHabit(editHabit.id);
                  }}
                  className="w-full py-2 text-xs text-red-500 hover:text-red-600"
                >
                  この習慣を削除
                </button>
              )}
              <button
                onClick={() => setHabitModalOpen(false)}
                className="w-full py-2 text-xs text-slate-500"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
