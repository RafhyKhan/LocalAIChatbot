"""
Conversation CRUD endpoints.
"""
import logging
from fastapi import APIRouter, HTTPException
import conversations as conv_store

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/conversations")
def list_conversations():
    return conv_store.list_conversations()


@router.post("/api/conversations")
def create_conversation():
    return conv_store.create_conversation()


@router.get("/api/conversations/archived")
def list_archived():
    """Return all archived conversations for the Settings archive view."""
    return conv_store.list_archived_conversations()


@router.get("/api/conversations/{conv_id}")
def get_conversation(conv_id: str):
    data = conv_store.get_conversation(conv_id)
    if not data:
        raise HTTPException(status_code=404, detail="Not found")
    return data


@router.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: str):
    """Archive a conversation (hide from sidebar). Nothing is permanently deleted."""
    conv_store.delete_conversation(conv_id)
    return {"ok": True}


@router.post("/api/conversations/{conv_id}/restore")
def restore_conversation(conv_id: str):
    """Restore an archived conversation back to the sidebar."""
    conv_store.restore_conversation(conv_id)
    return {"ok": True}
