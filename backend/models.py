"""
Pydantic request/response models shared across all routers.
"""
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    conversation_id: str = Field(max_length=64)
    message:         str = Field(max_length=32_768)


class ProfileData(BaseModel):
    content: str = Field(default="", max_length=500)


class WordItem(BaseModel):
    word:         str = Field(max_length=100)
    phonetic:     str = Field(default="", max_length=100)
    partOfSpeech: str = Field(default="", max_length=50)
    definition:   str = Field(default="", max_length=1_000)
    example:      str = Field(default="", max_length=500)


class TaskItem(BaseModel):
    label:    str = Field(max_length=200)
    category: str = Field(max_length=20)  # "work" | "activity" | "eat" | "read" | "workout"


class CalendarEventItem(BaseModel):
    title: str = Field(max_length=200)
    date:  str = Field(max_length=10)            # "YYYY-MM-DD"
    start: str = Field(default="", max_length=5) # "HH:MM" or empty for all-day
    end:   str = Field(default="", max_length=5) # "HH:MM" or empty for all-day


class AgendaItem(BaseModel):
    date: str = Field(max_length=10)             # "YYYY-MM-DD"
    text: str = Field(max_length=10_000)


class ChecklistTaskItem(BaseModel):
    id:      str  = Field(max_length=64)
    label:   str  = Field(max_length=200)
    checked: bool


class ChecklistSectionItem(BaseModel):
    id:    str  = Field(max_length=64)
    type:  str  = Field(max_length=20)  # "favourites" | "unsorted" | "custom"
    title: str  = Field(max_length=100)
    tasks: list[ChecklistTaskItem]


class ChecklistStateV2(BaseModel):
    sections: list[ChecklistSectionItem] = Field(max_length=50)
    lifetime: int = Field(ge=0)
