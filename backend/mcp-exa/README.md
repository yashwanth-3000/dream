# mcp-exa

Exa MCP integration notes for the Dream chat orchestrator (`backend/main-maf-chat`).

## Goal

Enable Exa MCP tool usage only when chat mode is `search`, while keeping normal chat mode unchanged.

## Wiring In This Repo

- Frontend mode source:
  - `website/src/components/ui/ai-prompt-box.tsx` defines `ModeId` including `search`.
- Frontend chat request:
  - `website/src/app/chat/page.tsx` sends `mode` in `/api/chat` payload.
- Chat API proxy:
  - `website/src/app/api/chat/route.ts` forwards payload to main backend.
- Backend request model:
  - `backend/main-maf-chat/agent_orchestrator/models.py` includes `ChatOrchestrationRequest.mode`.
- Backend MCP activation:
  - `backend/main-maf-chat/agent_orchestrator/chat_agents.py` uses `MCPStreamableHTTPTool` when `mode == "search"` and `EXA_MCP_ENABLED=true`.

## Environment Variables

Set these in `backend/main-maf-chat/.env`:

```dotenv
EXA_MCP_ENABLED=true
EXA_MCP_REQUIRED_IN_SEARCH=true
EXA_MCP_BASE_URL=https://mcp.exa.ai/mcp
EXA_API_KEY=
EXA_MCP_TOOLS=web_search_exa
EXA_MCP_TIMEOUT_SECONDS=45
```

Notes:
- `EXA_API_KEY` is optional, but recommended for reliability.
- `EXA_MCP_TOOLS` is comma-separated and mapped to Exa MCP `tools=` query param.
- No API keys are hardcoded in code.

## Runtime Behavior

- `mode=normal`: responder agent runs without MCP.
- `mode=search`:
  - backend attempts Exa MCP connection,
  - chat run includes MCP tool,
  - response includes `mcp_used=true` and `mcp_server` when MCP path succeeds,
  - with `EXA_MCP_REQUIRED_IN_SEARCH=true` (default), MCP is mandatory and request fails if MCP is unavailable.

## Verify

### 1) Start main orchestrator

```bash
cd /Users/yashwanthkrishna/Desktop/Projects/dream/backend/main-maf-chat
source .venv/bin/activate
python -m uvicorn agent_orchestrator.main:app --reload --host 127.0.0.1 --port 8010
```

### 2) Test normal mode (no MCP)

```bash
curl -sS -X POST "http://127.0.0.1:8010/api/v1/orchestrate/chat" \
  -H "content-type: application/json" \
  -d '{
    "message": "Why is the sky blue?",
    "history": [],
    "mode": "normal",
    "age_band": "8-10"
  }'
```

### 3) Test search mode (MCP expected)

```bash
curl -sS -X POST "http://127.0.0.1:8010/api/v1/orchestrate/chat" \
  -H "content-type: application/json" \
  -d '{
    "message": "What happened in the latest Chandrayaan mission update?",
    "history": [],
    "mode": "search",
    "age_band": "11-13"
  }'
```

Inspect `mcp_used` in the JSON response.

## Source Docs

See `SOURCES.md`.
