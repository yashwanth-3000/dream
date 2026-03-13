# Dream Website

The website is the Next.js frontend for Dream. It renders the public pages, the chat experience, and the dashboard workspaces, and it proxies browser requests to the orchestrator.

## Why This Microsoft Setup Matters

This frontend is intentionally thin. It does not run retrieval, moderation, or orchestration logic itself. Its Microsoft role is to provide a stable hosted entry point for the user experience while the backend stack does the heavy lifting.

| Microsoft product | Why Dream uses it here | How Dream uses it here |
|---|---|---|
| Azure Container Apps | The website needs a managed runtime that can stay warm, expose HTTPS, and live next to the backend services in the same Azure environment. That keeps frontend-to-backend latency low and makes deployment simpler than managing VMs or App Service plans for this hackathon setup. | `dream-website` runs in the `dream-env` Container Apps environment. It serves the Next.js app, hosts the server-side API proxy routes, and forwards browser-safe requests to the orchestrator through `MAIN_API_BASE_URL`. |
| Azure Container Registry | The frontend is deployed as a container image, so it needs a registry-backed release flow. This keeps deploys repeatable and lets the Container App point at a specific image tag and revision. | The website build is pushed to `dreamacr64808802c.azurecr.io`, then `dream-website` is updated to that image. The current live revision is `dream-website--0000038`. |

## What The Frontend Does

- Renders `/`, `/about`, and `/chat`
- Proxies chat requests through `/api/chat`
- Proxies study uploads through `/api/chat/study/upload`
- Provides dashboard pages for stories, characters, jobs, and API testing
- Keeps the chat UI aligned with the backend contract for `normal`, `search`, and `study`

## Chat Modes

The chat UI supports three backend-connected modes:

- `normal`: kid-safe direct answer path
- `search`: fresh web results through Exa MCP on the backend
- `study`: uploaded-file study mode through Azure AI Search on the backend

Current product behavior:

- `search` stays on the Exa MCP path
- `study` is the only mode that allows file uploads
- a new file upload in study mode starts a fresh `study_session_id`
- text-only follow-up messages in study mode continue inside the current study session
- voice input is removed from the composer

## Study Mode

Study mode is built for user-uploaded learning material, not general web search.

Flow:

1. User switches to `Study`
2. User attaches one or more supported study files
3. Frontend uploads files to `/api/chat/study/upload`
4. Backend returns a `study_session_id`
5. Chat requests send `mode=study` and that `study_session_id`
6. Responses are grounded only to that upload session

Supported study file types in the UI:

- `pdf`
- `txt`
- `md`
- `csv`
- `json`
- `xml`
- `html`
- `yaml`
- `yml`
- `log`

Important UX constraints:

- attach button is shown only in study mode
- unsupported files are rejected before upload
- if the current study upload does not support the question, the backend returns a "not found in the uploaded file" answer
- search mode and study mode are intentionally separate retrieval systems

## API Routes

Browser-safe proxy routes:

- `POST /api/chat`
- `POST /api/chat/study/upload`
- `GET /api/jobs`
- `GET /api/jobs/[id]`
- `GET /api/jobs/[id]/events`
- `GET /api/jobs/[id]/stream`
- `GET /api/assets/[jobId]/[filename]`

The website does not implement retrieval itself. It forwards requests to the orchestrator configured in environment variables.

## Local Development

```bash
cd website
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Create `website/.env.local` and point the frontend at the running orchestrator.

Typical values:

```bash
NEXT_PUBLIC_ORCHESTRATOR_URL=http://127.0.0.1:8010
ORCHESTRATOR_URL=http://127.0.0.1:8010
```

If you are testing against Azure, use the live Container App URL instead.

## Build

```bash
npm run build
```

## Live Deployment

| Resource | Value |
|---|---|
| Resource Group | `dream-rg` |
| Region | `East US` |
| Container Apps Env | `dream-env` |
| App Name | `dream-website` |
| App URL | `https://dream-website.greenplant-2d9bb135.eastus.azurecontainerapps.io` |
| Latest Revision | `dream-website--0000038` |
| Current Image | `dreamacr64808802c.azurecr.io/dream-website:20260314022530-amd64` |
| Scale | `minReplicas=1`, `maxReplicas=3` |
| Proxy Target | `MAIN_API_BASE_URL=https://dream-orchestrator.greenplant-2d9bb135.eastus.azurecontainerapps.io` |

## Deploy

Azure Container Apps deployment is handled by:

- `/Users/yashwanthkrishna/Desktop/Projects/dream/website/scripts/deploy_azure.sh`

Deploy command:

```bash
cd website
./scripts/deploy_azure.sh
```

Required deployment environment variables:

- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_LOCATION`
- `AZURE_CONTAINERAPP_ENV`
- `AZURE_ACR_NAME`
- `AZURE_CONTAINERAPP_NAME`
- `MAIN_API_BASE_URL`

Typical live Azure values:

- `AZURE_RESOURCE_GROUP=dream-rg`
- `AZURE_LOCATION=eastus`
- `AZURE_CONTAINERAPP_ENV=dream-env`
- `AZURE_ACR_NAME=dreamacr64808802c`
- `AZURE_CONTAINERAPP_NAME=dream-website`
- `MAIN_API_BASE_URL=https://dream-orchestrator.greenplant-2d9bb135.eastus.azurecontainerapps.io`

Optional deployment settings:

- `AZURE_CONTAINER_CPU` defaults to `0.5`
- `AZURE_CONTAINER_MEMORY` defaults to `1Gi`
- `AZURE_MIN_REPLICAS` defaults to `1`
- `AZURE_MAX_REPLICAS` defaults to `3`

What the deploy script does:

1. Builds the Next.js website image in ACR.
2. Creates or updates the `dream-website` Container App.
3. Sets `MAIN_API_BASE_URL` so the server-side proxy routes point at the orchestrator.
4. Keeps the site warm with `minReplicas=1`.

The live website currently talks to:

- orchestrator: `https://dream-orchestrator.greenplant-2d9bb135.eastus.azurecontainerapps.io`

Important deployment note:

- If `az acr build` fails with `TasksOperationsNotAllowed`, the subscription is blocking ACR Tasks.
- In that case, build locally for `linux/amd64`, push the image to `dreamacr64808802c.azurecr.io`, and update the Container App image manually.
