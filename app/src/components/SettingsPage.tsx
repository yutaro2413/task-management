"use client";

import { useState, useEffect, useCallback } from "react";

type Category = { id: string; name: string };
type Genre = { id: string; name: string; color: string };

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#6b7280",
];

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newGenreName, setNewGenreName] = useState("");
  const [newGenreColor, setNewGenreColor] = useState("#6366f1");
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingGenre, setEditingGenre] = useState<Genre | null>(null);
  const [seeding, setSeeding] = useState(false);

  const fetchData = useCallback(async () => {
    const [cats, gnrs] = await Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/genres").then((r) => r.json()),
    ]);
    setCategories(cats);
    setGenres(gnrs);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim() }),
    });
    setNewCatName("");
    fetchData();
  };

  const updateCategory = async () => {
    if (!editingCat) return;
    await fetch("/api/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingCat),
    });
    setEditingCat(null);
    fetchData();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("このカテゴリを削除しますか？関連する記録も影響を受けます。")) return;
    await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  const addGenre = async () => {
    if (!newGenreName.trim()) return;
    await fetch("/api/genres", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGenreName.trim(), color: newGenreColor }),
    });
    setNewGenreName("");
    fetchData();
  };

  const updateGenre = async () => {
    if (!editingGenre) return;
    await fetch("/api/genres", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingGenre),
    });
    setEditingGenre(null);
    fetchData();
  };

  const deleteGenre = async (id: string) => {
    if (!confirm("このジャンルを削除しますか？関連する記録も影響を受けます。")) return;
    await fetch(`/api/genres?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  const seedData = async () => {
    setSeeding(true);
    await fetch("/api/seed", { method: "POST" });
    await fetchData();
    setSeeding(false);
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4 py-3">
        <h1 className="text-lg font-bold text-center max-w-lg mx-auto">設定</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full space-y-6">
        {/* Seed data */}
        {categories.length === 0 && genres.length === 0 && (
          <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200 text-center">
            <p className="text-sm text-indigo-700 mb-2">初期データがありません</p>
            <button
              onClick={seedData}
              disabled={seeding}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {seeding ? "設定中..." : "初期データを作成"}
            </button>
          </div>
        )}

        {/* Categories */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold">カテゴリ</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {categories.map((cat) => (
              <div key={cat.id} className="px-4 py-3 flex items-center justify-between">
                {editingCat?.id === cat.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editingCat.name}
                      onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                      className="flex-1 px-2 py-1 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                    <button onClick={updateCategory} className="text-xs text-indigo-600 font-medium">保存</button>
                    <button onClick={() => setEditingCat(null)} className="text-xs text-slate-400">取消</button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm">{cat.name}</span>
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
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              placeholder="新しいカテゴリ"
              className="flex-1 px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={addCategory}
              disabled={!newCatName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300"
            >
              追加
            </button>
          </div>
        </div>

        {/* Genres */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold">ジャンル</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {genres.map((genre) => (
              <div key={genre.id} className="px-4 py-3">
                {editingGenre?.id === genre.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingGenre.name}
                      onChange={(e) => setEditingGenre({ ...editingGenre, name: e.target.value })}
                      className="w-full px-2 py-1 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditingGenre({ ...editingGenre, color: c })}
                          className={`w-7 h-7 rounded-full border-2 ${editingGenre.color === c ? "border-slate-800 scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: c }}
                        />
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
              <input
                type="text"
                value={newGenreName}
                onChange={(e) => setNewGenreName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGenre()}
                placeholder="新しいジャンル"
                className="flex-1 px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={addGenre}
                disabled={!newGenreName.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300"
              >
                追加
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewGenreColor(c)}
                  className={`w-6 h-6 rounded-full border-2 ${newGenreColor === c ? "border-slate-800 scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
