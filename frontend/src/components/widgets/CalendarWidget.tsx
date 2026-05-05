/**
 * CalendarWidget — weather card layout + Google Calendar events.
 * Week-based pagination: arrows load the prev/next 7-day block.
 * Weather is cached in localStorage (keyed by date) so past/future
 * weeks show historical data if the user visited that week before.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { BASE } from "../../api";

interface CalendarEvent {
  id:      string;
  title:   string;
  start:   string | null;
  end:     string | null;
  all_day: boolean;
  desc:    string;
  source?: string;   // "primary" | "sait"
}

interface CalendarDay {
  date:   string;
  events: CalendarEvent[];
}

interface DayForecast {
  date:        string;
  icon:        string;
  description: string;
  max_c:       number;
  min_c:       number;
  wind_kmph:   number;
  precip_prob: number;
}

// ── Weather cache (localStorage) ─────────────────────────────────────────────

const WEATHER_CACHE_KEY = "rainai_weather_cache";

function loadWeatherCache(): Record<string, DayForecast> {
  try { return JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) ?? "{}"); }
  catch { return {}; }
}
function saveWeatherCache(c: Record<string, DayForecast>) {
  localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(c));
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDates(offset: number): string[] {
  const today = new Date();
  // Anchor to this week's Sunday (JS getDay(): 0=Sun, so subtract dayOfWeek)
  const dayOfWeek = today.getDay(); // 0 Sun … 6 Sat
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dayOfWeek);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + offset * 7 + i);
    return localDateStr(d);
  });
}

function getDayAbbr(dateStr: string): string {
  return new Date(dateStr + "T12:00:00")
    .toLocaleDateString([], { weekday: "short" })
    .toUpperCase();
}

function formatCardDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00")
    .toLocaleDateString([], { month: "long", day: "numeric" });
}

function weekRangeLabel(dates: string[]): string {
  const fmt = { month: "short", day: "numeric" } as const;
  return `${new Date(dates[0] + "T12:00:00").toLocaleDateString([], fmt)} – ${new Date(dates[6] + "T12:00:00").toLocaleDateString([], fmt)}`;
}

function fmtTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh   = h % 12 || 12;
  return `${hh}:${m.toString().padStart(2, "0")} ${ampm}`;
}

const TODAY = localDateStr(new Date());

// ── Component ─────────────────────────────────────────────────────────────────

export default function CalendarWidget() {
  const [connected,     setConnected]     = useState<boolean | null>(null);
  const [authUrl,       setAuthUrl]       = useState("");
  const [allDays,       setAllDays]       = useState<Record<string, CalendarEvent[]>>({});
  const [weatherCache,  setWeatherCache]  = useState<Record<string, DayForecast>>(loadWeatherCache);
  const [weekOffset,    setWeekOffset]    = useState(0);
  const [weekLoading,   setWeekLoading]   = useState(false);
  const [saitVisible,   setSaitVisible]   = useState(() =>
    localStorage.getItem("rainai_sait_visible") !== "false"
  );

  // Agenda modal
  const [agendaDate,   setAgendaDate]   = useState<string | null>(null);
  const [agendaText,   setAgendaText]   = useState("");
  const [agendaSaving, setAgendaSaving] = useState(false);

  // Add Event modal
  const [addOpen,   setAddOpen]   = useState(false);
  const [newTitle,  setNewTitle]  = useState("");
  const [newDate,   setNewDate]   = useState(TODAY);
  const [newStart,  setNewStart]  = useState("");
  const [newEnd,    setNewEnd]    = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const weekOffsetRef  = useRef(0); // stable ref so callbacks don't go stale

  // ── Fetch a week of calendar events ──────────────────────────────────────

  const fetchWeekEvents = useCallback(async (startDate: string) => {
    setWeekLoading(true);
    try {
      const r = await fetch(`${BASE}/api/calendar/events?start_date=${startDate}&days_ahead=7`);
      if (r.ok) {
        const data = await r.json();
        const map: Record<string, CalendarEvent[]> = {};
        (data.days ?? []).forEach((d: CalendarDay) => { map[d.date] = d.events; });
        setAllDays(map);
      }
    } catch { /* ignore */ } finally {
      setWeekLoading(false);
    }
  }, []);

  // ── Auth check + polling ──────────────────────────────────────────────────

  const checkAuth = useCallback(async () => {
    try {
      const r    = await fetch(`${BASE}/api/calendar/auth`);
      const data = await r.json();
      setConnected(data.connected);
      if (data.auth_url) setAuthUrl(data.auth_url);
      if (data.connected) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        fetchWeekEvents(getWeekDates(weekOffsetRef.current)[0]);
      }
    } catch { /* ignore */ }
  }, [fetchWeekEvents]);

  // ── Mount ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Fetch live weather and cache it
    fetch(`${BASE}/api/weather`)
      .then(r => r.json())
      .then(data => {
        const existing = loadWeatherCache();
        (data.days ?? []).forEach((d: DayForecast) => { existing[d.date] = d; });
        setWeatherCache({ ...existing });
        saveWeatherCache(existing);
      })
      .catch(() => {});

    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (connected === false) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(checkAuth, 3000);
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [connected, checkAuth]);

  // ── Week navigation ───────────────────────────────────────────────────────

  function goWeek(dir: 1 | -1) {
    const next = weekOffsetRef.current + dir;
    weekOffsetRef.current = next;
    setWeekOffset(next);
    if (connected) fetchWeekEvents(getWeekDates(next)[0]);
  }

  // ── Bullet insert ─────────────────────────────────────────────────────────

  function insertBullet() {
    const el = textareaRef.current;
    if (!el) return;
    const start  = el.selectionStart;
    const end    = el.selectionEnd;
    const bullet = "• ";
    const next   = agendaText.slice(0, start) + bullet + agendaText.slice(end);
    setAgendaText(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + bullet.length;
      el.focus();
    });
  }

  // ── Agenda modal ──────────────────────────────────────────────────────────

  function openAgenda(date: string) {
    const existing = (allDays[date] ?? []).find(ev => ev.title === "📋 Agenda");
    setAgendaText(existing?.desc ?? "");
    setAgendaDate(date);
  }

  async function saveAgenda() {
    if (!agendaDate) return;
    setAgendaSaving(true);
    try {
      await fetch(`${BASE}/api/calendar/agenda`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date: agendaDate, text: agendaText }),
      });
      setAgendaDate(null);
      fetchWeekEvents(getWeekDates(weekOffsetRef.current)[0]);
    } catch { /* ignore */ } finally { setAgendaSaving(false); }
  }

  // ── Add Event modal ───────────────────────────────────────────────────────

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle || !newDate) return;
    setAddSaving(true);
    try {
      await fetch(`${BASE}/api/calendar/events`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: newTitle, date: newDate, start: newStart, end: newEnd }),
      });
      setAddOpen(false);
      setNewTitle(""); setNewStart(""); setNewEnd("");
      fetchWeekEvents(getWeekDates(weekOffsetRef.current)[0]);
    } catch { /* ignore */ } finally { setAddSaving(false); }
  }

  // ── Secondary calendar toggle ─────────────────────────────────────────────

  function toggleSait() {
    setSaitVisible(v => {
      const next = !v;
      localStorage.setItem("rainai_sait_visible", String(next));
      return next;
    });
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const weekDates = getWeekDates(weekOffset);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="widget weather-widget">

      {/* ── Header ── */}
      <div className="widget-header">
        <span className="widget-title">📅 Calendar</span>
        <div className="cal-header-right">
          {connected === false && authUrl && (
            <a className="cal-connect-chip" href={authUrl} target="_blank" rel="noopener noreferrer">
              Connect Google ↗
            </a>
          )}
          {connected === true && (
            <>
              <button
                className={`cal-sait-toggle${saitVisible ? " cal-sait-toggle--on" : ""}`}
                onClick={toggleSait}
                title={saitVisible ? `Hide ${import.meta.env.VITE_SECONDARY_CALENDAR_LABEL ?? "Secondary"}` : `Show ${import.meta.env.VITE_SECONDARY_CALENDAR_LABEL ?? "Secondary"}`}
              >
                {import.meta.env.VITE_SECONDARY_CALENDAR_LABEL ?? "Cal 2"}
              </button>
              <button className="cal-add-event-btn" onClick={() => setAddOpen(true)}>
                + Add Event
              </button>
            </>
          )}
          <a
            className="widget-subtitle cal-gcal-link"
            href="https://calendar.google.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Calendar · Open-Meteo
          </a>
        </div>
      </div>

      {/* ── Week navigation bar ── */}
      <div className="cal-week-nav">
        <button className="cal-week-arrow" onClick={() => goWeek(-1)} disabled={weekLoading}>‹</button>
        <span className="cal-week-label">
          {weekOffset === 0 ? "This Week · " : weekOffset === -1 ? "Last Week · " : weekOffset === 1 ? "Next Week · " : ""}
          {weekRangeLabel(weekDates)}
        </span>
        <button className="cal-week-arrow" onClick={() => goWeek(1)} disabled={weekLoading}>›</button>
      </div>

      {/* ── Cards ── */}
      <div className={`cal-cards-row${weekLoading ? " cal-cards-loading" : ""}`}>
        {weekDates.map(dateStr => {
          const forecast   = weatherCache[dateStr];
          const allEvs     = allDays[dateStr] ?? [];
          const visibleEvs = allEvs.filter(ev =>
            ev.title !== "📋 Agenda" &&
            (ev.source !== "sait" || saitVisible)
          );
          const isToday    = dateStr === TODAY;

          return (
            <div
              key={dateStr}
              className={`weather-card cal-combined-card${isToday ? " weather-card-today" : ""}`}
            >
              {/* Day label */}
              <div className="wc-day">{getDayAbbr(dateStr)} · {formatCardDate(dateStr)}</div>

              {/* Weather */}
              {forecast ? (
                <>
                  <div className="wc-icon">{forecast.icon}</div>
                  <div className="wc-desc">{forecast.description}</div>
                  <div className="wc-temps">
                    <span className="wc-max">{forecast.max_c}°</span>
                    <span className="wc-min">{forecast.min_c}°</span>
                  </div>
                  <div className="wc-detail wc-detail-row">
                    <span>💨 {forecast.wind_kmph} km/h</span>
                    <span>💧 {forecast.precip_prob}%</span>
                  </div>
                </>
              ) : (
                <div className="cal-no-weather">No weather data</div>
              )}

              {/* Divider */}
              <div className="cal-card-divider" />

              {/* Events */}
              {connected === true ? (
                weekLoading ? (
                  <p className="cal-card-empty cal-card-dim">Loading…</p>
                ) : visibleEvs.length === 0 ? (
                  <p className="cal-card-empty">No events</p>
                ) : (
                  <div className="cal-card-events">
                    {visibleEvs.map(ev => (
                      <div
                        key={ev.id}
                        className={`cal-card-event${ev.source === "sait" ? " cal-card-event--sait" : ""}`}
                      >
                        <span className="cal-card-event-time">
                          {ev.all_day ? "All day" : ev.end ? `${fmtTime(ev.start)} – ${fmtTime(ev.end)}` : fmtTime(ev.start)}
                        </span>
                        <span className="cal-card-event-title">{ev.title}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : connected === false ? (
                <p className="cal-card-empty cal-card-dim">Sign in to see events</p>
              ) : (
                <p className="cal-card-empty cal-card-dim">…</p>
              )}

              {/* Agenda button */}
              {connected === true && (
                <button className="cal-agenda-day-btn" onClick={() => openAgenda(dateStr)}>
                  📋 Agenda
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Agenda modal ── */}
      {agendaDate && (
        <div className="cal-modal-overlay">
          <div className="cal-modal">
            <div className="cal-modal-header">
              <span className="cal-modal-title">📋 Agenda · {formatCardDate(agendaDate)}</span>
              <button className="cal-modal-close" onClick={() => setAgendaDate(null)}>×</button>
            </div>
            <div className="cal-modal-toolbar">
              <button type="button" className="cal-toolbar-btn" onClick={insertBullet}>• Bullet</button>
            </div>
            <textarea
              ref={textareaRef}
              className="cal-modal-textarea"
              placeholder="Write today's agenda, tasks, or notes…"
              value={agendaText}
              onChange={e => setAgendaText(e.target.value)}
              autoFocus
            />
            <div className="cal-modal-footer">
              <button className="cal-modal-cancel" onClick={() => setAgendaDate(null)}>Cancel</button>
              <button className="cal-modal-save" onClick={saveAgenda} disabled={agendaSaving}>
                {agendaSaving ? "Saving…" : "Save to Calendar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Event modal ── */}
      {addOpen && (
        <div className="cal-modal-overlay" onClick={() => setAddOpen(false)}>
          <form className="cal-modal" onClick={e => e.stopPropagation()} onSubmit={saveEvent}>
            <div className="cal-modal-header">
              <span className="cal-modal-title">+ New Event</span>
              <button type="button" className="cal-modal-close" onClick={() => setAddOpen(false)}>×</button>
            </div>
            <div className="cal-modal-body">
              <input
                className="cal-modal-input"
                placeholder="Event title"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                required
                autoFocus
              />
              <div className="cal-modal-row">
                <label className="cal-modal-label">Date</label>
                <input className="cal-modal-input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required />
              </div>
              <div className="cal-modal-row">
                <label className="cal-modal-label">Start</label>
                <input className="cal-modal-input" type="time" value={newStart} onChange={e => setNewStart(e.target.value)} />
              </div>
              <div className="cal-modal-row">
                <label className="cal-modal-label">End</label>
                <input className="cal-modal-input" type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
              </div>
              <p className="cal-modal-hint">Leave start/end empty for an all-day event.</p>
            </div>
            <div className="cal-modal-footer">
              <button type="button" className="cal-modal-cancel" onClick={() => setAddOpen(false)}>Cancel</button>
              <button type="submit" className="cal-modal-save" disabled={addSaving}>
                {addSaving ? "Saving…" : "Add to Calendar"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
