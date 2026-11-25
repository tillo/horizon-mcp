#!/bin/sh
# IAST switch (infra-7rog.41): the dd-trace tracer is INSTALLED in every image
# (/opt/iast) but starts only when DD_IAST_ENABLED=true, which only the QA cluster
# sets. Anything else -- unset, false, TRUE -- runs the command exactly as before.
if [ "${DD_IAST_ENABLED-}" = true ]; then
  NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--require /opt/iast/node_modules/dd-trace/init"
  export NODE_OPTIONS
fi
exec "$@"
