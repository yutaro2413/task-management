import FixedExpensesPage from "@/components/FixedExpensesPage";
import BottomNav from "@/components/BottomNav";

export default function Page() {
  return (
    <main className="h-screen flex flex-col pb-20 lg:pb-0">
      <FixedExpensesPage />
      <BottomNav />
    </main>
  );
}
