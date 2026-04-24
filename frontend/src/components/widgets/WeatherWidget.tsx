/**
 * WeatherWidget — 7-day Calgary forecast from Open-Meteo via /api/weather.
 * Self-contained: fetches its own data, handles loading + error states.
 * Left/right arrow buttons scroll the card row when all 7 days don't fit.
 * Each day card has a small note field — notes are saved to localStorage.
 */
import { useEffect, useRef, useState } from "react";
import { BASE } from "../../api";

interface DayForecast {
  date: string;
  day: string;
  code: number;
  icon: string;
  description: string;
  max_c: number;
  min_c: number;
  wind_kmph:  number;
  precip_mm:  number;
  precip_prob: number;
}

interface WeatherData {
  days: DayForecast[];
  location: string;
  error?: string;
}

// ── Notes persistence ─────────────────────────────────────────────────────────

const NOTES_KEY = "rainai_weather_notes";

function loadNotes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) ?? "{}"); }
  catch { return {}; }
}

function saveNotes(notes: Record<string, string>) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCardDate(dateStr: string): string {
  // Use noon to avoid timezone-shift issues with YYYY-MM-DD strings
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString([], { month: "long", day: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeatherWidget() {
  const [data,    setData]    = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes,   setNotes]   = useState<Record<string, string>>(loadNotes);
  const scrollRef             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${BASE}/api/weather`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ days: [], location: "Calgary, AB", error: "unavailable" }))
      .finally(() => setLoading(false));
  }, []);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "right" ? 280 : -280, behavior: "smooth" });
  };

  function handleNote(date: string, value: string) {
    const next = { ...notes, [date]: value };
    setNotes(next);
    saveNotes(next);
  }

  return (
    <div className="widget weather-widget">
      <div className="widget-header">
        <span className="widget-title">📍 {data?.location ?? "Calgary, AB"}</span>
        <span className="widget-subtitle">7-Day Forecast · Open-Meteo</span>
      </div>

      {loading && <div className="widget-placeholder">Loading forecast…</div>}

      {!loading && (!data || data.days.length === 0) && (
        <div className="widget-placeholder">Weather unavailable — check your connection.</div>
      )}

      {!loading && data && data.days.length > 0 && (
        <div className="weather-scroll-wrap">
          <button className="scroll-arrow" onClick={() => scroll("left")} aria-label="Scroll left">‹</button>

          <div className="weather-cards" ref={scrollRef}>
            {data.days.map((day, i) => (
              <div key={day.date} className={`weather-card${i === 0 ? " weather-card-today" : ""}`}>
                <div className="wc-day">{day.day} · {formatCardDate(day.date)}</div>
                <div className="wc-icon">{day.icon}</div>
                <div className="wc-desc">{day.description}</div>
                <div className="wc-temps">
                  <span className="wc-max">{day.max_c}°</span>
                  <span className="wc-min">{day.min_c}°</span>
                </div>
                <div className="wc-detail wc-detail-row">
                  <span>💨 {day.wind_kmph} km/h</span>
                  <span>💧 {day.precip_prob}%</span>
                </div>
                {/* ── Day note — saved to localStorage ── */}
                <textarea
                  className="wc-note"
                  placeholder="Add a note…"
                  value={notes[day.date] ?? ""}
                  onChange={(e) => handleNote(day.date, e.target.value)}
                />
              </div>
            ))}
          </div>

          <button className="scroll-arrow" onClick={() => scroll("right")} aria-label="Scroll right">›</button>
        </div>
      )}
    </div>
  );
}
