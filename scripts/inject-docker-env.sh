#!/bin/bash
set -euo pipefail

[ "${1:-}" = "prd" ] || [ "${1:-}" = "qas" ] || { echo "Uso: $0 <prd|qas>"; exit 1; }

[ -n "$(tail -c1 .env)" ] && printf '\n' >> .env

add() { grep -q "^$1=" .env || printf '%s=%s\n' "$1" "$2" >> .env; }

if [ "$1" = "prd" ]; then
  add MEILI_MEM_LIMIT 2g; add MEILI_MEM_RESERVATION 512m
  add REDIS_MEM_LIMIT 256m; add REDIS_MEM_RESERVATION 64m
else
  add MEILI_MEM_LIMIT 1g; add MEILI_MEM_RESERVATION 256m
  add REDIS_MEM_LIMIT 128m; add REDIS_MEM_RESERVATION 32m
fi
