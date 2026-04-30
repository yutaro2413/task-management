"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type ReviewItem = {
  id: string;
  text: string | null;
  note: string | null;
  color: string | null;
  location: string | null;
  page: number | null;
  imageUrl: string | null;
  type: string;
  reviewReps: number;
  book: { id: string; title: string; author: string | null; coverUrl: string | null; source: string };
};

type Stats = {
  totals: { reviewed: number; learning: number; mature: number; new: number };
  days: { date: string; total: number; ratings: Record<string, number> }[];
};

const COLOR_BAR: Record<string, string> = {
  yellow: "bg-amber-400",
  blue: "bg-blue-400",
  pink: "bg-pink-400",
  orange: "bg-orange-400",
};

const RATING_LABELS = [
  { value: 0, label: "Forgot", sub: "覚えてなかった", bg: "bg-red-500", hover: "hover:bg-red-600" },
  { value: 1, label: "Hard", sub: "思い出すのに苦労", bg: "bg-orange-500", hover: "hover:bg-orange-600" },
  { value: 2, label: "Good", sub: "思い出せた", bg: "bg-green-500", hover: "hover:bg-green-600" },
  { value: 3, label: "Easy", sub: "即答", bg: "bg-blue-500", hover: "hover:bg-blue-600" },
] as const;

export default function ReviewPage() {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reveal, setReveal] = useState(false); // テキストを表示するか (note を先に出して、本文を後で見せる)
  const [submitting, setSubmitting] = useState(false);
  const [reviewedToday, setReviewedToday] = useState(0);

  // 冒頭の setLoading(true) は react-hooks/set-state-in-effect ルールを満たすために必要。
  const [, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([
        fetch("/api/reviews/today?limit=20").then((r) => r.json()),
        fetch("/api/reviews/stats").then((r) => r.json()),
      ]);
      setQueue(t.queue ?? []);
      setDueCount(t.dueCount ?? 0);
      setNewCount(t.newCount ?? 0);
      setStats(s);
      setReveal(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const current = queue[0];

  const submit = async (rating: 0 | 1 | 2 | 3) => {
    if (!current || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`/api/reviews/${current.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      setQueue((q) => q.slice(1));
      setReveal(false);
      setReviewedToday((n) => n + 1);
      // 残り 1 件になったら追加で取得しておく
      if (queue.length <= 3) load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4 py-3">
        <div className="max-w-lg lg:max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">復習</h1>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>本日: <b className="text-indigo-600">{reviewedToday}</b></span>
            <span>残り: <b>{dueCount + (queue.length > dueCount ? newCount : 0)}</b></span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 px-4">
        <div className="max-w-lg lg:max-w-2xl mx-auto py-4 space-y-4">
          {!current ? (
            <EmptyState newCount={newCount} stats={stats} onReload={load} />
          ) : (
            <>
              {/* カード */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className={`flex`}>
                  <div className={`w-1 flex-shrink-0 ${COLOR_BAR[current.color ?? "yellow"] ?? "bg-amber-400"}`} />
                  <div className="flex-1 p-4 space-y-3">
                    <Link href={`/books/${current.book.id}`} className="flex items-center gap-2 text-[10px] text-slate-400 hover:text-indigo-600">
                      {current.book.coverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={current.book.coverUrl} alt="" className="w-6 h-9 object-cover rounded" />
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-600 truncate">{current.book.title}</p>
                        {current.book.author && <p className="truncate">{current.book.author}</p>}
                      </div>
                    </Link>

                    <div className="text-[10px] text-slate-400 flex items-center gap-2">
                      {current.page != null && <span>p.{current.page}</span>}
                      {current.location && <span>{current.location}</span>}
                      {current.reviewReps === 0 && <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">NEW</span>}
                    </div>

                    {current.imageUrl && current.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={current.imageUrl} alt="figure" className="w-full rounded border border-slate-100" />
                    ) : null}

                    {/* メモが先に出る (思い出すフックとして) */}
                    {current.note && (
                      <div className="bg-slate-50 rounded-md p-3 text-xs text-slate-600 italic">
                        💭 {current.note}
                      </div>
                    )}

                    {/* テキストはタップで開示 */}
                    {reveal ? (
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {current.text}
                      </p>
                    ) : (
                      <button
                        onClick={() => setReveal(true)}
                        className="w-full py-6 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 text-sm font-medium hover:bg-slate-50"
                      >
                        本文を表示（タップ）
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 評価ボタン */}
              {reveal && (
                <div className="grid grid-cols-4 gap-2">
                  {RATING_LABELS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => submit(r.value)}
                      disabled={submitting}
                      className={`py-3 rounded-lg text-white font-bold text-xs ${r.bg} ${r.hover} disabled:opacity-50 transition-colors`}
                    >
                      <div>{r.label}</div>
                      <div className="text-[9px] font-normal opacity-80 mt-0.5">{r.sub}</div>
                    </button>
                  ))}
                </div>
              )}

              <p className="text-center text-[10px] text-slate-400">
                残り {queue.length} 件 · 期限切れ {dueCount} · 未学習 {newCount}
              </p>
            </>
          )}

          {/* 統計 */}
          {stats && (
            <details className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <summary className="px-4 py-3 text-xs font-bold text-slate-500 cursor-pointer">統計</summary>
              <div className="px-4 py-3 space-y-2 border-t border-slate-100">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <Stat label="未学習" n={stats.totals.new} color="text-slate-500" />
                  <Stat label="学習中" n={stats.totals.learning} color="text-amber-600" />
                  <Stat label="習熟" n={stats.totals.mature} color="text-green-600" />
                  <Stat label="復習済" n={stats.totals.reviewed} color="text-indigo-600" />
                </div>
                {stats.days.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1">過去30日の復習件数</p>
                    <div className="flex gap-0.5 items-end h-12">
                      {stats.days.map((d) => (
                        <div key={d.date} className="flex-1 bg-indigo-200 rounded-sm" style={{ height: `${Math.min(100, d.total * 5)}%` }} title={`${d.date}: ${d.total}件`} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <div>
      <div className={`text-lg font-bold ${color}`}>{n}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}

function EmptyState({ newCount, stats, onReload }: { newCount: number; stats: Stats | null; onReload: () => void }) {
  return (
    <div className="text-center py-12 space-y-3">
      <p className="text-4xl">🎉</p>
      <p className="text-sm font-bold text-slate-700">本日の復習は完了しました</p>
      {newCount > 0 && (
        <p className="text-xs text-slate-500">未学習のハイライトが {newCount} 件あります</p>
      )}
      {stats && stats.totals.reviewed > 0 && (
        <p className="text-xs text-slate-400">これまでに {stats.totals.reviewed} 件のハイライトを復習しています</p>
      )}
      <div className="flex gap-2 justify-center pt-2">
        <button onClick={onReload} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">
          再読込
        </button>
        <Link href="/books" className="px-4 py-2 rounded-lg border border-slate-200 text-slate-500 text-xs font-medium hover:bg-slate-50">
          書籍ライブラリへ
        </Link>
      </div>
    </div>
  );
}
