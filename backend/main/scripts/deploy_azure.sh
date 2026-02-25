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
  A2A_BACKEND_BASE_URL
  AZURE_OPENAI_ENDPOINT
  AZURE_OPENAI_CHAT_DEPLOYMENT_NAME
  AZURE_OPENAI_API_KEY
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required env var: ${var_name}" >&2
    exit 1
  fi
done

AZURE_OPENAI_API_VERSION="${AZURE_OPENAI_API_VERSION:-preview}"
A2A_RPC_PATH="${A2A_RPC_PATH:-/a2a}"
IMAGE_TAG="maf-orchestrator:$(date +%Y%m%d%H%M%S)"

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
    --secrets azure-openai-api-key="${AZURE_OPENAI_API_KEY}" \
    --output none

  az containerapp update \
    --name "${AZURE_CONTAINERAPP_NAME}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --image "${IMAGE_NAME}" \
    --set-env-vars \
      AGENT_PROVIDER=azure \
      A2A_BACKEND_BASE_URL="${A2A_BACKEND_BASE_URL}" \
      A2A_RPC_PATH="${A2A_RPC_PATH}" \
      A2A_USE_PROTOCOL=true \
      AZURE_OPENAI_ENDPOINT="${AZURE_OPENAI_ENDPOINT}" \
      AZURE_OPENAI_CHAT_DEPLOYMENT_NAME="${AZURE_OPENAI_CHAT_DEPLOYMENT_NAME}" \
      AZURE_OPENAI_API_VERSION="${AZURE_OPENAI_API_VERSION}" \
      AZURE_OPENAI_API_KEY=secretref:azure-openai-api-key \
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
    --cpu 1.0 \
    --memory 2Gi \
    --min-replicas 1 \
    --max-replicas 3 \
    --secrets azure-openai-api-key="${AZURE_OPENAI_API_KEY}" \
    --env-vars \
      AGENT_PROVIDER=azure \
      A2A_BACKEND_BASE_URL="${A2A_BACKEND_BASE_URL}" \
      A2A_RPC_PATH="${A2A_RPC_PATH}" \
      A2A_USE_PROTOCOL=true \
      AZURE_OPENAI_ENDPOINT="${AZURE_OPENAI_ENDPOINT}" \
      AZURE_OPENAI_CHAT_DEPLOYMENT_NAME="${AZURE_OPENAI_CHAT_DEPLOYMENT_NAME}" \
      AZURE_OPENAI_API_VERSION="${AZURE_OPENAI_API_VERSION}" \
      AZURE_OPENAI_API_KEY=secretref:azure-openai-api-key \
    --output none
fi

FQDN="$(az containerapp show --name "${AZURE_CONTAINERAPP_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" --query properties.configuration.ingress.fqdn -o tsv)"

echo "Deployment complete"
echo "App URL: https://${FQDN}"
echo "Health URL: https://${FQDN}/health"
