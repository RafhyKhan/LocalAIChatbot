/**
 * Overlay — the first thing seen on app load.
 *
 * Full-screen black layer that sits above everything (sidebar + dashboard).
 * Contains only:
 *   - Time-based generic greeting (no personal info)
 *   - Today's weather (slim — icon, temp, description only)
 *   - Google Search bar (full functionality, reused component)
 *   - Down arrow at bottom center to dismiss
 *
 * Animation: CSS translateY(-100%) slide — triggered by the `visible` prop.
 * Parent (App.tsx) owns the visible state. This component is always in the DOM.
 *
 * To add/remove content from the overlay, edit only this file and Overlay.css.
 */

import { useEffect, useState } from "react";
import { BASE } from "../api";
import GoogleSearchWidget from "./widgets/GoogleSearchWidget";
import "./Overlay.css";

// ── Today's weather (slim) ────────────────────────────────────────────────────

interface TodayWeather {
  icon:        string;
  description: string;
  max_c:       number;
  min_c:       number;
}

function OverlayWeather() {
  const [today, setToday] = useState<TodayWeather | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/weather`)
      .then((r) => r.json())
      .then((d) => {
        const day = d.days?.[0];
        if (day) setToday({ icon: day.icon, description: day.description, max_c: day.max_c, min_c: day.min_c });
      })
      .catch(() => {});
  }, []);

  if (!today) return <div className="overlay-weather-loading">Loading weather…</div>;

  return (
    <div className="overlay-weather">
      <span className="overlay-weather-icon">{today.icon}</span>
      <span className="overlay-weather-temp">{today.max_c}° / {today.min_c}°C</span>
      <span className="overlay-weather-sep">·</span>
      <span className="overlay-weather-desc">{today.description}</span>
    </div>
  );
}

// ── Greeting ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "Good Morning";
  if (h >= 12 && h < 17) return "Good Afternoon";
  if (h >= 17 && h < 21) return "Good Evening";
  return "Good Night";
}

// ── Overlay ───────────────────────────────────────────────────────────────────

interface OverlayProps {
  visible:   boolean;
  onDismiss: () => void;
}

export default function Overlay({ visible, onDismiss }: OverlayProps) {
  return (
    <div className={`overlay${visible ? "" : " overlay--hidden"}`}>

      {/* ── Today's weather ── */}
      <OverlayWeather />

      {/* ── Greeting ── */}
      <h1 className="overlay-greeting">{getGreeting()}</h1>

      {/* ── Search bar ── */}
      <div className="overlay-search">
        <GoogleSearchWidget />
      </div>

      {/* ── Dismiss arrow ── */}
      <button className="overlay-dismiss-btn" onClick={onDismiss} title="Go to dashboard">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

    </div>
  );
}
