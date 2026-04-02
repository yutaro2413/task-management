export function slotToTime(slotIndex: number): string {
  const hours = Math.floor(slotIndex / 2);
  const minutes = slotIndex % 2 === 0 ? "00" : "30";
  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
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
