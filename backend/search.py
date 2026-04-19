"""
SearXNG web search integration — designed for OpenAI tool calling.

Instead of a separate yes/no classifier, Gemma itself decides when to call
web_search() via the tool calling API. This is far more reliable because:
  - The model is trained to invoke tools when it needs real-time data.
  - There's no ambiguity parsing a "yes"/"no" text response.
  - The model trusts results it requested itself vs. results pasted into a prompt.

SEARCH_TOOLS  — the tool definition sent to Gemma with every request.
web_search()  — executes the actual SearXNG query when Gemma calls the tool.
"""

import httpx

# SearXNG is running in Docker on port 8080 (started via docker-compose up -d)
SEARXNG_URL     = "http://localhost:8080/search"
SEARXNG_TIMEOUT = 8  # seconds before we give up on the search request

# Tool definition sent to Gemma on every request.
# Gemma uses the description to decide when to call it — make it explicit.
SEARCH_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": (
                "Search the web for real-time, up-to-date information. "
                "Call this whenever the user asks about: current events, news, weather, "
                "temperature, sports scores, stock prices, recent releases, live data, "
                "or anything that may have changed after your training cutoff. "
                "Always prefer searching over saying you don't know."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to look up — be specific for better results.",
                    }
                },
                "required": ["query"],
            },
        },
    }
]


async def web_search(query: str) -> str:
    """
    Execute a search against the local SearXNG instance and return
    the top 5 results as a formatted string.

    This is called by main.py after Gemma emits a tool_call for "web_search".
    The result is sent back as a tool-role message so Gemma can read and cite it.
    """
    try:
        # Async HTTP client so we don't block the event loop during the search
        async with httpx.AsyncClient(timeout=SEARXNG_TIMEOUT) as http:
            resp = await http.get(
                SEARXNG_URL,
                params={"q": query, "format": "json", "language": "en"},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        # Return a descriptive error — Gemma will see this as the tool result
        # and can tell the user the search failed rather than silently giving up
        return f"Web search failed: {e}"

    results = data.get("results", [])[:5]  # top 5 results keeps the context concise
    if not results:
        return "No results found for this query."

    # Format as a numbered list: title, URL, and content snippet
    lines = [f'Search results for "{query}":\n']
    for i, r in enumerate(results, 1):
        title   = r.get("title", "No title")
        url     = r.get("url", "")
        snippet = r.get("content", "").strip()
        lines.append(f"{i}. {title}\n   {url}\n   {snippet}\n")

    return "\n".join(lines)
