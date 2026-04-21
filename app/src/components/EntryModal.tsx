"use client";

import { useState, useEffect } from "react";
import { slotToTime, slotToTimeLabel, getSlotOptions, getEndSlotOptions } from "@/lib/utils";
import { RecurrenceRule, RecurrenceType, RECURRENCE_OPTIONS, getRecurrenceLabelForDate, describeRecurrence } from "@/lib/recurrence";

type Category = { id: string; name: string };
type Genre = { id: string; name: string; color: string; type: string; subType: string };

type EditEntry = {
  id?: string;
  startSlot: number;
  endSlot: number;
  title?: string | null;
  detail?: string | null;
  category: Category;
  genre: Genre;
  recurrenceRule?: string | null;
  recurrenceEnd?: string | null;
  parentRecurrenceId?: string | null;
};

type Props = {
  slotIndex: number;
  date?: string;
  categories: Category[];
  genres: Genre[];
  editEntry?: EditEntry | null;
  onSave: (data: {
    categoryId: string;
    genreId: string;
    startSlot: number;
    endSlot: number;
    title?: string;
    detail?: string;
    recurrenceRule?: string;
    recurrenceEnd?: string;
    scope?: string;
    virtualDate?: string;
  }) => void;
  onDelete?: (scope?: string, virtualDate?: string) => void;
  onClose: () => void;
  panelMode?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
};

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

function RecurrencePicker({
  rule,
  recurrenceEnd,
  date,
  onChange,
}: {
  rule: RecurrenceRule | null;
  recurrenceEnd: string;
  date: string;
  onChange: (rule: RecurrenceRule | null, endDate: string) => void;
}) {
  const [showCustom, setShowCustom] = useState(rule?.type === "custom");
  const [interval, setInterval] = useState(rule?.interval || 2);
  const [customUnit, setCustomUnit] = useState<"day" | "week">(rule?.customUnit || "week");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(rule?.daysOfWeek || []);

  const selectedType = rule?.type || "none";

  const handleTypeChange = (type: RecurrenceType | "none") => {
    if (type === "none") {
      onChange(null, "");
      setShowCustom(false);
      return;
    }
    if (type === "custom") {
      setShowCustom(true);
      onChange({ type: "custom", interval, customUnit, daysOfWeek }, recurrenceEnd);
      return;
    }
    setShowCustom(false);
    onChange({ type }, recurrenceEnd);
  };

  const updateCustom = (updates: Partial<{ interval: number; customUnit: "day" | "week"; daysOfWeek: number[] }>) => {
    const newInterval = updates.interval ?? interval;
    const newUnit = updates.customUnit ?? customUnit;
    const newDays = updates.daysOfWeek ?? daysOfWeek;
    if (updates.interval !== undefined) setInterval(newInterval);
    if (updates.customUnit !== undefined) setCustomUnit(newUnit);
    if (updates.daysOfWeek !== undefined) setDaysOfWeek(newDays);
    onChange({ type: "custom", interval: newInterval, customUnit: newUnit, daysOfWeek: newDays }, recurrenceEnd);
  };

  const toggleDay = (day: number) => {
    const next = daysOfWeek.includes(day) ? daysOfWeek.filter((d) => d !== day) : [...daysOfWeek, day].sort();
    updateCustom({ daysOfWeek: next });
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-500 block">繰り返し</label>

      {/* Type selector */}
      <div className="flex flex-wrap gap-1.5">
        {RECURRENCE_OPTIONS.map((opt) => {
          let label = opt.label;
          if (opt.value === "weekly" && date) {
            const dow = new Date(date + "T00:00:00").getDay();
            label = `毎週${DAY_NAMES[dow]}曜日`;
          } else if (opt.value === "monthly_nth_weekday" && date) {
            label = getRecurrenceLabelForDate({ type: "monthly_nth_weekday" }, date);
          } else if (opt.value === "monthly_day" && date) {
            label = getRecurrenceLabelForDate({ type: "monthly_day" }, date);
          }
          return (
            <button
              key={opt.value}
              onClick={() => handleTypeChange(opt.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedType === opt.value
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Custom settings */}
      {showCustom && (
        <div className="bg-slate-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => updateCustom({ interval: Math.max(1, Number(e.target.value)) })}
              className="w-16 px-2 py-1 rounded border border-slate-200 text-sm text-center"
            />
            <div className="flex gap-1">
              {(["day", "week"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => updateCustom({ customUnit: u })}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${
                    customUnit === u ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  {u === "day" ? "日" : "週"}ごと
                </button>
              ))}
            </div>
          </div>
          {customUnit === "week" && (
            <div className="flex gap-1">
              {DAY_NAMES.map((name, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`w-8 h-8 rounded-full text-xs font-medium ${
                    daysOfWeek.includes(i) ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* End date */}
      {selectedType !== "none" && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">終了日:</label>
          <input
            type="date"
            value={recurrenceEnd}
            onChange={(e) => onChange(rule, e.target.value)}
            className="px-2 py-1 rounded border border-slate-200 text-xs"
          />
          {recurrenceEnd && (
            <button
              onClick={() => onChange(rule, "")}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              なし
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ScopeDialog({
  title,
  onSelect,
  onCancel,
}: {
  title: string;
  onSelect: (scope: "single" | "future" | "all") => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center modal-backdrop px-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold mb-4">{title}</h3>
        <div className="space-y-2">
          <button
            onClick={() => onSelect("single")}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-left px-4"
          >
            この予定だけ
          </button>
          <button
            onClick={() => onSelect("future")}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-left px-4"
          >
            これ以降の予定
          </button>
          <button
            onClick={() => onSelect("all")}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-left px-4"
          >
            すべての予定
          </button>
        </div>
        <button onClick={onCancel} className="w-full mt-3 py-2 text-sm text-slate-500 hover:text-slate-700">
          キャンセル
        </button>
      </div>
    </div>
  );
}

export default function EntryModal({
  slotIndex,
  date,
  categories,
  genres,
  editEntry,
  onSave,
  onDelete,
  onClose,
  panelMode = false,
  onDirtyChange,
}: Props) {
  const [categoryId, setCategoryId] = useState(editEntry?.category.id || "");
  const [genreId, setGenreId] = useState(editEntry?.genre.id || "");
  const [startSlot, setStartSlot] = useState(editEntry?.startSlot ?? slotIndex);
  const [endSlot, setEndSlot] = useState(editEntry?.endSlot ?? Math.min(slotIndex + 1, 48));
  const [title, setTitle] = useState(editEntry?.title || "");
  const [detail, setDetail] = useState(editEntry?.detail || "");
  const [showDetail, setShowDetail] = useState(!!editEntry?.detail);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [scopeAction, setScopeAction] = useState<"save" | "delete" | null>(null);

  const existingRule: RecurrenceRule | null = editEntry?.recurrenceRule
    ? JSON.parse(editEntry.recurrenceRule)
    : null;
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | null>(existingRule);
  const [recurrenceEnd, setRecurrenceEnd] = useState(
    editEntry?.recurrenceEnd ? editEntry.recurrenceEnd.split("T")[0] : ""
  );

  const isRecurring = !!(editEntry?.recurrenceRule || editEntry?.parentRecurrenceId);
  const [initial] = useState(() => ({
    categoryId: editEntry?.category.id || "",
    genreId: editEntry?.genre.id || "",
    startSlot: editEntry?.startSlot ?? slotIndex,
    endSlot: editEntry?.endSlot ?? Math.min(slotIndex + 1, 48),
    title: editEntry?.title || "",
    detail: editEntry?.detail || "",
  }));

  const isDirty =
    categoryId !== initial.categoryId ||
    genreId !== initial.genreId ||
    startSlot !== initial.startSlot ||
    endSlot !== initial.endSlot ||
    title.trim() !== initial.title.trim() ||
    detail.trim() !== initial.detail.trim();

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { onDirtyChange?.(false); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = categoryId && genreId && startSlot < endSlot;
  const slotOptions = getSlotOptions();
  const endSlotOptions = getEndSlotOptions(startSlot);

  const buildSaveData = (scope?: string) => ({
    categoryId,
    genreId,
    startSlot,
    endSlot,
    title: title.trim() || undefined,
    detail: detail.trim() || undefined,
    recurrenceRule: recurrenceRule ? JSON.stringify(recurrenceRule) : undefined,
    recurrenceEnd: recurrenceEnd || undefined,
    scope,
    virtualDate: date,
  });

  const handleSaveClick = () => {
    if (!canSave) return;
    if (isRecurring && editEntry) {
      setScopeAction("save");
      return;
    }
    onSave(buildSaveData());
  };

  const handleDeleteClick = () => {
    if (isRecurring && editEntry) {
      setScopeAction("delete");
      return;
    }
    onDelete?.();
  };

  const handleScopeSelect = (scope: "single" | "future" | "all") => {
    if (scopeAction === "save") {
      onSave(buildSaveData(scope));
    } else if (scopeAction === "delete") {
      onDelete?.(scope, date);
    }
    setScopeAction(null);
  };

  const recurrenceLabel = recurrenceRule && date
    ? describeRecurrence(recurrenceRule, date)
    : existingRule && date
    ? describeRecurrence(existingRule, date)
    : null;

  const formContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {date && <p className="text-[11px] text-slate-400 font-medium">{new Date(date + "T00:00:00").toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" })}</p>}
          <h2 className="text-lg font-bold">
            {slotToTime(startSlot)} - {slotToTimeLabel(endSlot)}
          </h2>
          {recurrenceLabel && (
            <p className="text-[11px] text-indigo-500 font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {recurrenceLabel}
              {recurrenceEnd && <span className="text-slate-400">〜{recurrenceEnd}</span>}
            </p>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Time range */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">時間</label>
        <div className="flex items-center gap-2">
          <select
            value={startSlot}
            onChange={(e) => {
              const val = Number(e.target.value);
              setStartSlot(val);
              if (val >= endSlot) setEndSlot(val + 1);
            }}
            className="flex-1 px-2 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {slotOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className="text-slate-400">〜</span>
          <select
            value={endSlot}
            onChange={(e) => setEndSlot(Number(e.target.value))}
            className="flex-1 px-2 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {endSlotOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category */}
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

      {/* Genre */}
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

      {/* Title */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
          やったこと <span className="text-slate-400 font-normal">（任意）</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="何をしていましたか？"
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Detail */}
      {!showDetail ? (
        <button onClick={() => setShowDetail(true)} className="text-xs text-indigo-600 mb-3">
          + 詳細を追加
        </button>
      ) : (
        <div className="mb-3">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
            詳細 <span className="text-slate-400 font-normal">（任意）</span>
          </label>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="詳細メモ"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>
      )}

      {/* Recurrence toggle */}
      {!showRecurrence ? (
        <button
          onClick={() => setShowRecurrence(true)}
          className="text-xs text-indigo-600 mb-4 flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          繰り返し設定
        </button>
      ) : (
        <div className="mb-4">
          <RecurrencePicker
            rule={recurrenceRule}
            recurrenceEnd={recurrenceEnd}
            date={date || ""}
            onChange={(r, end) => { setRecurrenceRule(r); setRecurrenceEnd(end); }}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onDelete && (
          <button
            onClick={handleDeleteClick}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100"
          >
            削除
          </button>
        )}
        <button
          onClick={handleSaveClick}
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

      {/* Scope dialog */}
      {scopeAction && (
        <ScopeDialog
          title={scopeAction === "save" ? "繰り返し予定の編集" : "繰り返し予定の削除"}
          onSelect={handleScopeSelect}
          onCancel={() => setScopeAction(null)}
        />
      )}
    </>
  );

  if (panelMode) {
    return <div className="p-5 overflow-y-auto flex-1">{formContent}</div>;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {formContent}
      </div>
    </div>
  );
}
