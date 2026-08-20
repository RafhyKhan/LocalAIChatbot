# RainAI — Local Personal AI Dashboard

A fully local AI assistant and personal dashboard. All data stays on your machine.

RainAI chat window.
<img width="2879" height="1445" alt="RainAIStartingOverlay" src="https://github.com/user-attachments/assets/f7f72348-701c-409a-9ac5-a5dd162b2e24" />
<img width="2873" height="1444" alt="RainAIChat" src="https://github.com/user-attachments/assets/a8850f7b-dcfa-483b-a0a9-a1e742f2a0b2" />

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

- Calender widget: Syncs your google calender and displays events on the widget. Uses weather API to display weather for future 7 days. The "Agenda" button creates a special event on your google calender that saves the text.
- News Widget: Contains the new articles from mutiple sources using APIs for each one.
- Checklist Widget: Allows you to create tasks with checkboxes. You can create sections to organize your checklist, and have an faovurite section that displays your checklist even when the app is closed. 

<img width="2879" height="1446" alt="RainAIDashboardScreenshot" src="https://github.com/user-attachments/assets/5c3b93b6-2da7-4a22-b2c0-c162fb5c7fcd" />


Widget menu revealed!

<img width="2879" height="1448" alt="RainAIDashboardWidgetMenuScreenshot" src="https://github.com/user-attachments/assets/e125d89b-c30a-40cc-aae6-adf7f05590db" />



RainAI chat window.

<img width="2873" height="1444" alt="RainAIChat" src="https://github.com/user-attachments/assets/a8850f7b-dcfa-483b-a0a9-a1e742f2a0b2" />



# RainAI — Complete Technical Reference & Project Chronicle

> A fully self-hosted, privacy-first, local AI assistant with hybrid semantic memory, Retrieval Augmented Generation, agentic tool-calling, Google API integration, multimodal vision, and a composable personal dashboard. Built entirely on-device. No external LLM API. No data leaving the machine.

---

## Table of Contents

1. [Project Philosophy & Origin](#1-project-philosophy--origin)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Complete Technology Stack](#3-complete-technology-stack)
4. [Backend — Module-by-Module Reference](#4-backend--module-by-module-reference)
   - 4.1 [main.py — The Orchestration Hub](#41-mainpy--the-orchestration-hub)
   - 4.2 [memory.py — Semantic Long-Term Memory](#42-memorypy--semantic-long-term-memory)
   - 4.3 [rag.py — Hybrid Document Retrieval](#43-ragpy--hybrid-document-retrieval)
   - 4.4 [conversations.py — Conversation Persistence](#44-conversationspy--conversation-persistence)
   - 4.5 [database.py — SQLite Layer](#45-databasepy--sqlite-layer)
   - 4.6 [search.py — SearXNG Web Search](#46-searchpy--searxng-web-search)
   - 4.7 [calculator.py — SymPy Symbolic Math](#47-calculatorpy--sympy-symbolic-math)
   - 4.8 [datetool.py — Date Arithmetic](#48-datetoolpy--date-arithmetic)
   - 4.9 [unittool.py — Unit Conversion](#49-unittoolpy--unit-conversion)
   - 4.10 [browsertool.py — URL Fetching](#410-browsertoolpy--url-fetching)
   - 4.11 [weathertool.py — Real-Time Weather](#411-weathertoolpy--real-time-weather)
   - 4.12 [google_calendar.py — Calendar Integration](#412-google_calendarpy--calendar-integration)
   - 4.13 [google_tasks.py — Tasks Integration](#413-google_taskspy--tasks-integration)
   - 4.14 [dashboard.py — Widget Data Feeds](#414-dashboardpy--widget-data-feeds)
5. [Inference Layer — Local LLM Stack](#5-inference-layer--local-llm-stack)
   - 5.1 [Docker Model Runner](#51-docker-model-runner)
   - 5.2 [Model Choice: Gemma 4](#52-model-choice-gemma-4)
   - 5.3 [OpenAI-Compatible API](#53-openai-compatible-api)
   - 5.4 [Context Window Configuration](#54-context-window-configuration)
6. [Agentic Tool-Calling Architecture](#6-agentic-tool-calling-architecture)
   - 6.1 [The Tool-Calling Loop](#61-the-tool-calling-loop)
   - 6.2 [Streaming vs Non-Streaming](#62-streaming-vs-non-streaming)
   - 6.3 [Tool Dispatch Pattern](#63-tool-dispatch-pattern)
   - 6.4 [SSE (Server-Sent Events) Streaming](#64-sse-server-sent-events-streaming)
7. [Dual-Tier Memory Architecture](#7-dual-tier-memory-architecture)
   - 7.1 [Tier 1 — Recency Window (Episodic Context)](#71-tier-1--recency-window-episodic-context)
   - 7.2 [Tier 2 — Semantic Long-Term Memory](#72-tier-2--semantic-long-term-memory)
   - 7.3 [Bi-Encoder: all-MiniLM-L6-v2](#73-bi-encoder-all-minilm-l6-v2)
   - 7.4 [Approximate Nearest Neighbour (ANN) with HNSW](#74-approximate-nearest-neighbour-ann-with-hnsw)
   - 7.5 [Cross-Encoder Reranking: FlashRank](#75-cross-encoder-reranking-flashrank)
   - 7.6 [Memory Deduplication](#76-memory-deduplication)
8. [RAG Pipeline — Hybrid Retrieval Augmented Generation](#8-rag-pipeline--hybrid-retrieval-augmented-generation)
   - 8.1 [Stage 1 — PDF Extraction (PyMuPDF)](#81-stage-1--pdf-extraction-pymupdf)
   - 8.2 [Stage 2 — Chunking Strategy](#82-stage-2--chunking-strategy)
   - 8.3 [Stage 3 — Dense Embedding (all-mpnet-base-v2)](#83-stage-3--dense-embedding-all-mpnet-base-v2)
   - 8.4 [Stage 4 — Dual Index: ChromaDB + BM25Okapi](#84-stage-4--dual-index-chromadb--bm25okapi)
   - 8.5 [Stage 5 — Hybrid Retrieval & Weighted Merge](#85-stage-5--hybrid-retrieval--weighted-merge)
   - 8.6 [Conversation-Aware Retrieval](#86-conversation-aware-retrieval)
   - 8.7 [Idempotent Re-Indexing via MD5 Hashing](#87-idempotent-re-indexing-via-md5-hashing)
   - 8.8 [Async Background Indexing with Progress Callbacks](#88-async-background-indexing-with-progress-callbacks)
9. [Context Assembly Pipeline](#9-context-assembly-pipeline)
   - 9.1 [Layer Order and Rationale](#91-layer-order-and-rationale)
   - 9.2 [Personal Context Block](#92-personal-context-block)
   - 9.3 [Token Estimation Endpoint](#93-token-estimation-endpoint)
10. [Google API Integration](#10-google-api-integration)
    - 10.1 [OAuth2 PKCE Flow](#101-oauth2-pkce-flow)
    - 10.2 [Shared Token Architecture](#102-shared-token-architecture)
    - 10.3 [Google Calendar — Full CRUD](#103-google-calendar--full-crud)
    - 10.4 [Google Tasks — Full CRUD + Ordering](#104-google-tasks--full-crud--ordering)
    - 10.5 [Route Naming — The /api/gtasks Separation](#105-route-naming--the-apigtasks-separation)
11. [Multimodal Vision](#11-multimodal-vision)
12. [Frontend Architecture](#12-frontend-architecture)
    - 12.1 [React + TypeScript + Vite](#121-react--typescript--vite)
    - 12.2 [Composable Widget Grid System](#122-composable-widget-grid-system)
    - 12.3 [Widget Registry Pattern](#123-widget-registry-pattern)
    - 12.4 [CSS Design System](#124-css-design-system)
    - 12.5 [@dnd-kit Drag-and-Drop](#125-dnd-kit-drag-and-drop)
13. [Widget Encyclopedia](#13-widget-encyclopedia)
    - 13.1 [GoogleTasksWidget](#131-googletaskswidget)
    - 13.2 [CalendarWidget](#132-calendarwidget)
    - 13.3 [ProphetWidget (Ibn Kathir)](#133-prophetwidget-ibn-kathir)
    - 13.4 [WeatherWidget](#134-weatherwidget)
    - 13.5 [ScheduleWidget](#135-schedulewidget)
    - 13.6 [CheckboxWidget](#136-checkboxwidget)
    - 13.7 [NewsWidget / MultiNewsWidget](#137-newswidget--multinewswidget)
    - 13.8 [WordWidget](#138-wordwidget)
    - 13.9 [PhilosopherWidget](#139-philosopherwidget)
    - 13.10 [BookmarksWidget](#1310-bookmarkswidget)
    - 13.11 [NotesWidget](#1311-noteswidget)
    - 13.12 [GreetingWidget, QuoteWidget, RandomFactWidget, CounterWidget, GoogleSearchWidget](#1312-utility-widgets)
14. [Data Persistence Architecture](#14-data-persistence-architecture)
15. [System Prompt Engineering](#15-system-prompt-engineering)
16. [REST API Reference](#16-rest-api-reference)
17. [Infrastructure & Docker](#17-infrastructure--docker)
18. [Configuration & Environment Variables](#18-configuration--environment-variables)
19. [The Build Journey — Development Chronicle](#19-the-build-journey--development-chronicle)
    - 19.1 [Phase 1 — Foundation: Chat + Memory + RAG](#191-phase-1--foundation-chat--memory--rag)
    - 19.2 [Phase 2 — Tool Ecosystem](#192-phase-2--tool-ecosystem)
    - 19.3 [Phase 3 — Dashboard & Widget System](#193-phase-3--dashboard--widget-system)
    - 19.4 [Phase 4 — Google Calendar Integration](#194-phase-4--google-calendar-integration)
    - 19.5 [Phase 5 — Prophet/Ibn Kathir Widget](#195-phase-5--prophetibn-kathir-widget)
    - 19.6 [Phase 6 — Google Tasks Widget](#196-phase-6--google-tasks-widget)
20. [Debugging Chronicle — Every Major Error & Fix](#20-debugging-chronicle--every-major-error--fix)
21. [Architectural Decisions & Rationale](#21-architectural-decisions--rationale)
22. [Known Limitations & Future Roadmap](#22-known-limitations--future-roadmap)
23. [Installation & Setup Guide](#23-installation--setup-guide)

---

## 1. Project Philosophy & Origin

RainAI was built from a single conviction: a personal AI assistant should be *personal* — meaning private, owned, and tailored exclusively to its user. Every design decision flows from that principle.

**Privacy by default.** No API keys to external LLM providers. No usage sent to OpenAI, Anthropic, or Google's inference infrastructure. The language model runs locally inside a Docker container on the user's own GPU. Conversation history, personal profile, documents, calendar data — none of it leaves the machine.

**Real capability, not a demo.** The system was engineered to be genuinely useful: it searches the web when it needs to, does exact math without approximation, checks real-time weather, reads your calendar before answering questions about your day, remembers things you said in past conversations, and can read and reason over PDF documents you feed it. It is not a chatbot wrapper — it is an agentic system.

**Composable and extensible.** Both the backend tool suite and the frontend widget grid are designed to grow. Adding a new tool requires one branch in `_execute_tool()` and one entry in `ALL_TOOLS`. Adding a new widget requires one entry in `WIDGET_REGISTRY` and one `case` in `renderWidget()`. The architecture was planned to accommodate new capabilities without touching the core inference loop.

**Zero cloud dependency.** The entire stack runs on `localhost`. SearXNG for web search runs in Docker on port 8080. The LLM inference server runs in Docker via Docker Model Runner on port 12434. ChromaDB persists to disk at `backend/chroma_db/`. SQLite at `backend/conversations.db`. The only external network calls are: SearXNG (which itself federates to search engines), wttr.in for weather data, RSS feeds for news, and the Google APIs for Calendar and Tasks (which is opt-in and user-controlled via OAuth2).

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐│
│  │  Chat Panel  │  │  Dashboard   │  │  Settings / Profile    ││
│  │  (SSE stream)│  │  (Widget Grid│  │  (RAG / Archive / AI)  ││
│  └──────┬───────┘  └──────┬───────┘  └────────────────────────┘│
└─────────┼────────────────┼──────────────────────────────────────┘
          │ HTTP / SSE      │ REST
          ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND (Python)                      │
│                                                                  │
│  Context Assembly Pipeline:                                      │
│  [System Prompt] → [Time] → [Profile+Calendar] → [Semantic      │
│   Memory] → [RAG Chunks] → [Recent Window] → [User Message]     │
│                                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  memory.py │  │   rag.py     │  │  google_calendar.py    │  │
│  │ ChromaDB + │  │ ChromaDB +   │  │  google_tasks.py       │  │
│  │ FlashRank  │  │ BM25Okapi    │  │  dashboard.py          │  │
│  └────────────┘  └──────────────┘  └────────────────────────┘  │
│                                                                  │
│  Tool Suite:                                                     │
│  web_search → SearXNG  │  calculate → SymPy                     │
│  get_weather → wttr.in │  date_diff, convert_units, open_url    │
│                                                                  │
│  Persistence:                                                    │
│  SQLite (conversations) │ ChromaDB (vectors) │ JSON files        │
└───────────────────────────────┬─────────────────────────────────┘
                                │ OpenAI-compatible REST
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              DOCKER MODEL RUNNER (localhost:12434)               │
│                   Gemma 4 — 32k context window                  │
│                   GPU-accelerated (CUDA/RTX 4050)               │
└─────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                  ▼
      ┌───────────┐    ┌──────────────┐    ┌─────────────┐
      │  SearXNG  │    │  Google APIs │    │  wttr.in    │
      │  (Docker) │    │  (OAuth2)    │    │  (weather)  │
      │  port 8080│    │  Calendar +  │    └─────────────┘
      └───────────┘    │  Tasks v1    │
                       └──────────────┘
```

---

## 3. Complete Technology Stack

### Backend
| Component | Technology | Version/Notes |
|---|---|---|
| Web Framework | FastAPI | Async ASGI, CORS-configured |
| ASGI Server | Uvicorn | Runs `main.py` |
| LLM Client | `openai` Python SDK | AsyncOpenAI, pointed at local Docker endpoint |
| Language Model | Gemma 4 | `docker.io/ai/gemma4:E2B`, 32k context |
| Inference Runtime | Docker Model Runner | Port 12434, GPU-accelerated |
| Vector Database | ChromaDB | PersistentClient, HNSW cosine space |
| Bi-Encoder (memory) | `all-MiniLM-L6-v2` | SentenceTransformers, 384-dim embeddings |
| Bi-Encoder (RAG) | `all-mpnet-base-v2` | SentenceTransformers, 768-dim, higher quality |
| Cross-Encoder Reranker | FlashRank (`ms-marco-MiniLM-L-12-v2`) | Passage relevance scoring |
| Keyword Search Index | BM25Okapi (rank_bm25) | Pickled to `rag_bm25.pkl` |
| PDF Extraction | PyMuPDF (fitz) | Text + font metadata extraction |
| Symbolic Math | SymPy | Exact computation, safe parse_expr |
| Relational DB | SQLite | `database.py`, conversations + messages |
| Web Search | SearXNG | Self-hosted Docker instance |
| HTTP Client | httpx | Async HTTP for web search and weather |
| Google Auth | `google-auth-oauthlib` | OAuth2 PKCE flow |
| Google Calendar API | `google-api-python-client` | Calendar v3 |
| Google Tasks API | `google-api-python-client` | Tasks v1 |
| Environment Config | `python-dotenv` | `backend/.env` |
| Data Validation | Pydantic v2 | All request/response models |

### Frontend
| Component | Technology | Notes |
|---|---|---|
| Framework | React 18 | Functional components, hooks throughout |
| Language | TypeScript | Strict typing across all components |
| Build Tool | Vite | HMR dev server on port 5173 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable | Widget grid + task priority list |
| Styling | Custom CSS (index.css) | CSS variables, dark-first design system |
| State Management | React useState/useEffect | No external state library |
| Persistence | localStorage | Widget state, user preferences, reading progress |
| HTTP | fetch API | REST + SSE streaming |

### Infrastructure
| Service | How It Runs | Port |
|---|---|---|
| LLM Inference | Docker Model Runner | 12434 |
| SearXNG | Docker Compose | 8080 |
| FastAPI Backend | Uvicorn | 8000 |
| React Frontend | Vite Dev Server | 5173 |

---

## 4. Backend — Module-by-Module Reference

### 4.1 `main.py` — The Orchestration Hub

`main.py` is the central nervous system of RainAI. It is responsible for:

1. **Context assembly** — calling `_build_base_messages()` which coordinates all five context sources (system prompt, personal context, semantic memory, RAG chunks, recent window) into a single ordered message list before any inference happens.
2. **The tool-calling loop** — the `while True` agentic loop inside the `stream()` generator that runs inference, dispatches tool calls, appends results, and loops until the model produces a final answer.
3. **Response streaming** — switching to SSE streaming mode for the final response delivery.
4. **Persistence coordination** — calling `conv_store.add_message()` to write to SQLite and ChromaDB simultaneously.
5. **All REST endpoint routing** — every API route is registered here, spanning conversations, RAG management, Google Calendar, Google Tasks, profile, words, tasks, checklist, weather, news, and bookmarks.

**Key constants:**
- `RECENT_WINDOW = 80` — number of messages kept in the direct context window (Tier 1 memory)
- `SEMANTIC_K = 5` — number of semantically recalled messages injected from long-term memory (Tier 2)
- `MODEL = "docker.io/ai/gemma4:E2B"` — the Docker Model Runner image identifier
- `num_ctx: 32768` — 32k token context window passed per-request as an `extra_body` parameter

**The `_build_context_block()` function** assembles the personal context block that gets prepended to every system prompt:
- Loads the user's `profile.json` (free-text personal facts)
- Fetches today's Google Calendar events (today only, not the full 7-day window)
- Splits out the special `📋 Agenda` event (a freeform daily note) from regular calendar events
- Loads only the `Favourites` section of the checklist (not all tasks — only starred items)
- Each source is wrapped in independent `try/except` so failure in one never blocks the others

**Pydantic models defined:**
- `ChatRequest` — conversation_id, message, optional image_data (base64), optional image_mime
- `ProfileData` — content string
- `WordItem` — word, phonetic, partOfSpeech, definition, example
- `TaskItem` — label, category (for local personal task pool)
- `CalendarEventItem` — title, date, start, end
- `AgendaItem` — date, text
- `TaskCreateItem` — list_id, title, notes, due, starred (legacy), subtask_titles
- `TaskUpdateItem` — title, notes, due, status (all optional)
- `TaskMoveItem` — previous_task_id (for Google Tasks ordering)
- `ChecklistTaskItem` — id, label, checked
- `ChecklistSectionItem` — id, type, title, tasks
- `ChecklistStateV2` — sections, lifetime

---

### 4.2 `memory.py` — Semantic Long-Term Memory

See Section 7 for full architectural detail.

**Key design choices:**
- Uses a *separate* ChromaDB collection called `messages` — distinct from the RAG `rag_docs` collection. The two collections never mix.
- Both bi-encoder (MiniLM) and cross-encoder (FlashRank) are singleton instances — lazy-loaded on first use, then cached in module-level globals `_embed_model`, `_ranker`, `_collection`. This means the first request after server start pays the model-loading cost; all subsequent requests reuse the loaded models.
- `add_message(conv_id, msg_id, role, content)` — called by `conv_store.add_message()` which itself is called from `main.py` on every user and assistant message. ChromaDB document ID is `"{conv_id}_{msg_id}"` — the combination of both ensures global uniqueness across all conversations.
- `delete_conversation(conv_id)` — called on conversation deletion, removes all ChromaDB embeddings for that conversation via metadata filtering.
- `search(query, n_results, exclude_msg_ids)` — the full ANN → filter → rerank pipeline described in Section 7.

---

### 4.3 `rag.py` — Hybrid Document Retrieval

See Section 8 for full architectural detail.

**Key design choices:**
- Uses ChromaDB collection `rag_docs` with the same `chroma_db/` directory as the memory collection but a different collection name — they coexist in the same ChromaDB instance without interference.
- Two embedding models are used across the system: `all-MiniLM-L6-v2` in `memory.py` (fast, 384-dim, for conversation memory) and `all-mpnet-base-v2` in `rag.py` (more accurate, 768-dim, for document retrieval). This was a deliberate upgrade — MPNet produces richer embeddings for technical document content.
- The RAG embedding model runs on CUDA (`device="cuda"`) to handle the large batch encoding workload during indexing. The memory bi-encoder runs on CPU since it encodes single messages at a time.
- BM25 state is pickled to `rag_bm25.pkl`. If the file is corrupt or missing, the system degrades gracefully to semantic-only mode without throwing an error.
- Chunk metadata stored per-chunk: `source` (filename), `chunk_index`, `hash` (MD5 of file), `page_est` (estimated page number). The page estimation formula: `max(1, round((chunk_index / max(total_chunks-1, 1)) * page_count) + 1)` — a linear interpolation across the document.

---

### 4.4 `conversations.py` — Conversation Persistence

Manages the SQLite-backed conversation store. Responsibilities:
- `create_conversation()` — creates a new conversation record with a UUID and default title
- `list_conversations()` — returns all active (non-archived) conversations
- `list_archived_conversations()` — returns soft-deleted conversations for the Settings archive view
- `get_conversation(conv_id)` — returns conversation metadata + message list
- `get_recent_messages(conv_id, limit)` — returns the last `limit` messages in chronological order (feeds `RECENT_WINDOW`)
- `add_message(conv_id, role, content)` — writes to SQLite AND triggers `memory.add_message()` to simultaneously embed and store in ChromaDB. This is the single write point that keeps both persistence layers in sync.
- `delete_conversation(conv_id)` — soft-delete (sets an `archived` flag) + calls `memory.delete_conversation()` to remove ChromaDB embeddings. Nothing is hard-deleted at the SQLite level.
- `restore_conversation(conv_id)` — clears the archived flag
- `update_title(conv_id, title)` — called after the first exchange to set a generated title (limited to 80 chars)

---

### 4.5 `database.py` — SQLite Layer

Handles raw SQLite operations. `init_db()` is called at startup and creates two tables if they don't exist:
- `conversations` — id (UUID), title, created_at, archived (boolean)
- `messages` — id (integer PK, used as `msg_id` in ChromaDB metadata), conversation_id (FK), role, content, created_at

The integer `id` of each message row is stored as `msg_id` in ChromaDB metadata. This is what enables `exclude_msg_ids` deduplication — messages in the recency window have their SQLite IDs collected into a set, and the semantic search excludes any ChromaDB result whose `msg_id` metadata matches one of those IDs.

---

### 4.6 `search.py` — SearXNG Web Search

**Why SearXNG?** It is a self-hosted, open-source meta-search engine that aggregates results from Google, Bing, DuckDuckGo, and dozens of other engines simultaneously, without any API keys, rate limits, or tracking.

**Tool definition strategy:** Instead of a binary yes/no "should I search?" classifier, the entire search decision is delegated to the model via the tool-calling API. The description field in `SEARCH_TOOLS` is carefully engineered to enumerate exactly when the model should invoke it: "current events, news, weather, temperature, sports scores, stock prices, recent releases, live data, or anything that may have changed after your training cutoff." The model was trained to use tools like these — the description is the behavioral contract.

**Implementation:** Uses `httpx.AsyncClient` with an 8-second timeout. Fetches the SearXNG JSON endpoint at `http://localhost:8080/search` with `format=json&language=en`. Returns the top 5 results formatted as a numbered list with title, URL, and snippet. The tool result (a formatted string) is appended as a `tool`-role message for the model to read before generating its final response. Source URLs are extracted via regex from all web search results and sent to the frontend in the final `done` event for citation display.

---

### 4.7 `calculator.py` — SymPy Symbolic Math

**Why not eval()?** Three reasons:
1. `eval()` runs Python's floating-point arithmetic, which has the same precision limitations as the AI itself. `2.2 - 2.0` returns `0.19999999999999982` in Python's float.
2. `eval()` is a security risk — it executes arbitrary Python code.
3. SymPy does *symbolic* computation. `sqrt(2)` stays as `√2` until explicitly evaluated. `sin(pi/6)` returns exactly `1/2`, not `0.4999999999`.

**Parser configuration:** Two extra transformations are loaded:
- `implicit_multiplication_application` — allows `2x` as `2*x` so the model can write natural notation
- `convert_xor` — treats `^` as `**` so the model doesn't need to know Python's power operator

**Safe namespace:** `_SYMPY_NAMESPACE` includes all public SymPy symbols without any Python builtins, preventing code execution through the math parser.

**Result formatting:** Returns both exact symbolic form and decimal approximation when the result is purely numerical. For symbolic results (unevaluated integrals, expressions with free variables), returns the simplified form.

---

### 4.8 `datetool.py` — Date Arithmetic

Handles date difference calculations. The model is explicitly instructed in the system prompt to ALWAYS use this tool rather than computing date differences itself — temporal reasoning is a known LLM weakness, especially across month/year boundaries, leap years, and daylight saving transitions.

---

### 4.9 `unittool.py` — Unit Conversion

Handles unit conversions across metric/imperial and other domain-specific systems. Like the calculator, the model is instructed never to estimate conversions — the tool provides exact values.

---

### 4.10 `browsertool.py` — URL Fetching

`open_url(url)` — fetches a URL and returns its text content, enabling the model to "browse" to a specific page when given or finding a URL. This gives the system a lightweight web browsing capability beyond the snippet-based search results from SearXNG.

---

### 4.11 `weathertool.py` — Real-Time Weather

Fetches from `wttr.in`, a terminal-oriented weather service with a clean JSON API. The system prompt includes a strong directive: "ALWAYS use the get_weather tool for ANY weather-related question... NEVER search the web for weather; the get_weather tool is faster and always accurate." This prevents the model from wasting a web search call on weather when a dedicated tool exists.

The default location falls back to `CURRENT_LOCATION` from the environment if the user doesn't specify one.

---

### 4.12 `google_calendar.py` — Calendar Integration

**OAuth2 PKCE flow:** Uses `google-auth-oauthlib`'s `InstalledAppFlow` in out-of-band mode, generating an authorization URL the user opens in a browser. After granting permission, Google redirects to `http://localhost:8000/api/calendar/callback` with an authorization code. `exchange_code(code)` exchanges the code for access + refresh tokens, persisted to `google_token.json`.

**Dual scope:** The OAuth2 scope array is `["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/tasks"]`. Both Google Calendar and Google Tasks share the same token file and the same auth flow. This was a deliberate architectural choice — requesting both scopes at first authorization means only one OAuth2 approval step is needed for both integrations.

**Important:** If `google_token.json` was created before the Tasks scope was added, it must be deleted and re-authentication performed to obtain a token with both scopes.

**`_load_creds()`** — the shared credential loader used by both `google_calendar.py` and `google_tasks.py`. Loads the token, refreshes it automatically if expired using the stored refresh token.

**`get_events(days_ahead, start_date)`** — returns events in a structured format per day: `{ date, events: [{title, start, end, all_day, desc}] }`. The special `📋 Agenda` all-day event is created/updated via `save_agenda(date, text)` and detected by title in `_build_context_block()` for automatic injection into the AI's daily context.

**Callback page:** The OAuth callback endpoint returns a self-contained HTML page that displays a ✅ confirmation and auto-closes the popup tab after 1.5 seconds via `setTimeout(() => window.close(), 1500)`. This was designed to eliminate the need for the user to manually close the tab.

---

### 4.13 `google_tasks.py` — Tasks Integration

**`_get_service()`** — builds the `tasks` v1 service using the shared credentials from `google_calendar._load_creds()`. Returns `None` if credentials are unavailable, enabling `is_connected()` to gate all endpoints cleanly.

**`get_all_tasks()`** — fetches all tasks across all lists. Key parameters: `showCompleted=True, showHidden=True, maxResults=100`. The `maxResults=100` cap was discovered the hard way — setting it to 200 triggered a silent validation exception from Google's API (see Debugging Chronicle, Section 20).

Subtask handling: tasks with a `parent` field are separated from top-level tasks, grouped by parent ID into `child_map`, and embedded as a `subtasks` list inside their parent task object. Each top-level task gets a `position` field (a lexicographically sortable string used by Google Tasks to maintain list order).

**`move_task(list_id, task_id, previous_task_id)`** — wraps `tasks().move()`. The `previous` parameter is the ID of the task that should immediately precede the moved task in the new position. Passing `None` (omitting the parameter) moves the task to the top of the list. This is the mechanism powering drag-and-drop reordering that syncs to Google.

**`starred` field — completely removed:** Google Tasks API v1 does not expose the `starred`/`important` field via `tasks.get()` — it always omits it. Attempts to PATCH with `starred: true` are silently ignored by the API. After extensive debugging, the starred field was removed entirely from all layers — the `Task` TypeScript interface, `get_all_tasks()` response, `create_task()` body, `update_task()` body, and `TaskUpdateItem` Pydantic model. The use case was replaced by the Priority List pattern.

---

### 4.14 `dashboard.py` — Widget Data Feeds

Provides data endpoints for the various dashboard widgets:
- `get_forecast()` — 7-day weather forecast from Open-Meteo (free, no API key)
- `get_news()` — BBC News RSS feed headlines
- `get_multi_news(source)` — configurable RSS feed for multiple news sources
- `get_philosopher()` — Oxford University Press Blog "Philosopher of the Month" RSS feed

All RSS parsing is done server-side in Python, returning clean JSON to the frontend.

---

## 5. Inference Layer — Local LLM Stack

### 5.1 Docker Model Runner

Docker Model Runner is Docker's native LLM hosting solution. It runs as part of the Docker Desktop installation and is invoked with:

```bash
docker model run docker.io/ai/gemma4:E2B
```

It downloads the model, hosts it on the GPU, and exposes an OpenAI-compatible REST API at `http://localhost:12434/v1`. The model runs persistently in the background once started.

### 5.2 Model Choice: Gemma 4

**Gemma 4** (Google DeepMind) was selected as the primary model for several reasons:
- Strong instruction-following for the tool-calling pattern
- Capable vision (multimodal) support for image analysis
- Good performance on the RTX 4050 mobile GPU (6GB VRAM in the development hardware)
- `E2B` variant optimized for efficiency

Alternative models discussed but not deployed: **Qwen3-4B** was considered as a potential replacement — Qwen3's model family has strong multilingual support and competitive benchmark performance at small parameter counts. The architecture's OpenAI-compatible API abstraction makes swapping models a single `MODEL` constant change.

### 5.3 OpenAI-Compatible API

The `AsyncOpenAI` client is configured with:
```python
client = AsyncOpenAI(
    base_url="http://localhost:12434/v1",
    api_key="not-needed",
)
```

`api_key="not-needed"` is required by the SDK constructor but is ignored by the local inference server — there is no authentication on the local endpoint.

### 5.4 Context Window Configuration

Each inference call passes `extra_body={"num_ctx": 32768}`. This is a llama.cpp / Docker Model Runner specific parameter that sets the KV cache size and maximum context length for that specific request. Without it, the server defaults to a much smaller context window. The 32k window was chosen to accommodate: system prompt (~500 tokens) + personal context (~200 tokens) + semantic memory (~300 tokens) + RAG chunks (~1200 tokens) + 80 recent messages (~10,000–20,000 tokens depending on message length) + user message + tool results.

A token counting endpoint at `GET /api/conversations/{conv_id}/tokens` estimates usage using a characters÷4 approximation (close enough for Gemma without requiring an actual tokenizer library). It reports `used`, `limit` (32000), and `remaining`.

---

## 6. Agentic Tool-Calling Architecture

### 6.1 The Tool-Calling Loop

The most architecturally significant part of RainAI is the agentic tool-calling loop inside the `stream()` generator function. It is a true while loop — not a one-shot inference call.

```
while True:
    response = await client.chat.completions.create(
        model=MODEL,
        messages=messages,
        tools=ALL_TOOLS,
        tool_choice="auto",
        stream=False,           # ← non-streaming during tool loop
        extra_body={"num_ctx": 32768},
    )
    
    tool_calls = response.choices[0].message.tool_calls
    
    if not tool_calls:
        final_content = response.choices[0].message.content
        break                   # ← exit loop, proceed to streaming
    
    # append assistant message with tool_calls
    # execute each tool
    # append tool-role messages with results
    # loop again
```

This design allows the model to chain tool calls. For example:
1. User asks: "What's the GDP of France divided by its population, and how does that compare to Germany?"
2. Model calls `web_search("France GDP 2024")` → gets result
3. Model calls `web_search("Germany GDP 2024")` → gets result
4. Model calls `calculate("2794900000000 / 68000000")` → gets exact result
5. Model calls `calculate("4456000000000 / 84000000")` → gets exact result
6. Model generates final comparative answer with all data

Each iteration appends both the assistant's tool_call request message AND the tool result message in the OpenAI message format — the model reads its own prior tool calls and results before deciding what to do next.

### 6.2 Streaming vs Non-Streaming

The loop always runs `stream=False` (non-streaming, blocking). This is necessary because:
- Streaming a tool_call response is complex — you'd need to buffer the stream, detect tool calls in partial JSON, and handle reconnection
- The tool loop needs the *complete* response to know whether `tool_calls` is set
- The user-facing latency during tool execution is covered by `searching...` / `calculating...` SSE indicator events

Once the loop exits (no more tool calls), there are two paths:
1. **Model answered without calling any tools** — `final_content` is already set from the last loop iteration. It's yielded as a single SSE delta immediately. No second inference call needed.
2. **Model used tools** — a second inference call is made, this time with `stream=True`. The model generates its answer knowing all tool results, and tokens are streamed to the frontend in real time.

### 6.3 Tool Dispatch Pattern

`_execute_tool(name, arguments)` is an `async` function that dispatches by tool name:

```python
async def _execute_tool(name: str, arguments: str) -> str:
    args = json.loads(arguments)
    
    if name == "web_search":   return await searcher.web_search(args["query"])
    if name == "calculate":    return calc.calculate(args["expression"])
    if name == "date_diff":    return datetool.date_diff(args["date1"], args["date2"])
    if name == "convert_units": return unittool.convert_units(...)
    if name == "open_url":     return browsertool.open_url(args["url"])
    if name == "get_weather":  return weathertool.get_weather(args["location"])
    
    return f"Unknown tool: {name}"
```

Adding a new tool requires:
1. Implementing the function in a new Python module
2. Adding a branch here
3. Adding the tool definition to `ALL_TOOLS` in `main.py`
4. Updating the comment in `frontend/src/components/Sidebar.tsx` (noted in code)

### 6.4 SSE (Server-Sent Events) Streaming

The chat endpoint returns a `StreamingResponse` with `media_type="text/event-stream"`. The generator yields JSON-encoded events:

- `{"searching": true}` — web search started (renders "Searching the web..." indicator)
- `{"calculating": true}` — calculation started
- `{"delta": "token text"}` — streaming text chunk from final response
- `{"done": true, "sources": [...]}` — response complete, with source URLs collected from web searches
- `{"error": "message"}` — error occurred

The frontend `EventSource` / `fetch` + `ReadableStream` client reads these events and updates the chat UI accordingly.

---

## 7. Dual-Tier Memory Architecture

### 7.1 Tier 1 — Recency Window (Episodic Context)

The most recent `RECENT_WINDOW = 80` messages from the current conversation are loaded from SQLite via `get_recent_messages(conv_id, limit=80)` and placed verbatim into the message list in chronological order. No processing, no filtering, no scoring — they are included unconditionally.

**Why 80?** At an average of ~150 tokens per message, 80 messages ≈ 12,000 tokens — roughly 37% of the 32k context budget. This leaves room for the system prompt, personal context, semantic memory, RAG chunks, the new user message, and tool results.

The recency window is the model's "working memory" — everything it can reference immediately without retrieval. Conversational coherence (pronouns, follow-up questions, shared references within a session) depends entirely on Tier 1.

### 7.2 Tier 2 — Semantic Long-Term Memory

Tier 2 exists to solve the fundamental problem of finite context windows: the model cannot remember what you told it in conversation #1 while you're in conversation #200. Tier 2 provides the *illusion* of long-term memory by dynamically retrieving and injecting the most relevant past messages at query time.

Every message ever sent (across all conversations) is embedded and stored in ChromaDB's `messages` collection. On each new request, the pipeline runs:
1. Embed the query
2. ANN retrieval from ChromaDB → top 25 candidates
3. Distance threshold filter → drop dissimilar candidates
4. Deduplicate against recency window
5. FlashRank reranking → reorder by true relevance
6. Top 5 injected into system prompt

### 7.3 Bi-Encoder: all-MiniLM-L6-v2

**What it is:** A Sentence Transformer model — a neural network that maps text to a fixed-length dense vector (embedding) in a high-dimensional semantic space. `all-MiniLM-L6-v2` specifically:
- **Architecture:** Distilled from a larger BERT model. 6 transformer layers (vs. BERT's 12). The distillation process compresses the knowledge of a larger model into a smaller, faster one.
- **Output dimension:** 384 dimensions
- **Training:** Fine-tuned on "all" types of text pairs using contrastive learning — pairs of semantically similar sentences are trained to produce similar embeddings, while dissimilar pairs are pushed apart.
- **Size:** ~80MB
- **Speed:** Fast enough for single-message encoding to be imperceptible latency (<10ms on CPU)

**Why it's called a "bi-encoder":** Query and document are encoded *independently* (two separate forward passes), then similarity is computed as cosine distance between the two resulting vectors. Compare to cross-encoder: query and document are fed *together* as a single input. Bi-encoder = two encodings → compare. Cross-encoder = one encoding of both → score.

**The trade-off:** Because query and document never see each other during encoding, the bi-encoder can miss nuanced relevance — it compares the "average meaning" of each text independently. This is why reranking exists.

### 7.4 Approximate Nearest Neighbour (ANN) with HNSW

**The problem:** Given a query embedding vector `Q` and 10,000 stored message vectors, find the most similar ones. Exact nearest neighbour requires computing the distance to all 10,000 — O(n) per query.

**HNSW (Hierarchical Navigable Small World graph):** ChromaDB uses HNSW as its ANN index. HNSW builds a layered graph structure where nodes connect to their nearest neighbours. Search navigates the graph layer by layer, homing in on the query region rather than scanning linearly. Time complexity: O(log n).

The "approximate" means HNSW occasionally misses the single closest vector — but in practice, the top-k results are essentially identical to exact search, and the speed difference (milliseconds vs. seconds at scale) is massive.

**`hnsw:space: "cosine"`** — the distance metric. Cosine distance measures the angle between vectors regardless of their magnitude. For text embeddings, magnitude doesn't carry semantic meaning — a long document and a short document about the same topic should be close. Cosine distance normalizes this out.

`fetch = min(col.count(), n_results * 5)` — over-fetching by 5x gives the filter and reranker plenty of candidates to work with after the distance threshold drops some.

### 7.5 Cross-Encoder Reranking: FlashRank

**What it is:** FlashRank is a lightweight reranking library. The specific model `ms-marco-MiniLM-L-12-v2` is a cross-encoder fine-tuned on the **MS MARCO** dataset — a massive Microsoft corpus of real web search queries paired with passage relevance judgments. This training makes it specifically good at judging whether a given passage is truly relevant to a given query.

**How it works:**
```python
passages = [{"id": i, "text": candidate["content"]} for i, candidate in enumerate(candidates)]
reranked = _get_ranker().rerank(RerankRequest(query=query, passages=passages))
candidates = [candidates[r["id"]] for r in reranked]
```

The cross-encoder reads each (query, passage) pair *jointly* — it sees both texts in the same attention computation. This allows it to notice things like: the passage uses the word "database" in a completely different context than the query asking about databases. The bi-encoder would score them similarly because both mention "database." The cross-encoder understands the difference.

**FlashRank specifically** is chosen because it's optimized for this exact retrieval-then-rerank pattern: small enough to run without GPU, fast enough to rerank 20–30 candidates in milliseconds, and the ms-marco model is purpose-built for passage relevance (not general similarity).

### 7.6 Memory Deduplication

`exclude_msg_ids: set | None` — a set of SQLite message IDs corresponding to all messages in the current recency window. Before reranking, any ChromaDB result whose `msg_id` metadata matches one of these IDs is dropped. This prevents a message from appearing both in the recency window (verbatim) and the semantic memory injection (snippet). Without this deduplication, the same message could appear twice in the context — wasting tokens and confusing the model with repetition.

---

## 8. RAG Pipeline — Hybrid Retrieval Augmented Generation

RAG allows the model to answer questions about documents that weren't in its training data — PDFs placed in `backend/docs/` are indexed and made queryable. The hybrid approach combines two fundamentally different retrieval methods for better coverage.

### 8.1 Stage 1 — PDF Extraction (PyMuPDF)

`_extract_pdf_text(path)` opens a PDF with `fitz.open()` and calls `page.get_text()` for each page. Text is joined with newlines. This works for text-based PDFs (most academic papers, most books). Scanned image PDFs produce no text — `_extract_pdf_text` returns an empty string, and `index_document` returns an error: "No text extracted — file may be a scanned image PDF (needs OCR)".

PyMuPDF (fitz) also exposes font metadata — size, bold flag, text content per block — which was used in the Prophet widget's `extract_prophet_chunks.py` script to classify text into chapter titles, section headings, and body text based on font size and weight.

### 8.2 Stage 2 — Chunking Strategy

```python
CHUNK_SIZE    = 1200  # characters (~300 tokens)
CHUNK_OVERLAP = 450   # 37.5% overlap
```

Overlapping chunks: each chunk starts `CHUNK_SIZE - CHUNK_OVERLAP = 750` characters after the previous one. The 37.5% overlap is high by standard practice (50–100 char overlap is common) — this was intentionally increased to reduce the chance that a key sentence or concept falls exactly at a chunk boundary. The cost is ~33% more chunks than non-overlapping, which is acceptable for the document sizes in this system.

The chunking is character-based, not sentence-aware — a simple, predictable baseline. The code comment notes: "Swap this function to implement smarter chunking (e.g. sentence-aware, parent-child)" — an explicit extension point.

### 8.3 Stage 3 — Dense Embedding (all-mpnet-base-v2)

`all-mpnet-base-v2` produces 768-dimensional embeddings (vs. MiniLM's 384). It was specifically upgraded from MiniLM for the RAG collection because document retrieval quality benefits more from embedding fidelity than conversation memory does — document chunks can contain technical terminology where semantic nuance matters more than conversational fluency.

Batch encoding at `batch_size=32` processes 32 chunks per GPU forward pass, maximizing throughput during the indexing phase. CUDA acceleration is critical here — indexing a large PDF (hundreds of pages → thousands of chunks) without GPU acceleration would take hours.

### 8.4 Stage 4 — Dual Index: ChromaDB + BM25Okapi

**ChromaDB** stores the dense embeddings as the primary semantic index. Each chunk is stored with metadata: `source` (filename), `chunk_index`, `hash` (MD5), `page_est`.

**BM25Okapi** (from `rank_bm25`) is a classical probabilistic keyword retrieval model — the standard algorithm underlying Elasticsearch's default scoring. BM25 (Best Match 25) is a refinement of TF-IDF that accounts for document length normalization. It excels at exact term matching — if the query contains a specific technical term or proper noun, BM25 will reliably find chunks containing that exact term even if the semantic embedding misses the context.

BM25 state is rebuilt from scratch after every add or delete operation (`_rebuild_bm25()`). The rebuild fetches all documents from ChromaDB, tokenizes them (simple whitespace tokenizer — `text.lower().split()`), and constructs a new `BM25Okapi` object. This is efficient because the total corpus typically stays small (a few thousand chunks at most).

**Why persist BM25 to disk?** Because rebuilding from scratch at server startup from ChromaDB would add latency. The pickle file persists the trained BM25 model and the ID list between restarts.

### 8.5 Stage 5 — Hybrid Retrieval & Weighted Merge

```python
SEMANTIC_WEIGHT = 0.60
BM25_WEIGHT     = 0.40
DISTANCE_THRESHOLD = 0.60  # cosine distance cutoff

combined = SEMANTIC_WEIGHT * semantic_score + BM25_WEIGHT * bm25_score
```

The hybrid merge:
1. Runs semantic search in ChromaDB → top `fetch` results with distances converted to similarity: `similarity = max(0.0, 1.0 - distance)`
2. Runs BM25 keyword search → top `fetch` results with normalized scores
3. Takes the union of all chunk IDs from both results
4. For each chunk ID, computes the weighted combined score
5. **Applies the distance threshold as a hard gate on the semantic score** — if a chunk's cosine distance > 0.60, it's dropped regardless of its BM25 score. This prevents purely keyword-matching garbage from polluting the results.
6. Sorts by combined score descending
7. Returns the top `TOP_K = 4` chunks

**Why 60/40?** Semantic search handles paraphrase, synonyms, and conceptual queries. BM25 handles exact terms, acronyms, and technical specifics. The 60% semantic / 40% BM25 weight was chosen to give semantic understanding primacy while giving keyword precision meaningful weight.

### 8.6 Conversation-Aware Retrieval

```python
if recent_messages:
    context = " ".join(m.strip() for m in recent_messages[-2:] if m.strip())
    enriched_query = f"{context} {query}" if context else query
```

The last 2 user messages are prepended to the query before embedding and BM25 search. This anchors retrieval in the current conversational topic. Without this, if a user asks a follow-up question like "Can you explain that in more detail?" the query "Can you explain that in more detail?" has no useful retrieval signal — it's semantically bland. With the last 2 messages prepended, the enriched query includes the actual topic being discussed.

### 8.7 Idempotent Re-Indexing via MD5 Hashing

Each chunk's metadata includes `hash = hashlib.md5(path.read_bytes()).hexdigest()`. When `index_document(path)` is called:
1. Check if any chunks from this filename exist in ChromaDB
2. If yes, compare the stored hash against the current file's MD5
3. If identical → `return {"status": "skipped"}` — no re-indexing needed
4. If different → delete all old chunks in batches → re-index from scratch

This means the "Index Documents" button in Settings is safe to press repeatedly — it only does work when files have actually changed.

**Batched deletion and insertion:** ChromaDB has a maximum batch size limit (~5461 items). All `col.add()` and `col.delete()` calls are chunked in batches of 5000 to avoid hitting this limit.

### 8.8 Async Background Indexing with Progress Callbacks

Indexing runs in a thread pool executor so it doesn't block the asyncio event loop (embedding large PDFs on CPU/GPU is compute-intensive and synchronous):

```python
loop = asyncio.get_running_loop()
results = await loop.run_in_executor(
    None,  # default ThreadPoolExecutor
    lambda: rag.index_folder(progress_callback=on_progress),
)
```

The `progress_callback(files_done, total_files, current_file, elapsed)` is called before each file. It updates a global `_rag_index_progress` dict (files_done, total_files, current_file, elapsed_seconds, estimated_remaining_seconds). The estimated remaining time uses a simple average-per-file projection: `avg_per_file * (total_files - files_done)`.

The frontend polls `GET /api/rag/index/status` periodically during indexing to render a live progress bar.

---

## 9. Context Assembly Pipeline

### 9.1 Layer Order and Rationale

`_build_base_messages()` constructs the final message list in this exact order:

```
messages = [
    {"role": "system", "content": 
        SYSTEM_PROMPT
        + current_time_string
        + personal_context_block    ← profile + calendar + favourites
        + semantic_memory_snippets  ← FlashRank-reranked long-term recall
        + rag_document_chunks       ← hybrid-retrieved document passages
    },
    
    # Tier 1: recent conversation (verbatim, chronological)
    {"role": "user",      "content": message_n-79},
    {"role": "assistant", "content": response_n-79},
    ...
    {"role": "user",      "content": message_n-1},
    {"role": "assistant", "content": response_n-1},
    
    # Current user message (optionally multimodal)
    {"role": "user", "content": current_user_message},
]
```

**Why this order?** LLMs attend most strongly to content closest to the generation point (recency bias in attention). The recent conversation goes last (just before the user message) so it has maximum influence on the response. The system prompt and static context go first, establishing the persona and behavioral rules. Semantic memory and RAG sit in the middle — relevant but not conversationally urgent.

### 9.2 Personal Context Block

`_build_context_block()` assembles three sources:

**Profile:** `profile.json` is a free-text field the user maintains in Settings. It's a permanent "about me" document the AI always has access to. Examples: major/field of study, city, interests, ongoing projects, preferences.

**Calendar (today only):** Only today's events are injected — not the 7-day window. The AI doesn't need to know next Thursday's schedule unless asked. This keeps the context lean. The `📋 Agenda` event is separated from regular events and appended as `📋 Agenda: [text]` — it acts as a freeform daily note (tasks, intentions, reminders) that the AI reads every morning automatically.

**Favourites checklist:** Only the `type: "favourites"` section of the checklist is included. If it's empty, nothing is injected. This gives the AI awareness of the user's starred daily tasks without filling context with the full task list.

### 9.3 Token Estimation Endpoint

`GET /api/conversations/{conv_id}/tokens` returns:
```json
{"used": 4210, "limit": 32000, "remaining": 27790}
```

Calculation: `(len(SYSTEM_PROMPT) + sum(len(m["content"]) for m in recent)) // 4`

The `÷4` approximation (1 token ≈ 4 characters for English text) is a widely used heuristic that's close enough for display purposes without requiring an actual tokenizer.

---

## 10. Google API Integration

### 10.1 OAuth2 PKCE Flow

Google's OAuth2 authorization code flow with PKCE (Proof Key for Code Exchange):

1. `get_auth_url()` generates an authorization URL with the requested scopes and a state parameter
2. User opens the URL in a browser, signs in with Google, reviews permissions, clicks "Allow"
3. Google redirects to `http://localhost:8000/api/calendar/callback?code=...&state=...`
4. `exchange_code(code)` exchanges the authorization code for access + refresh tokens
5. Tokens are persisted to `backend/google_token.json`
6. All subsequent API calls use the stored tokens, auto-refreshing when expired

The frontend polls `GET /api/calendar/auth` every 3 seconds until `{"connected": true}` is returned. The auth URL is displayed as a button in the widget when not connected.

### 10.2 Shared Token Architecture

`google_calendar._load_creds()` is a module-level function used by *both* `google_calendar.py` and `google_tasks.py`. Both modules import and call the same credential loader, reading from the same `google_token.json`. This means:

- One OAuth2 flow authenticates both Calendar and Tasks
- One `google_token.json` file stores credentials for both
- One scope array at auth time covers both: `["...calendar", "...tasks"]`
- If the token is deleted and re-authentication happens, both integrations are restored simultaneously

### 10.3 Google Calendar — Full CRUD

**Read:** `get_events(days_ahead, start_date)` — fetches events from the Google Calendar v3 API using `events().list()` with `timeMin`, `timeMax`, `singleEvents=True`, `orderBy="startTime"`. Returns structured per-day data.

**Create:** `create_event(title, date, start, end)` — creates either a timed event (with `dateTime` start/end in RFC3339) or an all-day event (with `date` only) depending on whether start/end times are provided.

**Agenda Save:** `save_agenda(date, text)` — searches for an existing `📋 Agenda` event on the given date. If found, PATCHes its description. If not found, creates a new all-day event with title `📋 Agenda` and the text as description. This persistence mechanism means the agenda note survives server restarts and is always available to the AI's context builder.

### 10.4 Google Tasks — Full CRUD + Ordering

**The `position` field:** Google Tasks maintains order using a `position` field — a string of digits, lexicographically sortable, assigned by Google's servers. When tasks are fetched, sorting by `position` gives the user-defined order. When `move()` is called, Google reassigns positions to reflect the new order. The frontend sorts Priority List tasks by `.position.localeCompare(b.position)` to maintain Google's ordering without needing a local ordering layer.

**Optimistic UI updates:** When any task operation is performed (add, delete, reorder), the UI state is updated immediately *before* the API call completes. The API call fires asynchronously, and `fetchData()` is called in `.finally()` to sync the confirmed server state back. This gives the UI a snappy, responsive feel even on network latency.

**Drag reorder lock:** A `reordering` boolean state is set to `true` when a drag-end event triggers a `move()` API call. While `reordering === true`, the `PointerSensor` has `activationConstraint: {distance: Infinity}` — effectively disabling all drag interactions. The lock is released in `.finally()` after `fetchData()` completes. This prevents race conditions from multiple concurrent reorder requests.

### 10.5 Route Naming — The /api/gtasks Separation

A critical architectural decision: all Google Tasks API endpoints are named `/api/gtasks/*`, **not** `/api/tasks/*`.

`/api/tasks` was already in use by the personal task pool (`tasks.json`) serving the ScheduleWidget — endpoints for adding/removing tasks from a local JSON-based task list for the daily schedule builder. FastAPI uses first-match routing: the first registered route matching a path pattern wins. If Google Tasks routes had used `/api/tasks`, every Google Tasks API call would have silently hit the ScheduleWidget's handler with a completely wrong schema — returning task pool data instead of Google Tasks data, with no error thrown.

This route conflict was discovered through a codebase audit after the widget showed task lists loading correctly but no tasks appearing. See the Debugging Chronicle (Section 20) for the full discovery process.

---

## 11. Multimodal Vision

When `req.image_data` and `req.image_mime` are present in the ChatRequest, the final user message is replaced with a multimodal content block:

```python
messages[-1] = {
    "role": "user",
    "content": [
        {"type": "text",      "text": req.message},
        {"type": "image_url", "image_url": {
            "url": f"data:{req.image_mime};base64,{req.image_data}"
        }},
    ],
}
```

The image is embedded as a base64 data URI — no file upload, no URL, no external storage. The data URI is passed directly to the Docker Model Runner's vision endpoint. Gemma 4's multimodal capability handles: object identification, scene description, text in images (OCR-like), color analysis, composition analysis, diagram reading.

**Important limitation noted in system prompt:** "Be upfront that your internal image resolution is limited — you may miss fine detail or struggle with precise counting in dense scenes." This is an honest acknowledgment that local vision models have lower resolution than GPT-4V or Claude.

**Image not stored:** The base64 image data is intentionally not persisted to SQLite or ChromaDB. Only the text portion of the user's message is stored. Images can be large, and storing raw base64 in a SQLite text column would bloat the database significantly.

---

## 12. Frontend Architecture

### 12.1 React + TypeScript + Vite

The frontend is a React 18 single-page application written in TypeScript. Vite serves as the build tool and development server — HMR (Hot Module Replacement) allows component changes to reflect in the browser instantly without a full page reload.

CORS is configured in `main.py`: `allow_origins=["http://localhost:5173"]` — the Vite dev server's default port.

`frontend/src/api.ts` exports the `BASE` constant (`http://localhost:8000`) used as the API base URL throughout all components. This is the single point of truth for the backend URL — changing the backend port only requires updating one constant.

### 12.2 Composable Widget Grid System

The Dashboard renders widgets in a CSS Grid layout. Each widget has a `colSpan` property in the registry — how many columns it occupies in the grid. The grid itself is responsive. Widgets that warrant more horizontal space (the Google Tasks calendar with its side panel, for example) use `colSpan: 2`.

Widgets can be toggled on/off from a "Widgets" control panel. Widget visibility state is persisted in localStorage. Widgets can be reordered via `@dnd-kit` drag-and-drop (the `SortableWidget.tsx` wrapper).

### 12.3 Widget Registry Pattern

All widgets are registered in a `WIDGET_REGISTRY` array in `Dashboard.tsx`:

```typescript
const WIDGET_REGISTRY = [
    { id: "weather",   icon: "🌤", label: "Weather",       description: "...", colSpan: 1 },
    { id: "calendar",  icon: "📅", label: "Calendar",      description: "...", colSpan: 2 },
    { id: "gtasks",    icon: "📋", label: "Google Tasks",  description: "...", colSpan: 2 },
    { id: "prophet",   icon: "📖", label: "Ibn Kathir",    description: "...", colSpan: 1 },
    // ...
]
```

The `renderWidget(id)` function is a switch statement mapping each ID to its component:

```typescript
case "gtasks":  return <GoogleTasksWidget />;
case "prophet": return <ProphetWidget />;
// ...
```

Adding a new widget: add one entry to `WIDGET_REGISTRY`, one case to `renderWidget()`, one import.

### 12.4 CSS Design System

`frontend/src/index.css` is a 3000+ line custom CSS design system. It uses:
- **CSS custom properties (variables)** for color tokens, spacing, and typography — enabling consistent theming
- **Dark-first design** — the default color scheme is dark, appropriate for a personal productivity tool used at night
- **Scoped class naming** — each widget has its own prefix to prevent cascade collisions:
  - `gt-*` — GoogleTasksWidget
  - `po-*` — Prophet progress overlay
  - `prophet-*` — ProphetWidget main
  - `cal-*` — CalendarWidget
  - `news-*` — NewsWidget
  - etc.
- **Grid for calendar layout** — `grid-template-columns: repeat(7, 1fr)` for day headers and cells, `grid-auto-rows: auto` (not fixed height) so days with many tasks expand naturally

### 12.5 @dnd-kit Drag-and-Drop

`@dnd-kit/core` and `@dnd-kit/sortable` are used in two places:

**Widget Grid:** `SortableWidget.tsx` wraps each dashboard widget, enabling drag-to-reorder the grid layout. Widget order is persisted in localStorage.

**Google Tasks Priority List:** `SortablePriorityItem` component inside `GoogleTasksWidget.tsx` wraps each priority task. Uses `useSortable({ id, disabled: reordering })` — the `disabled` flag is the drag lock mechanism. The `CSS.Transform.toString(transform)` style is applied to the dragging item. On `DragEndEvent`, `arrayMove()` from `@dnd-kit/sortable` computes the new array order, and the `move()` API call syncs the new position to Google.

---

## 13. Widget Encyclopedia

### 13.1 GoogleTasksWidget

The most complex widget in the system. ~1100 lines of TypeScript.

**Calendar section (left, colSpan:2):** A rolling 31-day grid centered on today (today minus 15 days through today plus 15 days). This is not a traditional monthly calendar — it always shows exactly 31 days in a 7-column grid, updating daily. The `getRollingGrid()` function computes the date range.

- `grid-auto-rows: auto` — row height is determined by the tallest day cell in that row, not a fixed height. Days with many tasks expand the entire row vertically.
- Tasks appear as color-coded chips inside their due-date cell. Chip text wraps (`white-space: normal`) — no ellipsis truncation, so full task names are always visible.
- Priority List tasks are excluded from the calendar chips entirely (`t.listId !== priorityListId`) to prevent tasks appearing twice (once in the calendar, once in the priority list).
- Hidden lists (filtered out) are excluded: `!hiddenLists.has(t.listId)`

**Priority List (right panel, width: 310px):** Displays tasks from the Google Tasks list named "Priority List" (case-insensitive match: `l.title.toLowerCase() === "priority list"`).

- Tasks are sorted by Google's `position` field (lexicographically) — maintains Google's server-side ordering
- Numbered (1, 2, 3...) — displayed as a ranked priority queue
- Draggable via `@dnd-kit` with real-time Google sync on drop
- Drag lock while API call + `fetchData()` is in flight
- `×` button on each item: deletes task from Google via `DELETE /api/gtasks/{listId}/{taskId}`
- `⠿` drag handle: appears on hover (CSS opacity transition)

**P button (priority promotion):** Available on every task in the expanded list view that is NOT already in the Priority List. Creates a duplicate in the Priority List via `POST /api/gtasks` with `title = "{ListName}: {originalTitle}"`. The list name is prepended to disambiguate when the same task title appears in multiple lists.

**Color legend:** Above the priority list, a row of colored dots — one per task list. Each dot is clickable: `cycleListColor(listId)` advances through an 8-color palette, saving the override to `localStorage` under key `tasks_color_overrides`. Color overrides persist across page reloads.

**Filter panel:** A dropdown showing all task lists with checkboxes. Toggling a list hides its tasks from the calendar and expanded list. Persisted in `localStorage` under `HIDDEN_LISTS_KEY`.

**Expanded section (bottom):** A collapsible section below the calendar showing all tasks grouped by list. Starts collapsed. The entire widget starts *expanded* (expanded state is the default on first load).

Per-list grouping features:
- `▾/▸` collapse toggle (each list independently collapsible)
- `+` add task button in the list title bar — opens create overlay with that list pre-selected
- `📝` notepad toggle — reveals an inline `textarea` for free-form notes, auto-saving to localStorage on every keystroke (no debounce — immediate persistence)
- Task rows: `✏` edit, `P` promote, `×` delete

**Create/Edit overlays:**
- Fields: task name, notes, due date, list selector
- Backdrop click does NOT close the overlay — deliberate UX decision to prevent accidental dismissal while typing. Only the `×` button or "Cancel" button closes it.
- No `Escape` key handler — same reasoning.
- Edit overlay pre-fills all fields from the existing task's data.

**Subtasks:** Fetched and embedded in the task object but displayed only in the expanded list view as a checklist-style sub-list. Subtasks do NOT appear on the calendar chips — the due date of the parent task is what appears, not individual subtasks.

### 13.2 CalendarWidget

Displays a 7-day rolling view of Google Calendar events. Features:
- Navigation arrows to shift the 7-day window forward or backward
- Event creation form (title, date, start time, end time)
- All-day event support
- Agenda note field (syncs to the `📋 Agenda` all-day event, which the AI reads in its context block)
- OAuth2 connection flow embedded — shows "Connect Google Calendar" button if not authenticated, polling `GET /api/calendar/auth` every 3 seconds

### 13.3 ProphetWidget (Ibn Kathir)

A custom reading widget built around the book *Stories of the Prophets* by Ibn Kathir, sourced from a PDF in `frontend/src/data/`.

**Data source:** The PDF was processed by `extract_prophet_chunks.py` using PyMuPDF — text blocks were classified by font size and bold flag into chapter titles (≥13pt, non-bold, contains "Prophet"), section headings (12pt bold ≥5 chars, or 14pt bold ≥10 chars not ending in `:` or starting with quote), and body text. This classification logic handled the book's inconsistent heading structure across different prophet chapters.

**JSON structure (`prophets.json`):** 29 prophet objects:
```json
{
    "id": "Musa",
    "name": "Musa (Moses)",
    "bio": "...",
    "region": "...",
    "era": "...",
    "keyFigures": [...],
    "connectedProphets": [...],
    "chunks": [
        {"index": 0, "section": "Description of the Pharaoh", "text": "..."}
    ]
}
```
459 total chunks across 29 prophets. The enrichment fields (bio, region, era, keyFigures, connectedProphets) were added by `enrich_prophets.py`.

**Widget behavior:**
- On load: random prophet + random chunk from within that prophet's story
- `←/→` navigation buttons to move between chunks. `→` (Next) marks the current section as read.
- `📖` progress button opens the progress overlay
- `switchProphet()` allows jumping to a different prophet

**Progress overlay (two-panel):**
- Panel 1 — Prophet list: all 29 prophets shown with their name, overall completion % (read sections / total sections), and a mini progress bar
- Panel 2 — Section detail: full list of sections for a prophet with `✓` (read) or `☐` (unread) icons, current section highlighted. Clicking any section navigates directly to it.

**localStorage persistence:**
- `prophet_reading_progress` — `{prophetId: currentChunkIndex}` — tracks which chunk you were on per prophet
- `prophet_read_sections` — `{prophetId: number[]}` — array of read chunk indexes per prophet

**Ishaq and Yaqub correction:** These two prophets had 0 chunks after initial extraction because their stories were embedded inside the Ismail chapter with no separate chapter heading. Fixed via keyword-based section reassignment in the extraction script: section titles matching "Isaac", "Jacob", "Yaqub", "Ishaq" within Ismail's chunks were moved to the appropriate prophet.

### 13.4 WeatherWidget

7-day forecast from Open-Meteo (free, no API key, REST-based). Displays: day name, weather condition icon, high/low temperatures. Data fetched from `GET /api/weather` which calls `dashboard.get_forecast()`. Separate from the AI's `get_weather` tool which uses wttr.in — the widget uses Open-Meteo for its structured 7-day forecast format.

### 13.5 ScheduleWidget

A daily schedule builder. Pulls tasks from the personal task pool (JSON file, managed via `GET/POST/DELETE /api/tasks`). Tasks have categories: "work", "activity", "eat", "read", "workout". The widget allows dragging tasks into time slots to build a daily schedule. Distinct from Google Tasks — this is a local, offline-first task pool for schedule planning.

### 13.6 CheckboxWidget

A structured checklist with sections. Supports:
- **Favourites section** (type: "favourites") — starred tasks, rendered in the AI's personal context block
- **Unsorted section** (type: "unsorted") — default section for new tasks
- **Custom sections** (type: "custom") — user-created named sections
- Lifetime counter — total tasks ever checked
- Section collapse toggles
- Data migrated from old flat format (`labels[]`, `checked[]`, `favourites[]`) to new sections format on first load via `_migrate_old_checklist()`

### 13.7 NewsWidget / MultiNewsWidget

`NewsWidget` — BBC News RSS feed, fixed source.
`MultiNewsWidget` — configurable RSS source selector. Supported sources are defined server-side in `dashboard.get_multi_news(source)`. Both widgets fetch from `GET /api/news` and `GET /api/multinews/{source}` respectively.

### 13.8 WordWidget

A personal vocabulary builder. Features:
- Add word with: word, phonetic pronunciation, part of speech, definition, example sentence
- Persisted to `backend/words.json` via `GET/POST/DELETE /api/words`
- Display cards with all fields
- Delete button per word

### 13.9 PhilosopherWidget

Fetches and displays the latest "Philosopher of the Month" posts from the Oxford University Press Blog RSS feed via `GET /api/philosopher`. Cards show post title, date, and excerpt.

### 13.10 BookmarksWidget

Parses a Chrome bookmarks HTML export file (`frontend/src/data/bookmarksApril26.html`). Uses regex to extract all `<A HREF="...">title</A>` entries, returning `[{title, url}]`. The backend endpoint `GET /api/bookmarks` does the parsing. The widget renders a searchable, clickable list of all bookmarks — a quick-access bookmarks panel without needing the browser.

### 13.11 NotesWidget

A simple persistent freeform text area. Notes content stored in localStorage. No backend needed — purely client-side persistence.

### 13.12 Utility Widgets

- **GreetingWidget** — time-aware greeting ("Good morning", "Good afternoon", etc.) with the user's name from the first name env variable
- **QuoteWidget** — displays a rotating curated quote
- **RandomFactWidget** — displays an interesting fact, changes on click
- **CounterWidget** — a simple increment/decrement counter, persisted in localStorage
- **GoogleSearchWidget** — a styled Google Search input that opens Google in a new tab

---

## 14. Data Persistence Architecture

Three primary persistence mechanisms operate across the system:

| Layer | Technology | What It Stores | Location |
|---|---|---|---|
| Conversations | SQLite | Conversation metadata, all messages (role + content + timestamp) | `backend/conversations.db` |
| Vector Memory | ChromaDB | Embedded message vectors + metadata, embedded RAG document chunks + metadata | `backend/chroma_db/` |
| BM25 Index | Pickle | BM25Okapi trained model + chunk ID list | `backend/rag_bm25.pkl` |
| Profile | JSON file | User's freeform personal profile text | `backend/profile.json` |
| Words | JSON file | Personal vocabulary list | `backend/words.json` |
| Local Tasks | JSON file | ScheduleWidget personal task pool | `backend/tasks.json` |
| Checklist | JSON file | Checklist sections, tasks, lifetime count | `backend/checklist.json` |
| Google Auth | JSON file | OAuth2 access + refresh tokens | `backend/google_token.json` |
| Widget State | localStorage | Widget visibility, order, display preferences | Browser localStorage |
| Prophet Progress | localStorage | Per-prophet current chunk index + read sections | Browser localStorage |
| Task Colors | localStorage | Per-list color overrides (hex) | Browser localStorage |
| Task Notes | localStorage | Per-list freeform notepad content | Browser localStorage |
| Hidden Lists | localStorage | Set of list IDs filtered from calendar | Browser localStorage |

**Why JSON files for profile/words/tasks/checklist?** These are small, structured, human-readable datasets that change infrequently and don't require relational queries. SQLite would be over-engineered for them. The files are easy to inspect, edit manually, and back up.

**Why ChromaDB for both memory and RAG?** ChromaDB offers persistent HNSW vector indexing with metadata filtering in a pure Python, zero-server-required package. Running two logically separate collections (`messages` vs `rag_docs`) in the same ChromaDB instance avoids running two separate vector databases.

---

## 15. System Prompt Engineering

The system prompt is a critical piece of behavioral engineering. It establishes:

**Identity:** "Your name is RainAI. You are a helpful, concise personal AI assistant built exclusively for and by {USER_FULL_NAME}."

**Location awareness:** "You are located in {CURRENT_LOCATION}." Grounds the AI's context for any location-dependent queries.

**Web search directive:** "Never say you cannot access the internet or that your knowledge has a cutoff — you can and should search the web when needed." This overrides the model's base-training tendency to disclaim internet access.

**Weather tool directive:** "ALWAYS use this tool for ANY weather-related question... NEVER search the web for weather." Force-routes weather queries to the dedicated tool rather than the general web search.

**Calculator directive:** "ALWAYS use the calculator tool for any mathematical computation — never attempt arithmetic, algebra, or numerical reasoning yourself. You make math errors; the calculator does not." An explicit epistemic acknowledgment built into the prompt — the model is told directly that it makes arithmetic errors, which is both true and necessary for reliable tool adoption.

**Date directive:** "ALWAYS use it for any calculation involving the difference between two dates — never compute date gaps yourself."

**Unit conversion directive:** Same pattern — explicit instruction to always use the tool.

**Vision capability acknowledgment:** Instructs the model to acknowledge its resolution limitations honestly rather than overclaiming vision accuracy.

**Epistemic humility:** "You can and do make mistakes. When uncertain, say so clearly. Always distinguish between what you know from training and what you found via web search."

**Authoritative time injection:** Every request includes: "The current date and time in {location} is: {datetime}. This is exact and authoritative — do NOT search the web for the current time or date." This prevents the model from calling `web_search("current time")` when it can read the injected time directly.

---

## 16. REST API Reference

### Chat
| Method | Path | Description |
|---|---|---|
| POST | `/api/chat` | Main chat endpoint — returns SSE stream |

### Conversations
| Method | Path | Description |
|---|---|---|
| GET | `/api/conversations` | List all active conversations |
| POST | `/api/conversations` | Create new conversation |
| GET | `/api/conversations/archived` | List archived conversations |
| GET | `/api/conversations/{id}` | Get conversation + messages |
| DELETE | `/api/conversations/{id}` | Soft-archive conversation |
| POST | `/api/conversations/{id}/restore` | Restore archived conversation |
| PATCH | `/api/conversations/{id}/title` | Rename conversation |
| GET | `/api/conversations/{id}/tokens` | Token usage estimate |

### RAG
| Method | Path | Description |
|---|---|---|
| GET | `/api/rag/documents` | List indexed documents + chunk counts |
| GET | `/api/rag/index/status` | Live indexing progress |
| POST | `/api/rag/index` | Trigger background indexing |
| DELETE | `/api/rag/documents/{filename}` | Remove document from index |

### Google Calendar
| Method | Path | Description |
|---|---|---|
| GET | `/api/calendar/auth` | Auth status + auth URL if not connected |
| GET | `/api/calendar/callback` | OAuth2 redirect handler |
| GET | `/api/calendar/events` | Fetch events (start_date, days_ahead params) |
| POST | `/api/calendar/events` | Create calendar event |
| POST | `/api/calendar/agenda` | Save agenda note for a date |

### Google Tasks
| Method | Path | Description |
|---|---|---|
| GET | `/api/gtasks/lists` | List all task lists |
| GET | `/api/gtasks` | Get all tasks (all lists, subtasks embedded) |
| POST | `/api/gtasks` | Create task |
| PATCH | `/api/gtasks/{list_id}/{task_id}` | Update task fields |
| POST | `/api/gtasks/{list_id}/{task_id}/move` | Move task (reorder) |
| DELETE | `/api/gtasks/{list_id}/{task_id}` | Delete task |

### Dashboard Data
| Method | Path | Description |
|---|---|---|
| GET | `/api/weather` | 7-day Open-Meteo forecast |
| GET | `/api/news` | BBC News RSS |
| GET | `/api/multinews/{source}` | Configurable RSS source |
| GET | `/api/philosopher` | OUP philosopher RSS |

### Profile & Data
| Method | Path | Description |
|---|---|---|
| GET | `/api/profile` | Get user profile text |
| POST | `/api/profile` | Save user profile text |
| GET | `/api/context-preview` | Preview the full personal context block |
| GET | `/api/words` | Get word list |
| POST | `/api/words` | Add word |
| DELETE | `/api/words/{word}` | Delete word |
| GET | `/api/tasks` | Get local task pool (ScheduleWidget) |
| POST | `/api/tasks` | Add local task |
| DELETE | `/api/tasks/{label}` | Delete local task |
| GET | `/api/checklist` | Get checklist state |
| POST | `/api/checklist` | Save checklist state |
| GET | `/api/bookmarks` | Parse and return Chrome bookmarks |

---

## 17. Infrastructure & Docker

### Docker Model Runner

Docker Model Runner is Docker Desktop's built-in LLM inference layer. It pulls model images from Docker Hub's AI namespace (`docker.io/ai/`), loads them onto the GPU, and serves them via the OpenAI-compatible API on port 12434. No separate model download, no Ollama, no llama.cpp setup — it's fully integrated into Docker Desktop.

Starting the model:
```bash
docker model run docker.io/ai/gemma4:E2B
```

### SearXNG

SearXNG runs as a Docker Compose service. It requires a `docker-compose.yml` in the project root (or a separate searxng directory) and a `searxng/settings.yml` configuration file enabling JSON format output. Starts with:
```bash
docker-compose up -d
```
Accessible at `http://localhost:8080`. The backend's `search.py` queries it directly.

### Backend Server

```bash
cd backend
uvicorn main:app --reload --port 8000
```

`--reload` enables hot-reload during development — any change to `main.py` or imported modules restarts the server automatically.

### Frontend Dev Server

```bash
cd frontend
npm run dev
```

Starts Vite on `http://localhost:5173` with HMR.

---

## 18. Configuration & Environment Variables

All configuration lives in `backend/.env` (never committed to git — in `.gitignore`).

| Variable | Used In | Description |
|---|---|---|
| `USER_FULL_NAME` | `main.py` | Full name — appears in system prompt identity |
| `USER_FIRST_NAME` | `main.py` | First name — used in informal system prompt references |
| `USER_LOCATION` | `main.py`, `weathertool.py` | City/location for weather default + location awareness |
| `USER_LOCATION_SHORT` | `main.py` | Short location string for time injection label |
| `USER_TIMEZONE` | `main.py` | IANA timezone string (e.g. "America/Edmonton") for accurate local time |
| `GOOGLE_CLIENT_ID` | `google_calendar.py` | Google OAuth2 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `google_calendar.py` | Google OAuth2 client secret |

**Google Cloud Console setup required for Google integrations:**
1. Create a project in Google Cloud Console
2. Enable Google Calendar API and Google Tasks API
3. Create OAuth2 credentials (Desktop Application type)
4. Add `http://localhost:8000/api/calendar/callback` as an authorized redirect URI
5. Copy client ID and client secret to `.env`

---

## 19. The Build Journey — Development Chronicle

### 19.1 Phase 1 — Foundation: Chat + Memory + RAG

The project began with establishing the core chat loop. The first architectural decision was the inference runtime: Docker Model Runner was chosen over Ollama or a manual llama.cpp setup because it integrates natively into Docker Desktop and exposes an OpenAI-compatible API, meaning the standard `openai` Python SDK could be used without any custom HTTP client code.

The first memory implementation used only the recency window (Tier 1) — the last N messages from SQLite. This worked for single sessions but the AI had no memory across conversations. ChromaDB was added for Tier 2 semantic memory: every message gets embedded and stored, retrieved on each new request via ANN search.

The initial embedding model was `all-MiniLM-L6-v2`. FlashRank was added as the reranker after observing that raw cosine similarity sometimes returned tangentially related messages instead of truly relevant ones — the cross-encoder dramatically improved recall precision.

RAG was added to support PDF documents. The initial chunking was simple fixed-size overlapping windows. The embedding model for RAG was upgraded from MiniLM to `all-mpnet-base-v2` to improve technical document retrieval quality. BM25 was added to the RAG pipeline after observing that semantic search alone missed exact technical term matches (e.g., a query for a specific function name wouldn't retrieve the chunk discussing that function if the embedding emphasized the surrounding context over the name itself).

### 19.2 Phase 2 — Tool Ecosystem

The tool-calling architecture was built iteratively. Each tool followed the same pattern: define the JSON schema, implement the Python function, add a dispatch branch. The order of addition: web_search (SearXNG) → calculate (SymPy) → get_weather (wttr.in) → date_diff → convert_units → open_url.

The critical design decision was whether to use a separate intent classifier ("does this query need a web search?") or to rely on the model's own tool-calling capability. The latter was chosen — the model is trained to call tools when it needs them, and the description field in the tool definition is the behavioral contract. This is more reliable than a separate classifier because the model trusts results it requested itself.

The streaming architecture evolved: initially responses were either fully streaming or fully blocking. The current hybrid (blocking tool loop → streaming final answer) emerged as the best user experience — the user sees "Searching..." / "Calculating..." indicators during tool execution, then the final response streams in naturally.

### 19.3 Phase 3 — Dashboard & Widget System

The dashboard was designed as a composable grid from the start. The `WIDGET_REGISTRY` + `renderWidget()` pattern was established early to make widget addition a two-step process. CSS design tokens were set up in `index.css` to ensure consistent spacing, colors, and typography across all widgets without per-widget style duplication.

The `@dnd-kit` library was integrated for widget reordering. The `SortableWidget.tsx` wrapper provides drag-and-drop capability to any registered widget without the widget itself needing to know about drag-and-drop.

Widgets were added incrementally: weather → news → quotes → greeting → schedule → checkbox → words → bookmarks → philosopher. Each widget is a self-contained React component with its own state management and CSS classes. The notes widget uses pure localStorage — the only widget with zero backend dependency.

### 19.4 Phase 4 — Google Calendar Integration

The Google Calendar integration required establishing the OAuth2 PKCE flow — the first time the project needed a user-facing authentication step. The popup-based flow (opens Google auth URL in a new tab → user approves → tab auto-closes) was chosen over redirect-based auth to avoid disrupting the main app page.

The `_build_context_block()` function was the key integration point — making the AI aware of the user's daily schedule without requiring the user to tell it. The `📋 Agenda` event pattern emerged as a way to give the user a freeform daily note that the AI reads automatically. The decision to inject only today's events (not the full 7-day window) kept the context block lean.

### 19.5 Phase 5 — Prophet/Ibn Kathir Widget

The ProphetWidget originated from a need for a daily Islamic learning widget. The initial approach was to manually write story summaries for each prophet — but this was identified as problematic (summarization vs. verbatim text) and replaced with direct extraction from Ibn Kathir's PDF.

The PDF extraction required building a font-size/boldness-based heading classifier in `extract_prophet_chunks.py`. The book had inconsistent heading structure: some chapters had only body text, some had multiple heading levels, and some (Ismail) had sections about other prophets embedded within them. The classification logic handled this through a multi-condition rule set:

- Chapter heading: ≥13pt, non-bold, contains "Prophet"
- Primary section heading: 14pt bold, ≥10 chars, not ending in `:`, not starting with quote or parenthesis
- Secondary section heading: 12pt bold, ≥5 chars
- Body text: everything else

The Ishaq and Yaqub problem (0 chunks each) was solved by keyword-based section reassignment: during post-processing, sections within Ismail's chunk list whose titles contained "Isaac", "Jacob", "Yaqub", or "Ishaq" were moved to the appropriate prophet's chunk list.

Total: 459 chunks across 29 prophets. The `enrich_prophets.py` script added biographical metadata (bio, region, era, keyFigures, connectedProphets) to each prophet object.

The reading progress UI (progress overlay with two panels, per-section checkmarks, mini progress bars) was built to make the experience feel like a proper e-reader with reading history, not just a random chunk displayer.

### 19.6 Phase 6 — Google Tasks Widget

The Google Tasks widget was the most complex single component built in the project. The requirements evolved iteratively:

**Initial requirements:** Monthly calendar showing tasks on due dates, color-coded by list.

**Calendar evolution:** Monthly → rolling 31-day window (today ±15 days). The rolling window ensures the calendar always shows the most immediately relevant dates rather than resetting at month boundaries. `grid-auto-rows: auto` replaced fixed row heights after discovering that days with many tasks were clipping their content.

**Priority List origin:** The `starred` field was initially intended to mark high-priority tasks. After discovering that Google Tasks API v1 completely ignores the starred field (it is never returned in API responses and patching it has no effect), the entire starred system was removed and replaced with a named Google Tasks list called "Priority List." This list is detected case-insensitively and rendered as a special side panel with drag-to-reorder.

**The P button:** When the Priority List pattern was established, a `P` button was added to every task row (except those already in the Priority List) that creates a copy in the Priority List with the source list name prepended: `"Database Design: Complete ERD"`. This allows the Priority List to aggregate tasks from multiple source lists with context about their origin.

**Drag-and-drop + Google sync:** The drag-reorder uses `@dnd-kit`. On drag end, `arrayMove()` computes the new order, the UI updates optimistically, and `POST /api/gtasks/{listId}/{taskId}/move` syncs the new position to Google's servers. The drag lock (`reordering` state with `activationConstraint: {distance: Infinity}`) prevents race conditions.

**The overlay close behavior:** Both create and edit overlays were deliberately configured to ignore backdrop clicks and have no Escape key handler. The rationale: the create/edit forms take significant user input, and accidentally closing an overlay mid-entry (by clicking slightly outside it) would be frustrating and cause data loss.

**Color system:** The color legend above the Priority List maps each task list to a color from an 8-color palette. Colors are overridable per-list by clicking the legend dot — `cycleListColor()` advances through the palette and persists to localStorage. The Priority List itself has no legend dot (it's excluded as a special-case list).

---

## 20. Debugging Chronicle — Every Major Error & Fix

### Bug 1: `maxResults=200` Silent Exception (Google Tasks)

**Symptom:** No tasks were returned from Google Tasks. No error appeared in logs.

**Root cause:** Google Tasks API v1 caps `maxResults` at 100. Passing 200 triggered a validation error from Google's API that was caught by a bare `except Exception: continue` in the task-fetching loop — silently swallowing the error and returning an empty list for every task list.

**Discovery:** Added `print(f"[google_tasks] Error fetching tasks for list '{tl['title']}' ({tl['id']}): {e}")` to the exception handler. The printed error revealed the maxResults validation failure.

**Fix:** Changed `maxResults=200` to `maxResults=100`. Also changed the bare `except` to print the error before continuing.

**Lesson:** Always log the exception message in `except` blocks, especially in loops where a continue could mask failures.

---

### Bug 2: Route Conflict `/api/tasks` vs `/api/gtasks` (FastAPI First-Match)

**Symptom:** The Google Tasks widget fetched task lists successfully (GET /api/gtasks/lists worked) but no tasks appeared on the calendar (GET /api/gtasks was returning wrong data).

**Root cause:** FastAPI uses first-match routing. The ScheduleWidget already had `GET /api/tasks` and `POST /api/tasks` registered for the local personal task pool. The initially named Google Tasks routes were also `/api/tasks`. The Google Tasks GET `/api/tasks` call was hitting the ScheduleWidget handler, which returned `{"tasks": [{label, category}, ...]}` instead of `{"tasks": [{id, listId, title, due, ...}]}`. The schema mismatch was silent — the frontend received data that looked like a tasks response but with completely wrong field names. No 404, no 500, no error.

**Discovery:** A full codebase audit of `main.py` searching for all route registrations revealed two handlers registered at `GET /api/tasks` — the ScheduleWidget handler (registered first) and what was intended to be the Google Tasks handler (never actually reached due to first-match).

**Fix:** Renamed all Google Tasks endpoints to `/api/gtasks/*` prefix throughout `main.py` and `frontend/src/api.ts` and `GoogleTasksWidget.tsx`.

**Lesson:** In monolithic FastAPI apps with many routes, namespacing by functional area (`/api/gtasks/`, `/api/calendar/`, `/api/rag/`) from the start prevents collisions. FastAPI's first-match behavior is a footgun for routes that share a prefix.

---

### Bug 3: `starred` Field Non-Functional (Google Tasks API v1)

**Symptom:** Starring tasks in the widget had no visible effect. Tasks starred locally never appeared in the "Starred" view on Google's own Tasks web interface. Tasks starred on Google's interface didn't show as starred in the widget.

**Root cause:** Google Tasks API v1 does not expose the `starred` (or `important`) field in any documented way. `task.get("starred", False)` always returned `False` because the field is simply absent from the API response. PATCHing with `starred: True` in the request body was silently ignored by Google's API — no error, no acknowledgment.

**Fix:** Removed `starred` entirely from all layers:
- `Task` TypeScript interface (frontend)
- `get_all_tasks()` response (backend)
- `create_task()` request body (backend)
- `update_task()` allowable fields (backend)
- `TaskUpdateItem` Pydantic model (backend)
- All UI elements (star button removed from task rows and overlays)

Replaced with the Priority List pattern — a named Google Tasks list that serves as the priority queue, with full bidirectional sync to Google's servers.

**Lesson:** Always verify API field support with actual API calls before building UI around it. Documentation may describe fields that exist in internal implementations but are never surfaced via the public API.

---

### Bug 4: Case-Sensitive Priority List Name Matching

**Symptom:** The Priority List panel was empty even though a Google Tasks list called "Priority List" existed. Also, "Priority List" appeared in the color legend (it shouldn't — it's a special case list excluded from the legend).

**Root cause:** The initial matching logic used strict equality: `l.title === "Priority List"`. If the user named their list `"priority list"` or `"Priority list"` (any case variation), the match failed. The `priorityListId` useMemo returned `null`, causing the Priority List panel to show nothing, and the list appeared in the color legend alongside regular lists.

**Fix:** Changed to case-insensitive matching: `l.title.toLowerCase() === "priority list"`.

**Lesson:** User-defined names should always be matched case-insensitively. Never assume the user named something with exactly the right capitalization.

---

### Bug 5: Ishaq and Yaqub — 0 Chunks

**Symptom:** After PDF extraction, prophets Ishaq (Isaac) and Yaqub (Jacob) had no chunks. Their widget cards showed no content.

**Root cause:** Ibn Kathir's book does not have separate chapters for Ishaq and Yaqub. Their stories are embedded within the Ismail chapter, under section headings like "The Story of Isaac" and "Jacob's Story" — without any top-level chapter heading bearing their names. The extraction script assigned all sections in the Ismail chapter to Ismail.

**Fix:** Post-processing in `extract_prophet_chunks.py` using keyword-based section reassignment:
```python
ishaq_keywords = ["isaac", "ishaq", "isḥāq"]
yaqub_keywords = ["jacob", "yaqub", "yaʿqūb"]
# sections in ismail_chunks where section title matches keywords → move to ishaq/yaqub chunks
```

**Lesson:** Real-world PDFs (especially books translated from Arabic) have structural irregularities that break algorithmic chapter detection. Post-processing heuristics are often necessary.

---

### Bug 6: `maxResults=200` in ChromaDB

**Symptom:** Not a runtime error, but a potential issue: `col.get()` with `limit=100_000` was used in some places to fetch all chunks for a document.

**Context:** ChromaDB's `get()` method has a max result limit too, but using `limit=100_000` is safe for small document sets. For very large document collections, batched fetching would be required.

---

### Bug 7: CUDA Indexing Timeout (45+ minutes)

**Symptom:** The RAG indexing process ran for over 45 minutes without completing after triggering on a large PDF.

**Root cause:** The first time `rag.py`'s embedding model is loaded, it downloads `all-mpnet-base-v2` from Hugging Face (~430MB). On subsequent runs, the model is cached locally. Additionally, a large PDF (1984 by George Orwell was being indexed) generates hundreds of chunks, each requiring a GPU embedding pass. The progress callback was working correctly — the UI showed the progress bar — but the estimated time was initially very long.

**Resolution:** The indexing did eventually complete successfully. CUDA confirmed as active (`device="cuda"` in `_get_embed_model()`). The long duration on the first run was the model download, not a bug.

**Lesson:** Distinguish between first-run initialization time (model download) and steady-state performance. Adding a "model loading..." indicator during the first embedding call would improve UX.

---

### Bug 8: Apostrophes Breaking Python Script Execution

**Symptom (prior session):** When trying to run `enrich_prophets.py` with inline bash commands that contained apostrophes in the enrichment data (e.g., "Prophet's mission"), the bash heredoc would terminate early, causing syntax errors.

**Fix:** Instead of running the Python script inline via bash, wrote the script to a `.py` file first using the Write tool, then executed `python enrich_prophets.py` as a separate command. This avoided all shell quoting issues.

**Lesson:** Never inline Python scripts with string literals containing apostrophes/quotes into bash commands. Write to a file first, execute second.

---

### Bug 9: Expanded Section Scrolling (UX Bug)

**Symptom:** The expanded task list section in GoogleTasksWidget was scrollable, meaning the list had a fixed maximum height and overflow:scroll.

**User requirement:** The expanded section should NOT be scrollable — it should grow to show all content, letting the page/container scroll instead.

**Fix:** Removed `overflow: auto`/`overflow-y: scroll` from the expanded section's CSS, replacing with `height: auto` and letting the widget's total height grow dynamically.

---

### Bug 10: Overlay Backdrop Click Closing Overlays

**Symptom:** Clicking anywhere outside the create/edit task overlay dismissed it immediately, losing any entered data.

**Fix:** Removed `onClick={closeOverlay}` from the backdrop `<div>`. The backdrop has `pointer-events: none` for click-through behavior, or an explicit `onClick={e => e.stopPropagation()}` on the modal panel. Only the explicit `×` button and "Cancel" button trigger `closeOverlay()`.

---

### Bug 11: Priority List Appearing in Calendar Chips

**Symptom:** Tasks in the Priority List appeared both in the Priority List panel and as calendar chips on their due dates — effectively showing every priority task twice.

**Fix:** Added `t.listId !== priorityListId` to the `tasksForDate()` filter:
```typescript
const tasksForDate = (s: string) =>
    tasks.filter(t =>
        t.due === s &&
        t.status !== "completed" &&
        !hiddenLists.has(t.listId) &&
        t.listId !== priorityListId   // ← exclusion
    );
```

---

### Bug 12: RAG Not Indexing a Specific PDF (1984)

**Symptom:** After placing the 1984 PDF in `backend/docs/` and triggering indexing, the file showed as "indexing" but never appeared in the indexed documents list.

**Investigation:** The file was being found by `glob("*.pdf")`. The text extraction was running. The issue was that the specific PDF was a scanned image PDF (no embedded text layer) — `get_text()` returned an empty string. The index_document function correctly returned `{"status": "error", "error": "No text extracted — file may be a scanned image PDF"}` but the error was not being surfaced clearly in the frontend progress UI.

**Lesson:** Always test PDF text extraction immediately after adding a new document. OCR capability (e.g., pytesseract + Tesseract) would handle scanned PDFs but adds significant complexity and wasn't implemented.

---

## 21. Architectural Decisions & Rationale

### Decision 1: OpenAI SDK → Local Docker Endpoint

Using the `openai` Python SDK pointed at `http://localhost:12434/v1` instead of building a raw HTTP client against the Docker Model Runner API means the backend is immediately compatible with any OpenAI-compatible inference server: Ollama, LM Studio, vLLM, TensorRT-LLM, or the actual OpenAI API. Swapping models or inference backends is a one-line change.

### Decision 2: Two ChromaDB Collections in One Instance

Memory (`messages`) and RAG (`rag_docs`) use separate ChromaDB collections in the same `chroma_db/` directory. This avoids running two vector database instances while keeping the data logically separated. ChromaDB's `get_or_create_collection()` handles initialization idempotently.

### Decision 3: Two Embedding Models

Using `all-MiniLM-L6-v2` for conversation memory and `all-mpnet-base-v2` for RAG was a deliberate trade-off:
- Memory needs fast per-message encoding (MiniLM: 384-dim, CPU, fast)
- RAG needs higher quality semantic matching for technical documents (MPNet: 768-dim, CUDA, slower but more accurate)

Using MPNet for memory would add latency on every message (embedding happens synchronously before the inference call). Using MiniLM for RAG would reduce document retrieval quality.

### Decision 4: Soft-Delete for Conversations

`DELETE /api/conversations/{id}` sets an `archived` flag rather than hard-deleting. Reasons:
1. Users often delete accidentally and want to recover
2. ChromaDB embeddings for a conversation are expensive to regenerate
3. The Settings page shows an Archive view where all soft-deleted conversations are listed and can be restored

### Decision 5: Recency Window in Context vs. Full History

Loading only the last 80 messages rather than the full conversation history is a necessary constraint of finite context windows. The choice of 80 was calculated to fit comfortably within the 32k token budget while leaving room for all other context layers. The semantic memory (Tier 2) compensates for the cutoff by retrieving relevant older messages on demand.

### Decision 6: BM25 Persist to Pickle

Rebuilding BM25 from ChromaDB on every server restart would add startup latency (fetching all chunks, tokenizing, building the model). Pickling the trained model means: fast startup, and the BM25 index stays synchronized by rebuilding after every add/delete operation.

### Decision 7: No Separate Auth Middleware

All API endpoints check Google connection status inline (`if not gcal.is_connected()`) and return 401 with a detail message. There is no middleware-level auth because the app is designed for single-user local deployment — there are no user accounts, no sessions, no JWTs. The only authentication is the Google OAuth2 flow for Google APIs.

### Decision 8: Optimistic UI Updates

All task operations (create, update, delete, reorder) update the React state immediately before the API response arrives. The API call fires asynchronously, and `fetchData()` in `.finally()` reconciles with the server's confirmed state. This makes the UI feel responsive even on network latency, at the cost of briefly showing a state that might differ from the server's truth (which is immediately corrected by `fetchData()`).

---

## 22. Known Limitations & Future Roadmap

### Current Limitations

**Context window cutoff:** RECENT_WINDOW=80 means very long conversations lose verbatim access to older messages. Semantic recall partially compensates but isn't perfect.

**Single-user only:** The system has no user authentication, no multi-tenancy, and no access controls. It's designed for a single person running it locally.

**Scanned PDFs unsupported:** PDFs without embedded text (scanned, photographed) produce no chunks. OCR integration would be required to support them.

**No streaming during tool calls:** Tool execution (web search, calculation) is non-streaming — the user sees a "Searching..." indicator but no partial results. Streaming tool results would require significant API complexity.

**BM25 tokenizer is trivial:** Whitespace-only tokenization. Stemming, stop-word removal, and morphological analysis would improve keyword retrieval precision.

**Google Tasks `starred` field:** The Google Tasks API v1 does not expose or accept a `starred`/`important` field. This limits task prioritization to the Priority List pattern.

### Potential Future Improvements (Researched, Not Implemented)

**Hierarchical Memory (MemGPT pattern):** Core memory (always-in-context facts), archival memory (queryable), reflection synthesis. Would require implementing a memory write tool the model can call mid-conversation.

**Self-RAG:** Model-driven retrieval gating — let the model decide whether document retrieval is even needed for a given query, rather than always running RAG. Would reduce irrelevant context injection on non-document queries.

**LLMLingua Prompt Compression:** Compress older messages in the recency window to tokens-per-meaning density, allowing more effective history in the same token budget. Microsoft open-source implementation available.

**Speculative Decoding:** Draft model (small, fast) proposes tokens in advance; main model verifies in parallel. 2-3x throughput improvement. Supported natively in llama.cpp/Docker Model Runner.

**Semantic Caching:** Cache responses to semantically similar queries. For queries like "What's the weather today?" asked repeatedly, cache the response with a short TTL rather than running inference again.

**Cross-session continuity:** End-of-session summary generated automatically and injected into the next session's system prompt, providing explicit continuity beyond the semantic recall system.

**Importance-weighted memory:** Flag certain messages (corrections, stated preferences, explicit goals) with higher importance scores at write time, boosting their retrieval weight.

**Qwen3-4B model swap:** Qwen3 has competitive benchmark performance at small parameter counts with strong multilingual support. The OpenAI-compatible API abstraction makes swapping a single-line change.

---

## 23. Installation & Setup Guide

### Prerequisites

- Windows 10/11 (this project was built on Windows 11 Home)
- Docker Desktop with Docker Model Runner enabled
- Python 3.11+
- Node.js 18+
- NVIDIA GPU with CUDA support (recommended; CPU-only is possible but very slow for indexing)
- Google Cloud Console project (for Calendar + Tasks integration)

### Step 1: Clone and Set Up

```bash
git clone <repository-url>
cd LocalAIChatbot
```

### Step 2: Start Docker Model Runner

```bash
docker model run docker.io/ai/gemma4:E2B
```

Wait for the model to download and start. It will serve on port 12434.

### Step 3: Start SearXNG

```bash
docker-compose up -d
```

Verify SearXNG is running at `http://localhost:8080`.

### Step 4: Set Up Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create `backend/.env`:
```
USER_FULL_NAME=Your Full Name
USER_FIRST_NAME=YourFirstName
USER_LOCATION=Your City, Country
USER_LOCATION_SHORT=City
USER_TIMEZONE=America/Edmonton
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Start the backend:
```bash
uvicorn main:app --reload --port 8000
```

### Step 5: Set Up Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at `http://localhost:5173`.

### Step 6: Google Integration (Optional)

1. Go to Google Cloud Console → Create Project → Enable Calendar API + Tasks API
2. Create OAuth2 credentials (Desktop Application) → Add redirect URI: `http://localhost:8000/api/calendar/callback`
3. Copy credentials to `backend/.env`
4. In the app, open the Calendar or Tasks widget → click "Connect Google Calendar" → complete OAuth2 flow in the popup
5. If you previously connected only Calendar and need Tasks: delete `backend/google_token.json` and re-authenticate (the new token will include both scopes)

### Step 7: Index Documents (Optional)

Place PDF files in `backend/docs/`, then open Settings → RAG Documents → Index Documents. Progress is shown live. Only text-based PDFs are supported (not scanned image PDFs).

### Step 8: Personal Profile

Open Settings → Profile → enter your personal information, ongoing projects, preferences. This text is injected into the AI's context on every request.

---

## Project Statistics

| Metric | Value |
|---|---|
| Backend modules | 14 Python files |
| Frontend components | 24 React/TSX files |
| Widget count | 15 widgets |
| Total backend lines | ~3,000+ |
| Total frontend lines | ~6,000+ |
| CSS lines (index.css) | ~3,000+ |
| API endpoints | 35+ REST routes |
| AI tools available | 6 |
| ChromaDB collections | 2 (messages, rag_docs) |
| Embedding models | 2 (MiniLM-L6, MPNet-base-v2) |
| Prophet chunks | 459 across 29 prophets |
| Context window | 32,768 tokens |
| Recent message window | 80 messages |
| Semantic recall | Top 5 (from top 25 ANN candidates, reranked) |
| RAG hybrid weights | 60% semantic / 40% BM25 |

---

*RainAI — Built privately, runs locally, remembers personally.*

