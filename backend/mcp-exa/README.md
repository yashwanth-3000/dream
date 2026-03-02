# mcp-exa: Exa MCP Integration

Exa is a semantic web search engine that exposes its search capability as an MCP (Model Context Protocol) server at `https://mcp.exa.ai/mcp`. The Dream platform integrates it as a runtime tool that the MAF Responder agent can autonomously call when the user switches to search mode — no wrapper code, no manual API calls, just the agent deciding when and how to search.

**Goal:** Enable real-time web search grounding in the kid-safe chat pipeline only when `mode=search`, while keeping normal chat mode completely unchanged.

---

## What Is MCP Here?

MCP (Model Context Protocol) is a standard that lets an LLM agent discover and call external tools over a network connection at runtime. Instead of hardcoding an Exa API call in application code, the orchestrator:

1. Opens a streamable HTTP connection to the Exa MCP server
2. Loads the available tool list (`web_search_exa`)
3. Passes those tools into the MAF agent's `.run()` call
4. The LLM decides whether to call the tool, what query to pass, and how to weave the result into its answer

The agent is in full control — the orchestrator never calls Exa directly.

---

## Full Wiring Path

Every layer from the UI search toggle to the Exa API call:

```
website/src/components/ui/ai-prompt-box.tsx
  ModeId type includes "search" — the search mode toggle lives here.
  When the user clicks the search pill, mode="search" is set in the chat payload.

website/src/app/chat/page.tsx
  Sends POST /api/chat with { message, history, age_band, mode: "search" }

website/src/app/api/chat/route.ts
  Next.js API proxy — forwards the full payload unchanged to:
  http://127.0.0.1:8010/api/v1/orchestrate/chat

backend/main-maf-chat/agent_orchestrator/models.py
  ChatOrchestrationRequest.mode: ChatMode  (ChatMode = Literal["normal", "search"])
  The mode field is validated and typed here.

backend/main-maf-chat/agent_orchestrator/chat_agents.py
  MAFKidsChatOrchestrator._generate_answer()
  ├── if mode == "search" and EXA_MCP_ENABLED=true:
  │     calls _run_responder_with_exa_mcp(prompt, query)
  │       ├── opens httpx.AsyncClient with exa_mcp_timeout_seconds
  │       ├── creates MCPStreamableHTTPTool(url=exa_mcp_url, load_tools=True)
  │       ├── discovers available tools from server (e.g. ["web_search_exa"])
  │       ├── calls _collect_mcp_output() to pre-fetch raw search results
  │       └── runs responder: agent.run(prompt, tools=exa_tool)
  │             The LLM sees the tool, calls web_search_exa with its own query,
  │             and weaves the result into the kid-safe answer.
  └── response includes mcp_used=true, mcp_server=<url>, mcp_output={...}

backend/main-maf-chat/agent_orchestrator/config.py
  Settings.exa_mcp_url property builds the final URL:
    https://mcp.exa.ai/mcp?exaApiKey=<EXA_API_KEY>&tools=web_search_exa
  EXA_API_KEY is appended as a query param — never hardcoded or in headers.
```

---

## Where It Lives in the Codebase

| File | Role in the MCP Integration |
|------|-----------------------------|
| `backend/main-maf-chat/agent_orchestrator/chat_agents.py` | Core MCP logic — `_run_responder_with_exa_mcp()` opens the connection and runs the agent with tools; `_collect_mcp_output()` pre-fetches raw search results for the response payload |
| `backend/main-maf-chat/agent_orchestrator/config.py` | `Settings.exa_mcp_url` property — assembles the Exa MCP endpoint URL with `exaApiKey` and `tools` query params from env vars |
| `backend/main-maf-chat/agent_orchestrator/models.py` | `ChatOrchestrationRequest.mode` typed field; `ChatOrchestrationResponse.mcp_used`, `.mcp_server`, `.mcp_output` response fields |
| `website/src/app/api/chat/route.ts` | Next.js proxy — passes `mode` through to the backend without modification |
| `website/src/app/chat/page.tsx` | Constructs the chat request payload including `mode` |
| `website/src/components/ui/ai-prompt-box.tsx` | UI origin of `mode=search` — the search mode toggle component where `ModeId` is defined |

---

## How `MCPStreamableHTTPTool` Works

`MCPStreamableHTTPTool` is the MAF class for connecting to remote MCP servers over streamable HTTP (as opposed to local stdio). It connects on `async with`, loads the server's tool list, and makes those tools available to any MAF agent's `.run()` call.

```python
# From chat_agents.py — simplified view
async with httpx.AsyncClient(timeout=settings.exa_mcp_timeout_seconds) as http_client:
    exa_tool = MCPStreamableHTTPTool(
        name="exa-search",
        url=settings.exa_mcp_url,          # https://mcp.exa.ai/mcp?exaApiKey=...&tools=web_search_exa
        description="Exa MCP web search for up-to-date factual grounding.",
        request_timeout=request_timeout,
        load_tools=True,                    # auto-discover tools from server on connect
        load_prompts=False,
        allowed_tools=["web_search_exa"],   # restrict to only this tool
        http_client=http_client,            # custom client for timeout + auth
    )
    async with exa_tool:                    # connects + loads tool list
        response = await self._responder.run(prompt, tools=exa_tool)
```

The `allowed_tools` list comes from `EXA_MCP_TOOLS` (default: `web_search_exa`). Only tools in this list are exposed to the agent — any other tools the Exa MCP server advertises are filtered out. The agent decides autonomously whether to call the tool and with what query.

---

## Environment Variables

Set these in `backend/main-maf-chat/.env`:

```dotenv
EXA_MCP_ENABLED=true
EXA_MCP_REQUIRED_IN_SEARCH=true
EXA_MCP_BASE_URL=https://mcp.exa.ai/mcp
EXA_API_KEY=your_exa_api_key_here
EXA_MCP_TOOLS=web_search_exa
EXA_MCP_TIMEOUT_SECONDS=45
```

| Variable | Default | Description |
|----------|---------|-------------|
| `EXA_MCP_ENABLED` | `true` | Enable Exa MCP integration in search mode |
| `EXA_MCP_REQUIRED_IN_SEARCH` | `true` | If `true`, search mode fails with 502 when MCP is unavailable. If `false`, falls back to answering without search |
| `EXA_MCP_BASE_URL` | `https://mcp.exa.ai/mcp` | Exa MCP server base URL |
| `EXA_API_KEY` | — | Exa API key — optional but recommended for reliability. Appended as `exaApiKey` query param |
| `EXA_MCP_TOOLS` | `web_search_exa` | Comma-separated allowed tool names — controls which MCP tools are exposed to the agent |
| `EXA_MCP_TIMEOUT_SECONDS` | `45` | Per-request timeout in seconds for the MCP connection + tool call |

No API keys are hardcoded anywhere in the codebase.

---

## Runtime Behavior

| Mode | What Happens |
|------|-------------|
| `mode=normal` | Responder agent runs directly against OpenAI. No MCP connection opened. `mcp_used=false` in response. |
| `mode=search` + MCP available | `MCPStreamableHTTPTool` connects, `web_search_exa` is loaded, agent runs with tool. `mcp_used=true`, `mcp_server` and `mcp_output` populated. |
| `mode=search` + MCP unavailable + `required=true` | Request fails with `502 Chat responder failed: Search mode requires MCP...` |
| `mode=search` + MCP unavailable + `required=false` | Warning logged, agent runs without MCP, answer returned without search grounding. |

---

## Response Fields When MCP Is Active

```json
{
  "answer": "The Chandrayaan-3 mission successfully landed near the lunar south pole...",
  "category": "learning",
  "safety": "safe",
  "reading_level": "11-13",
  "response_style": "explainer",
  "model": "gpt-4o-mini",
  "mcp_used": true,
  "mcp_server": "https://mcp.exa.ai/mcp",
  "mcp_output": {
    "tools": ["web_search_exa"],
    "tool_used": "web_search_exa",
    "input": { "query": "latest Chandrayaan mission update" },
    "output": "<raw search result text from Exa>"
  }
}
```

When `mode=normal`, `mcp_used` is `false`, `mcp_server` is `null`, and `mcp_output` is `null`.

---

## Failure Modes

| Scenario | `EXA_MCP_REQUIRED_IN_SEARCH=true` (default) | `EXA_MCP_REQUIRED_IN_SEARCH=false` |
|----------|------|------|
| Exa MCP server unreachable | `502` — request fails | Falls back to answering without search |
| Exa MCP exposes no tools | `502` — request fails | Falls back to answering without search |
| `EXA_MCP_ENABLED=false` in search mode | `502` — request fails | Answering without search always |
| `EXA_API_KEY` missing | Depends on Exa server auth policy | Depends on Exa server auth policy |

---

## Verify

### 1) Start the main orchestrator

```bash
cd backend/main-maf-chat
source .venv/bin/activate
python -m uvicorn agent_orchestrator.main:app --reload --host 127.0.0.1 --port 8010
```

### 2) Test normal mode — MCP must NOT be used

```bash
curl -sS -X POST "http://127.0.0.1:8010/api/v1/orchestrate/chat" \
  -H "content-type: application/json" \
  -d '{
    "message": "Why is the sky blue?",
    "history": [],
    "mode": "normal",
    "age_band": "8-10"
  }' | python3 -m json.tool | grep mcp_used
# → "mcp_used": false
```

### 3) Test search mode — MCP must be called

```bash
curl -sS -X POST "http://127.0.0.1:8010/api/v1/orchestrate/chat" \
  -H "content-type: application/json" \
  -d '{
    "message": "What happened in the latest Chandrayaan mission update?",
    "history": [],
    "mode": "search",
    "age_band": "11-13"
  }' | python3 -m json.tool | grep -E '"mcp_used"|"mcp_server"'
# → "mcp_used": true
# → "mcp_server": "https://mcp.exa.ai/mcp"
```

### 4) Confirm MCP output details

```bash
curl -sS -X POST "http://127.0.0.1:8010/api/v1/orchestrate/chat" \
  -H "content-type: application/json" \
  -d '{
    "message": "What is the latest news about Mars exploration?",
    "history": [],
    "mode": "search",
    "age_band": "8-10"
  }' | python3 -m json.tool | python3 -c "
import sys, json
data = json.load(sys.stdin)
mcp = data.get('mcp_output') or {}
print('tool_used :', mcp.get('tool_used'))
print('query     :', (mcp.get('input') or {}).get('query'))
print('mcp_used  :', data.get('mcp_used'))
"
```

---

## Source Docs

Reference docs used during integration:

- [MAF hosted MCP tools (streamable HTTP)](https://learn.microsoft.com/en-us/agent-framework/user-guide/agents/tools/hosted-mcp-tools)
- [MAF local MCP tools (stdio)](https://learn.microsoft.com/en-us/agent-framework/user-guide/agents/tools/local-mcp-tools)
- [Exa MCP server reference](https://docs.exa.ai/reference/mcp-server)

Key implementation notes from the docs:
- `MCPStreamableHTTPTool` is the correct MAF class for remote MCP over streamable HTTP (not stdio)
- For custom timeouts with MAF, pass an `httpx.AsyncClient` via `http_client=` — do not use the default client
- Exa MCP supports tool scoping via `tools=` query param on the endpoint URL, keeping the agent restricted to only the tools you allow
