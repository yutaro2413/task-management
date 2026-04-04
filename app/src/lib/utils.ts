export function slotToTime(slotIndex: number): string {
  const hours = Math.floor(slotIndex / 2);
  const minutes = slotIndex % 2 === 0 ? "00" : "30";
  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}

// JST date string (YYYY-MM-DD) from a Date or "now"
export function toJSTDateString(date?: Date): string {
  const d = date || new Date();
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

// JST current slot index
export function getCurrentSlotJST(): number {
  const now = new Date();
  const jstHours = (now.getUTCHours() + 9) % 24;
  const jstMinutes = now.getUTCMinutes();
  return jstHours * 2 + (jstMinutes >= 30 ? 1 : 0);
}

/** Extract YYYY-MM-DD from an ISO date string, interpreted as JST */
export function toJSTDateKey(isoString: string): string {
  const d = new Date(isoString);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((day + 6) % 7));
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function getDayLabel(date: Date): string {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`;
}

export function getMonthDates(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

export function getMonthLabel(year: number, month: number): string {
  return `${year}年${month + 1}月`;
}

// Generate time slot options (30-min increments)
export function getSlotOptions(): { value: number; label: string }[] {
  return Array.from({ length: 48 }, (_, i) => ({
    value: i,
    label: slotToTime(i),
  }));
}

/** Display label: slots ≥ 48 are shown as "翌HH:MM" (cross-midnight) */
export function slotToTimeLabel(slotIndex: number): string {
  if (slotIndex >= 48) return `翌${slotToTime(slotIndex - 48)}`;
  return slotToTime(slotIndex);
}

/** End-slot options from startSlot+1 up to 翌04:00 (slot 56), labeled with "翌" prefix for cross-midnight */
export function getEndSlotOptions(startSlot: number): { value: number; label: string }[] {
  const maxEnd = 56; // 翌04:00
  const options: { value: number; label: string }[] = [];
  for (let slot = startSlot + 1; slot <= maxEnd; slot++) {
    options.push({ value: slot, label: slotToTimeLabel(slot) });
  }
  return options;
}
