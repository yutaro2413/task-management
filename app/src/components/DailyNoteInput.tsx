"use client";

import { useState, useEffect, useCallback } from "react";
import { NOTE_SECTIONS, NoteSections, parseNote, serializeNote } from "@/lib/dailyNote";

const DRAFT_KEY_PREFIX = "dailyNote-draft-";

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
  type: string;
  distance?: string;
  duration?: string;
  pace?: string;
};

type WorkoutLog = { exercises: Exercise[] } | null;

function saveDraftToStorage(date: string, draft: NoteSections) {
  const serialized = serializeNote(draft);
  if (serialized) {
    localStorage.setItem(DRAFT_KEY_PREFIX + date, JSON.stringify(draft));
  } else {
    localStorage.removeItem(DRAFT_KEY_PREFIX + date);
  }
}

function loadDraftFromStorage(date: string): NoteSections | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY_PREFIX + date);
    if (!raw) return null;
    return JSON.parse(raw) as NoteSections;
  } catch {
    return null;
  }
}

function clearDraftFromStorage(date: string) {
  localStorage.removeItem(DRAFT_KEY_PREFIX + date);
}

function WorkoutSection({
  checked,
  exercises,
  menus,
  onToggle,
  onUpdate,
  readOnly,
}: {
  checked: boolean;
  exercises: Exercise[];
  menus: ExerciseMenu[];
  onToggle: () => void;
  onUpdate: (exercises: Exercise[]) => void;
  readOnly?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const addFromMenu = (menu: ExerciseMenu) => {
    onUpdate([...exercises, {
      menuId: menu.id,
      name: menu.name,
      weight: menu.defaultWeight,
      reps: menu.defaultReps,
      sets: menu.defaultSets,
      type: menu.type,
    }]);
    setShowPicker(false);
  };

  const addRunning = () => {
    onUpdate([...exercises, {
      name: "ランニング", weight: "", reps: 0, sets: 0, type: "running",
      distance: "", duration: "", pace: "",
    }]);
    setShowPicker(false);
  };

  const updateExercise = (idx: number, updates: Partial<Exercise>) => {
    onUpdate(exercises.map((e, i) => (i === idx ? { ...e, ...updates } : e)));
  };

  const removeExercise = (idx: number) => onUpdate(exercises.filter((_, i) => i !== idx));

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-medium transition-colors ${
          checked ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"
        }`}
      >
        <span className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
          checked ? "bg-emerald-500 border-emerald-500" : "border-slate-300"
        }`}>
          {checked && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <span>運動</span>
      </button>

      {checked && (
        <div className="px-3 py-2 space-y-2 border-t border-slate-100">
          {readOnly ? (
            exercises.length > 0 ? (
              <div className="space-y-1">
                {exercises.map((ex, i) => (
                  <p key={i} className="text-sm text-slate-700">
                    {ex.type === "running"
                      ? `${ex.name} — ${ex.distance || "?"} / ${ex.duration || "?"} / ${ex.pace || "?"}`
                      : `${ex.name} — ${ex.weight} × ${ex.reps}回 × ${ex.sets}set`}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">メニュー未入力</p>
            )
          ) : (
            <>
              {exercises.map((ex, idx) => (
                <div key={idx} className={`rounded border p-2 ${ex.type === "running" ? "border-orange-200 bg-orange-50/30" : "border-slate-100"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-600">{ex.name}</span>
                    <button onClick={() => removeExercise(idx)} className="p-0.5 text-slate-300 hover:text-red-500">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {ex.type === "running" ? (
                    <div className="flex gap-1">
                      <input type="text" value={ex.distance || ""} onChange={(e) => updateExercise(idx, { distance: e.target.value })} placeholder="距離" className="flex-1 min-w-0 px-1.5 py-1 rounded border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-400" />
                      <input type="text" value={ex.duration || ""} onChange={(e) => updateExercise(idx, { duration: e.target.value })} placeholder="時間" className="flex-1 min-w-0 px-1.5 py-1 rounded border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-400" />
                      <input type="text" value={ex.pace || ""} onChange={(e) => updateExercise(idx, { pace: e.target.value })} placeholder="ペース" className="flex-1 min-w-0 px-1.5 py-1 rounded border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-400" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input type="text" value={ex.weight} onChange={(e) => updateExercise(idx, { weight: e.target.value })} placeholder="重量" className="w-14 px-1.5 py-1 rounded border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      <input type="number" value={ex.reps} onChange={(e) => updateExercise(idx, { reps: Math.max(0, Number(e.target.value)) })} className="w-12 px-1 py-1 rounded border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      <span className="text-[10px] text-slate-400">回</span>
                      <input type="number" value={ex.sets} onChange={(e) => updateExercise(idx, { sets: Math.max(0, Number(e.target.value)) })} className="w-10 px-1 py-1 rounded border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      <span className="text-[10px] text-slate-400">set</span>
                    </div>
                  )}
                </div>
              ))}
              <div className="relative">
                <button
                  onClick={() => setShowPicker(!showPicker)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  + メニュー追加
                </button>
                {showPicker && (
                  <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-30 max-h-48 overflow-y-auto min-w-[200px]">
                    {menus.filter((m) => m.type === "strength").map((menu) => (
                      <button
                        key={menu.id}
                        onClick={() => addFromMenu(menu)}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-50 text-xs flex justify-between"
                      >
                        <span className="font-medium">{menu.name}</span>
                        <span className="text-slate-400">{menu.defaultWeight}×{menu.defaultReps}×{menu.defaultSets}</span>
                      </button>
                    ))}
                    <button
                      onClick={addRunning}
                      className="w-full px-3 py-2 text-left hover:bg-orange-50 text-xs font-medium text-orange-600"
                    >
                      🏃 ランニング
                    </button>
                    {menus.filter((m) => m.type === "strength").length === 0 && (
                      <p className="px-3 py-2 text-[10px] text-slate-400">設定からメニューを追加</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function DailyNoteInput({ date }: { date: string }) {
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState<NoteSections>({});
  const [mode, setMode] = useState<"closed" | "preview" | "edit">("closed");
  const [saving, setSaving] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // Workout state
  const [workoutChecked, setWorkoutChecked] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [savedWorkout, setSavedWorkout] = useState<WorkoutLog>(null);
  const [menus, setMenus] = useState<ExerciseMenu[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/daily-notes?date=${date}`).then((r) => r.json()),
      fetch(`/api/workout-logs?date=${date}`).then((r) => r.json()),
      fetch("/api/exercise-menus").then((r) => r.json()),
    ]).then(([noteData, workoutData, menuData]) => {
      const saved = noteData?.content || "";
      setContent(saved);
      const stored = loadDraftFromStorage(date);
      if (stored && serializeNote(stored) !== saved) {
        setHasDraft(true);
      } else {
        clearDraftFromStorage(date);
        setHasDraft(false);
      }

      setMenus(menuData);

      if (workoutData && workoutData.exercises) {
        setSavedWorkout(workoutData);
        setWorkoutChecked(true);
        setExercises(workoutData.exercises as Exercise[]);
      } else {
        setSavedWorkout(null);
        setWorkoutChecked(false);
        setExercises([]);
      }
    });
  }, [date]);

  const updateDraft = useCallback((updater: (prev: NoteSections) => NoteSections) => {
    setDraft((prev) => {
      const next = updater(prev);
      saveDraftToStorage(date, next);
      return next;
    });
  }, [date]);

  const handleOpen = () => {
    const stored = loadDraftFromStorage(date);
    if (stored && serializeNote(stored) !== content) {
      setDraft(stored);
      setMode("edit");
      setHasDraft(false);
      return;
    }
    if (content || savedWorkout) {
      setMode("preview");
    } else {
      setDraft({});
      setMode("edit");
    }
  };

  const handleEdit = () => {
    const stored = loadDraftFromStorage(date);
    if (stored && serializeNote(stored) !== content) {
      setDraft(stored);
    } else {
      setDraft(parseNote(content));
    }
    setMode("edit");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const serialized = serializeNote(draft);
      if (serialized !== content) {
        await fetch("/api/daily-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, content: serialized }),
        });
        setContent(serialized);
      }
      clearDraftFromStorage(date);
      setHasDraft(false);

      // Save workout
      if (workoutChecked && exercises.some((e) => e.name.trim())) {
        const filtered = exercises.filter((e) => e.name.trim());
        await fetch("/api/workout-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, exercises: filtered }),
        });
        setSavedWorkout({ exercises: filtered });
        setExercises(filtered);
      } else if (!workoutChecked && savedWorkout) {
        await fetch(`/api/workout-logs?date=${date}`, { method: "DELETE" });
        setSavedWorkout(null);
      }
    } finally {
      setSaving(false);
      setMode("closed");
    }
  };

  const handleClose = () => {
    setMode("closed");
  };

  const handleWorkoutToggle = () => {
    if (!workoutChecked) {
      setWorkoutChecked(true);
      if (exercises.length === 0) {
        // Load previous workout as carry-over
        fetch("/api/workout-logs?startDate=2020-01-01&endDate=" + date)
          .then((r) => r.json())
          .then((prev) => {
            if (Array.isArray(prev) && prev.length > 0) {
              setExercises((prev[0].exercises as Exercise[]).map((e) => ({ ...e })));
            }
          });
      }
    } else {
      setWorkoutChecked(false);
    }
  };

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const parsed = content ? parseNote(content) : {};
  const firstSection = NOTE_SECTIONS.find((s) => parsed[s.key]?.trim());
  const summaryText = firstSection
    ? parsed[firstSection.key]!.split("\n")[0]
    : parsed._free?.split("\n")[0] || "";

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 w-full bg-white rounded-lg border border-slate-200 px-3 py-1.5 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
      >
        <svg
          className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          {savedWorkout && <span className="text-xs flex-shrink-0" title="運動済み">💪</span>}
          {content ? (
            <span className="text-sm text-slate-700 truncate">
              {firstSection && <span className="text-[10px] text-slate-400 mr-1">★{firstSection.label}</span>}
              {summaryText}
            </span>
          ) : (
            <span className="text-sm text-slate-300">今日の一言...</span>
          )}
        </div>
        {hasDraft && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="下書きあり" />}
        <svg
          className="w-3 h-3 text-slate-300 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {mode === "preview" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4 pb-16"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[80dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-base font-bold">今日の一言</h3>
              <span className="text-xs text-slate-400">{dateLabel}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
              {savedWorkout && (
                <WorkoutSection
                  checked
                  exercises={savedWorkout.exercises as Exercise[]}
                  menus={menus}
                  onToggle={() => {}}
                  onUpdate={() => {}}
                  readOnly
                />
              )}

              {NOTE_SECTIONS.filter((s) => parsed[s.key]?.trim()).map((s) => (
                <div key={s.key}>
                  <p className="text-xs font-semibold text-indigo-600 mb-1">★{s.label}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pl-3 border-l-2 border-slate-100">{parsed[s.key]}</p>
                </div>
              ))}
              {parsed._free && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1">メモ</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pl-3 border-l-2 border-slate-100">{parsed._free}</p>
                </div>
              )}
              {!NOTE_SECTIONS.some((s) => parsed[s.key]?.trim()) && !parsed._free && !savedWorkout && (
                <p className="text-sm text-slate-400">（内容なし）</p>
              )}
            </div>
            <div className="flex gap-2 px-5 py-3 border-t border-slate-100 flex-shrink-0">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50"
              >
                閉じる
              </button>
              <button
                onClick={handleEdit}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700"
              >
                編集
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "edit" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4 pb-16"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[80dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-base font-bold">今日の一言</h3>
              <span className="text-xs text-slate-400">{dateLabel}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
              <WorkoutSection
                checked={workoutChecked}
                exercises={exercises}
                menus={menus}
                onToggle={handleWorkoutToggle}
                onUpdate={setExercises}
              />

              {NOTE_SECTIONS.map((s) => (
                <div key={s.key}>
                  <label className="block text-xs font-semibold text-indigo-600 mb-1">★{s.label}</label>
                  <textarea
                    value={draft[s.key] || ""}
                    onChange={(e) => updateDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                    placeholder={s.placeholder}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y leading-relaxed"
                  />
                </div>
              ))}
              {draft._free && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">メモ（旧形式の内容）</label>
                  <textarea
                    value={draft._free || ""}
                    onChange={(e) => updateDraft((d) => ({ ...d, _free: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y leading-relaxed"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 py-3 border-t border-slate-100 flex-shrink-0">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
