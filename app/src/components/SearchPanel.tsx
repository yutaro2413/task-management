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
    const params = new URLSearchParams();
    if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
    if (selectedGenreId) params.set("genreId", selectedGenreId);
    if (keyword.trim()) params.set("keyword", keyword.trim());

    const res = await fetch(`/api/time-entries?${params.toString()}`);
    setResults(await res.json());
    setSearched(true);
  };

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3 max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">検索</h3>
        <button onClick={onClose} className="text-xs text-slate-400">閉じる</button>
      </div>

      {/* Keyword */}
      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && search()}
        placeholder="キーワード検索..."
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <select
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          className="px-2 py-1 rounded-lg border border-slate-200 text-xs"
        >
          <option value="">全カテゴリ</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={selectedGenreId}
          onChange={(e) => setSelectedGenreId(e.target.value)}
          className="px-2 py-1 rounded-lg border border-slate-200 text-xs"
        >
          <option value="">全ジャンル</option>
          {genres.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <button
          onClick={search}
          className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-medium"
        >
          検索
        </button>
      </div>

      {/* Results */}
      {searched && (
        <div className="max-h-60 overflow-y-auto border-t border-slate-100 pt-2">
          {results.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">結果なし</p>
          ) : (
            <div className="space-y-1">
              {results.slice(0, 50).map((e) => (
                <div key={e.id} className="flex items-center gap-2 py-1.5">
                  <span className="text-xs text-slate-400 w-16 flex-shrink-0">
                    {new Date(e.date.split("T")[0] + "T00:00:00").toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                  </span>
                  <span className="text-xs text-slate-400 font-mono w-16">
                    {slotToTime(e.startSlot)}-{slotToTime(e.endSlot)}
                  </span>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: e.genre.color }}
                  />
                  <span className="text-xs text-slate-500">{e.category.name}</span>
                  <span className="text-sm flex-1 truncate">{e.title || e.genre.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
