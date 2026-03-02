# Dream MAF Orchestrator

The central orchestration layer for the Dream platform. Built on Microsoft Agent Framework (MAF), it routes kid-safe chat through dual MAF agents (with optional Exa MCP web search), forwards character creation requests through a MAF routing agent to the CrewAI Character Maker, and passes storybook requests to the MAF Story Book Maker — all via the A2A protocol.

**Pipeline:** Incoming request → MAF routing/chat agents → A2A protocol → specialist backends → job tracking + asset storage → structured response.

**Models used:**

- `gpt-4o-mini` (MAF agents) — question classification, kid-safe answering, character action routing
- Exa MCP (`web_search_exa`) — real-time web search grounding in chat search mode

---

## How It Works

This service sits between the Next.js frontend and the two specialist backends. Every request that arrives here passes through at least one MAF agent before any backend call is made. Nothing is proxied blindly — every route has explicit agent-driven logic.

### 1. Kid-Safe Chat (`/api/v1/orchestrate/chat`)

Two MAF agents run in sequence on every chat message:

```
User message
  └─► QuestionReaderAgent (dream-kid-question-reader)
        Reads the message + recent history and returns a strict JSON classification:
        {
          "category":       "general" | "learning" | "creative" | "sensitive" | "unsafe",
          "safety":         "safe" | "caution" | "unsafe",
          "reading_level":  "5-7" | "8-10" | "11-13" | "14+",
          "response_style": "short" | "explainer" | "playful",
          "notes":          "short reason"
        }

  └─► ResponderAgent (dream-kid-response-agent)
        Receives the classification result + original message and writes a
        60–140 word kid-safe answer using warm, concrete language.
        - unsafe safety   → politely refuses, suggests trusted adult
        - caution safety  → responds gently with supportive guidance
        - search mode     → injects Exa MCP tools before .run() so the
                            agent can call web_search_exa for fresh facts
```

**Normal mode** (`mode=normal`) — both agents run against OpenAI directly, no external calls beyond the LLM.

**Search mode** (`mode=search`) — before the Responder runs, `MCPStreamableHTTPTool` connects to `https://mcp.exa.ai/mcp`, loads the `web_search_exa` tool, and passes it into `agent.run(prompt, tools=exa_tool)`. The MAF agent decides on its own whether and how to call the tool — the orchestrator does not call the search API directly.

**Temporal queries** (e.g. "what is today's date?") are intercepted before the Responder. The server clock is injected as authoritative context and, if the LLM omits the ISO date in its reply, a deterministic correction is applied so the answer is always accurate.

**MCP failure handling** — if `EXA_MCP_REQUIRED_IN_SEARCH=true` (default) and the MCP server is unreachable, the request fails with a 502. If set to `false`, the Responder falls back to answering without search rather than failing silently.

---

### 2. Character Orchestration (`/api/v1/orchestrate/character`)

```
Character request (mode = auto | create | regenerate)
  └─► MAFRoutingAgent (dream-character-router)
        If mode is explicit (create / regenerate) → decision is immediate, no LLM call.
        If mode = auto → MAF agent reads the request fields and returns:
        {
          "selected_action": "create" | "regenerate",
          "rationale":       "short explanation",
          "confidence":      0.0–1.0
        }
        If MAF is unavailable or JSON parsing fails → deterministic rule fallback:
          - positive_prompt present  → regenerate
          - positive_prompt absent   → create

  └─► A2ABackendClient
        Sends the request to the Character Maker via A2A JSON-RPC
        (message/send to http://<A2A_BACKEND_BASE_URL>/a2a).

  └─► Job tracker
        If a job_id query param is provided, progress events are written to
        SQLite at each step: routing → backend_call → generating →
        downloading_assets → completed / failed.
        Downloaded character images are stored under data/{job_id}/.
```

**Why a routing agent?** The same endpoint accepts both full character creation (Vision → CrewAI → Replicate) and image-only regeneration. Using an MAF agent to make the decision means the routing logic can be adjusted by updating a prompt, not by changing code.

---

### 3. Storybook Orchestration (`/api/v1/orchestrate/storybook` and `/stream`)

```
Storybook request
  └─► A2ABackendClient.create_storybook()   (blocking endpoint)
      OR
      A2ABackendClient.stream_storybook_operation()   (streaming endpoint)

        Both routes call the Story Book Maker at A2A_STORY_BACKEND_BASE_URL.
        The streaming route forwards NDJSON events in real time:
          - type=status    → forwarded as-is
          - type=progress  → forwarded + written to job event log
          - type=update    → inspected; if it contains a nested progress
                             payload it is promoted to type=progress
          - type=final     → storybook result extracted, assets downloaded,
                             job marked completed

  └─► Job tracker
        If job_id is provided, the full progress trail is written to SQLite
        and the frontend can poll /api/v1/jobs/{id}/stream (SSE) for live updates.
```

---

### 4. Job Tracking + Asset Storage

Every character and storybook request can carry an optional `job_id` query param. When present:

1. A job record in SQLite transitions through states: `queued → processing → completed / failed`
2. Progress events are written at each pipeline step (step name, message, `0–100%` progress float)
3. A real-time SSE bus at `/api/v1/jobs/{job_id}/stream` pushes events to the frontend as they are written
4. After the backend responds, image URLs are downloaded and stored locally under `data/{job_id}/` so the UI can load them without hitting external URLs again
5. The job record is finalised with the full `result_payload` and a human-readable title extracted from the response

Jobs are created separately via `POST /api/v1/jobs` before the orchestration call, so the frontend can render a loading state immediately.

---

### 5. MAF + MCP + A2A: Why All Three?

| Layer | What It Provides |
|-------|-----------------|
| **MAF** (`agent-framework-core`) | Structured `Agent` abstraction over OpenAI/Azure. Agents have names, system instructions, and run against a typed LLM client. No raw `openai.chat.completions` calls anywhere in this service. |
| **MCP** (`mcp==1.24.0`) | Standard protocol for giving agents access to external tools at runtime. `MCPStreamableHTTPTool` connects to the Exa MCP server and exposes `web_search_exa` as a callable tool the agent can invoke autonomously. |
| **A2A** (`a2a-sdk==0.3.5`) | Standard agent-to-agent call protocol. All calls to character and storybook backends use `message/send` JSON-RPC, not direct HTTP. This keeps backends independently deployable and replaceable without changing this service. |

---

### Agent Roles

| Agent | Name | Purpose |
|-------|------|---------|
| QuestionReaderAgent | `dream-kid-question-reader` | Classifies kid questions by category, safety level, reading level, and response style |
| ResponderAgent | `dream-kid-response-agent` | Generates kid-safe answer; uses Exa MCP search tools when `mode=search` |
| MAFRoutingAgent | `dream-character-router` | Routes character requests to `create` (full pipeline) or `regenerate` (image-only) |

### Routing Logic

| Request Type | Agent Path | Destination |
|---|---|---|
| Chat — `mode=normal` | QuestionReader + Responder MAF agents | OpenAI |
| Chat — `mode=search` | QuestionReader + Responder MAF agents + Exa MCP | OpenAI + `mcp.exa.ai` |
| Character — `mode=create` | MAF Router agent → A2A | Character Maker (`:8000`) |
| Character — `mode=regenerate` | MAF Router agent → A2A | Character Maker (`:8000`) |
| Character — `mode=auto` | MAF Router agent decides → A2A | Character Maker (`:8000`) |
| Storybook | A2A passthrough | Story Book Maker (`:8020`) |
| Storybook stream | A2A streaming (NDJSON) | Story Book Maker (`:8020`) |

### A2A Protocol Guarantee

`A2A_USE_PROTOCOL` and `A2A_STORY_USE_PROTOCOL` are validated at startup — the service **refuses to start** if either is `false`. Soft-API fallback is not supported.

## Project Layout

```text
backend/main-maf-chat/
├── agent_orchestrator/
│   ├── main.py                    # FastAPI entrypoint + all route handlers
│   ├── chat_agents.py             # MAFKidsChatOrchestrator — QuestionReader + Responder agents + Exa MCP
│   ├── maf_router.py              # MAFRoutingAgent — character create/regenerate routing decision
│   ├── backend_client.py          # A2ABackendClient — A2A calls to character + storybook backends
│   ├── config.py                  # Pydantic-settings with provider + A2A validation
│   ├── models.py                  # All request/response Pydantic models + job models
│   ├── database.py                # SQLite job persistence (aiosqlite)
│   ├── job_manager.py             # Job lifecycle + SSE event bus
│   └── af_compat.py               # Agent Framework OpenTelemetry compatibility shim
├── azure/
│   └── containerapp.yaml          # Azure Container Apps manifest
├── data/                          # SQLite DB + downloaded assets (runtime, gitignored)
├── scripts/
│   └── deploy_azure.sh            # Azure Container Apps deploy script
├── Dockerfile
├── requirements.txt
└── README.md
```

## Setup

```bash
cd backend/main-maf-chat
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Environment Variables

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENT_PROVIDER` | No | `openai` | LLM provider: `openai` or `azure` |
| `OPENAI_API_KEY` | Yes (openai) | — | OpenAI API key for MAF agents |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Text model for all MAF agents |
| `AZURE_OPENAI_ENDPOINT` | Yes (azure) | — | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_API_KEY` | Yes (azure) | — | Azure OpenAI API key |
| `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME` | Yes (azure) | — | Deployment name for chat model |
| `AZURE_OPENAI_API_VERSION` | No | `preview` | Azure API version string |
| `EXA_MCP_ENABLED` | No | `true` | Enable Exa MCP web search in search mode |
| `EXA_MCP_REQUIRED_IN_SEARCH` | No | `true` | Fail hard if Exa MCP is unavailable in search mode |
| `EXA_MCP_BASE_URL` | No | `https://mcp.exa.ai/mcp` | Exa MCP server base URL |
| `EXA_API_KEY` | No | — | Exa API key (appended as `exaApiKey` query param) |
| `EXA_MCP_TOOLS` | No | `web_search_exa` | Comma-separated list of allowed MCP tool names |
| `EXA_MCP_TIMEOUT_SECONDS` | No | `45` | Per-request timeout for Exa MCP calls |
| `A2A_BACKEND_BASE_URL` | No | `http://127.0.0.1:8000` | Character Maker backend URL |
| `A2A_RPC_PATH` | No | `/a2a` | Character backend A2A RPC path |
| `A2A_USE_PROTOCOL` | No | `true` | Must remain `true` — enforced by startup validator |
| `A2A_STORY_BACKEND_BASE_URL` | No | `http://127.0.0.1:8020` | Story Book Maker backend URL |
| `A2A_STORY_RPC_PATH` | No | `/a2a` | Story backend A2A RPC path |
| `A2A_STORY_USE_PROTOCOL` | No | `true` | Must remain `true` — enforced by startup validator |
| `A2A_TIMEOUT_SECONDS` | No | `240` | Timeout for all A2A backend calls |
| `DREAM_DATA_DIR` | No | `./data` | Directory for SQLite DB and downloaded job assets |

**Model ID note:** Use raw OpenAI model IDs (`gpt-4o-mini`), not provider-prefixed IDs like `openai/gpt-4o-mini`.

## Run Locally

Start all three backends in order:

### 1) Character backend (port 8000)

```bash
cd backend/a2a-crew-ai-character-maker
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2) Storybook backend (port 8020)

```bash
cd backend/a2a-maf-story-book-maker
source .venv/bin/activate
uvicorn agent_storybook.main:app --reload --host 127.0.0.1 --port 8020
```

### 3) Main orchestrator (port 8010)

```bash
cd backend/main-maf-chat
source .venv/bin/activate
uvicorn agent_orchestrator.main:app --reload --host 127.0.0.1 --port 8010
```

Verify:

```bash
curl http://127.0.0.1:8010/health
```

## Deploy to Azure

Build and deploy to Azure Container Apps using ACR:

```bash
export AZURE_SUBSCRIPTION_ID=...
export AZURE_RESOURCE_GROUP=dream-rg
export AZURE_LOCATION=eastus
export AZURE_CONTAINERAPP_ENV=dream-env
export AZURE_ACR_NAME=dreamacr...
export AZURE_CONTAINERAPP_NAME=dream-main-orchestrator
export OPENAI_API_KEY=...
export REPLICATE_API_TOKEN=...
export A2A_BACKEND_BASE_URL=https://dream-character-a2a....azurecontainerapps.io
export A2A_STORY_BACKEND_BASE_URL=https://dream-storybook-a2a....azurecontainerapps.io

./scripts/deploy_azure.sh
```

| Resource | Value |
|---|---|
| Target port | `8080` |
| CPU / Memory | `1.0 vCPU / 2 Gi` |
| Min / Max replicas | `1 / 3` |
| Ingress | External (HTTPS) |

### Subscription Limitations and Workarounds

| Limitation | Impact | Workaround |
|---|---|---|
| ACR Tasks blocked (`TasksOperationsNotAllowed`) | Cannot cloud-build images via `az acr build` | Build locally with Docker/Colima, push to ACR |
| Basic/Standard VM quota = 0 | Cannot create App Service plans (B1/S1) | Use Container Apps (consumption-based, no VM quota needed) |

If your subscription supports ACR Tasks, you can use:

```bash
./scripts/deploy_azure.sh
```

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health + character backend connectivity snapshot |
| `GET` | `/api/v1/orchestrate/a2a-health` | A2A health probe for character backend |
| `GET` | `/api/v1/orchestrate/storybook-health` | A2A health probe for storybook backend |
| `POST` | `/api/v1/orchestrate/chat` | Kid-safe chat — MAF agents + optional Exa MCP |
| `POST` | `/api/v1/orchestrate/character` | Character creation/regeneration via MAF router + A2A |
| `POST` | `/api/v1/orchestrate/storybook` | Storybook creation passthrough via A2A |
| `POST` | `/api/v1/orchestrate/storybook/stream` | Streaming storybook creation (NDJSON) |
| `POST` | `/api/v1/jobs` | Create a tracked job record |
| `GET` | `/api/v1/jobs` | List jobs (filterable by `type`, `status`, `limit`, `offset`) |
| `GET` | `/api/v1/jobs/{job_id}` | Get full job details + assets |
| `GET` | `/api/v1/jobs/{job_id}/events` | Get job event log |
| `GET` | `/api/v1/jobs/{job_id}/stream` | SSE stream of live job events |
| `GET` | `/api/v1/assets/{job_id}/{filename}` | Serve a downloaded job asset file |
| `GET` | `/docs` | Interactive API docs (Swagger) |

### Chat Request

```json
{
  "message": "Why is the sky blue?",
  "history": [
    { "role": "user", "content": "What is the sun?" },
    { "role": "assistant", "content": "The sun is a giant ball of hot gas..." }
  ],
  "age_band": "5-8",
  "mode": "normal"
}
```

`mode` options: `normal` (MAF agents only), `search` (MAF agents + Exa MCP web search).

### Chat Response

```json
{
  "answer": "The sky looks blue because sunlight scatters...",
  "category": "learning",
  "safety": "safe",
  "reading_level": "5-7",
  "response_style": "explainer",
  "model": "gpt-4o-mini",
  "mcp_used": true,
  "mcp_server": "https://mcp.exa.ai/mcp",
  "mcp_output": {
    "tools": ["web_search_exa"],
    "tool_used": "web_search_exa",
    "input": { "query": "why is the sky blue" },
    "output": "..."
  }
}
```

`mcp_used` is `true` only when the Exa MCP tool was called during that reply. `mcp_output` is `null` in normal mode.

### Character Request

```json
{
  "mode": "auto",
  "user_prompt": "A relic hunter from submerged moon ruins",
  "world_references": [
    {
      "title": "Moon temple archive",
      "description": "Flooded stone halls",
      "image_data": "data:image/png;base64,..."
    }
  ],
  "character_drawings": [],
  "force_workflow": null
}
```

`mode` options: `auto` (MAF routing agent decides), `create` (force full pipeline), `regenerate` (image-only, requires `positive_prompt`).

### Character Response

```json
{
  "selected_action": "create",
  "selected_by": "agent",
  "agent_reasoning": "user_prompt present, no positive_prompt — full create path selected.",
  "agent_raw_output": "{ \"selected_action\": \"create\", \"rationale\": \"...\", \"confidence\": 0.95 }",
  "backend_endpoint": "https://dream-character-a2a.../api/v1/characters/create",
  "backend_status_code": 200,
  "backend_response": { "workflow_used": "reference_enriched", "backstory": { "...": "..." } }
}
```

`selected_by` values: `agent` (MAF router decided), `explicit_mode` (caller set `mode` directly), `rule_fallback` (MAF unavailable, rule logic used).

### Storybook Request

```json
{
  "user_prompt": "A moon explorer rescues a lost archive",
  "world_references": [],
  "character_drawings": [],
  "force_workflow": null,
  "max_characters": 2,
  "tone": "hopeful",
  "age_band": "5-8"
}
```

### Job Create Request

```json
{
  "type": "character",
  "title": "Moon Relic Hunter",
  "user_prompt": "A relic hunter from submerged moon ruins",
  "input_payload": {},
  "triggered_by": "user",
  "engine": "crewai"
}
```

`type` options: `character`, `story`, `video`.

### Error Codes

| Code | Meaning |
|------|---------|
| `422` | Invalid request schema or missing required field |
| `502` | Upstream failure — OpenAI, Exa MCP, character backend, or storybook backend |
| `500` | Unhandled server exception |

## Quick Test Commands

Health:

```bash
curl http://127.0.0.1:8010/health
```

Character A2A health:

```bash
curl http://127.0.0.1:8010/api/v1/orchestrate/a2a-health
```

Storybook A2A health:

```bash
curl http://127.0.0.1:8010/api/v1/orchestrate/storybook-health
```

Kid-safe chat (normal mode):

```bash
curl -X POST http://127.0.0.1:8010/api/v1/orchestrate/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Why is the sky blue?",
    "history": [],
    "age_band": "5-8",
    "mode": "normal"
  }'
```

Kid-safe chat (search mode — triggers Exa MCP):

```bash
curl -X POST http://127.0.0.1:8010/api/v1/orchestrate/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the latest news about Mars exploration?",
    "history": [],
    "age_band": "8-10",
    "mode": "search"
  }'
```

Character creation via main:

```bash
curl -X POST http://127.0.0.1:8010/api/v1/orchestrate/character \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "create",
    "user_prompt": "A relic hunter from submerged moon ruins",
    "world_references": [],
    "character_drawings": []
  }'
```

Storybook creation via main:

```bash
curl -X POST http://127.0.0.1:8010/api/v1/orchestrate/storybook \
  -H "Content-Type: application/json" \
  -d '{
    "user_prompt": "A moon explorer rescues a lost archive",
    "world_references": [],
    "character_drawings": [],
    "max_characters": 2,
    "tone": "hopeful",
    "age_band": "5-8"
  }'
```

List recent jobs:

```bash
curl "http://127.0.0.1:8010/api/v1/jobs?type=character&limit=10"
```

Stream job events:

```bash
curl -N "http://127.0.0.1:8010/api/v1/jobs/{job_id}/stream"
```

## Troubleshooting

| Problem | Check |
|---------|-------|
| `OPENAI_API_KEY is required` | Set `OPENAI_API_KEY` in `.env` or confirm `AGENT_PROVIDER` matches provided credentials |
| `A2A-only mode: A2A_USE_PROTOCOL must be true` | Do not set `A2A_USE_PROTOCOL=false` — enforced at startup and cannot be bypassed |
| `Search mode requires MCP, but EXA_MCP_ENABLED is false` | Set `EXA_MCP_ENABLED=true` and provide a valid `EXA_API_KEY` |
| Exa MCP timeout | Increase `EXA_MCP_TIMEOUT_SECONDS`; verify `EXA_API_KEY` is valid |
| `Chat responder failed` | Check `OPENAI_API_KEY`, model access, and OpenAI quota |
| `A2ABackendError` on character requests | Verify character backend is running at `A2A_BACKEND_BASE_URL` |
| `A2ABackendError` on storybook requests | Verify storybook backend is running at `A2A_STORY_BACKEND_BASE_URL` |
| `MAF import unavailable` | Reinstall dependencies: `pip install -r requirements.txt` |
| Jobs stuck in `processing` | Check SSE stream at `/api/v1/jobs/{id}/stream` for error events |
| Asset 404 on `/api/v1/assets/...` | Verify `DREAM_DATA_DIR` is writable and assets were downloaded during job completion |
| ACR Tasks blocked on deploy | Build locally with Docker/Colima and push to ACR manually |

## Dependencies

Pinned in `requirements.txt`:

| Package | Version | Purpose |
|---------|---------|---------|
| `agent-framework-core` | `1.0.0rc1` | MAF `Agent` class + OpenAI/Azure LLM clients |
| `agent-framework-a2a` | `1.0.0b260219` | MAF A2A transport layer |
| `mcp` | `1.24.0` | MCP protocol client (`MCPStreamableHTTPTool` for Exa) |
| `a2a-sdk` | `0.3.5` | A2A JSON-RPC protocol (`message/send`, `message/stream`) |
| `aiosqlite` | `0.21.0` | Async SQLite for job tracking |
| `fastapi` | `0.133.0` | Web framework |
| `uvicorn[standard]` | `0.41.0` | ASGI server |
