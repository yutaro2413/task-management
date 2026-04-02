"use client";

import { useState, useEffect } from "react";

type ExpenseCategory = { id: string; name: string };

type Props = {
  date: string;
  onSave: () => void;
  onClose: () => void;
};

export default function ExpenseModal({ date, onSave, onClose }: Props) {
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [categoryId, setCategoryId] = useState("");
  const [memo, setMemo] = useState("");
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  useEffect(() => {
    fetch("/api/expense-categories")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount))) return;
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        amount: Number(amount),
        type,
        categoryId: categoryId || null,
        memo: memo.trim() || null,
      }),
    });
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">家計簿を追加</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Type toggle */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 mb-3">
          <button
            onClick={() => setType("expense")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              type === "expense" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500"
            }`}
          >
            支出
          </button>
          <button
            onClick={() => setType("income")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              type === "income" ? "bg-white text-green-600 shadow-sm" : "text-slate-500"
            }`}
          >
            収入
          </button>
        </div>

        {/* Amount */}
        <div className="mb-3">
          <label className="text-xs font-semibold text-slate-500 mb-1 block">金額</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1000"
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            inputMode="numeric"
          />
        </div>

        {/* Category */}
        {categories.length > 0 && (
          <div className="mb-3">
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">カテゴリ</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryId("")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  !categoryId ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                なし
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    categoryId === cat.id
                      ? "bg-rose-500 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Memo */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-500 mb-1 block">メモ</label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="ランチ、交通費など"
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!amount || isNaN(Number(amount))}
          className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          保存
        </button>
      </div>
    </div>
  );
}
