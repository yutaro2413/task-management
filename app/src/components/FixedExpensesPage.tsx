"use client";

import { useState, useEffect, useCallback } from "react";
import ExpenseIcon from "./ExpenseIcon";
import LoadingOverlay from "./LoadingOverlay";
import Link from "next/link";

type ExpenseCategory = { id: string; name: string; color: string; icon: string };
type FixedExpense = {
  id: string;
  title: string;
  amount: number;
  type: string;
  day: number;
  categoryId: string | null;
  category: ExpenseCategory | null;
};

export default function FixedExpensesPage() {
  const [items, setItems] = useState<FixedExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<FixedExpense | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [categoryId, setCategoryId] = useState("");
  const [day, setDay] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, catsRes] = await Promise.all([
        fetch("/api/fixed-expenses"),
        fetch("/api/expense-categories"),
      ]);
      setItems(await itemsRes.json());
      setCategories(await catsRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalMonthly = items
    .filter((i) => i.type === "expense")
    .reduce((s, i) => s + i.amount, 0);

  const openAdd = () => {
    setTitle("");
    setAmount("");
    setType("expense");
    setCategoryId("");
    setDay(1);
    setEditItem(null);
    setShowAdd(true);
  };

  const openEdit = (item: FixedExpense) => {
    setTitle(item.title);
    setAmount(String(item.amount));
    setType(item.type as "expense" | "income");
    setCategoryId(item.categoryId || "");
    setDay(item.day);
    setEditItem(item);
    setShowAdd(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !amount || isNaN(Number(amount))) return;
    setSaving(true);
    try {
      if (editItem) {
        await fetch("/api/fixed-expenses", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editItem.id,
            title: title.trim(),
            amount: Number(amount),
            type,
            categoryId: categoryId || null,
            day,
          }),
        });
      } else {
        await fetch("/api/fixed-expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            amount: Number(amount),
            type,
            categoryId: categoryId || null,
            day,
          }),
        });
      }
      setShowAdd(false);
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    setSaving(true);
    try {
      await fetch(`/api/fixed-expenses?id=${id}`, { method: "DELETE" });
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const moveOrder = async (index: number, dir: -1 | 1) => {
    const list = [...items];
    const t = index + dir;
    if (t < 0 || t >= list.length) return;
    [list[index], list[t]] = [list[t], list[index]];
    setItems(list);
    await fetch("/api/fixed-expenses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder: true, ids: list.map((i) => i.id) }),
    });
  };

  return (
    <div className="flex-1 flex flex-col">
      {saving && <LoadingOverlay />}

      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Link href="/settings" className="p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold">固定費</h1>
          <button onClick={openAdd} className="p-2 rounded-lg hover:bg-slate-100 text-indigo-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto max-w-lg mx-auto w-full">
        {/* Monthly total */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">月額合計(支出)</span>
            <span className="text-lg font-bold text-rose-600">{totalMonthly.toLocaleString()}円</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-12">固定費が登録されていません</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                {/* Reorder */}
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveOrder(idx, -1)} disabled={idx === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-20">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button onClick={() => moveOrder(idx, 1)} disabled={idx === items.length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-20">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>

                {/* Icon */}
                {item.category ? (
                  <ExpenseIcon icon={item.category.icon} color={item.category.color} size={24} />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-slate-200" />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-slate-400">
                    {item.category?.name || "未分類"} ・ 毎月{item.day}日
                  </p>
                </div>

                {/* Amount */}
                <span className={`text-sm font-bold flex-shrink-0 ${
                  item.type === "income" ? "text-green-600" : "text-rose-600"
                }`}>
                  {item.amount.toLocaleString()}円
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-slate-100">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-50">
                    <svg className="w-4 h-4 text-slate-300 hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Type toggle */}
            <div className="flex bg-slate-100 rounded-t-2xl">
              <button
                onClick={() => setType("expense")}
                className={`flex-1 py-3 text-sm font-bold rounded-tl-2xl transition-colors ${
                  type === "expense" ? "bg-rose-500 text-white" : "text-slate-500"
                }`}
              >
                支出
              </button>
              <button
                onClick={() => setType("income")}
                className={`flex-1 py-3 text-sm font-bold rounded-tr-2xl transition-colors ${
                  type === "income" ? "bg-green-500 text-white" : "text-slate-500"
                }`}
              >
                収入
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Title */}
              <div className="flex items-center bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-500 w-16 flex-shrink-0">タイトル</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="固定費の名前"
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                />
              </div>

              {/* Amount */}
              <div className="flex items-center bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-500 w-16 flex-shrink-0">金額</span>
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

              {/* Day */}
              <div className="flex items-center bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-500 w-16 flex-shrink-0">引落日</span>
                <span className="text-sm flex-1">毎月</span>
                <select
                  value={day}
                  onChange={(e) => setDay(Number(e.target.value))}
                  className="text-sm font-bold bg-transparent focus:outline-none"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}日</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              {categories.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">カテゴリー</p>
                  <div className="grid grid-cols-3 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setCategoryId(categoryId === cat.id ? "" : cat.id)}
                        className={`py-2 px-2 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                          categoryId === cat.id
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <ExpenseIcon icon={cat.icon} color={cat.color} size={20} />
                        <span className="text-[10px] font-medium text-slate-700 leading-tight">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={!title.trim() || !amount || isNaN(Number(amount))}
                className="w-full py-3 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                {editItem ? "更新" : "追加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
