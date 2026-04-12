"use client";

import { useState, useEffect } from "react";
import ExpenseIcon from "./ExpenseIcon";
import LoadingOverlay from "./LoadingOverlay";

type ExpenseCategory = { id: string; name: string; color: string; icon: string };

type EditExpense = {
  id: string;
  date: string;
  amount: number;
  type: string;
  memo: string | null;
  category: { id: string; name: string; color: string; icon: string } | null;
};

type Props = {
  date: string;
  editExpense?: EditExpense | null;
  onSave: () => void;
  onDelete?: () => void;
  onClose: () => void;
  /** PC right-panel mode: renders inline without backdrop */
  panelMode?: boolean;
};

export default function ExpenseModal({ date, editExpense, onSave, onDelete, onClose, panelMode = false }: Props) {
  const [expenseDate, setExpenseDate] = useState(editExpense ? editExpense.date : date);
  const [amount, setAmount] = useState(editExpense ? String(editExpense.amount) : "");
  const [type, setType] = useState<"expense" | "income">(
    (editExpense?.type as "expense" | "income") || "expense"
  );
  const [categoryId, setCategoryId] = useState(editExpense?.category?.id || "");
  const [memo, setMemo] = useState(editExpense?.memo || "");
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [saving, setSaving] = useState(false);

  const isEdit = !!editExpense;

  useEffect(() => {
    fetch("/api/expense-categories")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  // Sync date if parent changes it (only in create mode)
  useEffect(() => {
    if (!isEdit) setExpenseDate(date);
  }, [date, isEdit]);

  const handleSave = async () => {
    const num = Number(amount);
    if (!amount || isNaN(num) || num <= 0) return;
    setSaving(true);
    try {
      if (isEdit) {
        await fetch("/api/expenses", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editExpense!.id,
            date: expenseDate,
            amount: num,
            type,
            categoryId: categoryId || null,
            memo: memo.trim() || null,
          }),
        });
      } else {
        await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: expenseDate,
            amount: num,
            type,
            categoryId: categoryId || null,
            memo: memo.trim() || null,
          }),
        });
      }
      onSave();
    } finally {
      setSaving(false);
    }
  };

  const changeDate = (delta: number) => {
    const d = new Date(expenseDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setExpenseDate(`${y}-${m}-${day}`);
  };

  const formContent = (
    <>
      {saving && <LoadingOverlay />}

      {/* Type toggle */}
      <div className={`flex bg-slate-100 ${panelMode ? "rounded-xl" : "rounded-t-2xl"}`}>
        <button
          onClick={() => setType("expense")}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${
            panelMode ? "rounded-l-xl" : "rounded-tl-2xl"
          } ${type === "expense" ? "bg-rose-500 text-white" : "text-slate-500"}`}
        >
          支出
        </button>
        <button
          onClick={() => setType("income")}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${
            panelMode ? "rounded-r-xl" : "rounded-tr-2xl"
          } ${type === "income" ? "bg-green-500 text-white" : "text-slate-500"}`}
        >
          収入
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Date selector */}
        <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
          <span className="text-xs text-slate-500">日付</span>
          <div className="flex items-center gap-2">
            <button onClick={() => changeDate(-1)} className="p-1 hover:bg-slate-200 rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-bold min-w-[140px] text-center">
              {new Date(expenseDate + "T00:00:00").toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </span>
            <button onClick={() => changeDate(1)} className="p-1 hover:bg-slate-200 rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Memo */}
        <div className="flex items-center bg-slate-50 rounded-lg px-3 py-2">
          <span className="text-xs text-slate-500 w-10">メモ</span>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="未入力"
            className="flex-1 text-sm bg-transparent focus:outline-none"
          />
        </div>

        {/* Amount — text input with numeric keyboard, no spinner arrows */}
        <div className="flex items-center bg-slate-50 rounded-lg px-3 py-2">
          <span className={`text-xs font-bold w-10 ${type === "expense" ? "text-rose-500" : "text-green-500"}`}>
            {type === "expense" ? "支出" : "収入"}
          </span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={amount}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d+$/.test(v)) setAmount(v);
            }}
            placeholder="0"
            className="flex-1 text-lg font-bold bg-transparent focus:outline-none text-right"
          />
          <span className="text-sm text-slate-500 ml-1">円</span>
        </div>

        {/* Category grid */}
        {categories.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">カテゴリー</p>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(categoryId === cat.id ? "" : cat.id)}
                  className={`py-2.5 px-2 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                    categoryId === cat.id
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <ExpenseIcon icon={cat.icon} color={cat.color} size={22} />
                  <span className="text-[10px] font-medium text-slate-700 leading-tight">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {isEdit && onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-3 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100"
            >
              削除
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!amount || isNaN(Number(amount)) || Number(amount) <= 0}
            className={`flex-1 py-3 rounded-lg text-sm font-bold text-white transition-colors ${
              type === "expense"
                ? "bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300"
                : "bg-green-500 hover:bg-green-600 disabled:bg-slate-300"
            } disabled:cursor-not-allowed`}
          >
            {isEdit ? "更新" : type === "expense" ? "支出を入力する" : "収入を入力する"}
          </button>
        </div>
      </div>
    </>
  );

  if (panelMode) {
    return <div className="overflow-y-auto flex-1">{formContent}</div>;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {formContent}
      </div>
    </div>
  );
}
