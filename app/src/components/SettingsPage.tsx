"use client";

import { useState, useEffect, useCallback } from "react";
import ExpenseIcon, { EXPENSE_ICON_OPTIONS } from "./ExpenseIcon";

type Category = { id: string; name: string };
type Genre = { id: string; name: string; color: string };
type ExpenseCategory = { id: string; name: string; color: string; icon: string };

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
  const [newExpCatName, setNewExpCatName] = useState("");
  const [newExpCatColor, setNewExpCatColor] = useState("#6b7280");
  const [newExpCatIcon, setNewExpCatIcon] = useState("default");
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingGenre, setEditingGenre] = useState<Genre | null>(null);
  const [editingExpCat, setEditingExpCat] = useState<ExpenseCategory | null>(null);
  const [seeding, setSeeding] = useState(false);

  const fetchData = useCallback(async () => {
    const [cats, gnrs, expCats] = await Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/genres").then((r) => r.json()),
      fetch("/api/expense-categories").then((r) => r.json()),
    ]);
    setCategories(cats);
    setGenres(gnrs);
    setExpenseCategories(expCats);
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
    await fetch("/api/genres", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newGenreName.trim(), color: newGenreColor }) });
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

  const seedData = async () => {
    setSeeding(true);
    await fetch("/api/seed", { method: "POST" });
    await fetchData();
    setSeeding(false);
  };

  const ArrowButtons = ({ index, total, onMove }: { index: number; total: number; onMove: (i: number, d: -1 | 1) => void }) => (
    <div className="flex flex-col gap-0.5">
      <button onClick={() => onMove(index, -1)} disabled={index === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-20">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 15l7-7 7 7" /></svg>
      </button>
      <button onClick={() => onMove(index, 1)} disabled={index === total - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-20">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 9l-7 7-7-7" /></svg>
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4 py-3">
        <h1 className="text-lg font-bold text-center max-w-lg mx-auto">設定</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full space-y-6">
        {/* Seed button for initial data */}
        {expenseCategories.length === 0 && (
          <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200 text-center">
            <p className="text-sm text-indigo-700 mb-2">家計簿カテゴリなどの初期データを作成</p>
            <button onClick={seedData} disabled={seeding} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
              {seeding ? "作成中..." : "初期データを作成"}
            </button>
          </div>
        )}

        {/* Categories */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100"><h2 className="text-sm font-semibold">カテゴリ</h2></div>
          <div className="divide-y divide-slate-100">
            {categories.map((cat, i) => (
              <div key={cat.id} className="px-4 py-3 flex items-center justify-between">
                {editingCat?.id === cat.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input type="text" value={editingCat.name} onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })} className="flex-1 px-2 py-1 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button onClick={updateCategory} className="text-xs text-indigo-600 font-medium">保存</button>
                    <button onClick={() => setEditingCat(null)} className="text-xs text-slate-400">取消</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <ArrowButtons index={i} total={categories.length} onMove={moveCatOrder} />
                      <span className="text-sm">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingCat(cat)} className="text-xs text-indigo-600">編集</button>
                      <button onClick={() => deleteCategory(cat.id)} className="text-xs text-red-500">削除</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
            <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} placeholder="新しいカテゴリ" className="flex-1 px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={addCategory} disabled={!newCatName.trim()} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300">追加</button>
          </div>
        </div>

        {/* Genres */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100"><h2 className="text-sm font-semibold">ジャンル</h2></div>
          <div className="divide-y divide-slate-100">
            {genres.map((genre, i) => (
              <div key={genre.id} className="px-4 py-3">
                {editingGenre?.id === genre.id ? (
                  <div className="space-y-2">
                    <input type="text" value={editingGenre.name} onChange={(e) => setEditingGenre({ ...editingGenre, name: e.target.value })} className="w-full px-2 py-1 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <div className="flex flex-wrap gap-1.5">
                      {COLORS.map((c) => (
                        <button key={c} onClick={() => setEditingGenre({ ...editingGenre, color: c })} className={`w-7 h-7 rounded-full border-2 ${editingGenre.color === c ? "border-slate-800 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={updateGenre} className="text-xs text-indigo-600 font-medium">保存</button>
                      <button onClick={() => setEditingGenre(null)} className="text-xs text-slate-400">取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowButtons index={i} total={genres.length} onMove={moveGenreOrder} />
                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: genre.color }} />
                      <span className="text-sm">{genre.name}</span>
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
          <div className="px-4 py-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center gap-2">
              <input type="text" value={newGenreName} onChange={(e) => setNewGenreName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGenre()} placeholder="新しいジャンル" className="flex-1 px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={addGenre} disabled={!newGenreName.trim()} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300">追加</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setNewGenreColor(c)} className={`w-6 h-6 rounded-full border-2 ${newGenreColor === c ? "border-slate-800 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>

        {/* Expense Categories */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100"><h2 className="text-sm font-semibold">家計簿カテゴリ</h2></div>
          <div className="divide-y divide-slate-100">
            {expenseCategories.map((cat, i) => (
              <div key={cat.id} className="px-4 py-3">
                {editingExpCat?.id === cat.id ? (
                  <div className="space-y-2">
                    <input type="text" value={editingExpCat.name} onChange={(e) => setEditingExpCat({ ...editingExpCat, name: e.target.value })} className="w-full px-2 py-1 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <div className="flex flex-wrap gap-1.5">
                      {COLORS.map((c) => (
                        <button key={c} onClick={() => setEditingExpCat({ ...editingExpCat, color: c })} className={`w-7 h-7 rounded-full border-2 ${editingExpCat.color === c ? "border-slate-800 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {EXPENSE_ICON_OPTIONS.map((ic) => (
                        <button key={ic} onClick={() => setEditingExpCat({ ...editingExpCat, icon: ic })} className={`p-1.5 rounded border ${editingExpCat.icon === ic ? "border-indigo-500 bg-indigo-50" : "border-slate-200"}`}>
                          <ExpenseIcon icon={ic} color={editingExpCat.color} size={18} />
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={updateExpenseCategory} className="text-xs text-indigo-600 font-medium">保存</button>
                      <button onClick={() => setEditingExpCat(null)} className="text-xs text-slate-400">取消</button>
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
          <div className="px-4 py-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center gap-2">
              <input type="text" value={newExpCatName} onChange={(e) => setNewExpCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addExpenseCategory()} placeholder="新しい家計簿カテゴリ" className="flex-1 px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={addExpenseCategory} disabled={!newExpCatName.trim()} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300">追加</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setNewExpCatColor(c)} className={`w-6 h-6 rounded-full border-2 ${newExpCatColor === c ? "border-slate-800 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_ICON_OPTIONS.slice(0, 12).map((ic) => (
                <button key={ic} onClick={() => setNewExpCatIcon(ic)} className={`p-1 rounded border ${newExpCatIcon === ic ? "border-indigo-500 bg-indigo-50" : "border-slate-200"}`}>
                  <ExpenseIcon icon={ic} color={newExpCatColor} size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
