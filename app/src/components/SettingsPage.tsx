"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ExpenseIcon, { EXPENSE_ICON_OPTIONS } from "./ExpenseIcon";
import KindleSyncSetup from "./KindleSyncSetup";
import WebClipperSetup from "./WebClipperSetup";
import { SortableList, SortableItem } from "./SortableList";
import { ThemeToggle } from "./ThemeToggle";
import { features } from "@/lib/features";

type Category = { id: string; name: string; excludeFromSummary: boolean };
type Genre = { id: string; name: string; color: string; type: string; subType: string };
type ExpenseCategory = { id: string; name: string; color: string; icon: string };
type MenuWeight = { locationId: string; weight: string };
type ExerciseMenu = { id: string; name: string; defaultWeight: string; weights?: MenuWeight[]; defaultReps: number; defaultSets: number; type: string };
type GymLocation = { id: string; name: string };
type WorkoutRoutine = { id: string; name: string; menuIds: string[] };

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#6b7280", "#92400e",
];

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newGenreName, setNewGenreName] = useState("");
  const [newGenreColor, setNewGenreColor] = useState("#6366f1");
  const [newGenreType, setNewGenreType] = useState<"投資" | "経費" | "付随">("経費");
  const [newGenreSubType, setNewGenreSubType] = useState<"投資的" | "経費的">("経費的");
  const [newExpCatName, setNewExpCatName] = useState("");
  const [newExpCatColor, setNewExpCatColor] = useState("#6b7280");
  const [newExpCatIcon, setNewExpCatIcon] = useState("default");
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingGenre, setEditingGenre] = useState<Genre | null>(null);
  const [editingExpCat, setEditingExpCat] = useState<ExpenseCategory | null>(null);
  const [exerciseMenus, setExerciseMenus] = useState<ExerciseMenu[]>([]);
  const [newMenuName, setNewMenuName] = useState("");
  const [newMenuWeight, setNewMenuWeight] = useState("");
  const [newMenuReps, setNewMenuReps] = useState(10);
  const [newMenuSets, setNewMenuSets] = useState(3);
  const [editingMenu, setEditingMenu] = useState<ExerciseMenu | null>(null);
  // 場所 (ジム) マスタ
  const [gymLocations, setGymLocations] = useState<GymLocation[]>([]);
  const [newLocationName, setNewLocationName] = useState("");
  const [editingLocation, setEditingLocation] = useState<GymLocation | null>(null);
  // 筋トレルーティン
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [editingRoutine, setEditingRoutine] = useState<WorkoutRoutine | null>(null);
  // NOTE: fetchData 冒頭の setFetching(true) は react-hooks/set-state-in-effect
  // ルールを満たすために必要（非同期 setState だけだと effect 内から呼び出せない）。
  const [, setFetching] = useState(false);
  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const [cats, gnrs, expCats, exMenus, locs, routs] = await Promise.all([
        fetch("/api/categories").then((r) => r.json()),
        fetch("/api/genres").then((r) => r.json()),
        fetch("/api/expense-categories").then((r) => r.json()),
        fetch("/api/exercise-menus").then((r) => r.json()),
        fetch("/api/gym-locations").then((r) => r.json()),
        fetch("/api/workout-routines").then((r) => r.json()),
      ]);
      setCategories(cats);
      setGenres(gnrs);
      setExpenseCategories(expCats);
      setExerciseMenus(exMenus);
      setGymLocations(locs);
      setRoutines(routs);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Category CRUD
  const addCategory = async () => {
    if (!newCatName.trim()) return;
    await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCatName.trim() }) });
    setNewCatName(""); fetchData();
  };
  const updateCategory = async () => {
    if (!editingCat) return;
    await fetch("/api/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingCat) });
    setEditingCat(null); fetchData();
  };
  const deleteCategory = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/categories?id=${id}`, { method: "DELETE" }); fetchData();
  };
  const moveCatOrder = async (index: number, dir: -1 | 1) => {
    const list = [...categories];
    const t = index + dir;
    if (t < 0 || t >= list.length) return;
    [list[index], list[t]] = [list[t], list[index]];
    setCategories(list);
    await fetch("/api/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reorder: true, ids: list.map(c => c.id) }) });
  };

  // Genre CRUD
  const addGenre = async () => {
    if (!newGenreName.trim()) return;
    await fetch("/api/genres", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newGenreName.trim(), color: newGenreColor, type: newGenreType, subType: newGenreType === "付随" ? "" : newGenreSubType }) });
    setNewGenreName(""); fetchData();
  };
  const updateGenre = async () => {
    if (!editingGenre) return;
    await fetch("/api/genres", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingGenre) });
    setEditingGenre(null); fetchData();
  };
  const deleteGenre = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/genres?id=${id}`, { method: "DELETE" }); fetchData();
  };
  const moveGenreOrder = async (index: number, dir: -1 | 1) => {
    const list = [...genres];
    const t = index + dir;
    if (t < 0 || t >= list.length) return;
    [list[index], list[t]] = [list[t], list[index]];
    setGenres(list);
    await fetch("/api/genres", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reorder: true, ids: list.map(g => g.id) }) });
  };

  // Expense Category CRUD
  const addExpenseCategory = async () => {
    if (!newExpCatName.trim()) return;
    await fetch("/api/expense-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newExpCatName.trim(), color: newExpCatColor, icon: newExpCatIcon }) });
    setNewExpCatName(""); fetchData();
  };
  const updateExpenseCategory = async () => {
    if (!editingExpCat) return;
    await fetch("/api/expense-categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingExpCat) });
    setEditingExpCat(null); fetchData();
  };
  const deleteExpenseCategory = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/expense-categories?id=${id}`, { method: "DELETE" }); fetchData();
  };
  const moveExpCatOrder = async (index: number, dir: -1 | 1) => {
    const list = [...expenseCategories];
    const t = index + dir;
    if (t < 0 || t >= list.length) return;
    [list[index], list[t]] = [list[t], list[index]];
    setExpenseCategories(list);
    await fetch("/api/expense-categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reorder: true, ids: list.map(c => c.id) }) });
  };

  // Exercise menu CRUD
  const addExerciseMenu = async () => {
    if (!newMenuName.trim()) return;
    await fetch("/api/exercise-menus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newMenuName.trim(), defaultWeight: newMenuWeight, defaultReps: newMenuReps, defaultSets: newMenuSets }),
    });
    setNewMenuName(""); setNewMenuWeight(""); setNewMenuReps(10); setNewMenuSets(3);
    fetchData();
  };
  const updateExerciseMenu = async () => {
    if (!editingMenu) return;
    await fetch("/api/exercise-menus", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingMenu) });
    setEditingMenu(null); fetchData();
  };
  const deleteExerciseMenu = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/exercise-menus?id=${id}`, { method: "DELETE" }); fetchData();
  };
  // 長押しドラッグ並び替え (筋トレメニュー専用)。新しい順序の id 配列を受け取って bulk update。
  const reorderExerciseMenus = async (newIds: string[]) => {
    const ordered = newIds.map((id) => exerciseMenus.find((m) => m.id === id)!).filter(Boolean);
    setExerciseMenus(ordered);
    await fetch("/api/exercise-menus", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder: true, ids: newIds }),
    });
  };

  // 場所 (ジム) CRUD
  const addLocation = async () => {
    if (!newLocationName.trim()) return;
    await fetch("/api/gym-locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newLocationName.trim() }) });
    setNewLocationName(""); fetchData();
  };
  const updateLocation = async () => {
    if (!editingLocation) return;
    await fetch("/api/gym-locations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingLocation) });
    setEditingLocation(null); fetchData();
  };
  const deleteLocation = async (id: string) => {
    if (!confirm("この場所を削除しますか？（メニューの場所別重量からも消えます）")) return;
    await fetch(`/api/gym-locations?id=${id}`, { method: "DELETE" }); fetchData();
  };

  // ルーティン CRUD
  const addRoutine = async () => {
    if (!newRoutineName.trim()) return;
    await fetch("/api/workout-routines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newRoutineName.trim(), menuIds: [] }) });
    setNewRoutineName(""); fetchData();
  };
  const updateRoutine = async () => {
    if (!editingRoutine) return;
    await fetch("/api/workout-routines", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingRoutine) });
    setEditingRoutine(null); fetchData();
  };
  const deleteRoutine = async (id: string) => {
    if (!confirm("このルーティンを削除しますか？")) return;
    await fetch(`/api/workout-routines?id=${id}`, { method: "DELETE" }); fetchData();
  };
  const toggleRoutineMenu = (menuId: string) => {
    if (!editingRoutine) return;
    const has = editingRoutine.menuIds.includes(menuId);
    setEditingRoutine({
      ...editingRoutine,
      menuIds: has ? editingRoutine.menuIds.filter((m) => m !== menuId) : [...editingRoutine.menuIds, menuId],
    });
  };

  const ArrowButtons = ({ index, total, onMove }: { index: number; total: number; onMove: (i: number, d: -1 | 1) => void }) => (
    <div className="flex flex-col gap-0.5">
      <button onClick={() => onMove(index, -1)} disabled={index === 0} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-20">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 15l7-7 7 7" /></svg>
      </button>
      <button onClick={() => onMove(index, 1)} disabled={index === total - 1} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-20">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 9l-7 7-7-7" /></svg>
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-40 px-4 py-3">
        <h1 className="text-lg font-bold text-center max-w-lg mx-auto">設定</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20 max-w-lg mx-auto w-full space-y-6">
        {/* テーマ切替 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold">テーマ</h2>
          </div>
          <div className="px-4 py-3">
            <ThemeToggle />
          </div>
        </div>
        <KindleSyncSetup />
        {features.webClipper && <WebClipperSetup />}
        {/* Fixed Expenses Link */}
        <Link
          href="/fixed-expenses"
          className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M9 14l6-6M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z" />
            </svg>
            <span className="text-sm font-semibold">固定費設定</span>
          </div>
          <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Categories */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800"><h2 className="text-sm font-semibold">カテゴリ</h2></div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {categories.map((cat, i) => (
              <div key={cat.id} className="px-4 py-3 flex items-center justify-between">
                {editingCat?.id === cat.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input type="text" value={editingCat.name} onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })} className="flex-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button onClick={updateCategory} className="text-xs text-indigo-600 font-medium">保存</button>
                    <button onClick={() => setEditingCat(null)} className="text-xs text-slate-400 dark:text-slate-500">取消</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <ArrowButtons index={i} total={categories.length} onMove={moveCatOrder} />
                      <span className="text-sm">{cat.name}</span>
                      {cat.excludeFromSummary && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 font-medium">サマリ除外</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          await fetch("/api/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: cat.id, name: cat.name, excludeFromSummary: !cat.excludeFromSummary }) });
                          fetchData();
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cat.excludeFromSummary ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}
                      >
                        {cat.excludeFromSummary ? "サマリ除外中" : "サマリ含む"}
                      </button>
                      <button onClick={() => setEditingCat(cat)} className="text-xs text-indigo-600">編集</button>
                      <button onClick={() => deleteCategory(cat.id)} className="text-xs text-red-500">削除</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} placeholder="新しいカテゴリ" className="flex-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={addCategory} disabled={!newCatName.trim()} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300">追加</button>
          </div>
        </div>

        {/* Genres */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800"><h2 className="text-sm font-semibold">ジャンル</h2></div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {genres.map((genre, i) => (
              <div key={genre.id} className="px-4 py-3">
                {editingGenre?.id === genre.id ? (
                  <div className="space-y-2">
                    <input type="text" value={editingGenre.name} onChange={(e) => setEditingGenre({ ...editingGenre, name: e.target.value })} className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <div className="flex gap-1">
                      <button onClick={() => setEditingGenre({ ...editingGenre, type: "投資", subType: "投資的" })} className={`px-3 py-1 rounded-full text-xs font-medium border ${editingGenre.type === "投資" ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}>投資</button>
                      <button onClick={() => setEditingGenre({ ...editingGenre, type: "経費", subType: "経費的" })} className={`px-3 py-1 rounded-full text-xs font-medium border ${editingGenre.type === "経費" ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}>経費</button>
                      <button onClick={() => setEditingGenre({ ...editingGenre, type: "付随", subType: "" })} className={`px-3 py-1 rounded-full text-xs font-medium border ${editingGenre.type === "付随" ? "bg-red-100 text-red-700 border-red-300" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}>付随</button>
                    </div>
                    {editingGenre.type !== "付随" && (
                      <div className="flex gap-1">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 self-center mr-1">性質:</span>
                        <button onClick={() => setEditingGenre({ ...editingGenre, subType: "投資的" })} className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${editingGenre.subType === "投資的" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}>投資的</button>
                        <button onClick={() => setEditingGenre({ ...editingGenre, subType: "経費的" })} className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${editingGenre.subType === "経費的" ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}>経費的</button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {COLORS.map((c) => (
                        <button key={c} onClick={() => setEditingGenre({ ...editingGenre, color: c })} className={`w-7 h-7 rounded-full border-2 ${editingGenre.color === c ? "border-slate-800 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={updateGenre} className="text-xs text-indigo-600 font-medium">保存</button>
                      <button onClick={() => setEditingGenre(null)} className="text-xs text-slate-400 dark:text-slate-500">取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowButtons index={i} total={genres.length} onMove={moveGenreOrder} />
                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: genre.color }} />
                      <span className="text-sm">{genre.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${genre.type === "投資" ? "bg-blue-100 text-blue-600" : genre.type === "付随" ? "bg-red-100 text-red-600" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>{genre.type || "経費"}</span>
                      {genre.type !== "付随" && genre.subType && (
                        <span className={`text-[9px] px-1 py-0.5 rounded-full font-medium ${genre.subType === "投資的" ? "bg-blue-50 text-blue-500" : "bg-amber-50 text-amber-500"}`}>{genre.subType}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingGenre(genre)} className="text-xs text-indigo-600">編集</button>
                      <button onClick={() => deleteGenre(genre.id)} className="text-xs text-red-500">削除</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <input type="text" value={newGenreName} onChange={(e) => setNewGenreName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGenre()} placeholder="新しいジャンル" className="flex-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={addGenre} disabled={!newGenreName.trim()} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300">追加</button>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setNewGenreType("投資"); setNewGenreSubType("投資的"); }} className={`px-3 py-1 rounded-full text-xs font-medium border ${newGenreType === "投資" ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}>投資</button>
              <button onClick={() => { setNewGenreType("経費"); setNewGenreSubType("経費的"); }} className={`px-3 py-1 rounded-full text-xs font-medium border ${newGenreType === "経費" ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}>経費</button>
              <button onClick={() => setNewGenreType("付随")} className={`px-3 py-1 rounded-full text-xs font-medium border ${newGenreType === "付随" ? "bg-red-100 text-red-700 border-red-300" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}>付随</button>
            </div>
            {newGenreType !== "付随" && (
              <div className="flex gap-1">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 self-center mr-1">性質:</span>
                <button onClick={() => setNewGenreSubType("投資的")} className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${newGenreSubType === "投資的" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}>投資的</button>
                <button onClick={() => setNewGenreSubType("経費的")} className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${newGenreSubType === "経費的" ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}>経費的</button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setNewGenreColor(c)} className={`w-6 h-6 rounded-full border-2 ${newGenreColor === c ? "border-slate-800 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>

        {/* Expense Categories */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800"><h2 className="text-sm font-semibold">家計簿カテゴリ</h2></div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {expenseCategories.map((cat, i) => (
              <div key={cat.id} className="px-4 py-3">
                {editingExpCat?.id === cat.id ? (
                  <div className="space-y-2">
                    <input type="text" value={editingExpCat.name} onChange={(e) => setEditingExpCat({ ...editingExpCat, name: e.target.value })} className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <div className="flex flex-wrap gap-1.5">
                      {COLORS.map((c) => (
                        <button key={c} onClick={() => setEditingExpCat({ ...editingExpCat, color: c })} className={`w-7 h-7 rounded-full border-2 ${editingExpCat.color === c ? "border-slate-800 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {EXPENSE_ICON_OPTIONS.map((ic) => (
                        <button key={ic} onClick={() => setEditingExpCat({ ...editingExpCat, icon: ic })} className={`p-1.5 rounded border ${editingExpCat.icon === ic ? "border-indigo-500 bg-indigo-50" : "border-slate-200 dark:border-slate-700"}`}>
                          <ExpenseIcon icon={ic} color={editingExpCat.color} size={18} />
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={updateExpenseCategory} className="text-xs text-indigo-600 font-medium">保存</button>
                      <button onClick={() => setEditingExpCat(null)} className="text-xs text-slate-400 dark:text-slate-500">取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowButtons index={i} total={expenseCategories.length} onMove={moveExpCatOrder} />
                      <ExpenseIcon icon={cat.icon} color={cat.color} size={18} />
                      <span className="text-sm">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingExpCat(cat)} className="text-xs text-indigo-600">編集</button>
                      <button onClick={() => deleteExpenseCategory(cat.id)} className="text-xs text-red-500">削除</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <input type="text" value={newExpCatName} onChange={(e) => setNewExpCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addExpenseCategory()} placeholder="新しい家計簿カテゴリ" className="flex-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={addExpenseCategory} disabled={!newExpCatName.trim()} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300">追加</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setNewExpCatColor(c)} className={`w-6 h-6 rounded-full border-2 ${newExpCatColor === c ? "border-slate-800 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_ICON_OPTIONS.slice(0, 12).map((ic) => (
                <button key={ic} onClick={() => setNewExpCatIcon(ic)} className={`p-1 rounded border ${newExpCatIcon === ic ? "border-indigo-500 bg-indigo-50" : "border-slate-200 dark:border-slate-700"}`}>
                  <ExpenseIcon icon={ic} color={newExpCatColor} size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Exercise Menus */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800"><h2 className="text-sm font-semibold">筋トレメニュー</h2></div>
          <SortableList ids={exerciseMenus.map((m) => m.id)} onReorder={reorderExerciseMenus}>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {exerciseMenus.map((menu) => (
                <SortableItem key={menu.id} id={menu.id}>
                  {({ listeners, setActivatorNodeRef, isDragging, handleStyle }) => (
                    <div className={`px-4 py-3 ${isDragging ? "bg-indigo-50 shadow-lg" : "bg-white dark:bg-slate-900"}`}>
                      {editingMenu?.id === menu.id ? (
                        <div className="space-y-2">
                          <input type="text" value={editingMenu.name} onChange={(e) => setEditingMenu({ ...editingMenu, name: e.target.value })} className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          <div className="flex gap-1">
                            <button onClick={() => setEditingMenu({ ...editingMenu, type: "strength" })} className={`px-3 py-1 rounded-full text-xs font-medium border ${editingMenu.type === "strength" ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}>筋トレ</button>
                            <button onClick={() => setEditingMenu({ ...editingMenu, type: "running" })} className={`px-3 py-1 rounded-full text-xs font-medium border ${editingMenu.type === "running" ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}>ランニング</button>
                          </div>
                          {editingMenu.type !== "running" && (
                            <>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <input type="text" value={editingMenu.defaultWeight} onChange={(e) => setEditingMenu({ ...editingMenu, defaultWeight: e.target.value })} placeholder="重量" className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500">kg(既定)</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input type="number" value={editingMenu.defaultReps} onChange={(e) => setEditingMenu({ ...editingMenu, defaultReps: Math.max(0, Number(e.target.value)) })} className="w-14 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500">回</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input type="number" value={editingMenu.defaultSets} onChange={(e) => setEditingMenu({ ...editingMenu, defaultSets: Math.max(0, Number(e.target.value)) })} className="w-12 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500">set</span>
                                </div>
                              </div>
                              {gymLocations.length > 0 && (
                                <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500">場所別の重量 (空欄なら既定値)</p>
                                  {gymLocations.map((loc) => {
                                    const cur = (editingMenu.weights ?? []).find((w) => w.locationId === loc.id)?.weight ?? "";
                                    return (
                                      <div key={loc.id} className="flex items-center gap-2">
                                        <span className="text-xs w-20 truncate text-slate-600 dark:text-slate-300">{loc.name}</span>
                                        <input
                                          type="text"
                                          value={cur}
                                          onChange={(e) => {
                                            const others = (editingMenu.weights ?? []).filter((w) => w.locationId !== loc.id);
                                            const next = e.target.value === "" ? others : [...others, { locationId: loc.id, weight: e.target.value }];
                                            setEditingMenu({ ...editingMenu, weights: next });
                                          }}
                                          placeholder="重量"
                                          className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">kg</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          )}
                          <div className="flex gap-2">
                            <button onClick={updateExerciseMenu} className="text-xs text-indigo-600 font-medium">保存</button>
                            <button onClick={() => setEditingMenu(null)} className="text-xs text-slate-400 dark:text-slate-500">取消</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span
                              ref={setActivatorNodeRef}
                              {...listeners}
                              style={handleStyle}
                              className="text-slate-400 dark:text-slate-500 text-lg leading-none cursor-grab active:cursor-grabbing select-none px-1 py-1"
                              title="長押ししてドラッグで並び替え"
                            >⋮⋮</span>
                            <span className="text-sm">{menu.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${menu.type === "running" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"}`}>
                              {menu.type === "running" ? "ランニング" : "筋トレ"}
                            </span>
                            {menu.type !== "running" && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {menu.defaultWeight && `${menu.defaultWeight}kg `}{menu.defaultReps}回×{menu.defaultSets}set
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => setEditingMenu(menu)} className="text-xs text-indigo-600">編集</button>
                            <button onClick={() => deleteExerciseMenu(menu.id)} className="text-xs text-red-500">削除</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableList>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <input type="text" value={newMenuName} onChange={(e) => setNewMenuName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addExerciseMenu()} placeholder="新しいメニュー名" className="flex-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={addExerciseMenu} disabled={!newMenuName.trim()} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300">追加</button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input type="text" value={newMenuWeight} onChange={(e) => setNewMenuWeight(e.target.value)} placeholder="重量" className="w-16 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                <span className="text-[10px] text-slate-400 dark:text-slate-500">kg</span>
              </div>
              <div className="flex items-center gap-1">
                <input type="number" value={newMenuReps} onChange={(e) => setNewMenuReps(Math.max(0, Number(e.target.value)))} className="w-14 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                <span className="text-[10px] text-slate-400 dark:text-slate-500">回</span>
              </div>
              <div className="flex items-center gap-1">
                <input type="number" value={newMenuSets} onChange={(e) => setNewMenuSets(Math.max(0, Number(e.target.value)))} className="w-12 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                <span className="text-[10px] text-slate-400 dark:text-slate-500">set</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gym Locations (場所) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold">場所 (ジム)</h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">場所ごとに使える重量が違う場合に登録。各メニュー編集で場所別の重量を設定できます。</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {gymLocations.map((loc) => (
              <div key={loc.id} className="px-4 py-3 flex items-center justify-between">
                {editingLocation?.id === loc.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input type="text" value={editingLocation.name} onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })} className="flex-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button onClick={updateLocation} className="text-xs text-indigo-600 font-medium">保存</button>
                    <button onClick={() => setEditingLocation(null)} className="text-xs text-slate-400 dark:text-slate-500">取消</button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm">{loc.name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingLocation(loc)} className="text-xs text-indigo-600">編集</button>
                      <button onClick={() => deleteLocation(loc.id)} className="text-xs text-red-500">削除</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <input type="text" value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLocation()} placeholder="新しい場所 (例: 自宅ジム)" className="flex-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={addLocation} disabled={!newLocationName.trim()} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300">追加</button>
          </div>
        </div>

        {/* Workout Routines (ルーティン) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold">筋トレルーティン</h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">「上半身A」等のメニュー群。記録時にまとめて追加できます。</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {routines.map((r) => (
              <div key={r.id} className="px-4 py-3">
                {editingRoutine?.id === r.id ? (
                  <div className="space-y-2">
                    <input type="text" value={editingRoutine.name} onChange={(e) => setEditingRoutine({ ...editingRoutine, name: e.target.value })} className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">含めるメニュー (タップで選択)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {exerciseMenus.map((m) => {
                        const selected = editingRoutine.menuIds.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            onClick={() => toggleRoutineMenu(m.id)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border ${selected ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"}`}
                          >
                            {selected ? `${editingRoutine.menuIds.indexOf(m.id) + 1}. ` : ""}{m.name}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={updateRoutine} className="text-xs text-indigo-600 font-medium">保存</button>
                      <button onClick={() => setEditingRoutine(null)} className="text-xs text-slate-400 dark:text-slate-500">取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{r.name}</span>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {r.menuIds.length > 0
                          ? r.menuIds.map((id) => exerciseMenus.find((m) => m.id === id)?.name).filter(Boolean).join(" / ")
                          : "メニュー未設定"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setEditingRoutine(r)} className="text-xs text-indigo-600">編集</button>
                      <button onClick={() => deleteRoutine(r.id)} className="text-xs text-red-500">削除</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <input type="text" value={newRoutineName} onChange={(e) => setNewRoutineName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRoutine()} placeholder="新しいルーティン (例: 上半身A)" className="flex-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={addRoutine} disabled={!newRoutineName.trim()} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300">追加</button>
          </div>
        </div>
      </div>
    </div>
  );
}
