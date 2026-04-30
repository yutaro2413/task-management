"use client";

import { useRef, useState } from "react";
import { extractHighlightsFromPdf, type ExtractedHighlight } from "@/lib/pdfHighlights";

type Status =
  | { kind: "idle" }
  | { kind: "parsing"; fileName: string }
  | { kind: "preview"; fileName: string; title: string; highlights: ExtractedHighlight[]; pageCount: number }
  | { kind: "uploading" }
  | { kind: "done"; created: number; existed: number; bookId: string }
  | { kind: "error"; message: string };

export default function PdfImportButton({ onImported }: { onImported?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [titleEdit, setTitleEdit] = useState("");

  const onFile = async (file: File) => {
    setStatus({ kind: "parsing", fileName: file.name });
    try {
      const buf = await file.arrayBuffer();
      const result = await extractHighlightsFromPdf(buf);
      const defaultTitle = file.name.replace(/\.pdf$/i, "");
      setTitleEdit(defaultTitle);
      setStatus({
        kind: "preview",
        fileName: file.name,
        title: defaultTitle,
        highlights: result.highlights,
        pageCount: result.pageCount,
      });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const onConfirm = async () => {
    if (status.kind !== "preview") return;
    setStatus({ kind: "uploading" });
    try {
      const res = await fetch("/api/pdf/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleEdit.trim() || status.title,
          fileName: status.fileName,
          pageCount: status.pageCount,
          highlights: status.highlights.map((h) => ({
            page: h.page,
            text: h.text,
            note: h.note,
            color: h.color,
            modifiedAt: h.modifiedAt?.toISOString() ?? null,
          })),
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} ${txt.slice(0, 100)}`);
      }
      const json = await res.json();
      setStatus({ kind: "done", created: json.created, existed: json.existed, bookId: json.book.id });
      onImported?.();
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const reset = () => setStatus({ kind: "idle" });

  return (
    <>
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full py-2 rounded-lg border-2 border-dashed border-violet-300 text-violet-600 text-sm font-medium hover:bg-violet-50"
      >
        📄 PDF からハイライト取込
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = ""; // 同じファイルを再選択できるようにリセット
        }}
      />

      {status.kind !== "idle" && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end lg:items-center justify-center" onClick={reset}>
          <div className="bg-white w-full lg:max-w-lg lg:rounded-xl rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-base font-bold">PDF 取込</h2>
              <button onClick={reset} className="text-slate-400 text-sm">×</button>
            </div>

            <div className="px-4 py-4 space-y-3">
              {status.kind === "parsing" && (
                <p className="text-sm text-slate-500">解析中: {status.fileName}</p>
              )}

              {status.kind === "preview" && (
                <>
                  <div>
                    <label className="text-xs text-slate-500">タイトル</label>
                    <input
                      value={titleEdit}
                      onChange={(e) => setTitleEdit(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-slate-200 text-sm"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">元ファイル: {status.fileName} · {status.pageCount} ページ</p>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-bold text-slate-600">
                      抽出されたハイライト: {status.highlights.length} 件
                      {status.highlights.filter((h) => !h.text).length > 0 && (
                        <span className="text-slate-400 font-normal">（うち本文無し: {status.highlights.filter((h) => !h.text).length} 件はスキップ）</span>
                      )}
                    </p>
                    {status.highlights.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        この PDF には /Highlight 注釈が見つかりませんでした。<br />
                        Preview / Acrobat / Goodnotes 等でハイライト付けされている PDF が対象です。スキャン PDF・画像のみの PDF からは取得できません。
                      </p>
                    ) : (
                      <ul className="max-h-60 overflow-y-auto space-y-1">
                        {status.highlights.slice(0, 30).map((h, i) => (
                          <li key={i} className="text-[11px] text-slate-600 border-l-2 border-amber-400 pl-2">
                            <span className="text-slate-400">p.{h.page}</span> {h.text || <em className="text-slate-400">（本文無し）</em>}
                          </li>
                        ))}
                        {status.highlights.length > 30 && (
                          <li className="text-[10px] text-slate-400 italic">...他 {status.highlights.length - 30} 件</li>
                        )}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={reset} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 text-sm">キャンセル</button>
                    <button
                      onClick={onConfirm}
                      disabled={status.highlights.filter((h) => h.text).length === 0}
                      className="flex-1 py-2 rounded-lg text-white font-bold text-sm bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300"
                    >
                      取込み実行
                    </button>
                  </div>
                </>
              )}

              {status.kind === "uploading" && (
                <p className="text-sm text-slate-500">送信中...</p>
              )}

              {status.kind === "done" && (
                <div className="space-y-3 text-center py-4">
                  <p className="text-2xl">✅</p>
                  <p className="text-sm font-bold text-slate-700">取込完了</p>
                  <p className="text-xs text-slate-500">新規 {status.created} 件 / 既存 {status.existed} 件</p>
                  <div className="flex gap-2 justify-center">
                    <a href={`/books/${status.bookId}`} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold">書籍を見る</a>
                    <button onClick={reset} className="px-4 py-2 rounded-lg border border-slate-200 text-xs text-slate-500">閉じる</button>
                  </div>
                </div>
              )}

              {status.kind === "error" && (
                <div className="space-y-3 text-center py-4">
                  <p className="text-2xl">⚠️</p>
                  <p className="text-sm font-bold text-red-600">エラー</p>
                  <p className="text-xs text-slate-500 whitespace-pre-wrap">{status.message}</p>
                  <button onClick={reset} className="px-4 py-2 rounded-lg border border-slate-200 text-xs text-slate-500">閉じる</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
