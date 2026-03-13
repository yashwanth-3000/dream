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
  MAIN_API_BASE_URL
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required env var: ${var_name}" >&2
    exit 1
  fi
done

AZURE_CONTAINER_CPU="${AZURE_CONTAINER_CPU:-0.5}"
AZURE_CONTAINER_MEMORY="${AZURE_CONTAINER_MEMORY:-1Gi}"
AZURE_MIN_REPLICAS="${AZURE_MIN_REPLICAS:-1}"
AZURE_MAX_REPLICAS="${AZURE_MAX_REPLICAS:-3}"
IMAGE_TAG="dream-website:$(date +%Y%m%d%H%M%S)"

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
  az containerapp update \
    --name "${AZURE_CONTAINERAPP_NAME}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --image "${IMAGE_NAME}" \
    --cpu "${AZURE_CONTAINER_CPU}" \
    --memory "${AZURE_CONTAINER_MEMORY}" \
    --min-replicas "${AZURE_MIN_REPLICAS}" \
    --max-replicas "${AZURE_MAX_REPLICAS}" \
    --set-env-vars \
      MAIN_API_BASE_URL="${MAIN_API_BASE_URL}" \
    --output none
else
  az containerapp create \
    --name "${AZURE_CONTAINERAPP_NAME}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --environment "${AZURE_CONTAINERAPP_ENV}" \
    --image "${IMAGE_NAME}" \
    --target-port 3000 \
    --ingress external \
    --registry-server "${ACR_LOGIN_SERVER}" \
    --registry-username "${ACR_USER}" \
    --registry-password "${ACR_PASS}" \
    --cpu "${AZURE_CONTAINER_CPU}" \
    --memory "${AZURE_CONTAINER_MEMORY}" \
    --min-replicas "${AZURE_MIN_REPLICAS}" \
    --max-replicas "${AZURE_MAX_REPLICAS}" \
    --env-vars \
      MAIN_API_BASE_URL="${MAIN_API_BASE_URL}" \
    --output none
fi

FQDN="$(az containerapp show --name "${AZURE_CONTAINERAPP_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" --query properties.configuration.ingress.fqdn -o tsv)"

echo "Deployment complete"
echo "Website URL: https://${FQDN}"
