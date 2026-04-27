import BottomNav from "@/components/BottomNav";
import TimelinePage from "@/components/TimelinePage";

export default function Home() {
  return (
    <main className="h-screen flex flex-col pb-20 lg:pb-0">
      <TimelinePage />
      <BottomNav />
    </main>
  );
}
