"""
Shared state: AI client, model config, tool list, system prompt, env constants.
Imported by routers to avoid circular dependencies with main.py.

load_dotenv() must be called in main.py BEFORE this module is imported.
"""
import logging
import os
from pathlib import Path

from openai import AsyncOpenAI
import search    as searcher
import calculator as calc
import datetool
import unittool
import browsertool
import weathertool

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
# Routers live in backend/routers/, so they use BASE_DIR to reach backend/*.json
BASE_DIR = Path(__file__).parent

# ── Model config ──────────────────────────────────────────────────────────────

client = AsyncOpenAI(
    base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:12434/v1"),
    api_key="not-needed",
)
MODEL = os.getenv("MODEL_NAME", "docker.io/ai/gemma4:E2B")

# ── Context window ────────────────────────────────────────────────────────────

# Direct message memory: how many recent messages to include verbatim in context.
# Token usage must fit within the model's context window for all RECENT_WINDOW messages.
RECENT_WINDOW = 80
SEMANTIC_K    = 5

# ── Personal config ───────────────────────────────────────────────────────────

USER_FULL_NAME   = os.getenv("USER_FULL_NAME",  "the user")
USER_FIRST_NAME  = os.getenv("USER_FIRST_NAME", "there")
CURRENT_LOCATION = os.getenv("USER_LOCATION",   "your city")

# ── Tool list ─────────────────────────────────────────────────────────────────
# Update the static tool list in frontend/src/components/Sidebar.tsx when changing this.

ALL_TOOLS = (
    searcher.SEARCH_TOOLS
    + calc.CALCULATOR_TOOLS
    + datetool.DATETOOL_TOOLS
    + unittool.UNITTOOL_TOOLS
    + browsertool.BROWSERTOOL_TOOLS
    + weathertool.WEATHER_TOOLS
)

# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    f"Your name is RainAI. You are a helpful, concise personal AI assistant built exclusively for and by {USER_FULL_NAME}."
    f"You are located in {CURRENT_LOCATION}."
    "\n\n"
    "You have access to real-time web search."
    "When asked about current events, news, prices, sports, or anything "
    "that requires up-to-date information, you will search the web automatically. "
    "Never say you cannot access the internet or that your knowledge has a cutoff — "
    "you can and should search the web when needed. "
    "If you searched, mention what you found. "
    "\n\n"
    "You have a get_weather tool that provides real-time weather from wttr.in. "
    "ALWAYS use this tool for ANY weather-related question — current conditions, "
    "temperature, feels-like, humidity, wind, UV index, or forecast. "
    "NEVER search the web for weather; the get_weather tool is faster and always accurate. "
    f"If the user does not specify a location, default to {CURRENT_LOCATION}."
    "\n\n"
    "You also have access to a precise calculator tool. "
    "ALWAYS use the calculator tool for any mathematical computation — "
    "never attempt arithmetic, algebra, or numerical reasoning yourself. "
    "You make math errors; the calculator does not."
    "\n\n"
    "You have a date_diff tool. "
    "ALWAYS use it for any calculation involving the difference between two dates — "
    "never compute date gaps yourself."
    "\n\n"
    "You have a convert_units tool. "
    "ALWAYS use it for any unit conversion — never estimate conversions yourself."
    "\n\n"
    "You are a helpful assistant, not an authoritative source of truth. "
    "You can and do make mistakes. When uncertain, say so clearly. "
    "Always distinguish between what you know from training and what you found via web search. "
    f"Encourage {USER_FIRST_NAME} to verify important information independently."
)
