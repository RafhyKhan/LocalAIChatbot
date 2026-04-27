"""
Google Calendar integration for RainAI.

PKCE fix: We generate the code_verifier ourselves, store it as a plain text
file, and pass it explicitly to fetch_token(). This avoids any reliance on
the Flow object's internal state surviving across uvicorn --reload restarts
or polling calls that would otherwise overwrite it.

Polling fix: get_auth_url() caches the URL + verifier on first call.
Subsequent polling calls return the same URL so the user always clicks a URL
whose verifier still exists on disk.
"""

import base64
import hashlib
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

SCOPES             = ["https://www.googleapis.com/auth/calendar"]
CREDENTIALS_FILE   = Path(__file__).parent / "credentials.json"
TOKEN_FILE         = Path(__file__).parent / "google_token.json"
CODE_VERIFIER_FILE = Path(__file__).parent / "_code_verifier.txt"
AUTH_URL_FILE      = Path(__file__).parent / "_auth_url.txt"
REDIRECT_URI       = "http://localhost:8000/api/calendar/callback"


# ── PKCE helpers ──────────────────────────────────────────────────────────────

def _generate_pkce() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) using S256 method."""
    verifier  = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()
    return verifier, challenge


# ── Token helpers ─────────────────────────────────────────────────────────────

def _save_creds(creds: Credentials) -> None:
    TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")


def _load_creds() -> Credentials | None:
    if not TOKEN_FILE.exists():
        return None
    try:
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            _save_creds(creds)
        return creds if creds and creds.valid else None
    except Exception:
        return None


def _get_service():
    creds = _load_creds()
    if not creds:
        return None
    return build("calendar", "v3", credentials=creds)


# ── Auth ──────────────────────────────────────────────────────────────────────

def is_connected() -> bool:
    return _load_creds() is not None


def get_auth_url() -> str:
    """
    Return the OAuth authorization URL.

    If a pending auth is already in progress (both files on disk), return the
    cached URL — polling every 3s will NOT generate a new verifier and will NOT
    invalidate the URL the user already has open.
    """
    # Reuse existing pending auth if both files are present
    if CODE_VERIFIER_FILE.exists() and AUTH_URL_FILE.exists():
        return AUTH_URL_FILE.read_text(encoding="utf-8").strip()

    # Generate a fresh PKCE pair for this auth attempt
    verifier, challenge = _generate_pkce()

    # Build the flow — web type credentials
    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )

    # Pass our manually generated challenge — the flow itself has no verifier
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        code_challenge=challenge,
        code_challenge_method="S256",
    )

    # Persist both to disk so they survive process restarts and polling
    CODE_VERIFIER_FILE.write_text(verifier, encoding="utf-8")
    AUTH_URL_FILE.write_text(auth_url, encoding="utf-8")

    return auth_url


def exchange_code(code: str) -> None:
    """
    Exchange the authorization code for tokens.
    Reads the saved verifier from disk and passes it explicitly to fetch_token.
    Creates a FRESH flow — no leftover internal state that could conflict.
    """
    if not CODE_VERIFIER_FILE.exists():
        raise RuntimeError(
            "No pending OAuth flow found — please click 'Connect Google' again."
        )

    verifier = CODE_VERIFIER_FILE.read_text(encoding="utf-8").strip()

    # Fresh flow — no internal code_verifier set, no state conflicts
    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )

    # Explicitly pass our verifier so it's included in the token POST body
    flow.fetch_token(code=code, code_verifier=verifier)
    _save_creds(flow.credentials)

    # Clean up pending auth files
    for f in (CODE_VERIFIER_FILE, AUTH_URL_FILE):
        try:
            f.unlink(missing_ok=True)
        except Exception:
            pass


# ── Events ────────────────────────────────────────────────────────────────────

def get_events(days_ahead: int = 7, start_date: str | None = None) -> list:
    """
    Return per-day event lists for start_date through start_date + days_ahead.
    If start_date is omitted, defaults to today.
    """
    service = _get_service()
    if not service:
        return []

    if start_date:
        try:
            start = datetime.fromisoformat(start_date).replace(
                hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
            )
        except ValueError:
            start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    end = start + timedelta(days=days_ahead)

    try:
        result = service.events().list(
            calendarId="primary",
            timeMin=start.isoformat(),
            timeMax=end.isoformat(),
            singleEvents=True,
            orderBy="startTime",
            maxResults=200,
        ).execute()
    except Exception:
        return []

    # Build per-day buckets
    days: dict[str, list] = {
        (start + timedelta(days=i)).strftime("%Y-%m-%d"): []
        for i in range(days_ahead)
    }

    for ev in result.get("items", []):
        ev_start = ev.get("start", {})
        date_str = ev_start.get("date") or ev_start.get("dateTime", "")[:10]
        if date_str not in days:
            continue
        all_day = "date" in ev_start
        start_t = None if all_day else ev_start.get("dateTime", "")[11:16]
        end_t   = None if all_day else ev.get("end", {}).get("dateTime", "")[11:16]
        days[date_str].append({
            "id":      ev.get("id", ""),
            "title":   ev.get("summary", "(No title)"),
            "start":   start_t,
            "end":     end_t,
            "all_day": all_day,
            "desc":    ev.get("description", ""),
        })

    return [{"date": d, "events": evs} for d, evs in days.items()]


def create_event(title: str, date: str, start_time: str, end_time: str) -> dict:
    """Create a calendar event. Empty times = all-day event."""
    service = _get_service()
    if not service:
        raise RuntimeError("Not connected to Google Calendar.")

    if start_time and end_time:
        body = {
            "summary": title,
            "start": {"dateTime": f"{date}T{start_time}:00", "timeZone": "America/Edmonton"},
            "end":   {"dateTime": f"{date}T{end_time}:00",   "timeZone": "America/Edmonton"},
        }
    else:
        body = {
            "summary": title,
            "start": {"date": date},
            "end":   {"date": date},
        }

    ev = service.events().insert(calendarId="primary", body=body).execute()
    return {"ok": True, "event_id": ev.get("id", "")}


def save_agenda(date: str, text: str) -> dict:
    """
    Save agenda text to the description of a special '📋 Agenda' all-day event.
    Creates the event if it doesn't exist; updates it if it does.
    Syncs to Google Calendar on all devices.
    """
    service = _get_service()
    if not service:
        raise RuntimeError("Not connected to Google Calendar.")

    try:
        result = service.events().list(
            calendarId="primary",
            timeMin=f"{date}T00:00:00Z",
            timeMax=f"{date}T23:59:59Z",
            q="📋 Agenda",
            singleEvents=True,
        ).execute()
    except Exception:
        result = {"items": []}

    existing = next(
        (e for e in result.get("items", []) if e.get("summary") == "📋 Agenda"),
        None,
    )

    body = {
        "summary":     "📋 Agenda",
        "description": text,
        "start":       {"date": date},
        "end":         {"date": date},
        "visibility":  "private",
    }

    if existing:
        ev = service.events().update(
            calendarId="primary", eventId=existing["id"], body=body
        ).execute()
    else:
        ev = service.events().insert(calendarId="primary", body=body).execute()

    return {"ok": True, "event_id": ev.get("id", "")}
