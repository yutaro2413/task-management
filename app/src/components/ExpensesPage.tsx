"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDate } from "@/lib/utils";

type Expense = {
  id: string;
  date: string;
  amount: number;
  memo: string | null;
};

export default function ExpensesPage() {
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [showForm, setShowForm] = useState(false);

  const fetchExpenses = useCallback(async () => {
    // Fetch current month
    const d = new Date(date);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const res = await fetch(
      `/api/expenses?startDate=${formatDate(start)}&endDate=${formatDate(end)}`
    );
    setExpenses(await res.json());
  }, [date]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount))) return;
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        amount: Number(amount),
        memo: memo.trim() || null,
      }),
    });
    setAmount("");
    setMemo("");
    setShowForm(false);
    fetchExpenses();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
    fetchExpenses();
  };

  const monthTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const currentMonth = new Date(date);

  const changeMonth = (delta: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + delta);
    d.setDate(1);
    setDate(formatDate(d));
  };

  // Group by date
  const byDate = new Map<string, Expense[]>();
  expenses.forEach((e) => {
    const key = e.date.split("T")[0];
    const list = byDate.get(key) || [];
    list.push(e);
    byDate.set(key, list);
  });

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="text-lg font-bold">
            {currentMonth.toLocaleDateString("ja-JP", { year: "numeric", month: "long" })}
          </p>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full space-y-4">
        {/* Monthly total */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
          <p className="text-sm text-slate-500">今月の支出</p>
          <p className="text-3xl font-bold text-rose-600">
            {monthTotal.toLocaleString()}
            <span className="text-base font-normal ml-1">円</span>
          </p>
        </div>

        {/* Expense list by date */}
        {Array.from(byDate.entries()).map(([dateKey, items]) => (
          <div key={dateKey} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex justify-between">
              <p className="text-sm font-semibold">
                {new Date(dateKey + "T00:00:00").toLocaleDateString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  weekday: "short",
                })}
              </p>
              <p className="text-sm font-medium text-slate-600">
                {items.reduce((s, e) => s + e.amount, 0).toLocaleString()}円
              </p>
            </div>
            <div className="divide-y divide-slate-50">
              {items.map((e) => (
                <div key={e.id} className="px-3 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm">{e.memo || "支出"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{e.amount.toLocaleString()}円</span>
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="text-slate-300 hover:text-red-500 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {expenses.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">まだ記録がありません</p>
        )}
      </div>

      {/* Add button / Form */}
      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 pb-8 safe-area-bottom" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">支出を追加</h2>
            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-500 mb-1 block">日付</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-500 mb-1 block">金額</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
                inputMode="numeric"
              />
            </div>
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
      ) : (
        <div className="fixed bottom-20 right-4 z-40">
          <button
            onClick={() => setShowForm(true)}
            className="w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 active:bg-indigo-800 flex items-center justify-center"
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
