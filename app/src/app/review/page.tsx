import BottomNav from "@/components/BottomNav";
import ReviewPage from "@/components/ReviewPage";

export default function Review() {
  return (
    <main className="h-screen flex flex-col pb-20 lg:pb-0">
      <ReviewPage />
      <BottomNav />
    </main>
  );
}
