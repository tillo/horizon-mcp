#!/bin/sh
# Behaviour of the IAST switch (infra-7rog.41): OFF unless DD_IAST_ENABLED=true, and
# when off the command runs exactly as before -- same argv, NODE_OPTIONS untouched.
set -eu
entry="$(dirname "$0")/iast-entry.sh"
init="--require /opt/iast/node_modules/dd-trace/init"
n=0
check() { # check <name> <expected> <actual>
  [ "$2" = "$3" ] || { echo "FAIL $1: expected '$2', got '$3'"; exit 1; }
  n=$((n + 1))
}
# NODE_OPTIONS as the wrapped command sees it ("<unset>" when absent)
seen() { sh "$entry" printenv NODE_OPTIONS || printf '<unset>'; }

check "off by default" "--no-node-snapshot" "$(unset DD_IAST_ENABLED; NODE_OPTIONS=--no-node-snapshot seen)"
check "off when false" "x" "$(DD_IAST_ENABLED=false NODE_OPTIONS=x seen)"
check "off when TRUE (exact match only)" "x" "$(DD_IAST_ENABLED=TRUE NODE_OPTIONS=x seen)"
check "off leaves NODE_OPTIONS unset" "<unset>" "$(unset NODE_OPTIONS DD_IAST_ENABLED; seen)"
check "on appends the tracer" "--no-node-snapshot $init" "$(DD_IAST_ENABLED=true NODE_OPTIONS=--no-node-snapshot seen)"
check "on with no NODE_OPTIONS" "$init" "$(unset NODE_OPTIONS; DD_IAST_ENABLED=true seen)"
check "argv passed verbatim" "a|b c|" "$(sh "$entry" printf '%s|' a 'b c')"
echo "iast-entry: $n checks passed"
