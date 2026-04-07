"use client";

import { useState, useEffect, useCallback } from "react";

type Genre = { id: string; name: string; color: string; type: string };
type Category = { id: string; name: string; excludeFromSummary: boolean };

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#6b7280", "#92400e",
];

type Tab = "genres" | "categories";

export default function MasterEditModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("genres");
  const [genres, setGenres] = useState<Genre[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingGenre, setEditingGenre] = useState<Genre | null>(null);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [newGenreName, setNewGenreName] = useState("");
  const [newGenreColor, setNewGenreColor] = useState("#6366f1");
  const [newGenreType, setNewGenreType] = useState<"投資" | "経費" | "付随">("経費");
  const [newCatName, setNewCatName] = useState("");

  const fetchData = useCallback(async () => {
    const [g, c] = await Promise.all([
      fetch("/api/genres").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]);
    setGenres(g);
    setCategories(c);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Genre CRUD
  const addGenre = async () => {
    if (!newGenreName.trim()) return;
    await fetch("/api/genres", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newGenreName.trim(), color: newGenreColor, type: newGenreType }) });
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

  const Arrow = ({ index, total, onMove }: { index: number; total: number; onMove: (i: number, d: -1 | 1) => void }) => (
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 flex-1 mr-3">
            <button onClick={() => setTab("genres")} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === "genres" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>ジャンル</button>
            <button onClick={() => setTab("categories")} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === "categories" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>カテゴリ</button>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {tab === "genres" ? (
            <div>
              <div className="divide-y divide-slate-100">
                {genres.map((genre, i) => (
                  <div key={genre.id} className="px-4 py-2.5">
                    {editingGenre?.id === genre.id ? (
                      <div className="space-y-2">
                        <input type="text" value={editingGenre.name} onChange={(e) => setEditingGenre({ ...editingGenre, name: e.target.value })} className="w-full px-2 py-1 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <div className="flex gap-1">
                          {(["投資", "経費", "付随"] as const).map((t) => (
                            <button key={t} onClick={() => setEditingGenre({ ...editingGenre, type: t })} className={`px-3 py-1 rounded-full text-xs font-medium border ${editingGenre.type === t ? (t === "投資" ? "bg-blue-100 text-blue-700 border-blue-300" : t === "付随" ? "bg-red-100 text-red-700 border-red-300" : "bg-slate-200 text-slate-700 border-slate-300") : "bg-white text-slate-400 border-slate-200"}`}>{t}</button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {COLORS.map((c) => (
                            <button key={c} onClick={() => setEditingGenre({ ...editingGenre, color: c })} className={`w-6 h-6 rounded-full border-2 ${editingGenre.color === c ? "border-slate-800 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
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
                          <Arrow index={i} total={genres.length} onMove={moveGenreOrder} />
                          <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: genre.color }} />
                          <span className="text-sm">{genre.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${genre.type === "投資" ? "bg-blue-100 text-blue-600" : genre.type === "付随" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"}`}>{genre.type || "経費"}</span>
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
                <div className="flex gap-1">
                  {(["投資", "経費", "付随"] as const).map((t) => (
                    <button key={t} onClick={() => setNewGenreType(t)} className={`px-3 py-1 rounded-full text-xs font-medium border ${newGenreType === t ? (t === "投資" ? "bg-blue-100 text-blue-700 border-blue-300" : t === "付随" ? "bg-red-100 text-red-700 border-red-300" : "bg-slate-200 text-slate-700 border-slate-300") : "bg-white text-slate-400 border-slate-200"}`}>{t}</button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setNewGenreColor(c)} className={`w-5 h-5 rounded-full border-2 ${newGenreColor === c ? "border-slate-800 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="divide-y divide-slate-100">
                {categories.map((cat, i) => (
                  <div key={cat.id} className="px-4 py-2.5">
                    {editingCat?.id === cat.id ? (
                      <div className="flex items-center gap-2">
                        <input type="text" value={editingCat.name} onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })} className="flex-1 px-2 py-1 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button onClick={updateCategory} className="text-xs text-indigo-600 font-medium">保存</button>
                        <button onClick={() => setEditingCat(null)} className="text-xs text-slate-400">取消</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Arrow index={i} total={categories.length} onMove={moveCatOrder} />
                          <span className="text-sm">{cat.name}</span>
                          {cat.excludeFromSummary && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 font-medium">サマリ除外</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingCat(cat)} className="text-xs text-indigo-600">編集</button>
                          <button onClick={() => deleteCategory(cat.id)} className="text-xs text-red-500">削除</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
                <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} placeholder="新しいカテゴリ" className="flex-1 px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button onClick={addCategory} disabled={!newCatName.trim()} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300">追加</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
