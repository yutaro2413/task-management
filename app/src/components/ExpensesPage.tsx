"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatDate, toJSTDateString, toJSTDateKey } from "@/lib/utils";
import { cachedFetch, invalidateCache, MASTER_TTL } from "@/lib/cache";
import { useSwipe } from "@/hooks/useSwipe";
import ExpenseModal from "./ExpenseModal";
import ExpenseIcon from "./ExpenseIcon";
import LoadingOverlay from "./LoadingOverlay";

type ExpenseCategory = { id: string; name: string; color: string; icon: string } | null;
type Expense = {
  id: string;
  date: string;
  amount: number;
  type: string;
  memo: string | null;
  category: ExpenseCategory;
};
type FixedExpense = {
  id: string;
  title: string;
  amount: number;
  type: string;
  category: ExpenseCategory;
};

export default function ExpensesPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFixed, setShowFixed] = useState(false);
  const hasData = useRef(false);

  const startDate = formatDate(new Date(year, month, 1));
  const endDate = formatDate(new Date(year, month + 1, 0));

  const fetchExpenses = useCallback(async (bustCache = false) => {
    setFetching(true);
    try {
      if (bustCache) invalidateCache("expenses");

      const [expData, fixedData] = await Promise.all([
        cachedFetch<Expense[]>(`/api/expenses?startDate=${startDate}&endDate=${endDate}`),
        cachedFetch<FixedExpense[]>("/api/fixed-expenses", MASTER_TTL),
      ]);
      setExpenses(expData);
      setFixedExpenses(fixedData);
      hasData.current = true;
    } finally {
      setFetching(false);
    }
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

  const swipeHandlers = useSwipe(
    () => changeMonth(1),   // swipe left → next month
    () => changeMonth(-1),  // swipe right → prev month
  );

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
      await fetchExpenses(true);
    } finally {
      setSaving(false);
    }
  };

  // Totals
  const fixedExpenseTotal = fixedExpenses.filter((f) => f.type === "expense").reduce((s, f) => s + f.amount, 0);
  const fixedIncomeTotal = fixedExpenses.filter((f) => f.type === "income").reduce((s, f) => s + f.amount, 0);

  const dailyTotals = new Map<string, { income: number; expense: number }>();
  expenses.forEach((e) => {
    const dateKey = toJSTDateKey(e.date);
    const totals = dailyTotals.get(dateKey) || { income: 0, expense: 0 };
    if (e.type === "income") totals.income += e.amount;
    else totals.expense += e.amount;
    dailyTotals.set(dateKey, totals);
  });

  const varIncome = expenses.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const varExpense = expenses.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const totalIncome = varIncome + fixedIncomeTotal;
  const totalExpense = varExpense + fixedExpenseTotal;
  const balance = totalIncome - totalExpense;

  // Calendar
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const today = toJSTDateString();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const selectedExpenses = selectedDate ? expenses.filter((e) => toJSTDateKey(e.date) === selectedDate) : [];
  const selectedDateTotal = selectedDate ? dailyTotals.get(selectedDate) : null;

  // ── Shared calendar + summary section ──────────────────────────────────────
  const calendarSection = (
    <>
      {/* Calendar */}
      <div className="px-2 py-2">
        <div className="grid grid-cols-7 text-center mb-1">
          {["月", "火", "水", "木", "金", "土", "日"].map((d, i) => (
            <span key={d} className={`text-xs font-medium py-1 ${i === 5 ? "text-blue-500" : i === 6 ? "text-red-500" : "text-slate-500"}`}>{d}</span>
          ))}
        </div>
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
                onClick={() => {
                  setSelectedDate(isSelected ? null : dateStr);
                  setShowInput(false);
                }}
                className={`py-1 px-0.5 text-center border border-transparent rounded-lg min-h-[3.5rem] flex flex-col items-center transition-colors ${
                  isSelected ? "bg-indigo-50 border-indigo-300" : "hover:bg-slate-50"
                }`}
              >
                <span className={`text-xs font-medium ${
                  isToday ? "bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center"
                  : dayOfWeek === 5 ? "text-blue-500" : dayOfWeek === 6 ? "text-red-500" : "text-slate-700"
                }`}>{day}</span>
                {totals && (
                  <div className="mt-0.5">
                    {totals.expense > 0 && <p className="text-[9px] text-rose-500 font-medium leading-tight">{totals.expense >= 10000 ? `${Math.round(totals.expense / 1000)}k` : totals.expense.toLocaleString()}</p>}
                    {totals.income > 0 && <p className="text-[9px] text-green-500 font-medium leading-tight">{totals.income >= 10000 ? `${Math.round(totals.income / 1000)}k` : totals.income.toLocaleString()}</p>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Monthly summary */}
      <div className="px-4 py-3 border-t border-b border-slate-200 bg-slate-50 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-xs text-slate-500">収入</p>
            <p className="text-sm font-bold text-green-600">{totalIncome.toLocaleString()}円</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">支出</p>
            <p className="text-sm font-bold text-rose-600">{totalExpense.toLocaleString()}円</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">収支</p>
            <p className={`text-sm font-bold ${balance >= 0 ? "text-green-600" : "text-rose-600"}`}>
              {balance >= 0 ? "" : "-"}{Math.abs(balance).toLocaleString()}円
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">変動費: {varExpense.toLocaleString()}円</span>
          <button onClick={() => setShowFixed(!showFixed)} className="text-indigo-600 font-medium flex items-center gap-0.5">
            固定費: {fixedExpenseTotal.toLocaleString()}円
            <svg className={`w-3 h-3 transition-transform ${showFixed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
        {showFixed && fixedExpenses.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 mt-1">
            {fixedExpenses.map((f) => (
              <div key={f.id} className="px-3 py-2 flex items-center gap-2">
                {f.category && <ExpenseIcon icon={f.category.icon} color={f.category.color} size={16} />}
                <span className="text-xs flex-1 truncate">{f.title}</span>
                <span className={`text-xs font-medium ${f.type === "income" ? "text-green-600" : "text-rose-600"}`}>{f.amount.toLocaleString()}円</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  // ── Shared date detail section ──────────────────────────────────────────────
  const dateDetailSection = selectedDate ? (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold">
          {new Date(selectedDate + "T00:00:00").toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}
        </h3>
        {selectedDateTotal && <span className="text-xs text-slate-500">-{selectedDateTotal.expense.toLocaleString()}円</span>}
      </div>
      {selectedExpenses.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">記録なし</p>
      ) : (
        <div className="space-y-1">
          {selectedExpenses.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                setEditingExpense(e);
                setShowInput(false);
              }}
              className="w-full flex items-center justify-between py-2.5 border-b border-slate-100 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {e.category && <ExpenseIcon icon={e.category.icon} color={e.category.color} size={20} />}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{e.category?.name || "未分類"}</p>
                  {e.memo && <p className="text-xs text-slate-400 truncate">({e.memo})</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${e.type === "income" ? "text-green-600" : "text-slate-800"}`}>{e.amount.toLocaleString()}円</span>
                <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {saving && <LoadingOverlay />}

      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto lg:max-w-none" {...swipeHandlers}>
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="text-center flex items-center gap-2">
            <p className="text-lg font-bold">{year}年{month + 1}月</p>
            {fetching && (
              <div className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            )}
          </div>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </header>

      {/* ── Mobile layout ── */}
      <div className="flex-1 overflow-y-auto pb-16 max-w-lg mx-auto w-full lg:hidden" {...swipeHandlers}>
        {calendarSection}
        {dateDetailSection}
        {!selectedDate && !fetching && expenses.length === 0 && hasData.current && (
          <p className="text-center text-sm text-slate-400 py-8">まだ記録がありません</p>
        )}
      </div>

      {/* ── PC layout ── */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        {/* Left: calendar + summary */}
        <div className="flex-1 overflow-y-auto border-r border-slate-200" {...swipeHandlers}>
          {calendarSection}
          {!selectedDate && !fetching && expenses.length === 0 && hasData.current && (
            <p className="text-center text-sm text-slate-400 py-8">まだ記録がありません</p>
          )}
        </div>

        {/* Right panel: date detail + add form */}
        <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden bg-white">
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-semibold text-slate-700">
              {showInput ? "家計簿を追加" : selectedDate
                ? new Date(selectedDate + "T00:00:00").toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })
                : "詳細"}
            </h3>
            <div className="flex items-center gap-1">
              {!showInput && selectedDate && (
                <button
                  onClick={() => setShowInput(true)}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-rose-50 text-rose-600 hover:bg-rose-100"
                >
                  ＋ 追加
                </button>
              )}
              {showInput && (
                <button onClick={() => setShowInput(false)} className="p-1 rounded-lg hover:bg-slate-100">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Panel content */}
          {showInput ? (
            <ExpenseModal
              date={selectedDate || today}
              onSave={() => { setShowInput(false); fetchExpenses(true); }}
              onClose={() => setShowInput(false)}
              panelMode
            />
          ) : selectedDate ? (
            <div className="overflow-y-auto flex-1">
              {dateDetailSection}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
              <p className="text-xs text-slate-400 text-center">
                カレンダーの日付をクリックして<br />詳細を表示
              </p>
              <button
                onClick={() => setShowInput(true)}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-rose-500 text-white hover:bg-rose-600"
              >
                ＋ 家計簿を追加
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FAB — mobile only */}
      <div className="fixed bottom-16 right-4 z-40 lg:hidden">
        <button
          onClick={() => setShowInput(true)}
          className="w-14 h-14 rounded-full bg-rose-500 text-white shadow-lg hover:bg-rose-600 active:bg-rose-700 flex items-center justify-center"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>

      {/* Mobile modal — create */}
      {showInput && (
        <div className="lg:hidden">
          <ExpenseModal
            date={selectedDate || today}
            onSave={() => { setShowInput(false); fetchExpenses(true); }}
            onClose={() => setShowInput(false)}
          />
        </div>
      )}

      {/* Edit modal — both mobile and PC */}
      {editingExpense && (
        <ExpenseModal
          key={editingExpense.id}
          date={toJSTDateKey(editingExpense.date)}
          editExpense={{ ...editingExpense, date: toJSTDateKey(editingExpense.date) }}
          onSave={() => { setEditingExpense(null); fetchExpenses(true); }}
          onDelete={async () => {
            await handleDelete(editingExpense.id);
            setEditingExpense(null);
          }}
          onClose={() => setEditingExpense(null)}
        />
      )}
    </div>
  );
}
