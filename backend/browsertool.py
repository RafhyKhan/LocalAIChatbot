"""
Browser tool — open URLs in the user's default browser.

Uses Python's built-in webbrowser module — no extra dependencies needed.
Gemma calls open_url() when the user asks to visit or open a website.
"""

import webbrowser

BROWSERTOOL_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "open_url",
            "description": (
                "Open a URL in the user's default web browser in a new tab. "
                "Use this when the user asks to open, visit, or navigate to a website or URL. "
                "Also use when the user puts a URL or domain in quotes and asks to open it."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": (
                            "The full URL to open. Add https:// if missing. "
                            "Examples: 'https://reddit.com', 'google.com', 'https://github.com/trending'"
                        ),
                    }
                },
                "required": ["url"],
            },
        },
    }
]


def open_url(url: str) -> str:
    """Open a URL in the default browser. Prepends https:// if no scheme is present."""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    webbrowser.open_new_tab(url)
    return f"Opened {url} in your browser."
