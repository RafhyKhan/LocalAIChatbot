"""
Date difference tool — exact date math via Python stdlib.

Why not let Gemma calculate date differences itself?
  - Gemma consistently gets date arithmetic wrong (e.g. said 49 days instead of 415).
  - Python's datetime.date handles leap years, month lengths, and timezone edges correctly.
  - This tool is called by Gemma whenever it needs to find the gap between two dates.
"""

from datetime import date as _date

# Tool definition sent to Gemma alongside every request.
# The description tells Gemma exactly when to use it.
DATETOOL_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "date_diff",
            "description": (
                "Calculate the exact number of days between two dates. "
                "ALWAYS use this tool instead of calculating date differences yourself — you make date math errors. "
                "Use for: how many days/weeks/months between two dates, how long ago something happened, "
                "how many days until a future event, age calculations, duration of events."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "date1": {
                        "type": "string",
                        "description": "The first (earlier) date in YYYY-MM-DD format. Example: '2025-03-04'",
                    },
                    "date2": {
                        "type": "string",
                        "description": "The second (later) date in YYYY-MM-DD format. Example: '2026-04-23'",
                    },
                },
                "required": ["date1", "date2"],
            },
        },
    }
]


def date_diff(date1: str, date2: str) -> str:
    """
    Return the exact difference between two ISO dates (YYYY-MM-DD).
    Handles negative differences gracefully (date1 after date2).
    Returns days, weeks, and a plain-English breakdown.
    """
    try:
        d1 = _date.fromisoformat(date1.strip())
        d2 = _date.fromisoformat(date2.strip())

        delta = d2 - d1
        days  = delta.days
        sign  = "" if days >= 0 else "-"
        abs_days = abs(days)

        weeks        = abs_days // 7
        remainder    = abs_days % 7
        approx_months = round(abs_days / 30.44, 1)
        approx_years  = round(abs_days / 365.25, 2)

        lines = [f"From {d1.strftime('%B %d, %Y')} to {d2.strftime('%B %d, %Y')}:"]
        lines.append(f"  Exact days  : {sign}{abs_days:,} days")
        lines.append(f"  In weeks    : {sign}{weeks} weeks and {remainder} days")
        lines.append(f"  Approx      : ~{approx_months} months / ~{approx_years} years")

        if days < 0:
            lines.append(f"  Note: date1 is after date2 — the difference is negative.")

        return "\n".join(lines)

    except ValueError as e:
        return (
            f"Could not parse dates: {e}\n"
            "Please provide dates in YYYY-MM-DD format. "
            "Example: date_diff('2025-03-04', '2026-04-23')"
        )
