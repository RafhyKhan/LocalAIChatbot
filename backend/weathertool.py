"""
Weather tool — real current weather via wttr.in (free, no API key required).

Uses wttr.in's JSON API: https://wttr.in/{location}?format=j1
Returns current conditions, temperature, humidity, wind, and a 3-day forecast.
Gemma calls get_weather() instead of searching the web for weather — much more
accurate and always real-time.
"""

import json
import urllib.request

DEFAULT_LOCATION = "Calgary, Alberta"

WEATHER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": (
                "Get the current real-time weather and forecast for any location. "
                "ALWAYS use this tool for any weather-related question — "
                "never search the web for weather, as web results are often stale. "
                "Use for: current temperature, feels-like, conditions, humidity, wind speed, "
                "UV index, visibility, and 3-day forecast. "
                "If the user does not specify a location, default to Calgary, Alberta, Canada."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": (
                            "City or location to get weather for. "
                            "Examples: 'Calgary', 'London', 'New York', 'Tokyo'. "
                            "Defaults to Calgary if not specified."
                        ),
                    }
                },
                "required": ["location"],
            },
        },
    }
]

# Map wttr.in weather codes to readable descriptions
_WEATHER_CODES = {
    "113": "Sunny", "116": "Partly Cloudy", "119": "Cloudy", "122": "Overcast",
    "143": "Mist", "176": "Patchy Rain", "179": "Patchy Snow", "182": "Sleet",
    "185": "Freezing Drizzle", "200": "Thundery Outbreaks", "227": "Blowing Snow",
    "230": "Blizzard", "248": "Fog", "260": "Freezing Fog",
    "263": "Light Drizzle", "266": "Light Drizzle", "281": "Freezing Drizzle",
    "284": "Heavy Freezing Drizzle", "293": "Light Rain", "296": "Light Rain",
    "299": "Moderate Rain", "302": "Moderate Rain", "305": "Heavy Rain",
    "308": "Heavy Rain", "311": "Light Freezing Rain", "314": "Moderate Freezing Rain",
    "317": "Light Sleet", "320": "Moderate Sleet", "323": "Light Snow",
    "326": "Light Snow", "329": "Moderate Snow", "332": "Moderate Snow",
    "335": "Heavy Snow", "338": "Heavy Snow", "350": "Ice Pellets",
    "353": "Light Rain Shower", "356": "Moderate Rain Shower", "359": "Heavy Rain Shower",
    "362": "Light Sleet Shower", "365": "Moderate Sleet Shower", "368": "Light Snow Shower",
    "371": "Moderate Snow Shower", "374": "Light Ice Pellet Shower",
    "377": "Moderate Ice Pellet Shower", "386": "Thundery Rain", "389": "Heavy Thundery Rain",
    "392": "Thundery Snow", "395": "Heavy Thundery Snow",
}


def get_weather(location: str = DEFAULT_LOCATION) -> str:
    """
    Fetch current weather + 3-day forecast from wttr.in and return a formatted string.
    Falls back to a clear error message if the request fails.
    """
    try:
        loc_encoded = urllib.parse.quote(location.strip())
        url = f"https://wttr.in/{loc_encoded}?format=j1"

        req = urllib.request.Request(url, headers={"User-Agent": "LocalAI-Chatbot/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        current = data["current_condition"][0]
        nearest = data.get("nearest_area", [{}])[0]
        area    = nearest.get("areaName", [{}])[0].get("value", location)
        country = nearest.get("country", [{}])[0].get("value", "")

        temp_c      = current["temp_C"]
        temp_f      = current["temp_F"]
        feels_c     = current["FeelsLikeC"]
        feels_f     = current["FeelsLikeF"]
        humidity    = current["humidity"]
        wind_kmph   = current["windspeedKmph"]
        wind_dir    = current["winddir16Point"]
        visibility  = current["visibility"]
        uv_index    = current["uvIndex"]
        description = _WEATHER_CODES.get(current["weatherCode"], current["weatherDesc"][0]["value"])

        lines = [
            f"Weather for {area}{', ' + country if country else ''}:",
            f"  Conditions  : {description}",
            f"  Temperature : {temp_c}°C / {temp_f}°F",
            f"  Feels like  : {feels_c}°C / {feels_f}°F",
            f"  Humidity    : {humidity}%",
            f"  Wind        : {wind_kmph} km/h {wind_dir}",
            f"  Visibility  : {visibility} km",
            f"  UV Index    : {uv_index}",
            "",
            "3-Day Forecast:",
        ]

        for day in data.get("weather", []):
            date      = day["date"]
            max_c     = day["maxtempC"]
            min_c     = day["mintempC"]
            max_f     = day["maxtempF"]
            min_f     = day["mintempF"]
            desc      = _WEATHER_CODES.get(
                day["hourly"][4]["weatherCode"],
                day["hourly"][4]["weatherDesc"][0]["value"]
            )
            lines.append(f"  {date}: {desc}, {min_c}°C–{max_c}°C / {min_f}°F–{max_f}°F")

        return "\n".join(lines)

    except Exception as e:
        return (
            f"Could not fetch weather for '{location}': {e}\n"
            "Try a different location name, e.g. 'Calgary' or 'London, UK'."
        )


# urllib.parse needed for quote() — import at module level
import urllib.parse
