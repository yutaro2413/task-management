import BottomNav from "@/components/BottomNav";
import WeeklyPage from "@/components/WeeklyPage";

export default function Weekly() {
  return (
    <main className="flex flex-col min-h-screen pb-20">
      <WeeklyPage />
      <BottomNav />
    </main>
  );
}
