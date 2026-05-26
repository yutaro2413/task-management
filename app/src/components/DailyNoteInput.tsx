"use client";

import { useState, useEffect, useCallback } from "react";
import { NOTE_SECTIONS, NoteSections, parseNote, serializeNote } from "@/lib/dailyNote";
import { SortableList, SortableItem } from "./SortableList";
import { resolveMenuWeight, type MenuWeight } from "@/lib/menuWeights";

const DRAFT_KEY_PREFIX = "dailyNote-draft-";

type ExerciseMenu = {
  id: string;
  name: string;
  defaultWeight: string;
  weights?: MenuWeight[];
  defaultReps: number;
  defaultSets: number;
  type: string;
};

type GymLocation = { id: string; name: string };
type WorkoutRoutine = { id: string; name: string; menuIds: string[] };

const LOCATION_STORAGE_KEY = "workoutSelectedLocation";

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
  locations,
  routines,
  selectedLocationId,
  onSelectLocation,
  onToggle,
  onUpdate,
  readOnly,
}: {
  checked: boolean;
  exercises: Exercise[];
  menus: ExerciseMenu[];
  locations: GymLocation[];
  routines: WorkoutRoutine[];
  selectedLocationId: string | null;
  onSelectLocation: (id: string | null) => void;
  onToggle: () => void;
  onUpdate: (exercises: Exercise[]) => void;
  readOnly?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);

  // メニューを 1 件 Exercise に変換 (選択中の場所の重量を適用)
  const menuToExercise = (menu: ExerciseMenu): Exercise => ({
    menuId: menu.id,
    name: menu.name,
    weight: menu.type === "running" ? "" : resolveMenuWeight(menu, selectedLocationId),
    reps: menu.defaultReps,
    sets: menu.defaultSets,
    type: menu.type,
  });

  const addFromMenu = (menu: ExerciseMenu) => {
    onUpdate([...exercises, menuToExercise(menu)]);
    setShowPicker(false);
  };

  // ルーティンを適用: 含まれるメニューを順に「追加」(既存はそのまま)
  const applyRoutine = (routine: WorkoutRoutine) => {
    const toAdd = routine.menuIds
      .map((id) => menus.find((m) => m.id === id))
      .filter((m): m is ExerciseMenu => Boolean(m))
      .map(menuToExercise);
    if (toAdd.length === 0) return;
    onUpdate([...exercises, ...toAdd]);
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

  // 各エクササイズに表示順依存の id を付与 (dnd-kit 用)。Drop 時に index ベースで再構成する。
  const idFor = (idx: number) => `ex-${idx}`;
  const reorderExercises = (newIds: string[]) => {
    const newOrder = newIds.map((id) => exercises[parseInt(id.replace("ex-", ""), 10)]);
    onUpdate(newOrder);
  };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-medium transition-colors ${
          checked ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400"
        }`}
      >
        <span className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
          checked ? "bg-emerald-500 border-emerald-500" : "border-slate-300 dark:border-slate-600"
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
        <div className="px-3 py-2 space-y-2 border-t border-slate-100 dark:border-slate-800">
          {/* 場所セレクタ + ルーティン (編集時のみ) */}
          {!readOnly && locations.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">場所:</span>
              <button
                onClick={() => onSelectLocation(null)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${selectedLocationId === null ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}
              >既定</button>
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => onSelectLocation(loc.id)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${selectedLocationId === loc.id ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}
                >{loc.name}</button>
              ))}
            </div>
          )}
          {!readOnly && routines.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">ルーティン追加:</span>
              {routines.map((r) => (
                <button
                  key={r.id}
                  onClick={() => applyRoutine(r)}
                  className="px-2 py-0.5 rounded-full text-[11px] font-medium border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                >+ {r.name}</button>
              ))}
            </div>
          )}
          {readOnly ? (
            exercises.length > 0 ? (
              <div className="space-y-1">
                {exercises.map((ex, i) => (
                  <p key={i} className="text-sm text-slate-700 dark:text-slate-200">
                    {ex.type === "running"
                      ? `${ex.name} — ${ex.distance || "?"} / ${ex.duration || "?"} / ${ex.pace || "?"}`
                      : `${ex.name} — ${ex.weight} × ${ex.reps}回 × ${ex.sets}set`}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">メニュー未入力</p>
            )
          ) : (
            <SortableList ids={exercises.map((_, i) => idFor(i))} onReorder={reorderExercises}>
              {exercises.map((ex, idx) => (
                <SortableItem key={idFor(idx)} id={idFor(idx)}>
                  {({ listeners, setActivatorNodeRef, isDragging, handleStyle }) => (
                    <div className={`rounded border p-2 mb-2 ${ex.type === "running" ? "border-orange-200 bg-orange-50/30" : "border-slate-100 dark:border-slate-800"} ${isDragging ? "shadow-lg ring-2 ring-emerald-300" : ""}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span
                            ref={setActivatorNodeRef}
                            {...listeners}
                            style={handleStyle}
                            className="text-slate-400 dark:text-slate-500 text-base leading-none cursor-grab active:cursor-grabbing select-none px-1 py-1"
                            title="長押ししてドラッグで並び替え"
                          >⋮⋮</span>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{ex.name}</span>
                        </div>
                        <button onClick={() => removeExercise(idx)} className="p-0.5 text-slate-300 dark:text-slate-600 hover:text-red-500 flex-shrink-0" aria-label="削除">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      {ex.type === "running" ? (
                        <div className="flex gap-1">
                          <input type="text" value={ex.distance || ""} onChange={(e) => updateExercise(idx, { distance: e.target.value })} placeholder="距離" className="flex-1 min-w-0 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-400" />
                          <input type="text" value={ex.duration || ""} onChange={(e) => updateExercise(idx, { duration: e.target.value })} placeholder="時間" className="flex-1 min-w-0 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-400" />
                          <input type="text" value={ex.pace || ""} onChange={(e) => updateExercise(idx, { pace: e.target.value })} placeholder="ペース" className="flex-1 min-w-0 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-400" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input type="text" value={ex.weight} onChange={(e) => updateExercise(idx, { weight: e.target.value })} placeholder="重量" className="w-14 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                          <input type="number" value={ex.reps} onChange={(e) => updateExercise(idx, { reps: Math.max(0, Number(e.target.value)) })} className="w-12 px-1 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">回</span>
                          <input type="number" value={ex.sets} onChange={(e) => updateExercise(idx, { sets: Math.max(0, Number(e.target.value)) })} className="w-10 px-1 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">set</span>
                        </div>
                      )}
                    </div>
                  )}
                </SortableItem>
              ))}
            </SortableList>
          )}
          {!readOnly && (
            <>
              <button
                onClick={() => setShowPicker(true)}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                + メニュー追加
              </button>
              {showPicker && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => setShowPicker(false)}>
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="relative bg-white dark:bg-slate-900 rounded-t-2xl w-full max-w-lg max-h-[50vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
                    <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-bold">メニュー選択</span>
                      <button onClick={() => setShowPicker(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 pb-20">
                      {menus.filter((m) => m.type === "strength").map((menu) => (
                        <button
                          key={menu.id}
                          onClick={() => addFromMenu(menu)}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between"
                        >
                          <span className="text-sm font-medium">{menu.name}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">{menu.defaultWeight} × {menu.defaultReps}回 × {menu.defaultSets}set</span>
                        </button>
                      ))}
                      <button
                        onClick={addRunning}
                        className="w-full px-4 py-3 text-left hover:bg-orange-50 flex items-center gap-2"
                      >
                        <span className="text-sm font-medium text-orange-600">🏃 ランニング</span>
                      </button>
                      {menus.filter((m) => m.type === "strength").length === 0 && (
                        <p className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">設定からメニューを追加してください</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
  const [locations, setLocations] = useState<GymLocation[]>([]);
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  // 選択中の場所を localStorage に永続化 (記録のたびに選び直さなくていい)
  const selectLocation = useCallback((id: string | null) => {
    setSelectedLocationId(id);
    if (id) localStorage.setItem(LOCATION_STORAGE_KEY, id);
    else localStorage.removeItem(LOCATION_STORAGE_KEY);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`/api/daily-notes?date=${date}`).then((r) => r.json()),
      fetch(`/api/workout-logs?date=${date}`).then((r) => r.json()),
      fetch("/api/exercise-menus").then((r) => r.json()),
      fetch("/api/gym-locations").then((r) => r.json()),
      fetch("/api/workout-routines").then((r) => r.json()),
    ]).then(([noteData, workoutData, menuData, locData, routData]) => {
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
      if (Array.isArray(locData)) setLocations(locData);
      if (Array.isArray(routData)) setRoutines(routData);
      // 保存済みの選択場所を復元 (存在チェック)
      const storedLoc = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (storedLoc && Array.isArray(locData) && locData.some((l: GymLocation) => l.id === storedLoc)) {
        setSelectedLocationId(storedLoc);
      }

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
        className="flex items-center gap-2 w-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition-colors"
      >
        <svg
          className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0"
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
            <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
              {firstSection && <span className="text-[10px] text-slate-400 dark:text-slate-500 mr-1">★{firstSection.label}</span>}
              {summaryText}
            </span>
          ) : (
            <span className="text-sm text-slate-300 dark:text-slate-600">今日の一言...</span>
          )}
        </div>
        {hasDraft && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="下書きあり" />}
        <svg
          className="w-3 h-3 text-slate-300 dark:text-slate-600 flex-shrink-0"
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
            className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[80dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
              <h3 className="text-base font-bold">今日の一言</h3>
              <span className="text-xs text-slate-400 dark:text-slate-500">{dateLabel}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
              {savedWorkout && (
                <WorkoutSection
                  checked
                  exercises={savedWorkout.exercises as Exercise[]}
                  menus={menus}
                  locations={locations}
                  routines={routines}
                  selectedLocationId={selectedLocationId}
                  onSelectLocation={selectLocation}
                  onToggle={() => {}}
                  onUpdate={() => {}}
                  readOnly
                />
              )}

              {NOTE_SECTIONS.filter((s) => parsed[s.key]?.trim()).map((s) => (
                <div key={s.key}>
                  <p className="text-xs font-semibold text-indigo-600 mb-1">★{s.label}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed pl-3 border-l-2 border-slate-100 dark:border-slate-800">{parsed[s.key]}</p>
                </div>
              ))}
              {parsed._free && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">メモ</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed pl-3 border-l-2 border-slate-100 dark:border-slate-800">{parsed._free}</p>
                </div>
              )}
              {!NOTE_SECTIONS.some((s) => parsed[s.key]?.trim()) && !parsed._free && !savedWorkout && (
                <p className="text-sm text-slate-400 dark:text-slate-500">（内容なし）</p>
              )}
            </div>
            <div className="flex gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
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
            className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[80dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
              <h3 className="text-base font-bold">今日の一言</h3>
              <span className="text-xs text-slate-400 dark:text-slate-500">{dateLabel}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
              <WorkoutSection
                checked={workoutChecked}
                exercises={exercises}
                menus={menus}
                locations={locations}
                routines={routines}
                selectedLocationId={selectedLocationId}
                onSelectLocation={selectLocation}
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y leading-relaxed"
                  />
                </div>
              ))}
              {draft._free && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">メモ（旧形式の内容）</label>
                  <textarea
                    value={draft._free || ""}
                    onChange={(e) => updateDraft((d) => ({ ...d, _free: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y leading-relaxed"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
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
