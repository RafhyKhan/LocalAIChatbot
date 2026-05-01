"""
Dashboard data providers — 7-day weather forecast and BBC News headlines.

Each function is self-contained: it fetches, parses, and returns a plain dict.
If the external source is unavailable the function returns an empty/fallback
structure so the frontend widget degrades gracefully without crashing.
"""

import json
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

# ── Weather (Open-Meteo, no API key required) ─────────────────────────────────
# Coordinates and display name loaded from backend/.env
_LAT           = float(os.getenv("USER_LOCATION_LAT",   "0"))
_LNG           = float(os.getenv("USER_LOCATION_LNG",   "0"))
_LOCATION_SHORT = os.getenv("USER_LOCATION_SHORT", "Local")
_TIMEZONE       = os.getenv("USER_TIMEZONE",        "UTC")

# WMO weather-code → emoji icon
_WMO_ICONS = {
    0: "☀️",
    1: "🌤️", 2: "⛅", 3: "☁️",
    45: "🌫️", 48: "🌫️",
    51: "🌦️", 53: "🌦️", 55: "🌧️",
    56: "🌧️", 57: "🌧️",
    61: "🌧️", 63: "🌧️", 65: "🌧️",
    66: "🌧️", 67: "🌧️",
    71: "🌨️", 73: "❄️", 75: "❄️", 77: "🌨️",
    80: "🌦️", 81: "🌧️", 82: "⛈️",
    85: "🌨️", 86: "❄️",
    95: "⛈️", 96: "⛈️", 99: "⛈️",
}

# WMO weather-code → short description
_WMO_DESC = {
    0: "Clear Sky",
    1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
    45: "Fog", 48: "Icy Fog",
    51: "Light Drizzle", 53: "Drizzle", 55: "Heavy Drizzle",
    56: "Freezing Drizzle", 57: "Heavy Freezing Drizzle",
    61: "Light Rain", 63: "Rain", 65: "Heavy Rain",
    66: "Freezing Rain", 67: "Heavy Freezing Rain",
    71: "Light Snow", 73: "Snow", 75: "Heavy Snow", 77: "Snow Grains",
    80: "Rain Showers", 81: "Rain Showers", 82: "Heavy Showers",
    85: "Snow Showers", 86: "Heavy Snow Showers",
    95: "Thunderstorm", 96: "Thunderstorm + Hail", 99: "Heavy Thunderstorm",
}


def get_forecast() -> dict:
    """Return a 7-day daily forecast from Open-Meteo for the configured location."""
    tz_encoded = _TIMEZONE.replace("/", "%2F")
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={_LAT}&longitude={_LNG}"
        "&daily=weathercode,temperature_2m_max,temperature_2m_min"
        ",windspeed_10m_max,precipitation_sum,precipitation_probability_max"
        f"&timezone={tz_encoded}&forecast_days=7"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RainAI/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        daily = data["daily"]
        days = []
        for i, date_str in enumerate(daily["time"]):
            code = daily["weathercode"][i]
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            days.append({
                "date":        date_str,
                "day":         date_obj.strftime("%a"),   # Mon, Tue …
                "code":        code,
                "icon":        _WMO_ICONS.get(code, "🌡️"),
                "description": _WMO_DESC.get(code, "Unknown"),
                "max_c":       round(daily["temperature_2m_max"][i]),
                "min_c":       round(daily["temperature_2m_min"][i]),
                "wind_kmph":    round(daily["windspeed_10m_max"][i]),
                "precip_mm":    round(daily["precipitation_sum"][i], 1),
                "precip_prob":  daily["precipitation_probability_max"][i] or 0,
            })

        return {"days": days, "location": _LOCATION_SHORT}

    except Exception as e:
        return {"days": [], "location": _LOCATION_SHORT, "error": str(e)}


# ── News (BBC RSS, stdlib XML only) ───────────────────────────────────────────

BBC_RSS = "https://feeds.bbci.co.uk/news/rss.xml"


def get_news() -> dict:
    """Return the latest BBC News headlines from their RSS feed.
    Returns an empty items list (not an error) if the feed is unreachable,
    so the widget simply shows nothing rather than an error state.
    """
    try:
        req = urllib.request.Request(BBC_RSS, headers={"User-Agent": "RainAI/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            xml_bytes = resp.read()

        root = ET.fromstring(xml_bytes.decode("utf-8"))
        channel = root.find("channel")
        if channel is None:
            return {"items": [], "source": "BBC News"}

        items = []
        for item in channel.findall("item")[:10]:
            title = (item.findtext("title") or "").strip()
            # BBC uses <link> as a plain text node directly before <title>
            # fall back to the guid if link is missing
            link  = (item.findtext("link") or item.findtext("guid") or "").strip()
            pub   = (item.findtext("pubDate") or "").strip()
            desc  = (item.findtext("description") or "").strip()
            if title and link:
                items.append({"title": title, "link": link, "pub_date": pub, "description": desc})

        return {"items": items, "source": "BBC News"}

    except Exception:
        return {"items": [], "source": "BBC News"}


# ── Multi-source news ─────────────────────────────────────────────────────────

_NEWS_SOURCES = {
    "bbc":       "https://feeds.bbci.co.uk/news/rss.xml",
    "reuters":   "https://news.google.com/rss/search?q=site:reuters.com&hl=en-CA&gl=CA&ceid=CA:en",
    "ap":        "https://news.google.com/rss/search?q=site:apnews.com&hl=en-CA&gl=CA&ceid=CA:en",
    "aljazeera": "https://www.aljazeera.com/xml/rss/all.xml",
    "cbc":       "https://www.cbc.ca/cmlink/rss-topstories",
    "ctv":       "https://news.google.com/rss/search?q=site:ctvnews.ca&hl=en-CA&gl=CA&ceid=CA:en",
    "calgary":   os.getenv("LOCAL_NEWS_RSS", ""),
}

_NS = {"media": "http://search.yahoo.com/mrss/", "dc": "http://purl.org/dc/elements/1.1/"}


def get_multi_news(source: str) -> dict:
    """Fetch RSS headlines for a given source key. Returns [] on failure."""
    url = _NEWS_SOURCES.get(source)
    if not url:
        return {"items": [], "source": source}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RainAI/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            xml_bytes = resp.read()

        # Try UTF-8 first, fall back to latin-1
        try:
            text = xml_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = xml_bytes.decode("latin-1")

        root    = ET.fromstring(text)
        channel = root.find("channel")
        if channel is None:
            return {"items": [], "source": source}

        items = []
        for item in channel.findall("item")[:10]:
            title = (item.findtext("title") or "").strip()
            link  = (item.findtext("link")  or item.findtext("guid") or "").strip()
            pub   = (item.findtext("pubDate") or "").strip()
            if title and link:
                items.append({"title": title, "link": link, "pub_date": pub})

        return {"items": items, "source": source}

    except Exception:
        return {"items": [], "source": source}


# ── Philosopher of the Month (OUP Blog RSS) ───────────────────────────────────

PHILOSOPHER_RSS = (
    "https://blog.oup.com/category/arts_and_humanities/philosopher-of-the-month/feed/"
)

_TAG_RE = re.compile(r"<[^>]+>")   # strips HTML tags from description excerpts


def _strip_html(text: str) -> str:
    return _TAG_RE.sub("", text).strip()


def get_philosopher() -> dict:
    """Return the 3 most recent Philosopher of the Month posts from OUP Blog RSS.
    Returns an empty items list if the feed is unreachable.
    """
    try:
        req = urllib.request.Request(
            PHILOSOPHER_RSS, headers={"User-Agent": "RainAI/1.0"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            xml_bytes = resp.read()

        root    = ET.fromstring(xml_bytes.decode("utf-8"))
        channel = root.find("channel")
        if channel is None:
            return {"items": []}

        items = []
        for item in channel.findall("item")[:3]:
            title   = (item.findtext("title")   or "").strip()
            link    = (item.findtext("link")    or item.findtext("guid") or "").strip()
            pub     = (item.findtext("pubDate") or "").strip()
            desc    = _strip_html(item.findtext("description") or "")
            # Trim description to a readable excerpt (~200 chars)
            if len(desc) > 220:
                desc = desc[:220].rsplit(" ", 1)[0] + "…"
            if title and link:
                items.append({"title": title, "link": link, "pub_date": pub, "excerpt": desc})

        return {"items": items}

    except Exception:
        return {"items": []}
