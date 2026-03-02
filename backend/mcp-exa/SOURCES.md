# MCP + Exa Sources

Verified on: 2026-03-02

- Microsoft Agent Framework MCP tools (local/stdio + streamable HTTP)
  - https://learn.microsoft.com/en-us/agent-framework/user-guide/agents/tools/local-mcp-tools
- Microsoft Agent Framework MCP tools (hosted/remote)
  - https://learn.microsoft.com/en-us/agent-framework/user-guide/agents/tools/hosted-mcp-tools
- Exa MCP server reference
  - https://docs.exa.ai/reference/mcp-server

Key points used in implementation:
- `MCPStreamableHTTPTool` is the MAF class for remote MCP over streamable HTTP.
- For custom auth headers/timeouts with MAF, use `httpx.AsyncClient` and pass it to `MCPStreamableHTTPTool(http_client=...)`.
- Exa MCP supports endpoint `https://mcp.exa.ai/mcp` and tool scoping via `tools=` query param.
