"use client";

import { useState, useEffect, useCallback } from "react";
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

function formatJSTDateLabel(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
  return `${m}/${d} (${wd})`;
}

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
  const [existingLogs, setExistingLogs] = useState<Map<string, number>>(new Map());
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sleep, setSleep] = useState<SleepSession | null>(null);
  const [targetDate, setTargetDate] = useState<string>(() => toJSTDateString());

  const loadAndMaybeShow = useCallback(
    async (date: string, opts: { autoOpen: boolean }) => {
      const [habitsData, logsData, sleepData] = await Promise.all([
        fetch("/api/habits").then((r) => r.json()),
        fetch(`/api/habit-logs?date=${date}`).then((r) => r.json()),
        fetch(`/api/sleep-sessions?date=${date}`)
          .then((r) => r.json())
          .catch(() => null),
      ]);

      const activeHabits = (habitsData as Habit[]).filter(
        (h) => h.level1 || h.level2 || h.level3 || h.level4 || h.level5
      );
      if (activeHabits.length === 0) return;

      const logMap = new Map<string, number>();
      for (const log of logsData as HabitLog[]) {
        logMap.set(log.habitId, log.level);
      }

      if (opts.autoOpen) {
        const hasAllLogged = activeHabits.every((h) => logMap.has(h.id));
        if (hasAllLogged) return;
      }

      setHabits(activeHabits);
      setExistingLogs(logMap);
      setSelected(new Map(logMap));
      setSleep(
        sleepData && typeof sleepData === "object" && "sleepAt" in sleepData
          ? (sleepData as SleepSession)
          : null
      );
      setTargetDate(date);
      setVisible(true);
    },
    []
  );

  useEffect(() => {
    loadAndMaybeShow(toJSTDateString(), { autoOpen: true });
  }, [loadAndMaybeShow]);

  useEffect(() => {
    const handler = (e: Event) => {
      const date = (e as CustomEvent<{ date: string }>).detail?.date;
      if (!date) return;
      loadAndMaybeShow(date, { autoOpen: false });
    };
    window.addEventListener("open-habit-modal", handler);
    return () => window.removeEventListener("open-habit-modal", handler);
  }, [loadAndMaybeShow]);

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
        .filter(([id, level]) => existingLogs.get(id) !== level)
        .map(([habitId, level]) =>
          fetch("/api/habit-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: targetDate, habitId, level }),
          })
        );
      await Promise.all(promises);
      window.dispatchEvent(new CustomEvent("habit-logs-updated"));
      setVisible(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setVisible(false);
  };

  if (!visible) return null;

  const getLevels = (h: Habit) => [h.level1, h.level2, h.level3, h.level4, h.level5];
  const today = toJSTDateString();
  const isToday = targetDate === today;
  const titleLabel = isToday ? "今日の習慣チェック" : `${formatJSTDateLabel(targetDate)}の習慣`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center modal-backdrop px-4">
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[85dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-base font-bold">{titleLabel}</h3>
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
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0`}
                          style={{
                            borderColor: isSelected
                              ? textDark
                                ? "#fff"
                                : habit.color
                              : textDark
                              ? "rgba(255,255,255,0.5)"
                              : "rgba(0,0,0,0.15)",
                            backgroundColor: isSelected
                              ? textDark
                                ? "#fff"
                                : habit.color
                              : "transparent",
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
                  {(() => {
                    const isSelected = selectedLevel === 0;
                    return (
                      <button
                        key={0}
                        onClick={() => handleSelect(habit.id, 0)}
                        className={`w-full px-3 py-2 rounded-lg text-left transition-all border-2 flex items-center gap-2 bg-slate-100 ${
                          isSelected
                            ? "ring-2 ring-offset-1 ring-slate-400 border-slate-400"
                            : "border-slate-200"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0`}
                          style={{
                            borderColor: isSelected ? "#64748b" : "rgba(0,0,0,0.15)",
                            backgroundColor: isSelected ? "#64748b" : "transparent",
                          }}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3}>
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="flex-1 text-slate-500">
                          <span className="text-[10px] font-bold opacity-60">Lv.0</span>
                          <span className="text-xs font-medium ml-2">できなかった</span>
                        </span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0">
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
