"use client";

import { useState, useEffect } from "react";
import { slotToTime } from "@/lib/utils";

type Category = { id: string; name: string };
type Genre = { id: string; name: string; color: string };
type TimeEntry = {
  id: string;
  date: string;
  startSlot: number;
  endSlot: number;
  title?: string | null;
  detail?: string | null;
  category: Category;
  genre: Genre;
};

export default function SearchPanel({ onClose }: { onClose: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedGenreId, setSelectedGenreId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<TimeEntry[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/genres").then((r) => r.json()),
    ]).then(([cats, gnrs]) => {
      setCategories(cats);
      setGenres(gnrs);
    });
  }, []);

  const search = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
    if (selectedGenreId) params.set("genreId", selectedGenreId);
    if (keyword.trim()) params.set("keyword", keyword.trim());

    const res = await fetch(`/api/time-entries?${params.toString()}`);
    setResults(await res.json());
    setSearched(true);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-base font-bold">検索</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Keyword */}
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="キーワード検索..."
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs flex-1"
            >
              <option value="">全カテゴリ</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={selectedGenreId}
              onChange={(e) => setSelectedGenreId(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs flex-1"
            >
              <option value="">全ジャンル</option>
              {genres.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={search}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "検索中..." : "検索"}
          </button>
        </div>

        {/* Results */}
        {searched && (
          <div className="flex-1 overflow-y-auto px-4 pb-4 border-t border-slate-100">
            {results.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">結果なし</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {results.slice(0, 50).map((e) => (
                  <div key={e.id} className="flex items-center gap-2 py-2.5">
                    <span className="text-xs text-slate-400 w-14 flex-shrink-0">
                      {new Date(e.date.split("T")[0] + "T00:00:00").toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                    </span>
                    <span className="text-xs text-slate-400 font-mono w-20 flex-shrink-0">
                      {slotToTime(e.startSlot)}-{slotToTime(e.endSlot)}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: e.genre.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">{e.category.name}</span>
                        <span className="text-xs px-1 rounded text-white" style={{ backgroundColor: e.genre.color }}>
                          {e.genre.name}
                        </span>
                      </div>
                      {e.title && <p className="text-sm truncate">{e.title}</p>}
                    </div>
                  </div>
                ))}
                {results.length > 50 && (
                  <p className="text-xs text-slate-400 py-2 text-center">他{results.length - 50}件</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
