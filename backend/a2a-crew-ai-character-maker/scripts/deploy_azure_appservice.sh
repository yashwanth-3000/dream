#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required_vars=(
  AZURE_SUBSCRIPTION_ID
  AZURE_RESOURCE_GROUP
  AZURE_LOCATION
  AZURE_APP_SERVICE_PLAN
  AZURE_WEBAPP_NAME
  OPENAI_API_KEY
  REPLICATE_API_TOKEN
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required env var: ${var_name}" >&2
    exit 1
  fi
done

OPENAI_MODEL="${OPENAI_MODEL:-openai/gpt-4o-mini}"
OPENAI_TEMPERATURE="${OPENAI_TEMPERATURE:-0.6}"
OPENAI_VISION_MODEL="${OPENAI_VISION_MODEL:-gpt-4.1-mini}"
OPENAI_VISION_MAX_TOKENS="${OPENAI_VISION_MAX_TOKENS:-500}"

REPLICATE_MODEL="${REPLICATE_MODEL:-openai/gpt-image-1.5}"
REPLICATE_OUTPUT_COUNT="${REPLICATE_OUTPUT_COUNT:-1}"
REPLICATE_ASPECT_RATIO="${REPLICATE_ASPECT_RATIO:-2:3}"
REPLICATE_QUALITY="${REPLICATE_QUALITY:-medium}"
REPLICATE_BACKGROUND="${REPLICATE_BACKGROUND:-auto}"
REPLICATE_MODERATION="${REPLICATE_MODERATION:-auto}"
REPLICATE_OUTPUT_FORMAT="${REPLICATE_OUTPUT_FORMAT:-webp}"
REPLICATE_INPUT_FIDELITY="${REPLICATE_INPUT_FIDELITY:-high}"
REPLICATE_OUTPUT_COMPRESSION="${REPLICATE_OUTPUT_COMPRESSION:-90}"

A2A_RPC_PATH="${A2A_RPC_PATH:-/a2a}"
A2A_AGENT_NAME="${A2A_AGENT_NAME:-Dream CrewAI Character Agent}"
A2A_AGENT_VERSION="${A2A_AGENT_VERSION:-0.1.0}"
CREWAI_VERBOSE="${CREWAI_VERBOSE:-true}"

PYTHON_RUNTIME="${PYTHON_RUNTIME:-PYTHON:3.11}"
STARTUP_FILE="${STARTUP_FILE:-gunicorn -k uvicorn.workers.UvicornWorker --bind=0.0.0.0 --timeout 240 app.main:app}"

az account set --subscription "${AZURE_SUBSCRIPTION_ID}"

az provider register --namespace Microsoft.Web --wait --output none

az group create \
  --name "${AZURE_RESOURCE_GROUP}" \
  --location "${AZURE_LOCATION}" \
  --output none

if ! az appservice plan show --name "${AZURE_APP_SERVICE_PLAN}" --resource-group "${AZURE_RESOURCE_GROUP}" >/dev/null 2>&1; then
  az appservice plan create \
    --name "${AZURE_APP_SERVICE_PLAN}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --is-linux \
    --sku B1 \
    --location "${AZURE_LOCATION}" \
    --output none
fi

if ! az webapp show --name "${AZURE_WEBAPP_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" >/dev/null 2>&1; then
  az webapp create \
    --name "${AZURE_WEBAPP_NAME}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --plan "${AZURE_APP_SERVICE_PLAN}" \
    --runtime "${PYTHON_RUNTIME}" \
    --startup-file "${STARTUP_FILE}" \
    --output none
fi

az webapp config appsettings set \
  --name "${AZURE_WEBAPP_NAME}" \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --settings \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true \
    OPENAI_API_KEY="${OPENAI_API_KEY}" \
    OPENAI_MODEL="${OPENAI_MODEL}" \
    OPENAI_TEMPERATURE="${OPENAI_TEMPERATURE}" \
    OPENAI_VISION_MODEL="${OPENAI_VISION_MODEL}" \
    OPENAI_VISION_MAX_TOKENS="${OPENAI_VISION_MAX_TOKENS}" \
    REPLICATE_API_TOKEN="${REPLICATE_API_TOKEN}" \
    REPLICATE_MODEL="${REPLICATE_MODEL}" \
    REPLICATE_OUTPUT_COUNT="${REPLICATE_OUTPUT_COUNT}" \
    REPLICATE_ASPECT_RATIO="${REPLICATE_ASPECT_RATIO}" \
    REPLICATE_QUALITY="${REPLICATE_QUALITY}" \
    REPLICATE_BACKGROUND="${REPLICATE_BACKGROUND}" \
    REPLICATE_MODERATION="${REPLICATE_MODERATION}" \
    REPLICATE_OUTPUT_FORMAT="${REPLICATE_OUTPUT_FORMAT}" \
    REPLICATE_INPUT_FIDELITY="${REPLICATE_INPUT_FIDELITY}" \
    REPLICATE_OUTPUT_COMPRESSION="${REPLICATE_OUTPUT_COMPRESSION}" \
    A2A_RPC_PATH="${A2A_RPC_PATH}" \
    A2A_AGENT_NAME="${A2A_AGENT_NAME}" \
    A2A_AGENT_VERSION="${A2A_AGENT_VERSION}" \
    CREWAI_VERBOSE="${CREWAI_VERBOSE}" \
  --output none

az webapp config set \
  --name "${AZURE_WEBAPP_NAME}" \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --startup-file "${STARTUP_FILE}" \
  --output none

TMP_ZIP="$(mktemp /tmp/dream-character-a2a-XXXXXX.zip)"

(
  cd "${ROOT_DIR}"
  zip -r "${TMP_ZIP}" \
    app \
    pyproject.toml \
    requirements.txt \
    README.md \
    -x "*/__pycache__/*"
)

az webapp deploy \
  --name "${AZURE_WEBAPP_NAME}" \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --src-path "${TMP_ZIP}" \
  --type zip \
  --clean true \
  --restart true \
  --output none

HOSTNAME="$(az webapp show --name "${AZURE_WEBAPP_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" --query defaultHostName -o tsv)"
PUBLIC_BASE_URL="https://${HOSTNAME}"

az webapp config appsettings set \
  --name "${AZURE_WEBAPP_NAME}" \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --settings A2A_PUBLIC_BASE_URL="${PUBLIC_BASE_URL}" \
  --output none

rm -f "${TMP_ZIP}"

echo "Deployment complete"
echo "App URL: ${PUBLIC_BASE_URL}"
echo "Health URL: ${PUBLIC_BASE_URL}/health"
echo "A2A RPC URL: ${PUBLIC_BASE_URL}${A2A_RPC_PATH}"
