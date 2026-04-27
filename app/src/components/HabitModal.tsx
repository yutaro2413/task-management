"use client";

import { useState, useEffect } from "react";
import { toJSTDateString } from "@/lib/utils";

type Habit = {
  id: string;
  name: string;
  color: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
  level5: string;
};

type HabitLog = {
  habitId: string;
  level: number;
};

type SleepSession = {
  date: string;
  sleepAt: string;
  wakeAt: string;
  durationMinutes: number;
};

function formatJSTTime(iso: string) {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

const DISMISS_KEY_PREFIX = "habit-dismiss-";
const SNOOZE_KEY = "habit-snooze-until";
const SNOOZE_MS = 60 * 60 * 1000;
const LEVEL_OPACITIES = [0.15, 0.3, 0.5, 0.75, 1.0];

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function levelColor(hex: string, level: number) {
  const { r, g, b } = hexToRgb(hex);
  const op = LEVEL_OPACITIES[level - 1];
  const mr = Math.round(255 + (r - 255) * op);
  const mg = Math.round(255 + (g - 255) * op);
  const mb = Math.round(255 + (b - 255) * op);
  return `rgb(${mr}, ${mg}, ${mb})`;
}

function levelBorderColor(hex: string, level: number) {
  const { r, g, b } = hexToRgb(hex);
  const op = Math.min(1, LEVEL_OPACITIES[level - 1] + 0.2);
  const mr = Math.round(255 + (r - 255) * op);
  const mg = Math.round(255 + (g - 255) * op);
  const mb = Math.round(255 + (b - 255) * op);
  return `rgb(${mr}, ${mg}, ${mb})`;
}

export default function HabitModal() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayLogs, setTodayLogs] = useState<Map<string, number>>(new Map());
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dontShowToday, setDontShowToday] = useState(false);
  const [sleep, setSleep] = useState<SleepSession | null>(null);

  const today = toJSTDateString();

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY_PREFIX + today);
    if (dismissed) return;
    const snoozeUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    if (snoozeUntil > Date.now()) return;

    Promise.all([
      fetch("/api/habits").then((r) => r.json()),
      fetch(`/api/habit-logs?date=${today}`).then((r) => r.json()),
      fetch(`/api/sleep-sessions?date=${today}`).then((r) => r.json()).catch(() => null),
    ]).then(([habitsData, logsData, sleepData]) => {
      const activeHabits = (habitsData as Habit[]).filter((h) => {
        const hasLevel = h.level1 || h.level2 || h.level3 || h.level4 || h.level5;
        return hasLevel;
      });
      if (activeHabits.length === 0) return;

      const logMap = new Map<string, number>();
      for (const log of logsData as HabitLog[]) {
        logMap.set(log.habitId, log.level);
      }
      setTodayLogs(logMap);

      const hasAllLogged = activeHabits.every((h) => logMap.has(h.id));
      if (hasAllLogged) return;

      setHabits(activeHabits);
      setSelected(new Map(logMap));
      if (sleepData && typeof sleepData === "object" && "sleepAt" in sleepData) {
        setSleep(sleepData as SleepSession);
      }
      setVisible(true);
    });
  }, [today]);

  const handleSelect = (habitId: string, level: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.get(habitId) === level) {
        next.delete(habitId);
      } else {
        next.set(habitId, level);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = Array.from(selected.entries())
        .filter(([id, level]) => todayLogs.get(id) !== level)
        .map(([habitId, level]) =>
          fetch("/api/habit-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: today, habitId, level }),
          })
        );
      await Promise.all(promises);
      localStorage.setItem(DISMISS_KEY_PREFIX + today, "1");
      localStorage.removeItem(SNOOZE_KEY);
      setVisible(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (dontShowToday) {
      localStorage.setItem(DISMISS_KEY_PREFIX + today, "1");
      localStorage.removeItem(SNOOZE_KEY);
    } else {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    }
    setVisible(false);
  };

  if (!visible) return null;

  const getLevels = (h: Habit) => [h.level1, h.level2, h.level3, h.level4, h.level5];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center modal-backdrop px-4">
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[85dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-base font-bold">今日の習慣チェック</h3>
          <p className="text-xs text-slate-400 mt-0.5">達成したレベルをタップしてください</p>
          {sleep && (
            <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
              <span>🌙 {formatJSTTime(sleep.sleepAt)}</span>
              <span className="text-slate-300">→</span>
              <span>☀️ {formatJSTTime(sleep.wakeAt)}</span>
              <span className="ml-1 text-slate-400">({formatDuration(sleep.durationMinutes)})</span>
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {habits.map((habit) => {
            const levels = getLevels(habit);
            const selectedLevel = selected.get(habit.id);

            return (
              <div key={habit.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: habit.color }}
                  />
                  <span className="text-sm font-bold text-slate-700">{habit.name}</span>
                </div>
                <div className="space-y-1">
                  {levels.map((label, i) => {
                    if (!label) return null;
                    const lv = i + 1;
                    const isSelected = selectedLevel === lv;
                    const bg = levelColor(habit.color, lv);
                    const border = levelBorderColor(habit.color, lv);
                    const textDark = lv >= 4;

                    return (
                      <button
                        key={lv}
                        onClick={() => handleSelect(habit.id, lv)}
                        className={`w-full px-3 py-2 rounded-lg text-left transition-all border-2 flex items-center gap-2 ${
                          isSelected ? "ring-2 ring-offset-1" : ""
                        }`}
                        style={{
                          backgroundColor: bg,
                          borderColor: isSelected ? habit.color : border,
                          color: textDark ? "#fff" : "#334155",
                          ["--tw-ring-color" as string]: habit.color,
                        }}
                      >
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected ? "" : ""
                          }`}
                          style={{
                            borderColor: isSelected ? (textDark ? "#fff" : habit.color) : (textDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.15)"),
                            backgroundColor: isSelected ? (textDark ? "#fff" : habit.color) : "transparent",
                          }}
                        >
                          {isSelected && (
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke={textDark ? habit.color : "#fff"}
                              strokeWidth={3}
                            >
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="flex-1">
                          <span className="text-[10px] font-bold opacity-60">Lv.{lv}</span>
                          <span className="text-xs font-medium ml-2">{label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowToday}
              onChange={(e) => setDontShowToday(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-500">今日は表示しない</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleSkip}
              className="flex-1 py-2.5 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50"
            >
              スキップ
            </button>
            <button
              onClick={handleSave}
              disabled={selected.size === 0 || saving}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
