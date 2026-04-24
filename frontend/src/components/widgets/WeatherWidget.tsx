/**
 * WeatherWidget — 7-day Calgary forecast from Open-Meteo via /api/weather.
 * Self-contained: fetches its own data, handles loading + error states.
 * Left/right arrow buttons scroll the card row when all 7 days don't fit.
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
  wind_kmph: number;
  precip_mm: number;
}

interface WeatherData {
  days: DayForecast[];
  location: string;
  error?: string;
}

export default function WeatherWidget() {
  const [data, setData]       = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${BASE}/api/weather`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ days: [], location: "Calgary, AB", error: "unavailable" }))
      .finally(() => setLoading(false));
  }, []);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "right" ? 220 : -220, behavior: "smooth" });
  };

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
                <div className="wc-day">{i === 0 ? "Today" : day.day}</div>
                <div className="wc-icon">{day.icon}</div>
                <div className="wc-desc">{day.description}</div>
                <div className="wc-temps">
                  <span className="wc-max">{day.max_c}°</span>
                  <span className="wc-min">{day.min_c}°</span>
                </div>
                <div className="wc-detail">💨 {day.wind_kmph} km/h</div>
                {day.precip_mm > 0 && (
                  <div className="wc-detail">💧 {day.precip_mm} mm</div>
                )}
              </div>
            ))}
          </div>

          <button className="scroll-arrow" onClick={() => scroll("right")} aria-label="Scroll right">›</button>
        </div>
      )}
    </div>
  );
}
