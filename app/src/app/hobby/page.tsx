import BottomNav from "@/components/BottomNav";
import HobbyPage from "@/components/HobbyPage";

export default function Hobby() {
  return (
    <main className="h-screen flex flex-col pb-20 lg:pb-0">
      <HobbyPage />
      <BottomNav />
    </main>
  );
}
