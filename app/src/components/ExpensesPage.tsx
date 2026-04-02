"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDate, toJSTDateString } from "@/lib/utils";
import ExpenseModal from "./ExpenseModal";
import ExpenseIcon from "./ExpenseIcon";

type ExpenseCategory = { id: string; name: string; color: string; icon: string } | null;
type Expense = {
  id: string;
  date: string;
  amount: number;
  type: string;
  memo: string | null;
  category: ExpenseCategory;
};

export default function ExpensesPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);

  const startDate = formatDate(new Date(year, month, 1));
  const endDate = formatDate(new Date(year, month + 1, 0));

  const fetchExpenses = useCallback(async () => {
    const res = await fetch(`/api/expenses?startDate=${startDate}&endDate=${endDate}`);
    setExpenses(await res.json());
  }, [startDate, endDate]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const changeMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelectedDate(null);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
    fetchExpenses();
  };

  // Daily totals
  const dailyTotals = new Map<string, { income: number; expense: number }>();
  expenses.forEach((e) => {
    const dateKey = e.date.split("T")[0];
    const totals = dailyTotals.get(dateKey) || { income: 0, expense: 0 };
    if (e.type === "income") {
      totals.income += e.amount;
    } else {
      totals.expense += e.amount;
    }
    dailyTotals.set(dateKey, totals);
  });

  // Monthly totals
  const monthlyIncome = expenses.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const monthlyExpense = expenses.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const monthlyBalance = monthlyIncome - monthlyExpense;

  // Calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDay.getDate();
  const today = toJSTDateString();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  // Selected date's expenses
  const selectedExpenses = selectedDate
    ? expenses.filter((e) => e.date.split("T")[0] === selectedDate)
    : [];

  const selectedDateTotal = selectedDate
    ? dailyTotals.get(selectedDate)
    : null;

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
          <div className="text-center">
            <p className="text-lg font-bold">{year}年{month + 1}月</p>
            <p className="text-xs text-slate-400">
              {formatDate(new Date(year, month, 1))} - {formatDate(new Date(year, month + 1, 0))}
            </p>
          </div>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto max-w-lg mx-auto w-full">
        {/* Calendar */}
        <div className="px-2 py-2">
          {/* Day headers */}
          <div className="grid grid-cols-7 text-center mb-1">
            {["月", "火", "水", "木", "金", "土", "日"].map((d, i) => (
              <span
                key={d}
                className={`text-xs font-medium py-1 ${
                  i === 5 ? "text-blue-500" : i === 6 ? "text-red-500" : "text-slate-500"
                }`}
              >
                {d}
              </span>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              if (day === null) return <div key={idx} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const totals = dailyTotals.get(dateStr);
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const dayOfWeek = idx % 7;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`py-1 px-0.5 text-center border border-transparent rounded-lg min-h-[3.5rem] flex flex-col items-center transition-colors ${
                    isSelected
                      ? "bg-indigo-50 border-indigo-300"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`text-xs font-medium ${
                      isToday
                        ? "bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center"
                        : dayOfWeek === 5
                        ? "text-blue-500"
                        : dayOfWeek === 6
                        ? "text-red-500"
                        : "text-slate-700"
                    }`}
                  >
                    {day}
                  </span>
                  {totals && (
                    <div className="mt-0.5">
                      {totals.expense > 0 && (
                        <p className="text-[9px] text-rose-500 font-medium leading-tight">
                          {totals.expense >= 10000
                            ? `${Math.round(totals.expense / 1000)}k`
                            : totals.expense.toLocaleString()}
                        </p>
                      )}
                      {totals.income > 0 && (
                        <p className="text-[9px] text-green-500 font-medium leading-tight">
                          {totals.income >= 10000
                            ? `${Math.round(totals.income / 1000)}k`
                            : totals.income.toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Monthly summary */}
        <div className="grid grid-cols-3 gap-2 px-4 py-3 border-t border-b border-slate-200 bg-slate-50">
          <div className="text-center">
            <p className="text-xs text-slate-500">収入</p>
            <p className="text-sm font-bold text-green-600">{monthlyIncome.toLocaleString()}円</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">支出</p>
            <p className="text-sm font-bold text-rose-600">{monthlyExpense.toLocaleString()}円</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">合計</p>
            <p className={`text-sm font-bold ${monthlyBalance >= 0 ? "text-green-600" : "text-rose-600"}`}>
              {monthlyBalance >= 0 ? "" : "-"}{Math.abs(monthlyBalance).toLocaleString()}円
            </p>
          </div>
        </div>

        {/* Selected date detail */}
        {selectedDate && (
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("ja-JP", {
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })}
              </h3>
              {selectedDateTotal && (
                <span className="text-xs text-slate-500">
                  -{selectedDateTotal.expense.toLocaleString()}円
                </span>
              )}
            </div>

            {selectedExpenses.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">記録なし</p>
            ) : (
              <div className="space-y-1">
                {selectedExpenses.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between py-2.5 border-b border-slate-100"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {e.category && (
                        <ExpenseIcon icon={e.category.icon} color={e.category.color} size={20} />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {e.category?.name || "未分類"}
                        </p>
                        {e.memo && (
                          <p className="text-xs text-slate-400 truncate">({e.memo})</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${e.type === "income" ? "text-green-600" : "text-slate-800"}`}>
                        {e.amount.toLocaleString()}円
                      </span>
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
            )}
          </div>
        )}

        {!selectedDate && expenses.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">まだ記録がありません</p>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 z-40">
        <button
          onClick={() => setShowInput(true)}
          className="w-14 h-14 rounded-full bg-rose-500 text-white shadow-lg hover:bg-rose-600 active:bg-rose-700 flex items-center justify-center"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Input modal */}
      {showInput && (
        <ExpenseModal
          date={selectedDate || toJSTDateString()}
          onSave={() => {
            setShowInput(false);
            fetchExpenses();
          }}
          onClose={() => setShowInput(false)}
        />
      )}
    </div>
  );
}
