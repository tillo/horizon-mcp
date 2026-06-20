# horizon-mcp

A small, self-contained image that puts [`@evertrust/horizon-mcp`](https://github.com/evertrust/horizon-mcp)
(the EverTrust Horizon / CLM MCP server, which speaks **stdio**) on the network, so it
can be reached over HTTP by Claude Code, Cursor, and other MCP clients — instead of only
locally over stdio.

It wraps the upstream server with:

- [`supergateway`](https://github.com/supercorp-ai/supergateway) to expose it as
  **streamable HTTP / SSE**, and
- **nginx** for **bearer-token auth** (an `Authorization: Bearer <token>` header *or* a
  `?token=<token>` query param), so the endpoint can be published safely behind a reverse
  proxy.

The MCP package and supergateway are **baked into the image** — there is no runtime
`npm install`, so the container starts immediately and the versions are pinned and
reproducible.

## Notes specific to Horizon's MCP

- It runs with `--stateful --sessionTimeout 600000`. `--stateful` is **required**:
  in stateless mode `tools/list` fails because the server caches per-session API auth and
  the `initialize` handshake must precede `tools/list` on the same stdio child. The
  session timeout reaps idle sessions (and their stdio children) so memory stays bounded.
- nginx rewrites `Host`/`Origin` to `localhost` and strips `Sec-Fetch-*` headers, because
  the MCP server validates the request origin.

## Run

```bash
docker run -d \
  -p 8080:8080 \
  -e HORIZON_URL=https://horizon.example.com \
  -e HORIZON_API_ID=<api id> \
  -e HORIZON_API_KEY=<api key> \
  -e MCP_BEARER_TOKEN=<a long random secret> \
  ghcr.io/<your-org>/horizon-mcp:latest
```

Then point your MCP client at `https://<host>:8080/`, sending
`Authorization: Bearer <MCP_BEARER_TOKEN>` (or appending `?token=<MCP_BEARER_TOKEN>`).

### Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `MCP_BEARER_TOKEN` | yes | — | Gate token (header or `?token=`) |
| `HORIZON_URL` | yes | — | Horizon base URL the MCP calls |
| `HORIZON_API_ID` | yes | — | Horizon API identifier |
| `HORIZON_API_KEY` | yes | — | Horizon API key |
| `SUPERGATEWAY_FLAGS` | no | `--stateful --sessionTimeout 600000` | Extra supergateway flags |
| `LISTEN_PORT` | no | `8080` | Public (gate) port |
| `INTERNAL_PORT` | no | `9090` | Bridge (loopback) port |

## Build

```bash
docker build -t horizon-mcp .
# pin a different upstream version:
docker build --build-arg MCP_VERSION=1.2.0 -t horizon-mcp .
```

`CACHEBUST_DAY` (a date stamp) is passed by CI to force a daily `apt upgrade` layer so the
base image keeps current security patches.

## License

MIT — see [LICENSE](LICENSE).
