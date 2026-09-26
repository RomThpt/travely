#!/usr/bin/env bash
# Usage: deploy/smoke.sh <base_url> <proxy_key>
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <base_url> <proxy_key>" >&2
  exit 1
fi

BASE_URL="${1%/}"
PROXY_KEY="$2"

check() {
  local label="$1"
  local url="$2"
  shift 2
  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' "$@" "$url")
  printf '%-20s %s  %s\n' "$label" "$status" "$url"
}

check "health" "$BASE_URL/health"
check "legs/demo" "$BASE_URL/v1/legs/demo" -H "x-travely-key: $PROXY_KEY"
