"use client";

import { useState, useEffect } from "react";
import ExpenseIcon from "./ExpenseIcon";
import LoadingOverlay from "./LoadingOverlay";

type ExpenseCategory = { id: string; name: string; color: string; icon: string };

type Props = {
  date: string;
  onSave: () => void;
  onClose: () => void;
  /** PC right-panel mode: renders inline without backdrop */
  panelMode?: boolean;
};

export default function ExpenseModal({ date, onSave, onClose, panelMode = false }: Props) {
  const [expenseDate, setExpenseDate] = useState(date);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [categoryId, setCategoryId] = useState("");
  const [memo, setMemo] = useState("");
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/expense-categories")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  // Sync date if parent changes it (e.g. date navigation)
  useEffect(() => {
    setExpenseDate(date);
  }, [date]);

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount))) return;
    setSaving(true);
    try {
      await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: expenseDate,
          amount: Number(amount),
          type,
          categoryId: categoryId || null,
          memo: memo.trim() || null,
        }),
      });
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

        {/* Amount */}
        <div className="flex items-center bg-slate-50 rounded-lg px-3 py-2">
          <span className={`text-xs font-bold w-10 ${type === "expense" ? "text-rose-500" : "text-green-500"}`}>
            {type === "expense" ? "支出" : "収入"}
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="flex-1 text-lg font-bold bg-transparent focus:outline-none text-right"
            inputMode="numeric"
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

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!amount || isNaN(Number(amount))}
          className={`w-full py-3 rounded-lg text-sm font-bold text-white transition-colors ${
            type === "expense"
              ? "bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300"
              : "bg-green-500 hover:bg-green-600 disabled:bg-slate-300"
          } disabled:cursor-not-allowed`}
        >
          {type === "expense" ? "支出" : "収入"}を入力する
        </button>
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
