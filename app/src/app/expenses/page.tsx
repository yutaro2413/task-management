import BottomNav from "@/components/BottomNav";
import ExpensesPage from "@/components/ExpensesPage";

export default function Expenses() {
  return (
    <main className="flex flex-col min-h-screen pb-20">
      <ExpensesPage />
      <BottomNav />
    </main>
  );
}
