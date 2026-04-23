"use client";

import { useState, useEffect, useCallback } from "react";
import { toJSTDateString } from "@/lib/utils";

type ExerciseMenu = {
  id: string;
  name: string;
  defaultWeight: string;
  defaultReps: number;
  defaultSets: number;
  type: string;
};

type Exercise = {
  menuId?: string;
  name: string;
  weight: string;
  reps: number;
  sets: number;
  type: string; // "strength" | "running"
  distance?: string;
  duration?: string;
  pace?: string;
};

type BookTitle = { id: string; title: string };
type ReadingEntry = {
  id: string;
  bookTitleId: string;
  bookTitle: { id: string; title: string };
  review?: string | null;
};

type Tab = "workout" | "reading";

function formatDateLabel(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export default function HobbyPage() {
  const [date, setDate] = useState(() => toJSTDateString());
  const [tab, setTab] = useState<Tab>("workout");

  // Workout state
  const [menus, setMenus] = useState<ExerciseMenu[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutSaved, setWorkoutSaved] = useState(false);
  const [workoutSaving, setWorkoutSaving] = useState(false);

  // Reading state
  const [bookTitles, setBookTitles] = useState<BookTitle[]>([]);
  const [readings, setReadings] = useState<ReadingEntry[]>([]);
  const [readingSaving, setReadingSaving] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [showBookInput, setShowBookInput] = useState(false);

  const isToday = date === toJSTDateString();

  const fetchWorkout = useCallback(async (d: string) => {
    const [menuData, logData] = await Promise.all([
      fetch("/api/exercise-menus").then((r) => r.json()),
      fetch(`/api/workout-logs?date=${d}`).then((r) => r.json()),
    ]);
    setMenus(menuData);
    if (logData && logData.exercises) {
      setExercises(logData.exercises as Exercise[]);
      setWorkoutSaved(true);
    } else {
      // Load previous workout as default
      const prev = await fetch("/api/workout-logs?startDate=2020-01-01&endDate=" + d).then((r) => r.json());
      if (Array.isArray(prev) && prev.length > 0) {
        const latest = prev[0]; // sorted desc
        setExercises((latest.exercises as Exercise[]).map((e) => ({ ...e })));
      } else {
        setExercises([]);
      }
      setWorkoutSaved(false);
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
    fetchWorkout(date);
    fetchReading(date);
  }, [date, fetchWorkout, fetchReading]);

  const changeDate = (delta: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setDate(`${y}-${m}-${day}`);
  };

  // ── Workout handlers ──
  const addExerciseFromMenu = (menu: ExerciseMenu) => {
    const ex: Exercise = {
      menuId: menu.id,
      name: menu.name,
      weight: menu.defaultWeight,
      reps: menu.defaultReps,
      sets: menu.defaultSets,
      type: menu.type,
    };
    setExercises((prev) => [...prev, ex]);
  };

  const addRunning = () => {
    setExercises((prev) => [
      ...prev,
      { name: "ランニング", weight: "", reps: 0, sets: 0, type: "running", distance: "", duration: "", pace: "" },
    ]);
  };

  const updateExercise = (idx: number, updates: Partial<Exercise>) => {
    setExercises((prev) => prev.map((e, i) => (i === idx ? { ...e, ...updates } : e)));
  };

  const removeExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveWorkout = async () => {
    setWorkoutSaving(true);
    try {
      if (exercises.length === 0) {
        await fetch(`/api/workout-logs?date=${date}`, { method: "DELETE" });
        setWorkoutSaved(false);
      } else {
        await fetch("/api/workout-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, exercises }),
        });
        setWorkoutSaved(true);
      }
    } finally {
      setWorkoutSaving(false);
    }
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

  // ── Menu select dropdown state ──
  const [showMenuPicker, setShowMenuPicker] = useState(false);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4">
        <div className="max-w-lg mx-auto">
          {/* Date nav */}
          <div className="flex items-center justify-between py-2">
            <button onClick={() => changeDate(-1)} className="p-2 rounded-lg hover:bg-slate-100">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <div className="flex items-center gap-2 justify-center">
                <span className="text-base font-bold">{formatDateLabel(date)}</span>
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

          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 mb-2">
            <button
              onClick={() => setTab("workout")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                tab === "workout" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"
              }`}
            >
              💪 運動
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

          {/* ══ Workout tab ══ */}
          {tab === "workout" && (
            <>
              {/* Exercise list */}
              {exercises.map((ex, idx) => (
                <div key={idx} className={`rounded-lg border overflow-hidden ${ex.type === "running" ? "border-orange-200" : "border-slate-200"}`}>
                  <div className={`flex items-center justify-between px-3 py-2 ${ex.type === "running" ? "bg-orange-50" : "bg-slate-50"}`}>
                    <span className="text-sm font-bold text-slate-700">{ex.name}</span>
                    <button onClick={() => removeExercise(idx)} className="text-slate-300 hover:text-red-500 p-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="px-3 py-2 space-y-2">
                    {ex.type === "running" ? (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">距離</label>
                          <input
                            type="text"
                            value={ex.distance || ""}
                            onChange={(e) => updateExercise(idx, { distance: e.target.value })}
                            placeholder="5.0km"
                            className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">時間</label>
                          <input
                            type="text"
                            value={ex.duration || ""}
                            onChange={(e) => updateExercise(idx, { duration: e.target.value })}
                            placeholder="30:00"
                            className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">ペース</label>
                          <input
                            type="text"
                            value={ex.pace || ""}
                            onChange={(e) => updateExercise(idx, { pace: e.target.value })}
                            placeholder="6:00/km"
                            className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-400"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 block mb-0.5">重量</label>
                          <input
                            type="text"
                            value={ex.weight}
                            onChange={(e) => updateExercise(idx, { weight: e.target.value })}
                            placeholder="20kg"
                            className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                        </div>
                        <div className="w-16">
                          <label className="text-[10px] text-slate-400 block mb-0.5">回数</label>
                          <input
                            type="number"
                            value={ex.reps}
                            onChange={(e) => updateExercise(idx, { reps: Math.max(0, Number(e.target.value)) })}
                            className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                        </div>
                        <div className="w-14">
                          <label className="text-[10px] text-slate-400 block mb-0.5">セット</label>
                          <input
                            type="number"
                            value={ex.sets}
                            onChange={(e) => updateExercise(idx, { sets: Math.max(0, Number(e.target.value)) })}
                            className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Add menu */}
              <div className="relative">
                <button
                  onClick={() => setShowMenuPicker(!showMenuPicker)}
                  className="w-full py-2.5 rounded-lg border-2 border-dashed border-emerald-300 text-emerald-600 text-sm font-medium hover:bg-emerald-50 transition-colors"
                >
                  + メニュー追加
                </button>
                {showMenuPicker && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-30 max-h-60 overflow-y-auto">
                    {menus.filter((m) => m.type === "strength").map((menu) => (
                      <button
                        key={menu.id}
                        onClick={() => { addExerciseFromMenu(menu); setShowMenuPicker(false); }}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-50 flex items-center justify-between"
                      >
                        <span className="text-sm font-medium">{menu.name}</span>
                        <span className="text-xs text-slate-400">
                          {menu.defaultWeight} × {menu.defaultReps}回 × {menu.defaultSets}set
                        </span>
                      </button>
                    ))}
                    <button
                      onClick={() => { addRunning(); setShowMenuPicker(false); }}
                      className="w-full px-4 py-2.5 text-left hover:bg-orange-50 border-b border-slate-50 flex items-center gap-2"
                    >
                      <span className="text-sm font-medium text-orange-600">🏃 ランニング</span>
                    </button>
                    {menus.length === 0 && (
                      <p className="px-4 py-3 text-xs text-slate-400">設定からメニューを追加してください</p>
                    )}
                  </div>
                )}
              </div>

              {/* Save button */}
              {exercises.length > 0 && (
                <button
                  onClick={saveWorkout}
                  disabled={workoutSaving}
                  className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 transition-colors"
                >
                  {workoutSaving ? "保存中..." : workoutSaved ? "更新" : "保存"}
                </button>
              )}
            </>
          )}

          {/* ══ Reading tab ══ */}
          {tab === "reading" && (
            <>
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
