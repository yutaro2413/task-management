"use client";

type Highlight = {
  id: string;
  type: string;
  text?: string | null;
  note?: string | null;       // App 専用メモ
  kindleNote?: string | null; // Kindle 由来メモ (同期で上書きされる)
  color?: string | null;
  location?: string | null;
  page?: number | null;
  imageUrl?: string | null;
  highlightedAt?: string | null;
  archived?: boolean;
};

const COLOR_BAR: Record<string, string> = {
  yellow: "bg-amber-400",
  blue: "bg-blue-400",
  pink: "bg-pink-400",
  orange: "bg-orange-400",
};

export default function HighlightList({
  highlights,
  onDelete,
  onUpdateNote,
  onUnarchive,
  archivedMode = false,
}: {
  highlights: Highlight[];
  onDelete: (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onUnarchive?: (id: string) => void;
  archivedMode?: boolean;
}) {
  if (highlights.length === 0) {
    return <p className="text-center text-sm text-slate-400 py-6">
      {archivedMode ? "削除されたハイライトはありません" : "ハイライトはまだありません"}
    </p>;
  }
  return (
    <div className="space-y-2">
      {highlights.map((h) => (
        <div key={h.id} className={`bg-white rounded-lg border ${archivedMode ? "border-slate-300 opacity-70" : "border-slate-200"} overflow-hidden flex`}>
          <div className={`w-1 flex-shrink-0 ${COLOR_BAR[h.color ?? "yellow"] ?? "bg-amber-400"}`} />
          <div className="flex-1 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] text-slate-400 flex items-center gap-2">
                {h.page != null && <span>p.{h.page}</span>}
                {h.location && <span>{h.location}</span>}
                {h.type === "image" && <span className="px-1 py-0.5 rounded bg-violet-100 text-violet-600">図表</span>}
                {archivedMode && <span className="px-1 py-0.5 rounded bg-slate-200 text-slate-600">Kindle で削除済</span>}
              </div>
              <div className="flex items-center gap-2">
                {archivedMode && onUnarchive && (
                  <button onClick={() => onUnarchive(h.id)} className="text-emerald-500 hover:text-emerald-700 text-xs">復活</button>
                )}
                <button onClick={() => onDelete(h.id)} className="text-slate-300 hover:text-red-500 text-xs">削除</button>
              </div>
            </div>
            {h.type === "image" && h.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={h.imageUrl} alt="figure" className="max-w-full rounded border border-slate-100" />
            ) : null}
            {h.text && <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{h.text}</p>}

            {/* Kindle 由来のメモ（読み取り専用、同期のたびに上書きされる） */}
            {h.kindleNote && (
              <div className="bg-amber-50 rounded-md px-2 py-1.5 text-xs text-slate-700 leading-relaxed">
                <span className="text-[9px] font-bold text-amber-700">💭 Kindle</span>
                <span className="ml-1 whitespace-pre-wrap">{h.kindleNote}</span>
              </div>
            )}

            {/* App 側メモ（編集可能、同期で触らない） */}
            <div>
              <label className="text-[9px] font-bold text-indigo-700">📝 App メモ</label>
              <textarea
                defaultValue={h.note ?? ""}
                onBlur={(e) => onUpdateNote(h.id, e.target.value)}
                placeholder="アプリ側メモ..."
                rows={1}
                className="w-full px-2 py-1 mt-0.5 rounded border border-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-y"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
