import BottomNav from "@/components/BottomNav";
import TimelinePage from "@/components/TimelinePage";

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen pb-20">
      <TimelinePage />
      <BottomNav />
    </main>
  );
}
