"""
Google Calendar endpoints: auth, OAuth callback, events, agenda.
"""
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from models import CalendarEventItem, AgendaItem
import google_calendar as gcal

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/calendar/auth")
def calendar_auth_status():
    """Return { connected, auth_url? } — widget polls this every 3s until connected."""
    connected = gcal.is_connected()
    if connected:
        return {"connected": True}
    return {"connected": False, "auth_url": gcal.get_auth_url()}


@router.get("/api/calendar/callback")
def calendar_callback(code: str, state: str = ""):
    """
    OAuth redirect target. Exchanges code for tokens, then returns a
    self-closing HTML page so the popup tab disappears automatically.
    """
    try:
        gcal.exchange_code(code)
        html = """<!doctype html>
<html><head><title>Connected</title></head>
<body style="font-family:sans-serif;background:#212121;color:#ececec;
             display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center">
    <div style="font-size:48px;margin-bottom:12px">✅</div>
    <p style="font-size:18px;font-weight:600">Google Calendar connected!</p>
    <p style="color:#8e8ea0;margin-top:6px">You can close this tab.</p>
  </div>
  <script>setTimeout(()=>window.close(),1500);</script>
</body></html>"""
    except Exception:
        logger.exception("OAuth callback failed")
        html = """<!doctype html>
<html><head><title>Error</title></head>
<body style="font-family:sans-serif;background:#212121;color:#ececec;
             display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center">
    <div style="font-size:48px;margin-bottom:12px">❌</div>
    <p style="font-size:18px;font-weight:600">Connection failed</p>
    <p style="color:#8e8ea0;margin-top:6px">Close this tab and try again.</p>
  </div>
</body></html>"""
    return HTMLResponse(content=html)


@router.get("/api/calendar/events")
def get_calendar_events(start_date: str = None, days_ahead: int = 7):
    """Return { days: [...] } for any 7-day window. Defaults to today."""
    if not gcal.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Calendar.")
    return {"days": gcal.get_events(days_ahead=days_ahead, start_date=start_date)}


@router.post("/api/calendar/events")
def create_calendar_event(item: CalendarEventItem):
    """Create a Google Calendar event."""
    if not gcal.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Calendar.")
    return gcal.create_event(item.title, item.date, item.start, item.end)


@router.post("/api/calendar/agenda")
def save_calendar_agenda(item: AgendaItem):
    """Save agenda text to the '📋 Agenda' all-day event for a given date."""
    if not gcal.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Calendar.")
    return gcal.save_agenda(item.date, item.text)
