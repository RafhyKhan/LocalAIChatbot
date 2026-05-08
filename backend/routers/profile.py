"""
Profile and context-preview endpoints.
_build_context_block lives here because it depends on profile + checklist + calendar.
"""
import json
import logging
from datetime import date, datetime

from fastapi import APIRouter
from shared import BASE_DIR
from models import ProfileData
from routers.checklist import load_checklist
import google_calendar as gcal

logger = logging.getLogger(__name__)
router = APIRouter()

# ── File helpers ──────────────────────────────────────────────────────────────

_PROFILE_FILE = BASE_DIR / "profile.json"


def load_profile() -> str:
    if not _PROFILE_FILE.exists():
        return ""
    try:
        return json.loads(_PROFILE_FILE.read_text(encoding="utf-8")).get("content", "")
    except Exception:
        return ""


def save_profile(content: str) -> None:
    _PROFILE_FILE.write_text(
        json.dumps({"content": content}, indent=2, ensure_ascii=False), encoding="utf-8"
    )


# ── Context block builder ─────────────────────────────────────────────────────

def build_context_block() -> str:
    """
    Assemble a personal context block covering:
      - User's static profile
      - Calendar: today only (all events + agenda note)
      - Checklist: Favourites section only (omitted if empty)

    Each source is wrapped in a try/except so a failure in one never breaks the others.
    """
    parts = ["=== PERSONAL CONTEXT ==="]

    # ── Profile ───────────────────────────────────────────────────────────────
    try:
        profile = load_profile()
        if profile.strip():
            parts.append(f"\n[Profile]\n{profile.strip()}")
    except Exception:
        pass

    # ── Calendar (today only) ─────────────────────────────────────────────────
    try:
        today_str = date.today().isoformat()
        days      = gcal.get_events(days_ahead=1, start_date=today_str)

        for day_data in days:
            if day_data["date"] != today_str:
                continue

            events = day_data["events"]

            try:
                weekday = datetime.fromisoformat(today_str).strftime("%a %b %d")
            except Exception:
                weekday = today_str

            agenda_note    = None
            regular_events = []
            for ev in events:
                if ev["title"] == "📋 Agenda":
                    agenda_note = ev.get("desc", "").strip()
                else:
                    regular_events.append(ev)

            day_lines = [f"\n[Today — {weekday}]"]

            for ev in regular_events:
                if ev["all_day"]:
                    line = f"  (all day)  {ev['title']}"
                else:
                    line = f"  {ev['start']}–{ev['end']}  {ev['title']}"
                desc = ev.get("desc", "").strip()
                if desc:
                    line += f"\n    Notes: {desc}"
                day_lines.append(line)

            if agenda_note:
                day_lines.append(f"  📋 Agenda: {agenda_note}")

            if len(day_lines) == 1:
                day_lines.append("  (nothing scheduled)")

            parts.append("\n".join(day_lines))
    except Exception:
        pass

    # ── Checklist (Favourites section only) ───────────────────────────────────
    try:
        checklist = load_checklist()
        for section in checklist.get("sections", []):
            if section.get("type") != "favourites":
                continue
            tasks = section.get("tasks", [])
            if not tasks:
                break
            title = section.get("title", "⭐ Favourites")
            lines = [f"\n[{title}]"]
            for t in tasks:
                mark = "☑" if t["checked"] else "☐"
                lines.append(f"  {mark} {t['label']}")
            parts.append("\n".join(lines))
            break
    except Exception:
        pass

    parts.append("\n========================")
    return "\n".join(parts)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/api/profile")
def get_profile():
    """Return the user's personal profile text."""
    return {"content": load_profile()}


@router.post("/api/profile")
def save_profile_endpoint(item: ProfileData):
    """Save the user's personal profile text."""
    save_profile(item.content)
    return {"ok": True}


@router.get("/api/context-preview")
def get_context_preview():
    """Return the assembled context block as it would be injected via Live Data Update."""
    return {"text": build_context_block()}
