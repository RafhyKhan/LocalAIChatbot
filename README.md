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






First page, main overlay. Containg search and clean UI.

<img width="2879" height="1445" alt="RainAIStartingOverlay" src="https://github.com/user-attachments/assets/f7f72348-701c-409a-9ac5-a5dd162b2e24" />


After pressing the Arrow at the bottom of the overlay, the Dashboard is revealed. The dashboard contains mutiple widgets. 
> Calender widget: Syncs your google calender and displays events on the widget. Uses weather API to display weather for future 7 days. The "Agenda" button creates a special event on your google calender that saves the text.
> News Widget: Contains the new articles from mutiple sources using APIs for each one.
> Checklist Widget: Allows you to create tasks with checkboxes. You can create sections to organize your checklist, and have an faovurite section that displays your checklist even when the app is closed. 

<img width="2879" height="1446" alt="RainAIDashboardScreenshot" src="https://github.com/user-attachments/assets/5c3b93b6-2da7-4a22-b2c0-c162fb5c7fcd" />


Widget menu revealed!

<img width="2879" height="1448" alt="RainAIDashboardWidgetMenuScreenshot" src="https://github.com/user-attachments/assets/e125d89b-c30a-40cc-aae6-adf7f05590db" />



RainAI chat window.

<img width="2873" height="1444" alt="RainAIChat" src="https://github.com/user-attachments/assets/a8850f7b-dcfa-483b-a0a9-a1e742f2a0b2" />


