# @hiveflow/mcp-server — deprecated

> **This package is no longer maintained.** Use the hosted Hiveflow MCP server instead:
>
> ## `https://mcp.hiveflow.ai`

The hosted server is always up to date with the platform, signs you in with OAuth (no API key to copy), and needs nothing installed. This repository is archived and the npm package will not receive updates.

*Español: este paquete está deprecado. Usa el MCP remoto `https://mcp.hiveflow.ai`; las instrucciones de abajo sirven igual.*

## Connect your client

**Claude (web, Desktop, mobile)** — Settings → Connectors → *Add custom connector* → URL `https://mcp.hiveflow.ai`.

**Claude Code**

```bash
claude mcp add --transport http hiveflow https://mcp.hiveflow.ai
```

**ChatGPT** — Settings → Apps & Connectors → add a connector with the URL `https://mcp.hiveflow.ai`.

**Cursor** (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "hiveflow": { "url": "https://mcp.hiveflow.ai" }
  }
}
```

**VS Code** (`.vscode/mcp.json`)

```json
{
  "servers": {
    "hiveflow": { "type": "http", "url": "https://mcp.hiveflow.ai" }
  }
}
```

**Clients that only support stdio** — bridge with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "hiveflow": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.hiveflow.ai"]
    }
  }
}
```

## Headless use (scripts, CI)

The hosted server also accepts a Hiveflow API key (`hf_...`, created in Settings → API Keys) instead of OAuth:

```bash
npx -y mcp-remote https://mcp.hiveflow.ai --header "Authorization: Bearer ${HIVEFLOW_API_KEY}"
```

## Migrating from this package

| Old tool (this package) | Hosted server |
|---|---|
| `list_flows`, `get_flow`, `create_flow` | same names |
| `execute_flow` | `run_flow` |
| `pause_flow`, `resume_flow` | `set_flow_state` (`paused` / `active`) |
| `list_mcp_servers`, `create_mcp_server`, `get_flow_executions` | removed |
| `blurb_set_emotion`, `blurb_set_state`, `blurb_status` | `hiveflow blurb …` in the [Hiveflow CLI](https://github.com/hiveflowai/hiveflow-cli) (the board is local, a hosted server cannot reach it) |

The hosted server adds organizations, workspaces, kanban boards, cards and workers. Ask your assistant to call the `docs` tool for the full API reference.

## License

MIT
