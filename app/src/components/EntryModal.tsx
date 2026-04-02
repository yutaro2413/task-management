"use client";

import { useState } from "react";
import { slotToTime } from "@/lib/utils";

type Category = { id: string; name: string };
type Genre = { id: string; name: string; color: string };

type Props = {
  slotIndex: number;
  categories: Category[];
  genres: Genre[];
  editEntry?: {
    title: string;
    detail?: string | null;
    category: Category;
    genre: Genre;
  } | null;
  onSave: (data: {
    categoryId: string;
    genreId: string;
    title: string;
    detail?: string;
  }) => void;
  onDelete?: () => void;
  onClose: () => void;
};

export default function EntryModal({
  slotIndex,
  categories,
  genres,
  editEntry,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [categoryId, setCategoryId] = useState(editEntry?.category.id || "");
  const [genreId, setGenreId] = useState(editEntry?.genre.id || "");
  const [title, setTitle] = useState(editEntry?.title || "");
  const [detail, setDetail] = useState(editEntry?.detail || "");
  const [showDetail, setShowDetail] = useState(!!editEntry?.detail);

  const canSave = categoryId && genreId && title.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {slotToTime(slotIndex)} - {slotToTime(slotIndex + 1)}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category selection */}
        <div className="mb-3">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">カテゴリ</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  categoryId === cat.id
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Genre selection */}
        <div className="mb-3">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">ジャンル</label>
          <div className="flex flex-wrap gap-2">
            {genres.map((genre) => (
              <button
                key={genre.id}
                onClick={() => setGenreId(genre.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  genreId === genre.id
                    ? "text-white shadow-md scale-105"
                    : "text-slate-700 bg-slate-100 hover:bg-slate-200"
                }`}
                style={genreId === genre.id ? { backgroundColor: genre.color } : {}}
              >
                {genre.name}
              </button>
            ))}
          </div>
        </div>

        {/* Title input */}
        <div className="mb-3">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">やったこと</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="何をしていましたか？"
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Detail (expandable) */}
        {!showDetail ? (
          <button
            onClick={() => setShowDetail(true)}
            className="text-xs text-indigo-600 mb-4"
          >
            + 詳細を追加
          </button>
        ) : (
          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">詳細</label>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="詳細メモ（任意）"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100"
            >
              削除
            </button>
          )}
          <button
            onClick={() => canSave && onSave({ categoryId, genreId, title: title.trim(), detail: detail.trim() || undefined })}
            disabled={!canSave}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition-colors ${
              canSave
                ? "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
                : "bg-slate-300 cursor-not-allowed"
            }`}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
