# Exa MCP Integration

Dream web search mode is backed by Exa MCP.

## Runtime role

- Chat `mode=search` in `backend/main-maf-chat`
- Retriever class: `agent_orchestrator/rag/exa_mcp.py`
- Provider label: `exa_mcp`
- Evidence returned as normalized `citations` + raw MCP packet in `mcp_output`

## Required env vars

- `EXA_API_KEY`
- `EXA_MCP_BASE_URL` (default: `https://mcp.exa.ai/mcp`)
- `EXA_MCP_TOOLS` (default: `web_search_exa`)

Optional:

- `EXA_MCP_ENABLED=true|false`
- `EXA_MCP_REQUIRED_IN_SEARCH=true|false`
- `EXA_MCP_TIMEOUT_SECONDS`
- `EXA_SEARCH_TOP_K`

## Notes

- Search mode uses Exa MCP for fresh internet retrieval.
- Study mode is separate and uses Azure AI Search over uploaded PDF chunks.
- Main implementation docs live in: [`backend/main-maf-chat/README.md`](../main-maf-chat/README.md)
