"""
Checklist endpoints — sections format with migration from old flat format.
"""
import json
import logging
from uuid import uuid4

from fastapi import APIRouter
from shared import BASE_DIR
from models import ChecklistStateV2

logger = logging.getLogger(__name__)
router = APIRouter()

# ── File helpers ──────────────────────────────────────────────────────────────

_CHECKLIST_FILE         = BASE_DIR / "checklist.json"
_CHECKLIST_INITIAL_FILE = BASE_DIR / "checklist-initial.json"


def _migrate_old_checklist(data: dict) -> dict:
    """Convert flat-array format to sections format. Backs up old file first."""
    labels     = data.get("labels", [])
    checked    = data.get("checked", [])
    favourites = data.get("favourites", [])
    lifetime   = data.get("lifetime", 0)

    fav_tasks      = []
    unsorted_tasks = []
    for i, label in enumerate(labels):
        task = {
            "id":      str(uuid4()),
            "label":   label,
            "checked": checked[i] if i < len(checked) else False,
        }
        if i < len(favourites) and favourites[i]:
            fav_tasks.append(task)
        else:
            unsorted_tasks.append(task)

    sections = []
    if fav_tasks:
        sections.append({"id": "favourites", "type": "favourites",
                         "title": "⭐ Favourites", "tasks": fav_tasks})
    if unsorted_tasks:
        sections.append({"id": str(uuid4()), "type": "unsorted",
                         "title": "Unsorted", "tasks": unsorted_tasks})

    new_data = {"sections": sections, "lifetime": lifetime}
    _CHECKLIST_FILE.write_text(json.dumps(new_data, indent=2, ensure_ascii=False), encoding="utf-8")
    return new_data


def load_checklist() -> dict:
    if not _CHECKLIST_FILE.exists():
        return {"sections": [], "lifetime": 0}
    try:
        data = json.loads(_CHECKLIST_FILE.read_text(encoding="utf-8"))
        if "labels" in data:
            return _migrate_old_checklist(data)
        return data
    except Exception:
        return {"sections": [], "lifetime": 0}


def save_checklist(state: dict) -> None:
    _CHECKLIST_FILE.write_text(
        json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8"
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/api/checklist")
def get_checklist():
    """Return the full checklist state from disk (migrates old format on first call)."""
    return load_checklist()


@router.post("/api/checklist")
def save_checklist_endpoint(item: ChecklistStateV2):
    """Persist the full checklist state (sections format) to disk."""
    save_checklist(item.model_dump())
    return {"ok": True}
