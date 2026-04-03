import BottomNav from "@/components/BottomNav";
import ExpensesPage from "@/components/ExpensesPage";

export default function Expenses() {
  return (
    <main className="h-screen flex flex-col pb-20 lg:pb-0">
      <ExpensesPage />
      <BottomNav />
    </main>
  );
}
