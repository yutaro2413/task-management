"use client";

import { useEffect, useState } from "react";

type Series = { id: string; name: string };

type Book = {
  id: string;
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  source: string;
  asin?: string | null;
  isbn?: string | null;
  publisher?: string | null;
  rating?: number | null;
  purchasedAt?: string | null;
  finishedAt?: string | null;
  seriesId?: string | null;
  volume?: number | null;
  notes?: string | null;
};

type Props = {
  open: boolean;
  initial?: Partial<Book>;
  onClose: () => void;
  onSaved: (book: Book) => void;
};

const SOURCES = [
  { value: "kindle", label: "Kindle" },
  { value: "paper", label: "紙の本" },
  { value: "manga", label: "漫画" },
];

export default function BookFormModal({ open, initial, onClose, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [source, setSource] = useState("paper");
  const [isbn, setIsbn] = useState("");
  const [publisher, setPublisher] = useState("");
  const [rating, setRating] = useState<number | "">("");
  const [purchasedAt, setPurchasedAt] = useState("");
  const [finishedAt, setFinishedAt] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [volume, setVolume] = useState<number | "">("");
  const [coverUrl, setCoverUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/book-series").then((r) => r.json()).then(setSeriesList).catch(() => {});
    setTitle(initial?.title ?? "");
    setAuthor(initial?.author ?? "");
    setSource(initial?.source ?? "paper");
    setIsbn(initial?.isbn ?? "");
    setPublisher(initial?.publisher ?? "");
    setRating(typeof initial?.rating === "number" ? initial.rating : "");
    setPurchasedAt(initial?.purchasedAt ? initial.purchasedAt.slice(0, 10) : "");
    setFinishedAt(initial?.finishedAt ? initial.finishedAt.slice(0, 10) : "");
    setSeriesId(initial?.seriesId ?? "");
    setVolume(typeof initial?.volume === "number" ? initial.volume : "");
    setCoverUrl(initial?.coverUrl ?? "");
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  if (!open) return null;

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        author: author.trim() || undefined,
        source,
        isbn: isbn.trim() || undefined,
        publisher: publisher.trim() || undefined,
        rating: rating === "" ? undefined : Number(rating),
        purchasedAt: purchasedAt || undefined,
        finishedAt: finishedAt || undefined,
        seriesId: seriesId || undefined,
        volume: volume === "" ? undefined : Number(volume),
        coverUrl: coverUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      const url = initial?.id ? `/api/books/${initial.id}` : "/api/books";
      const method = initial?.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const book = await res.json();
      onSaved(book);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full lg:max-w-lg lg:rounded-xl rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold">{initial?.id ? "書籍を編集" : "書籍を追加"}</h2>
          <button onClick={onClose} className="text-slate-400 text-sm">×</button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <div>
            <label className="text-xs text-slate-500">タイトル *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">著者</label>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">種別</label>
            <div className="flex gap-1 flex-wrap">
              {SOURCES.map((s) => (
                <button key={s.value} type="button" onClick={() => setSource(s.value)} className={`px-3 py-1 rounded-full text-xs font-medium border ${source === s.value ? "bg-indigo-100 text-indigo-700 border-indigo-300" : "bg-white text-slate-400 border-slate-200"}`}>{s.label}</button>
              ))}
            </div>
          </div>

          {source === "manga" && (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-xs text-slate-500">シリーズ</label>
                <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 text-sm">
                  <option value="">（未設定）</option>
                  {seriesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">巻</label>
                <input type="number" value={volume} onChange={(e) => setVolume(e.target.value === "" ? "" : Number(e.target.value))} className="w-full px-3 py-2 rounded border border-slate-200 text-sm" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500">ISBN</label>
              <input value={isbn} onChange={(e) => setIsbn(e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">出版社</label>
              <input value={publisher} onChange={(e) => setPublisher(e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500">購入日</label>
              <input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">読了日</label>
              <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500">評価</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(rating === n ? "" : n)} className={`text-xl ${(typeof rating === "number" ? rating : 0) >= n ? "text-amber-400" : "text-slate-300"}`}>★</button>
              ))}
              {rating !== "" && <button type="button" onClick={() => setRating("")} className="text-xs text-slate-400 ml-2">クリア</button>}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500">カバー画像URL（任意・空ならGoogle Booksで自動取得）</label>
            <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 text-sm" placeholder="https://..." />
          </div>

          <div>
            <label className="text-xs text-slate-500">メモ</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 rounded border border-slate-200 text-sm resize-y" />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-slate-200 text-slate-500">キャンセル</button>
          <button onClick={save} disabled={!title.trim() || saving} className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 disabled:bg-slate-300">
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
