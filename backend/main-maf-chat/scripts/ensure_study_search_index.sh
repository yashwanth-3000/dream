#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_FILE="${ROOT_DIR}/azure/search/dream-study-index.json"

required_vars=(
  AZURE_SEARCH_SERVICE_ENDPOINT
  AZURE_SEARCH_API_KEY
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required env var: ${var_name}" >&2
    exit 1
  fi
done

AZURE_SEARCH_API_VERSION="${AZURE_SEARCH_API_VERSION:-2025-09-01}"

curl -sS -X PUT \
  "${AZURE_SEARCH_SERVICE_ENDPOINT%/}/indexes/dream-study-index?api-version=${AZURE_SEARCH_API_VERSION}&allowIndexDowntime=true" \
  -H "Content-Type: application/json" \
  -H "api-key: ${AZURE_SEARCH_API_KEY}" \
  --data @"${SCHEMA_FILE}"

echo
echo "Ensured Azure Search index: dream-study-index"
