# horizon-mcp: wraps @evertrust/horizon-mcp (stdio) with supergateway (streamable
# HTTP/SSE) behind an nginx bearer-token gate — a single self-contained image, so
# the MCP can be reached over the network instead of only locally over stdio.
#
# Public default pulls node:24-bookworm-slim straight from Docker Hub. In CI with a
# registry pull-through cache (e.g. the GitLab dependency proxy), pass
#   --build-arg REGISTRY=<cache-prefix>/
# to route the base image through it.
ARG REGISTRY=
FROM ${REGISTRY}node:24-bookworm-slim

# CACHEBUST_DAY (CI passes $(date +%Y%m%d)) invalidates this layer once per day so
# `apt upgrade` picks up freshly-published security patches.
ARG CACHEBUST_DAY=unset
RUN echo "cache day: ${CACHEBUST_DAY}" && \
    apt-get update && apt-get -y upgrade && \
    apt-get install -y --no-install-recommends \
      nginx gettext-base tini ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Bake supergateway + the MCP package so there is NO runtime `npm install` (the live
# deployment used to install on every pod start — ~38s plus node-engine warnings).
ARG SUPERGATEWAY_VERSION=latest
ARG MCP_PACKAGE=@evertrust/horizon-mcp
ARG MCP_VERSION=1.2.0
RUN npm install -g "supergateway@${SUPERGATEWAY_VERSION}" "${MCP_PACKAGE}@${MCP_VERSION}" && \
    npm cache clean --force

# Declare the meaningful version (consumed by the optional CI version-tag job).
RUN echo "${MCP_VERSION}" > /etc/image-version

WORKDIR /app
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Runtime knobs (override at deploy):
#   MCP_BEARER_TOKEN    (required) gate token — Authorization: Bearer <t>  or  ?token=<t>
#   MCP_BIN             stdio binary supergateway runs
#   SUPERGATEWAY_FLAGS  extra supergateway flags
#   LISTEN_PORT         gate (public) port
#   INTERNAL_PORT       bridge (loopback) port
# horizon-mcp REQUIRES --stateful (stateless breaks tools/list — it caches per-session
# API auth) plus --sessionTimeout so the per-session stdio children are reaped (without
# it they leak and the pod OOMs every ~9-11h).
# Supply the upstream API env the MCP itself reads (HORIZON_URL, HORIZON_API_ID,
# HORIZON_API_KEY) at runtime — never bake credentials into the image.
ENV MCP_BIN=horizon-mcp \
    SUPERGATEWAY_FLAGS="--stateful --sessionTimeout 600000" \
    LISTEN_PORT=8080 \
    INTERNAL_PORT=9090 \
    HOME=/tmp \
    npm_config_cache=/tmp/.npm

EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--", "/app/start.sh"]
