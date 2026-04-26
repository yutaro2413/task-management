"use client";

import { useEffect } from "react";

const THROTTLE_KEY = "last-unlock-post";
const THROTTLE_MS = 600 * 1000; // 10分

export default function SleepTracker() {
  useEffect(() => {
    const post = () => {
      const last = Number(sessionStorage.getItem(THROTTLE_KEY) || 0);
      if (Date.now() - last < THROTTLE_MS) return;
      sessionStorage.setItem(THROTTLE_KEY, String(Date.now()));
      fetch("/api/unlock-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "web" }),
        keepalive: true,
      }).catch(() => {});
    };
    post();
    const onVis = () => {
      if (document.visibilityState === "visible") post();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return null;
}
