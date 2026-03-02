# Main MAF Chat: Microsoft Agent Framework Orchestrator

This `backend/main-maf-chat/` service is the orchestration layer between UI/clients and specialized A2A backends.

It currently routes to:
- `backend/a2a-crew-ai-character-maker` for character workflows
- `backend/a2a-maf-story-book-maker` for short storybook workflows
- Built-in MAF chat agents for kid-safe Q&A (`/api/v1/orchestrate/chat`)

## Architecture

```text
User/UI
  -> main (MAF orchestrator)
      -> character route decision (create | regenerate)
         -> A2A -> character backend (/a2a)
      -> storybook request passthrough
         -> A2A -> storybook backend (/a2a)
      -> chat route
         -> MAF question-reader agent + response agent (OpenAI/Azure OpenAI)
         -> Exa MCP tools when chat mode is search
```

## Endpoints

### `GET /health`
Service health plus character backend connectivity snapshot.

### `GET /api/v1/orchestrate/a2a-health`
A2A health probe for character backend.

### `GET /api/v1/orchestrate/storybook-health`
A2A health probe for storybook backend (`a2a-maf-story-book-maker`).

### `POST /api/v1/orchestrate/character`
Character orchestration entrypoint.

### `POST /api/v1/orchestrate/storybook`
Storybook orchestration entrypoint. Forwards to storybook backend through A2A.

### `POST /api/v1/orchestrate/chat`
Kid-safe chat orchestration entrypoint. Uses two MAF agents:
- question-reader agent (classification + safety)
- response agent (age-appropriate answer)

## Storybook Request Shape

```json
{
  "user_prompt": "A moon explorer rescues a lost archive",
  "world_references": [],
  "character_drawings": [],
  "force_workflow": "reference_enriched",
  "max_characters": 2,
  "tone": "hopeful",
  "age_band": "5-8"
}
```

## Local Run

Start all three backends:

### 1) Character backend (8000)

```bash
cd /Users/yashwanthkrishna/Desktop/Projects/dream/backend/a2a-crew-ai-character-maker
source .venv/bin/activate
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2) Storybook backend (8020)

```bash
cd /Users/yashwanthkrishna/Desktop/Projects/dream/backend/a2a-maf-story-book-maker
source .venv/bin/activate
python -m uvicorn agent_storybook.main:app --reload --host 127.0.0.1 --port 8020
```

### 3) Main orchestrator (8010)

```bash
cd /Users/yashwanthkrishna/Desktop/Projects/dream/backend/main-maf-chat
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn agent_orchestrator.main:app --reload --host 127.0.0.1 --port 8010
```

## Required `.env` values in `backend/main-maf-chat/.env`

```dotenv
AGENT_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
A2A_BACKEND_BASE_URL=http://127.0.0.1:8000
A2A_RPC_PATH=/a2a
A2A_USE_PROTOCOL=true
A2A_STORY_BACKEND_BASE_URL=http://127.0.0.1:8020
A2A_STORY_RPC_PATH=/a2a
A2A_STORY_USE_PROTOCOL=true
EXA_MCP_ENABLED=true
EXA_MCP_BASE_URL=https://mcp.exa.ai/mcp
EXA_API_KEY=
EXA_MCP_TOOLS=web_search_exa
EXA_MCP_TIMEOUT_SECONDS=45
```

Model note:
- Use raw OpenAI model IDs (for example `gpt-4o-mini`), not provider-prefixed IDs like `openai/gpt-4o-mini`.

## Quick Tests

### Health

```bash
curl -sS http://127.0.0.1:8010/health
```

### Storybook A2A health via main

```bash
curl -sS http://127.0.0.1:8010/api/v1/orchestrate/storybook-health
```

### Character via main

```bash
curl -sS -X POST "http://127.0.0.1:8010/api/v1/orchestrate/character" \
  -H "content-type: application/json" \
  -d '{
    "mode": "create",
    "user_prompt": "A relic hunter from submerged moon ruins",
    "world_references": [],
    "character_drawings": []
  }'
```

### Storybook via main

```bash
curl -sS -X POST "http://127.0.0.1:8010/api/v1/orchestrate/storybook" \
  -H "content-type: application/json" \
  -d '{
    "user_prompt": "A moon explorer rescues a lost archive",
    "world_references": [],
    "character_drawings": [],
    "max_characters": 2,
    "tone": "hopeful",
    "age_band": "5-8"
  }'
```

### Kid-safe chat via main

```bash
curl -sS -X POST "http://127.0.0.1:8010/api/v1/orchestrate/chat" \
  -H "content-type: application/json" \
  -d '{
    "message": "Why is the sky blue?",
    "history": [],
    "age_band": "5-8",
    "mode": "search"
  }'
```

Chat response includes metadata fields:
- `mcp_used`: `true` when Exa MCP was used for that reply.
- `mcp_server`: MCP server URL label used by backend.

## Azure Deploy Notes

`backend/main-maf-chat/scripts/deploy_azure.sh` now supports optional story backend envs:
- `A2A_STORY_BACKEND_BASE_URL` (defaults to `A2A_BACKEND_BASE_URL` if unset)
- `A2A_STORY_RPC_PATH` (default `/a2a`)
- `A2A_STORY_USE_PROTOCOL` (default `true`)

## Dependencies

Pinned in `requirements.txt`:
- `agent-framework-core==1.0.0rc1`
- `agent-framework-a2a==1.0.0b260219`
- `mcp==1.24.0`
- `a2a-sdk==0.3.5`
