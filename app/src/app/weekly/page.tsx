import BottomNav from "@/components/BottomNav";
import WeeklyPage from "@/components/WeeklyPage";

export default function Weekly() {
  return (
    <main className="h-screen flex flex-col pb-20 lg:pb-0">
      <WeeklyPage />
      <BottomNav />
    </main>
  );
}
