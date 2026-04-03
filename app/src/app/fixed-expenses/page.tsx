import FixedExpensesPage from "@/components/FixedExpensesPage";
import BottomNav from "@/components/BottomNav";

export default function Page() {
  return (
    <main className="flex flex-col min-h-screen pb-20">
      <FixedExpensesPage />
      <BottomNav />
    </main>
  );
}
