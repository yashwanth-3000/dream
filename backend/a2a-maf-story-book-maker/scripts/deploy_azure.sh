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

CHARACTER_BACKEND_BASE_URL="${CHARACTER_BACKEND_BASE_URL:-https://dream-character-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io}"
AZURE_CONTAINER_CPU="${AZURE_CONTAINER_CPU:-1.0}"
AZURE_CONTAINER_MEMORY="${AZURE_CONTAINER_MEMORY:-2Gi}"
AZURE_MIN_REPLICAS="${AZURE_MIN_REPLICAS:-1}"
AZURE_MAX_REPLICAS="${AZURE_MAX_REPLICAS:-3}"
IMAGE_TAG="dream-storybook-a2a:$(date +%Y%m%d%H%M%S)"

az account set --subscription "${AZURE_SUBSCRIPTION_ID}"

ACR_LOGIN_SERVER="$(az acr show --name "${AZURE_ACR_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" --query loginServer -o tsv)"

echo "Building image ${IMAGE_TAG}..."
az acr build \
  --registry "${AZURE_ACR_NAME}" \
  --image "${IMAGE_TAG}" \
  "${ROOT_DIR}" \
  --output none

ACR_USER="$(az acr credential show --name "${AZURE_ACR_NAME}" --query username -o tsv)"
ACR_PASS="$(az acr credential show --name "${AZURE_ACR_NAME}" --query passwords[0].value -o tsv)"
IMAGE_NAME="${ACR_LOGIN_SERVER}/${IMAGE_TAG}"

if az containerapp show --name "${AZURE_CONTAINERAPP_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" >/dev/null 2>&1; then
  az containerapp secret set \
    --name "${AZURE_CONTAINERAPP_NAME}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --secrets openai-api-key="${OPENAI_API_KEY}" replicate-api-token="${REPLICATE_API_TOKEN}" \
    --output none

  az containerapp update \
    --name "${AZURE_CONTAINERAPP_NAME}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --image "${IMAGE_NAME}" \
    --cpu "${AZURE_CONTAINER_CPU}" \
    --memory "${AZURE_CONTAINER_MEMORY}" \
    --min-replicas "${AZURE_MIN_REPLICAS}" \
    --max-replicas "${AZURE_MAX_REPLICAS}" \
    --set-env-vars \
      OPENAI_API_KEY=secretref:openai-api-key \
      OPENAI_MODEL=gpt-4o-mini \
      OPENAI_TEMPERATURE=0.6 \
      OPENAI_VISION_MODEL=gpt-4.1-mini \
      OPENAI_VISION_MAX_TOKENS=500 \
      REPLICATE_API_TOKEN=secretref:replicate-api-token \
      REPLICATE_MODEL=openai/gpt-image-1.5 \
      REPLICATE_OUTPUT_COUNT=1 \
      REPLICATE_ASPECT_RATIO=2:3 \
      REPLICATE_QUALITY=medium \
      REPLICATE_BACKGROUND=auto \
      REPLICATE_MODERATION=auto \
      REPLICATE_OUTPUT_FORMAT=webp \
      REPLICATE_INPUT_FIDELITY=high \
      REPLICATE_OUTPUT_COMPRESSION=90 \
      CHARACTER_BACKEND_BASE_URL="${CHARACTER_BACKEND_BASE_URL}" \
      CHARACTER_BACKEND_RPC_PATH=/a2a \
      CHARACTER_BACKEND_USE_PROTOCOL=true \
      CHARACTER_BACKEND_CREATE_PATH=/api/v1/characters/create \
      CHARACTER_BACKEND_TIMEOUT_SECONDS=240 \
      SCENE_IMAGE_TIMEOUT_SECONDS=70 \
      SCENE_IMAGE_RETRY_COUNT=1 \
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
    --secrets openai-api-key="${OPENAI_API_KEY}" replicate-api-token="${REPLICATE_API_TOKEN}" \
    --env-vars \
      OPENAI_API_KEY=secretref:openai-api-key \
      OPENAI_MODEL=gpt-4o-mini \
      OPENAI_TEMPERATURE=0.6 \
      OPENAI_VISION_MODEL=gpt-4.1-mini \
      OPENAI_VISION_MAX_TOKENS=500 \
      REPLICATE_API_TOKEN=secretref:replicate-api-token \
      REPLICATE_MODEL=openai/gpt-image-1.5 \
      REPLICATE_OUTPUT_COUNT=1 \
      REPLICATE_ASPECT_RATIO=2:3 \
      REPLICATE_QUALITY=medium \
      REPLICATE_BACKGROUND=auto \
      REPLICATE_MODERATION=auto \
      REPLICATE_OUTPUT_FORMAT=webp \
      REPLICATE_INPUT_FIDELITY=high \
      REPLICATE_OUTPUT_COMPRESSION=90 \
      CHARACTER_BACKEND_BASE_URL="${CHARACTER_BACKEND_BASE_URL}" \
      CHARACTER_BACKEND_RPC_PATH=/a2a \
      CHARACTER_BACKEND_USE_PROTOCOL=true \
      CHARACTER_BACKEND_CREATE_PATH=/api/v1/characters/create \
      CHARACTER_BACKEND_TIMEOUT_SECONDS=240 \
      SCENE_IMAGE_TIMEOUT_SECONDS=70 \
      SCENE_IMAGE_RETRY_COUNT=1 \
    --output none
fi

FQDN="$(az containerapp show --name "${AZURE_CONTAINERAPP_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" --query properties.configuration.ingress.fqdn -o tsv)"

echo "Deployment complete"
echo "App URL: https://${FQDN}"
