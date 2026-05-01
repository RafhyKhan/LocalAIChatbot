# RainAI — Local Personal AI Dashboard

A fully local AI assistant and personal dashboard. All data stays on your machine.

---

## AI Capabilities

- [x] Conversational chat with persistent history per conversation
- [x] Real-time web search via local SearXNG instance
- [x] Weather lookup — current conditions and 3-day forecast
- [x] Precise calculator via SymPy
- [x] Date difference between any two dates
- [x] Unit conversion — any unit, any category
- [x] URL browsing — open and read web pages
- [x] Semantic memory — ChromaDB recalls relevant past conversations automatically
- [x] Live Data Update — send calendar, checklist, and personal profile to the AI on demand
- [x] Stop mid-response — cancel a streaming reply at any time
- [x] Web search toggle — enable or disable search per session
- [x] Conversation archive — soft delete with full restore from Settings

---

## Dashboard

A modular widget grid displayed alongside the chat sidebar.

### Widgets

| Widget | Description |
|---|---|
| 🌤 Weather | 7-day local forecast from Open-Meteo |
| 📅 Google Calendar | Weekly events + agenda notes |
| ✅ Checklist | Sectioned tasks with favourites, drag-and-drop, lifetime counter |
| 🗓 Daily Schedule | Time-slot tracker with live current-slot highlighting |
| 📰 BBC News | Latest headlines from BBC RSS |
| 🌍 World News | Multi-source accordion reader |
| 💬 Quote | Random quote from a configurable endpoint |
| 🎲 Random Fact | Dad jokes, trivia, poetry |
| 📖 Word of the Day | Dictionary definition + manual entry fallback |
| 🏛 Philosopher of the Month | Latest posts from OUP Blog |
| 📝 Notes | Persistent scratchpad, auto-saves locally |
| 🔍 Google Search | Quick search bar |
| 🔖 Bookmarks | Personal URL bookmarks in localStorage |

### Modularity

- Each widget is a self-contained React component
- Add a new widget by creating a component and registering one line in `Dashboard.tsx`
- Widgets span 1 or 2 columns via `colSpan`
- Widget Directory lets you add/remove widgets from the UI without touching code
- Visibility and layout persist across sessions

