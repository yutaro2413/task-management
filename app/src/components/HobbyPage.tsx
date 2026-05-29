"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { toJSTDateString } from "@/lib/utils";
import { parseWeight, exerciseVolume } from "@/lib/workoutVolume";
import { calcGymStats, GYM_START_DATE, fmtAvg } from "@/lib/gymStats";
import { smartReplaceSleepTime } from "@/lib/sleep";
import { SortableList, SortableItem } from "./SortableList";
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

// 旧 replaceJSTHHMM は smartReplaceSleepTime に置き換え (lib/sleep.ts)

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

// parseWeight / exerciseVolume は @/lib/workoutVolume に切り出し済み

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
  const [exerciseMenus, setExerciseMenus] = useState<{ id: string; name: string }[]>([]);
  const [chartMode, setChartMode] = useState<"weight" | "volume">("weight");
  const [historyFilter, setHistoryFilter] = useState("");
  const [historyLimit, setHistoryLimit] = useState(20);
  const [savingExerciseKey, setSavingExerciseKey] = useState<string | null>(null);

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
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [sleepView, setSleepView] = useState<"duration" | "sleepAt" | "wakeAt">("duration");
  const [editingSleep, setEditingSleep] = useState<SleepSession | null>(null);
  const [editSleepHM, setEditSleepHM] = useState("");
  const [editWakeHM, setEditWakeHM] = useState("");
  const [savingSleep, setSavingSleep] = useState(false);

  const isToday = date === toJSTDateString();

  const fetchWorkouts = useCallback(async () => {
    const [logs, menus] = await Promise.all([
      fetch("/api/workout-logs?startDate=2020-01-01&endDate=2099-12-31").then((r) => r.json()),
      fetch("/api/exercise-menus").then((r) => r.json()),
    ]);
    if (Array.isArray(logs)) setAllWorkouts(logs);
    if (Array.isArray(menus)) setExerciseMenus(menus);
  }, []);

  // 履歴の inline 編集: 指定された日のエクササイズ配列を patch して保存
  const saveExercises = useCallback(
    async (date: string, exercises: Exercise[], key: string) => {
      setSavingExerciseKey(key);
      try {
        if (exercises.length === 0) {
          await fetch(`/api/workout-logs?date=${date}`, { method: "DELETE" });
        } else {
          await fetch("/api/workout-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date, exercises }),
          });
        }
        await fetchWorkouts();
      } finally {
        setSavingExerciseKey(null);
      }
    },
    [fetchWorkouts],
  );

  const updateExerciseField = useCallback(
    async (logDate: string, idx: number, patch: Partial<Exercise>) => {
      const log = allWorkouts.find((l) => {
        const dk = typeof l.date === "string" && l.date.includes("T") ? l.date.split("T")[0] : l.date;
        return dk === logDate;
      });
      if (!log) return;
      const next = log.exercises.map((ex, i) => (i === idx ? { ...ex, ...patch } : ex));
      // 値が変わっていなければ何もしない
      if (JSON.stringify(next[idx]) === JSON.stringify(log.exercises[idx])) return;
      await saveExercises(logDate, next, `${logDate}-${idx}`);
    },
    [allWorkouts, saveExercises],
  );

  const deleteExerciseRow = useCallback(
    async (logDate: string, idx: number) => {
      const log = allWorkouts.find((l) => {
        const dk = typeof l.date === "string" && l.date.includes("T") ? l.date.split("T")[0] : l.date;
        return dk === logDate;
      });
      if (!log) return;
      const next = log.exercises.filter((_, i) => i !== idx);
      await saveExercises(logDate, next, `${logDate}-${idx}-del`);
    },
    [allWorkouts, saveExercises],
  );

  // 長押しドラッグ並び替え (履歴の各日のエクササイズ)
  const reorderHistoryExercises = useCallback(
    async (logDate: string, newIds: string[]) => {
      const log = allWorkouts.find((l) => {
        const dk = typeof l.date === "string" && l.date.includes("T") ? l.date.split("T")[0] : l.date;
        return dk === logDate;
      });
      if (!log) return;
      const newOrder = newIds.map((id) => log.exercises[parseInt(id.replace("ex-", ""), 10)]);
      if (newOrder.every((e, i) => e === log.exercises[i])) return;
      await saveExercises(logDate, newOrder, `${logDate}-reorder`);
    },
    [allWorkouts, saveExercises],
  );

  const deleteWholeWorkoutDay = useCallback(
    async (logDate: string) => {
      if (!confirm(`${logDate} の筋トレ記録を全て削除しますか？`)) return;
      await saveExercises(logDate, [], `${logDate}-day-del`);
    },
    [saveExercises],
  );

  // 履歴セクションで表示するログ (フィルタ + ページネーション)
  const filteredHistory = useMemo(() => {
    const term = historyFilter.trim();
    const matched = term
      ? allWorkouts.filter((log) => log.exercises.some((e) => e.name.includes(term)))
      : allWorkouts;
    return matched.slice(0, historyLimit);
  }, [allWorkouts, historyFilter, historyLimit]);

  const filteredHistoryTotal = useMemo(() => {
    const term = historyFilter.trim();
    return term
      ? allWorkouts.filter((log) => log.exercises.some((e) => e.name.includes(term))).length
      : allWorkouts.length;
  }, [allWorkouts, historyFilter]);

  // ジム通いカウント (開始日 2026-04-19 以降)
  const gymStats = useMemo(() => {
    const dates = allWorkouts
      .map((l) => (typeof l.date === "string" && l.date.includes("T") ? l.date.split("T")[0] : l.date))
      .filter((d): d is string => typeof d === "string");
    return calcGymStats(dates);
  }, [allWorkouts]);

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

  useEffect(() => {
    const handler = () => {
      fetchHabits();
      fetchHabitLogs();
    };
    window.addEventListener("habit-logs-updated", handler);
    return () => window.removeEventListener("habit-logs-updated", handler);
  }, [fetchHabits, fetchHabitLogs]);

  const fetchSleepSessions = useCallback(async () => {
    const today = new Date();
    const startDate = "2020-01-01";
    const endDate = toJSTDateString(today);
    const data = await fetch(
      `/api/sleep-sessions?startDate=${startDate}&endDate=${endDate}`
    ).then((r) => r.json());
    if (Array.isArray(data)) setSleepSessions(data);
  }, []);

  useEffect(() => {
    if (tab === "sleep") fetchSleepSessions();
  }, [tab, fetchSleepSessions]);

  const openSleepEdit = (s: SleepSession) => {
    setEditingSleep(s);
    setEditSleepHM(formatJSTHHMM(s.sleepAt));
    setEditWakeHM(formatJSTHHMM(s.wakeAt));
  };

  const saveSleepEdit = async () => {
    if (!editingSleep) return;
    setSavingSleep(true);
    try {
      // 起床時刻を先に決定し (基準は元の wakeAt) → 就寝時刻はその起床時刻から見て妥当な日付を選ぶ。
      // これで「23:30→01:30」のような日跨ぎ編集も正しい日付に解釈される。
      const newWakeAt = smartReplaceSleepTime(editWakeHM, editingSleep.sleepAt, "wake");
      const newSleepAt = smartReplaceSleepTime(editSleepHM, newWakeAt, "sleep");
      const res = await fetch("/api/sleep-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editingSleep.date,
          sleepAt: newSleepAt,
          wakeAt: newWakeAt,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "保存に失敗しました");
        return;
      }
      setEditingSleep(null);
      await fetchSleepSessions();
    } finally {
      setSavingSleep(false);
    }
  };

  const runCleanup = useCallback(async () => {
    if (!confirm("30日以上前のロック解除イベントを集約・削除します。よろしいですか？")) return;
    setCleanupRunning(true);
    setCleanupResult(null);
    try {
      const res = await fetch("/api/sleep-sessions/cleanup", { method: "POST" });
      const data = await res.json();
      setCleanupResult(
        `集約 ${data.upsertedSessions ?? 0} 件 / 削除 ${data.deletedEvents ?? 0} 件`
      );
      await fetchSleepSessions();
    } catch {
      setCleanupResult("失敗しました");
    } finally {
      setCleanupRunning(false);
    }
  }, [fetchSleepSessions]);

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
  // chartMode により Y 軸の指標を切替:
  //   "weight" : 週ごとのメニュー別最大重量 (kg)
  //   "volume" : 週ごとのメニュー別最大ボリューム (重量 × 回数 × セット)
  // 過去にメニューをリネームしていてもスナップショットの古い名前で重複表示されないよう、
  // menuId があれば menuId で集約し、現マスタの名前を凡例に使う。
  const chartData = useMemo(() => {
    const weekMenuMax = new Map<string, Map<string, number>>();
    const seriesKeys = new Set<string>();
    const weekKeys = new Set<string>();
    const menuIdToCurrentName = new Map(exerciseMenus.map((m) => [m.id, m.name]));

    for (const log of allWorkouts) {
      const dateKey = typeof log.date === "string" && log.date.includes("T")
        ? log.date.split("T")[0]
        : log.date;
      const wk = getWeekKey(dateKey);
      weekKeys.add(wk);

      for (const ex of log.exercises) {
        if (ex.type === "running") continue;
        const value = chartMode === "volume" ? exerciseVolume(ex) : parseWeight(ex.weight);
        if (value === null) continue;
        const key = ex.menuId ?? ex.name;
        seriesKeys.add(key);
        if (!weekMenuMax.has(wk)) weekMenuMax.set(wk, new Map());
        const menuMap = weekMenuMax.get(wk)!;
        menuMap.set(key, Math.max(menuMap.get(key) || 0, value));
      }
    }

    const sortedWeeks = Array.from(weekKeys).sort();
    const labels = sortedWeeks.map((wk) => getWeekLabel(wk));
    const labelFor = (key: string) => menuIdToCurrentName.get(key) ?? key;
    const sortedKeys = Array.from(seriesKeys).sort((a, b) => labelFor(a).localeCompare(labelFor(b)));

    const POINT_STYLES = ["circle", "rect", "triangle", "rectRot", "star", "crossRot"] as const;
    const DASH_PATTERNS: number[][] = [[], [6, 4], [2, 3], [10, 4, 2, 4]];

    const datasets = sortedKeys.map((key, i) => ({
      label: labelFor(key),
      data: sortedWeeks.map((wk) => weekMenuMax.get(wk)?.get(key) ?? null),
      borderColor: CHART_COLORS[i % CHART_COLORS.length],
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + "33",
      borderWidth: 2,
      borderDash: DASH_PATTERNS[i % DASH_PATTERNS.length],
      pointStyle: POINT_STYLES[i % POINT_STYLES.length],
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBorderWidth: 2,
      pointBackgroundColor: "#fff",
      tension: 0.3,
      spanGaps: true,
    }));

    return { labels, datasets };
  }, [allWorkouts, exerciseMenus, chartMode]);

  // ── Sleep chart data ──
  const sleepChart = useMemo(() => {
    const sortedSessions = [...sleepSessions].sort((a, b) => a.date.localeCompare(b.date));
    const labels = sortedSessions.map((s) => {
      const d = new Date(s.date + "T00:00:00");
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });

    const durations = sortedSessions.map((s) => +(s.durationMinutes / 60).toFixed(2));
    const sortedDur = [...durations].sort((a, b) => a - b);
    const median = sortedDur.length === 0
      ? 0
      : sortedDur.length % 2 === 0
      ? (sortedDur[sortedDur.length / 2 - 1] + sortedDur[sortedDur.length / 2]) / 2
      : sortedDur[(sortedDur.length - 1) / 2];

    const jstHourFloat = (iso: string) => {
      const d = new Date(iso);
      const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      return jst.getUTCHours() + jst.getUTCMinutes() / 60;
    };
    // 就寝時刻: 12時前は深夜と見做して+24（連続軸上で 22, 23, 24, 25...と表示するため）
    const sleepHours = sortedSessions.map((s) => {
      const h = jstHourFloat(s.sleepAt);
      return h < 12 ? h + 24 : h;
    });
    const wakeHours = sortedSessions.map((s) => jstHourFloat(s.wakeAt));

    return { labels, durations, median, sleepHours, wakeHours, count: sortedSessions.length };
  }, [sleepSessions]);

  const formatHourTick = (val: number) => {
    const h = ((val % 24) + 24) % 24;
    const wholeH = Math.floor(h);
    const m = Math.round((h - wholeH) * 60);
    return `${String(wholeH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

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
      <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-40 px-4">
        <div className="max-w-lg lg:max-w-3xl mx-auto">
          <div className="py-2 text-center">
            <span className="text-base font-bold">趣味</span>
          </div>

          {/* Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 mb-2">
            <button
              onClick={() => setTab("workout")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                tab === "workout" ? "bg-white dark:bg-slate-900 text-emerald-700 shadow-sm" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              💪 筋トレ推移
            </button>
            <button
              onClick={() => setTab("reading")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                tab === "reading" ? "bg-white dark:bg-slate-900 text-blue-700 shadow-sm" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              📚 読書
            </button>
            <button
              onClick={() => setTab("habit")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                tab === "habit" ? "bg-white dark:bg-slate-900 text-indigo-700 shadow-sm" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              🎯 習慣
            </button>
            <button
              onClick={() => setTab("sleep")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                tab === "sleep" ? "bg-white dark:bg-slate-900 text-sky-700 shadow-sm" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              🌙 睡眠
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20 px-4">
        <div className="max-w-lg lg:max-w-3xl mx-auto py-4 space-y-3">

          {/* ══ Workout trend chart ══ */}
          {tab === "workout" && (
            <>
              {/* ジム通いカウント (開始: 2026-04-19) */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">💪 ジム通いカウント</h3>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{GYM_START_DATE} 〜 ({gymStats.daysElapsed}日)</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-2xl font-bold text-emerald-600">{gymStats.visits}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">通った回数</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-600">{fmtAvg(gymStats.weeklyAvg)}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">週平均 (回/週)</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-600">{fmtAvg(gymStats.monthlyAvg)}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">月平均 (回/月)</div>
                  </div>
                </div>
              </div>

              {chartData.datasets.length > 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {chartMode === "weight" ? "重量推移（週ごとの最大重量）" : "ボリューム推移（週ごとの最大 重量×回数×セット）"}
                    </h3>
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-md p-0.5">
                      <button
                        onClick={() => setChartMode("weight")}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded ${chartMode === "weight" ? "bg-white dark:bg-slate-900 text-emerald-700 shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
                      >重量</button>
                      <button
                        onClick={() => setChartMode("volume")}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded ${chartMode === "volume" ? "bg-white dark:bg-slate-900 text-emerald-700 shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
                      >ボリューム</button>
                    </div>
                  </div>
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
                            title: {
                              display: true,
                              text: chartMode === "weight" ? "重量 (kg)" : "ボリューム (kg × 回 × セット)",
                              font: { size: 11 },
                            },
                            ticks: { font: { size: 10 } },
                            beginAtZero: true,
                          },
                        },
                        plugins: {
                          legend: {
                            position: "bottom",
                            labels: { font: { size: 10 }, boxWidth: 12, padding: 8, usePointStyle: true },
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
                  <p className="text-sm text-slate-400 dark:text-slate-500">筋トレの記録がまだありません</p>
                  <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">記録タブの「今日の一言」から記録してください</p>
                </div>
              )}

              {/* ── 履歴 (inline 編集) ── */}
              {allWorkouts.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">履歴</h3>
                    <input
                      value={historyFilter}
                      onChange={(e) => { setHistoryFilter(e.target.value); setHistoryLimit(20); }}
                      placeholder="メニュー名で絞り込み..."
                      className="flex-1 min-w-[140px] px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {filteredHistoryTotal > 0 ? `${Math.min(historyLimit, filteredHistoryTotal)}/${filteredHistoryTotal}件` : "0件"}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredHistory.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">該当する記録がありません</p>
                    ) : (
                      filteredHistory.map((log) => {
                        const dateKey = typeof log.date === "string" && log.date.includes("T") ? log.date.split("T")[0] : log.date;
                        return (
                          <div key={log.id} className="px-4 py-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{dateKey}</span>
                              <button onClick={() => deleteWholeWorkoutDay(dateKey)} className="text-[10px] text-slate-300 dark:text-slate-600 hover:text-red-500">日全体を削除</button>
                            </div>
                            <SortableList
                              ids={log.exercises.map((_, i) => `ex-${i}`)}
                              onReorder={(newIds) => reorderHistoryExercises(dateKey, newIds)}
                            >
                              {log.exercises.map((ex, idx) => {
                                const key = `${dateKey}-${idx}`;
                                const isSaving = savingExerciseKey === key;
                                return (
                                  <SortableItem key={`ex-${idx}`} id={`ex-${idx}`}>
                                    {({ listeners, setActivatorNodeRef, isDragging, handleStyle }) => {
                                      const handle = (
                                        <span
                                          ref={setActivatorNodeRef}
                                          {...listeners}
                                          style={handleStyle}
                                          className="text-slate-400 dark:text-slate-500 text-base leading-none cursor-grab active:cursor-grabbing select-none px-1 py-1"
                                          title="長押ししてドラッグで並び替え"
                                        >⋮⋮</span>
                                      );
                                      return ex.type === "running" ? (
                                        <div className={`flex items-center gap-1.5 text-xs py-0.5 ${isDragging ? "bg-emerald-50 ring-1 ring-emerald-300 rounded" : ""}`}>
                                          {handle}
                                          <span className="text-[10px] px-1 py-0.5 rounded bg-sky-50 text-sky-700 font-medium flex-shrink-0">ラン</span>
                                          <input
                                            defaultValue={ex.name}
                                            onBlur={(e) => updateExerciseField(dateKey, idx, { name: e.target.value })}
                                            className="flex-1 min-w-0 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800 text-xs"
                                          />
                                          <input
                                            defaultValue={ex.distance ?? ""}
                                            onBlur={(e) => updateExerciseField(dateKey, idx, { distance: e.target.value })}
                                            placeholder="距離"
                                            className="w-14 px-1 py-0.5 rounded border border-slate-100 dark:border-slate-800 text-xs text-center"
                                          />
                                          <input
                                            defaultValue={ex.duration ?? ""}
                                            onBlur={(e) => updateExerciseField(dateKey, idx, { duration: e.target.value })}
                                            placeholder="時間"
                                            className="w-14 px-1 py-0.5 rounded border border-slate-100 dark:border-slate-800 text-xs text-center"
                                          />
                                          <button
                                            onClick={() => deleteExerciseRow(dateKey, idx)}
                                            className="text-slate-300 dark:text-slate-600 hover:text-red-500 text-xs px-1"
                                            aria-label="削除"
                                          >×</button>
                                        </div>
                                      ) : (
                                        <div className={`flex items-center gap-1.5 text-xs py-0.5 ${isDragging ? "bg-emerald-50 ring-1 ring-emerald-300 rounded" : ""}`}>
                                          {handle}
                                          <input
                                            defaultValue={ex.name}
                                            onBlur={(e) => updateExerciseField(dateKey, idx, { name: e.target.value })}
                                            className="flex-1 min-w-0 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800 text-xs font-medium"
                                          />
                                          <input
                                            defaultValue={ex.weight}
                                            onBlur={(e) => updateExerciseField(dateKey, idx, { weight: e.target.value })}
                                            placeholder="kg"
                                            className="w-12 px-1 py-0.5 rounded border border-slate-100 dark:border-slate-800 text-xs text-center"
                                          />
                                          <span className="text-[9px] text-slate-400 dark:text-slate-500">×</span>
                                          <input
                                            type="number"
                                            defaultValue={ex.reps}
                                            onBlur={(e) => updateExerciseField(dateKey, idx, { reps: Number(e.target.value) || 0 })}
                                            className="w-10 px-1 py-0.5 rounded border border-slate-100 dark:border-slate-800 text-xs text-center"
                                          />
                                          <span className="text-[9px] text-slate-400 dark:text-slate-500">×</span>
                                          <input
                                            type="number"
                                            defaultValue={ex.sets}
                                            onBlur={(e) => updateExerciseField(dateKey, idx, { sets: Number(e.target.value) || 0 })}
                                            className="w-10 px-1 py-0.5 rounded border border-slate-100 dark:border-slate-800 text-xs text-center"
                                          />
                                          <button
                                            onClick={() => deleteExerciseRow(dateKey, idx)}
                                            disabled={isSaving}
                                            className="text-slate-300 dark:text-slate-600 hover:text-red-500 text-xs px-1 disabled:opacity-50"
                                            aria-label="削除"
                                          >×</button>
                                        </div>
                                      );
                                    }}
                                  </SortableItem>
                                );
                              })}
                            </SortableList>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {filteredHistoryTotal > historyLimit && (
                    <button
                      onClick={() => setHistoryLimit((n) => n + 20)}
                      className="w-full py-2 text-xs text-emerald-600 font-medium border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      もっと表示 (+20)
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* ══ Reading tab ══ */}
          {tab === "reading" && (
            <>
              <Link href="/books" className="block text-center py-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100">
                📚 書籍ライブラリ・ハイライトを開く →
              </Link>
              {/* Date nav */}
              <div className="flex items-center justify-between py-1">
                <button onClick={() => changeDate(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
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
                <button onClick={() => changeDate(1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Reading entries for this date */}
              {readings.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-blue-50">
                    <span className="text-sm font-bold text-blue-800">{entry.bookTitle.title}</span>
                    <button onClick={() => removeReading(entry.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 p-1">
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
                      className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y leading-relaxed"
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
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                      className="flex-1 py-1.5 rounded-lg text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
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
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-2">登録済みの本</p>
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
                  <p className="text-sm text-slate-400 dark:text-slate-500">アクティブな習慣がまだありません</p>
                  <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">下の「習慣の管理」から追加してください</p>
                </div>
              ) : (
                habits
                  .filter((h) => h.active)
                  .map((h) => (
                    <div key={h.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: h.color }}
                        />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex-1 truncate">
                          {h.name}
                        </span>
                        <button
                          onClick={() => openHabitEdit(h)}
                          className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
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
                              const onCellClick = cell.isFuture
                                ? undefined
                                : () =>
                                    window.dispatchEvent(
                                      new CustomEvent("open-habit-modal", { detail: { date: cell.date } })
                                    );
                              return (
                                <div
                                  key={cell.date}
                                  title={`${cell.date}${level ? ` Lv.${level}` : ""}`}
                                  onClick={onCellClick}
                                  className={`aspect-square rounded-sm ${
                                    cell.isFuture ? "" : "cursor-pointer"
                                  } ${cell.isToday ? "ring-1 ring-slate-400" : ""}`}
                                  style={{ backgroundColor: bg }}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-slate-400 dark:text-slate-500">
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
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">習慣の管理</h3>
                  <button
                    onClick={openHabitAdd}
                    className="text-xs px-3 py-1 rounded-full bg-indigo-600 text-white font-bold hover:bg-indigo-700"
                  >
                    + 追加
                  </button>
                </div>
                {habits.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-3">
                    習慣を追加して記録を始めましょう
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {habits.map((h) => (
                      <div key={h.id} className="py-2 flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: h.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${
                              h.active ? "" : "text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            {h.name}
                          </p>
                          {!h.active && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">非表示中</p>
                          )}
                        </div>
                        <button
                          onClick={() => toggleHabitActive(h)}
                          className="text-[10px] px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          {h.active ? "非表示" : "表示"}
                        </button>
                        <button
                          onClick={() => openHabitEdit(h)}
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label="編集"
                        >
                          <svg
                            className="w-4 h-4 text-slate-400 dark:text-slate-500"
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
                            className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-red-500"
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
                  <p className="text-sm text-slate-400 dark:text-slate-500">睡眠データがまだありません</p>
                  <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">
                    iOSショートカットで <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">/api/unlock-events</code> に POST してください
                  </p>
                </div>
              ) : (
                <>
                  {/* Chart with view toggle */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {sleepView === "duration" && `睡眠時間（全${sleepChart.count}日 / 中央値 ${sleepChart.median.toFixed(2)}h）`}
                        {sleepView === "sleepAt" && "就寝時刻の推移"}
                        {sleepView === "wakeAt" && "起床時刻の推移"}
                      </h3>
                      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                        {[
                          { key: "duration", label: "時間" },
                          { key: "sleepAt", label: "就寝" },
                          { key: "wakeAt", label: "起床" },
                        ].map((v) => (
                          <button
                            key={v.key}
                            onClick={() => setSleepView(v.key as "duration" | "sleepAt" | "wakeAt")}
                            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                              sleepView === v.key ? "bg-white dark:bg-slate-900 text-sky-700 shadow-sm font-medium" : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="h-56">
                      {sleepView === "duration" && (
                        <Line
                          data={{
                            labels: sleepChart.labels,
                            datasets: [
                              {
                                label: "睡眠時間",
                                data: sleepChart.durations,
                                borderColor: "#0ea5e9",
                                backgroundColor: "#0ea5e933",
                                borderWidth: 2,
                                pointRadius: 2,
                                tension: 0.3,
                              },
                              {
                                label: "中央値",
                                data: sleepChart.labels.map(() => +sleepChart.median.toFixed(2)),
                                borderColor: "#f97316",
                                backgroundColor: "transparent",
                                borderWidth: 1.5,
                                borderDash: [5, 4],
                                pointRadius: 0,
                                tension: 0,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              x: { ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true } },
                              y: {
                                beginAtZero: true,
                                suggestedMax: 10,
                                ticks: { font: { size: 10 } },
                                title: { display: true, text: "時間", font: { size: 11 } },
                              },
                            },
                            plugins: {
                              legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 12, padding: 8, usePointStyle: true } },
                              tooltip: {
                                callbacks: {
                                  label: (ctx) => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(2)} 時間`,
                                },
                              },
                            },
                          }}
                        />
                      )}
                      {sleepView === "sleepAt" && (
                        <Line
                          data={{
                            labels: sleepChart.labels,
                            datasets: [
                              {
                                label: "就寝時刻",
                                data: sleepChart.sleepHours,
                                borderColor: "#6366f1",
                                backgroundColor: "#6366f133",
                                borderWidth: 2,
                                pointRadius: 2,
                                tension: 0.3,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              x: { ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true } },
                              y: {
                                ticks: { font: { size: 10 }, callback: (v) => formatHourTick(v as number) },
                                title: { display: true, text: "JST", font: { size: 11 } },
                                suggestedMin: 20,
                                suggestedMax: 30,
                                reverse: true,
                              },
                            },
                            plugins: {
                              legend: { display: false },
                              tooltip: { callbacks: { label: (ctx) => `就寝 ${formatHourTick(ctx.parsed.y as number)}` } },
                            },
                          }}
                        />
                      )}
                      {sleepView === "wakeAt" && (
                        <Line
                          data={{
                            labels: sleepChart.labels,
                            datasets: [
                              {
                                label: "起床時刻",
                                data: sleepChart.wakeHours,
                                borderColor: "#f59e0b",
                                backgroundColor: "#f59e0b33",
                                borderWidth: 2,
                                pointRadius: 2,
                                tension: 0.3,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              x: { ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true } },
                              y: {
                                ticks: { font: { size: 10 }, callback: (v) => formatHourTick(v as number) },
                                title: { display: true, text: "JST", font: { size: 11 } },
                                suggestedMin: 4,
                                suggestedMax: 12,
                                reverse: true,
                              },
                            },
                            plugins: {
                              legend: { display: false },
                              tooltip: { callbacks: { label: (ctx) => `起床 ${formatHourTick(ctx.parsed.y as number)}` } },
                            },
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Log list */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 px-3 pt-3">睡眠ログ</h3>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {[...sleepSessions].reverse().map((s) => {
                        const dateLabel = new Date(s.date + "T00:00:00").toLocaleDateString("ja-JP", {
                          month: "numeric", day: "numeric", weekday: "short",
                        });
                        const widthPct = Math.min(100, (s.durationMinutes / (10 * 60)) * 100);
                        return (
                          <button
                            key={s.date}
                            onClick={() => openSleepEdit(s)}
                            className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{dateLabel}</span>
                              <span className="text-xs font-bold text-sky-700">{formatDurationHM(s.durationMinutes)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                              <span>🌙 {formatJSTHHMM(s.sleepAt)}</span>
                              <span className="text-slate-300 dark:text-slate-600">→</span>
                              <span>☀️ {formatJSTHHMM(s.wakeAt)}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-sky-400 rounded-full" style={{ width: `${widthPct}%` }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Manual cleanup */}
              <div className="pt-2 text-center">
                <button
                  onClick={runCleanup}
                  disabled={cleanupRunning}
                  className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 underline disabled:opacity-50"
                >
                  {cleanupRunning ? "クリーンアップ中..." : "古いデータを集約して削除"}
                </button>
                {cleanupResult && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{cleanupResult}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sleep Edit Modal */}
      {editingSleep && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center modal-backdrop px-4"
          onClick={() => setEditingSleep(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold mb-1">睡眠時刻を編集</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {new Date(editingSleep.date + "T00:00:00").toLocaleDateString("ja-JP", {
                month: "numeric", day: "numeric", weekday: "short",
              })}
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">🌙 就寝時刻</span>
                <input
                  type="time"
                  value={editSleepHM}
                  onChange={(e) => setEditSleepHM(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">☀️ 起床時刻</span>
                <input
                  type="time"
                  value={editWakeHM}
                  onChange={(e) => setEditWakeHM(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
                />
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setEditingSleep(null)}
                className="flex-1 py-2.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                キャンセル
              </button>
              <button
                onClick={saveSleepEdit}
                disabled={savingSleep}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300"
              >
                {savingSleep ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Habit Add/Edit Modal */}
      {habitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4"
          onClick={() => setHabitModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold">
                {editHabit ? "習慣を編集" : "習慣を追加"}
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {/* Name */}
              <div className="flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 w-16 flex-shrink-0">名前</span>
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
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">カラー</p>
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
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
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
                className="w-full py-2 text-xs text-slate-500 dark:text-slate-400"
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
