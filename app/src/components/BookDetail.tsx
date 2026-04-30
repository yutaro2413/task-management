"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BookFormModal from "./BookFormModal";
import HighlightList from "./HighlightList";

type Highlight = {
  id: string;
  type: string;
  text?: string | null;
  note?: string | null;
  color?: string | null;
  location?: string | null;
  page?: number | null;
  imageUrl?: string | null;
  highlightedAt?: string | null;
};

type Bookmark = {
  id: string;
  location?: string | null;
  page?: number | null;
  bookmarkedAt?: string | null;
};

type ReadingLog = {
  id: string;
  date: string;
  review?: string | null;
};

type Book = {
  id: string;
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  source: string;
  asin?: string | null;
  isbn?: string | null;
  publisher?: string | null;
  url?: string | null;
  excerpt?: string | null;
  siteName?: string | null;
  rating?: number | null;
  purchasedAt?: string | null;
  finishedAt?: string | null;
  notes?: string | null;
  volume?: number | null;
  series?: { id: string; name: string } | null;
  highlights: Highlight[];
  bookmarks: Bookmark[];
  readingLogs: ReadingLog[];
};

const SOURCE_LABEL: Record<string, string> = { kindle: "Kindle", paper: "紙", manga: "漫画", web: "Web", pdf: "PDF" };

export default function BookDetail({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"highlights" | "bookmarks" | "logs">("highlights");

  const load = useCallback(async () => {
    const res = await fetch(`/api/books/${bookId}`);
    if (res.ok) setBook(await res.json());
  }, [bookId]);

  useEffect(() => { load(); }, [load]);

  if (!book) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-slate-400">読み込み中...</p>
      </div>
    );
  }

  const refreshMeta = async () => {
    setRefreshing(true);
    try {
      await fetch(`/api/books/${book.id}/refresh-metadata`, { method: "POST" });
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const removeBook = async () => {
    if (!confirm("この書籍を削除しますか？ハイライトもすべて削除されます。")) return;
    await fetch(`/api/books/${book.id}`, { method: "DELETE" });
    router.push("/books");
  };

  const updateRating = async (n: number) => {
    const next = book.rating === n ? null : n;
    await fetch(`/api/books/${book.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: next }),
    });
    setBook({ ...book, rating: next });
  };

  const deleteHighlight = async (id: string) => {
    await fetch(`/api/highlights?id=${id}`, { method: "DELETE" });
    setBook({ ...book, highlights: book.highlights.filter((h) => h.id !== id) });
  };

  const updateHighlightNote = async (id: string, note: string) => {
    await fetch("/api/highlights", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, note }),
    });
  };

  const deleteBookmark = async (id: string) => {
    await fetch(`/api/bookmarks?id=${id}`, { method: "DELETE" });
    setBook({ ...book, bookmarks: book.bookmarks.filter((b) => b.id !== id) });
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4 py-3">
        <div className="flex items-center max-w-lg lg:max-w-3xl mx-auto">
          <Link href="/books" className="text-slate-400 text-sm">← 戻る</Link>
          <h1 className="flex-1 text-base font-bold text-center truncate px-2">{book.title}</h1>
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-600">編集</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 px-4">
        <div className="max-w-lg lg:max-w-3xl mx-auto py-4 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex gap-3">
            <div className="w-24 aspect-[2/3] bg-slate-100 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
              {book.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl text-slate-300">📖</span>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{SOURCE_LABEL[book.source] ?? book.source}</span>
              {book.series && (
                <p className="text-[10px] text-slate-400">{book.series.name}{book.volume != null ? ` 第${book.volume}巻` : ""}</p>
              )}
              {book.author && <p className="text-xs text-slate-500">{book.author}</p>}
              {book.publisher && <p className="text-[10px] text-slate-400">{book.publisher}</p>}
              <div className="flex gap-1 pt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => updateRating(n)} className={`text-lg ${(book.rating ?? 0) >= n ? "text-amber-400" : "text-slate-300"}`}>★</button>
                ))}
              </div>
              <div className="text-[10px] text-slate-400 space-y-0.5 pt-1">
                {book.purchasedAt && <p>購入: {book.purchasedAt.slice(0, 10)}</p>}
                {book.finishedAt && <p>読了: {book.finishedAt.slice(0, 10)}</p>}
                {book.asin && <p>ASIN: {book.asin}</p>}
                {book.isbn && <p>ISBN: {book.isbn}</p>}
                {book.siteName && <p>{book.siteName}</p>}
                {book.url && (
                  <a href={book.url} target="_blank" rel="noreferrer" className="text-emerald-600 underline truncate block">
                    {book.url}
                  </a>
                )}
              </div>
              {book.excerpt && (
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-3">{book.excerpt}</p>
              )}
            </div>
          </div>

          {book.notes && (
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-400 mb-1">メモ</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{book.notes}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={refreshMeta} disabled={refreshing} className="flex-1 py-2 rounded-lg text-xs border border-slate-200 text-slate-500 disabled:opacity-50">
              {refreshing ? "取得中..." : "🔄 Google Books でメタ再取得"}
            </button>
            <button onClick={removeBook} className="px-3 py-2 rounded-lg text-xs border border-red-200 text-red-500">削除</button>
          </div>

          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setTab("highlights")} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${tab === "highlights" ? "bg-white text-slate-700 shadow-sm" : "text-slate-500"}`}>ハイライト ({book.highlights.length})</button>
            <button onClick={() => setTab("bookmarks")} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${tab === "bookmarks" ? "bg-white text-slate-700 shadow-sm" : "text-slate-500"}`}>しおり ({book.bookmarks.length})</button>
            <button onClick={() => setTab("logs")} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${tab === "logs" ? "bg-white text-slate-700 shadow-sm" : "text-slate-500"}`}>読書日 ({book.readingLogs.length})</button>
          </div>

          {tab === "highlights" && (
            <HighlightList
              highlights={book.highlights}
              onDelete={deleteHighlight}
              onUpdateNote={updateHighlightNote}
            />
          )}
          {tab === "bookmarks" && (
            book.bookmarks.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-6">しおりはまだありません</p>
            ) : (
              <ul className="space-y-1">
                {book.bookmarks.map((b) => (
                  <li key={b.id} className="bg-white rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between text-xs">
                    <span className="text-slate-600">{b.page != null ? `p.${b.page}` : ""} {b.location ?? ""}</span>
                    <button onClick={() => deleteBookmark(b.id)} className="text-slate-300 hover:text-red-500">削除</button>
                  </li>
                ))}
              </ul>
            )
          )}
          {tab === "logs" && (
            book.readingLogs.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-6">読書ログはまだありません</p>
            ) : (
              <ul className="space-y-1">
                {book.readingLogs.map((l) => (
                  <li key={l.id} className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-xs">
                    <p className="font-medium text-slate-600">{l.date.slice(0, 10)}</p>
                    {l.review && <p className="text-slate-500 mt-1 whitespace-pre-wrap">{l.review}</p>}
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>

      <BookFormModal
        open={editing}
        initial={book}
        onClose={() => setEditing(false)}
        onSaved={(updated) => setBook({ ...book, ...updated })}
      />
    </div>
  );
}
