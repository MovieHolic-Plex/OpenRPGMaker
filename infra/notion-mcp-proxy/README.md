# MDC Notion MCP proxy

This service gives MCP clients a small Notion tool surface without distributing a Notion API token to every client.

It is intentionally private:

- binds to MDC's Tailscale interface rather than `0.0.0.0`;
- uses the encrypted Tailscale (WireGuard) path only; it has no public listener;
- rejects every source IP outside `ALLOWED_CIDRS` before any MCP or health request;
- validates `Host` and browser `Origin` headers;
- has only five tools: search, fetch, create page, append content, and create comment.

## Deploy on MDC

```bash
cd /home/main/notion-mcp-proxy
npm ci --omit=dev
cp .env.example .env
chmod 600 .env
# Enter NOTION_TOKEN only in .env; never put it in a shell history, document, or Git config.
pm2 startOrReload ecosystem.config.cjs
pm2 save
```

Use `http://100.73.251.77:8788/mcp` in a Streamable HTTP-compatible MCP client. The client must be a listed Tailscale VPS; traffic stays inside Tailscale's WireGuard-encrypted tunnel.

## Operate

```bash
# Verify from an allowed device
curl --fail --silent --show-error http://100.73.251.77:8788/healthz

# Check the running service
pm2 status notion-mcp-proxy
pm2 logs notion-mcp-proxy --lines 100

# Change the allowed device list, then reload
vi /home/main/notion-mcp-proxy/.env
pm2 reload notion-mcp-proxy
```

When a device is lost or a token is exposed, remove the device `/32` immediately or rotate the Notion integration token, update `.env`, and reload the PM2 process.
