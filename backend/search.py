import aiohttp

SEARXNG_URL = "http://localhost:8888"


async def web_search(query: str, num_results: int = 5) -> list[dict]:
    params = {
        "q": query,
        "format": "json",
        "categories": "general",
    }
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f"{SEARXNG_URL}/search", params=params) as resp:
                if resp.status == 200:
                    data = await resp.json(content_type=None)
                    results = data.get("results", [])[:num_results]
                    return [
                        {
                            "title": r.get("title", ""),
                            "url": r.get("url", ""),
                            "content": r.get("content", ""),
                        }
                        for r in results
                    ]
    except Exception as e:
        print(f"[search] SearXNG error: {e}")
    return []


def format_search_results(results: list[dict]) -> str:
    if not results:
        return ""
    lines = ["[Web Search Results]"]
    for i, r in enumerate(results, 1):
        lines.append(f"{i}. {r['title']}")
        if r.get("url"):
            lines.append(f"   {r['url']}")
        if r.get("content"):
            lines.append(f"   {r['content'][:400]}")
        lines.append("")
    return "\n".join(lines)
