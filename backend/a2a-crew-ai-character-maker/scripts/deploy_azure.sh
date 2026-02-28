#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required_vars=(
  AZURE_SUBSCRIPTION_ID
  AZURE_RESOURCE_GROUP
  AZURE_LOCATION
  AZURE_CONTAINERAPP_ENV
  AZURE_ACR_NAME
  AZURE_CONTAINERAPP_NAME
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

AZURE_CONTAINER_CPU="${AZURE_CONTAINER_CPU:-1.0}"
AZURE_CONTAINER_MEMORY="${AZURE_CONTAINER_MEMORY:-2Gi}"
AZURE_MIN_REPLICAS="${AZURE_MIN_REPLICAS:-1}"
AZURE_MAX_REPLICAS="${AZURE_MAX_REPLICAS:-3}"
IMAGE_TAG="dream-character-a2a:$(date +%Y%m%d%H%M%S)"

az extension add --name containerapp --upgrade --allow-preview true --output none
az provider register --namespace Microsoft.App --wait --output none
az provider register --namespace Microsoft.OperationalInsights --wait --output none
az provider register --namespace Microsoft.ContainerRegistry --wait --output none

az account set --subscription "${AZURE_SUBSCRIPTION_ID}"

az group create \
  --name "${AZURE_RESOURCE_GROUP}" \
  --location "${AZURE_LOCATION}" \
  --output none

if ! az acr show --name "${AZURE_ACR_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" >/dev/null 2>&1; then
  az acr create \
    --name "${AZURE_ACR_NAME}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --sku Basic \
    --admin-enabled true \
    --output none
fi

az acr update \
  --name "${AZURE_ACR_NAME}" \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --admin-enabled true \
  --output none

ACR_LOGIN_SERVER="$(az acr show --name "${AZURE_ACR_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" --query loginServer -o tsv)"

az acr build \
  --registry "${AZURE_ACR_NAME}" \
  --image "${IMAGE_TAG}" \
  "${ROOT_DIR}" \
  --output none

if ! az containerapp env show --name "${AZURE_CONTAINERAPP_ENV}" --resource-group "${AZURE_RESOURCE_GROUP}" >/dev/null 2>&1; then
  az containerapp env create \
    --name "${AZURE_CONTAINERAPP_ENV}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --location "${AZURE_LOCATION}" \
    --output none
fi

ACR_USER="$(az acr credential show --name "${AZURE_ACR_NAME}" --query username -o tsv)"
ACR_PASS="$(az acr credential show --name "${AZURE_ACR_NAME}" --query passwords[0].value -o tsv)"
IMAGE_NAME="${ACR_LOGIN_SERVER}/${IMAGE_TAG}"

if az containerapp show --name "${AZURE_CONTAINERAPP_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" >/dev/null 2>&1; then
  az containerapp secret set \
    --name "${AZURE_CONTAINERAPP_NAME}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --secrets \
      openai-api-key="${OPENAI_API_KEY}" \
      replicate-api-token="${REPLICATE_API_TOKEN}" \
    --output none

  az containerapp update \
    --name "${AZURE_CONTAINERAPP_NAME}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --image "${IMAGE_NAME}" \
    --set-env-vars \
      OPENAI_API_KEY=secretref:openai-api-key \
      OPENAI_MODEL="${OPENAI_MODEL}" \
      OPENAI_TEMPERATURE="${OPENAI_TEMPERATURE}" \
      OPENAI_VISION_MODEL="${OPENAI_VISION_MODEL}" \
      OPENAI_VISION_MAX_TOKENS="${OPENAI_VISION_MAX_TOKENS}" \
      REPLICATE_API_TOKEN=secretref:replicate-api-token \
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
else
  az containerapp create \
    --name "${AZURE_CONTAINERAPP_NAME}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --environment "${AZURE_CONTAINERAPP_ENV}" \
    --image "${IMAGE_NAME}" \
    --target-port 8080 \
    --ingress external \
    --registry-server "${ACR_LOGIN_SERVER}" \
    --registry-username "${ACR_USER}" \
    --registry-password "${ACR_PASS}" \
    --cpu "${AZURE_CONTAINER_CPU}" \
    --memory "${AZURE_CONTAINER_MEMORY}" \
    --min-replicas "${AZURE_MIN_REPLICAS}" \
    --max-replicas "${AZURE_MAX_REPLICAS}" \
    --secrets \
      openai-api-key="${OPENAI_API_KEY}" \
      replicate-api-token="${REPLICATE_API_TOKEN}" \
    --env-vars \
      OPENAI_API_KEY=secretref:openai-api-key \
      OPENAI_MODEL="${OPENAI_MODEL}" \
      OPENAI_TEMPERATURE="${OPENAI_TEMPERATURE}" \
      OPENAI_VISION_MODEL="${OPENAI_VISION_MODEL}" \
      OPENAI_VISION_MAX_TOKENS="${OPENAI_VISION_MAX_TOKENS}" \
      REPLICATE_API_TOKEN=secretref:replicate-api-token \
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
fi

FQDN="$(az containerapp show --name "${AZURE_CONTAINERAPP_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" --query properties.configuration.ingress.fqdn -o tsv)"
PUBLIC_BASE_URL="https://${FQDN}"

az containerapp update \
  --name "${AZURE_CONTAINERAPP_NAME}" \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --set-env-vars A2A_PUBLIC_BASE_URL="${PUBLIC_BASE_URL}" \
  --output none

echo "Deployment complete"
echo "App URL: ${PUBLIC_BASE_URL}"
echo "Health URL: ${PUBLIC_BASE_URL}/health"
echo "A2A RPC URL: ${PUBLIC_BASE_URL}${A2A_RPC_PATH}"
