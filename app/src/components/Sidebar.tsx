"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "記録", icon: "clock" },
  { href: "/weekly", label: "サマリー", icon: "chart" },
  { href: "/hobby", label: "趣味/習慣", icon: "hobby" },
  { href: "/expenses", label: "家計簿", icon: "wallet" },
  { href: "/settings", label: "設定", icon: "gear" },
];

const icons: Record<string, React.ReactNode> = {
  clock: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  chart: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M3 3v18h18" />
      <path d="M7 16l4-8 4 4 4-6" />
    </svg>
  ),
  hobby: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  wallet: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <circle cx="16" cy="14" r="1" />
    </svg>
  ),
  gear: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
};

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="hidden lg:flex fixed left-0 top-0 h-full w-16 bg-white border-r border-slate-200 z-50 flex-col items-center py-6 gap-1">
      {navItems.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl w-12 transition-colors ${
              isActive
                ? "bg-indigo-50 text-indigo-600"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            {icons[item.icon]}
            <span className="text-[9px] font-medium leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
