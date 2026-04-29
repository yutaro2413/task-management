"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import BookFormModal from "./BookFormModal";

type Book = {
  id: string;
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  source: string;
  rating?: number | null;
  purchasedAt?: string | null;
  finishedAt?: string | null;
  seriesId?: string | null;
  volume?: number | null;
  series?: { id: string; name: string } | null;
  _count?: { highlights: number; bookmarks: number; readingLogs: number };
};

type Series = { id: string; name: string; _count?: { books: number } };

const SOURCE_LABEL: Record<string, string> = {
  kindle: "Kindle",
  paper: "紙",
  manga: "漫画",
};

const SOURCE_COLOR: Record<string, string> = {
  kindle: "bg-amber-50 text-amber-700",
  paper: "bg-slate-100 text-slate-600",
  manga: "bg-pink-50 text-pink-700",
};

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [filter, setFilter] = useState<string>("all"); // "all" | "kindle" | "paper" | "manga"
  const [showForm, setShowForm] = useState(false);
  const [showSeriesForm, setShowSeriesForm] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filter !== "all") qs.set("source", filter);
    if (search.trim()) qs.set("search", search.trim());
    try {
      const [b, s] = await Promise.all([
        fetch(`/api/books?${qs.toString()}`).then((r) => r.json()),
        fetch("/api/book-series").then((r) => r.json()),
      ]);
      setBooks(b);
      setSeriesList(s);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { load(); }, [load]);

  const addSeries = async () => {
    const name = newSeriesName.trim();
    if (!name) return;
    await fetch("/api/book-series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewSeriesName("");
    setShowSeriesForm(false);
    load();
  };

  // 漫画は同シリーズの本をシリーズ単位で1つにまとめて表示する
  const displayBooks = (() => {
    if (filter !== "manga") return books;
    const grouped: Book[] = [];
    const seenSeries = new Set<string>();
    for (const b of books) {
      if (b.seriesId) {
        if (seenSeries.has(b.seriesId)) continue;
        seenSeries.add(b.seriesId);
      }
      grouped.push(b);
    }
    return grouped;
  })();

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold text-center mb-2">書籍</h1>
          <div className="flex gap-1 mb-2">
            {[
              { v: "all", label: "すべて" },
              { v: "kindle", label: "Kindle" },
              { v: "paper", label: "紙" },
              { v: "manga", label: "漫画" },
            ].map((t) => (
              <button key={t.v} onClick={() => setFilter(t.v)} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${filter === t.v ? "bg-indigo-100 text-indigo-700" : "text-slate-500 bg-slate-50"}`}>{t.label}</button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="タイトル検索..."
            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 px-4">
        <div className="max-w-lg mx-auto py-4 space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setShowForm(true)} className="flex-1 py-2 rounded-lg border-2 border-dashed border-indigo-300 text-indigo-600 text-sm font-medium hover:bg-indigo-50">+ 書籍を追加</button>
            <button onClick={() => setShowSeriesForm(!showSeriesForm)} className="px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-500">シリーズ管理</button>
          </div>

          {showSeriesForm && (
            <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="flex gap-2">
                <input value={newSeriesName} onChange={(e) => setNewSeriesName(e.target.value)} placeholder="シリーズ名（例: ワンピース）" className="flex-1 px-2 py-1.5 rounded border border-slate-200 text-sm" />
                <button onClick={addSeries} disabled={!newSeriesName.trim()} className="px-3 py-1.5 rounded text-xs font-bold text-white bg-indigo-600 disabled:bg-slate-300">追加</button>
              </div>
              {seriesList.length > 0 && (
                <ul className="text-xs text-slate-500 space-y-1">
                  {seriesList.map((s) => (
                    <li key={s.id} className="flex justify-between">
                      <span>{s.name}</span>
                      <span className="text-slate-400">{s._count?.books ?? 0}巻</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {loading ? (
            <p className="text-center text-sm text-slate-400 py-8">読み込み中...</p>
          ) : displayBooks.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">まだ書籍がありません</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {displayBooks.map((b) => (
                <Link key={b.id} href={`/books/${b.id}`} className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-[2/3] bg-slate-100 flex items-center justify-center overflow-hidden">
                    {b.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.coverUrl} alt={b.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl text-slate-300">📖</span>
                    )}
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="flex items-center gap-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_COLOR[b.source] ?? "bg-slate-100 text-slate-500"}`}>{SOURCE_LABEL[b.source] ?? b.source}</span>
                      {b.series && <span className="text-[9px] text-slate-400 truncate">{b.series.name}</span>}
                    </div>
                    <p className="text-xs font-bold text-slate-700 line-clamp-2">{b.title}</p>
                    {b.author && <p className="text-[10px] text-slate-400 line-clamp-1">{b.author}</p>}
                    <div className="flex items-center gap-1 text-[9px] text-slate-400">
                      {typeof b.rating === "number" && b.rating > 0 && <span className="text-amber-400">{"★".repeat(b.rating)}</span>}
                      {b._count && b._count.highlights > 0 && <span>📝{b._count.highlights}</span>}
                      {b._count && b._count.bookmarks > 0 && <span>🔖{b._count.bookmarks}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <BookFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={() => load()}
      />
    </div>
  );
}
