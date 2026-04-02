type Props = {
  icon: string;
  color: string;
  size?: number;
};

const iconPaths: Record<string, string> = {
  cart: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z",
  food: "M3 3h2v18H3V3zm5 0v7c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2V3m-3 0v18m5-18v18c2.2 0 4-1.8 4-4v-3c0-2.2-1.8-4-4-4",
  dinner: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14c-2.33 0-4.5-1.17-5.78-3.12C7.73 14.33 10 13.5 12 13.5s4.27.83 5.78 2.38C16.5 17.83 14.33 19 12 19z",
  hobby: "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8",
  heart: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  coffee: "M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3",
  book: "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
  party: "M5.8 11.3L2 22l10.7-3.8M5.8 11.3l4.6 4.6M5.8 11.3l6.5-6.5M16.5 4.8l2.7 2.7M10.4 15.9l6.5-6.5M16.9 9.4l2.7 2.7M22 2l-5.5 5.5",
  hotel: "M3 21h18M3 7v14M21 7v14M6 11h4v4H6v-4zm8 0h4v4h-4v-4zM3 7l9-4 9 4",
  train: "M4 11V4a2 2 0 012-2h12a2 2 0 012 2v7M4 11l-2 9h20l-2-9M4 11h16M8 18h.01M16 18h.01M12 2v9",
  daily: "M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z",
  device: "M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2zm0 0V4m16 2V4M1 20h22",
  clothes: "M12 2L8 6H4l2 16h12l2-16h-4l-4-4z",
  invest: "M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07",
  house: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  pc: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  card: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H5a3 3 0 00-3 3v8a3 3 0 003 3z",
  default: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z",
};

export const EXPENSE_ICON_OPTIONS = Object.keys(iconPaths);

export default function ExpenseIcon({ icon, color, size = 20 }: Props) {
  const path = iconPaths[icon] || iconPaths.default;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}
