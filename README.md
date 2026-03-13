# Dream

Dream is an AI storytelling and learning platform for kids. It combines a **Next.js** website with four backend services: a **MAF** orchestrator, a **CrewAI** character generator, a **MAF** storybook generator, and a **MAF** quiz generator. Together they support kid-safe chat, study-mode answers grounded on uploaded study files, story-ready character creation, illustrated 12-spread storybooks with narration, and structured quiz generation.

The backend stack uses **Microsoft Agent Framework (MAF)** for orchestration-time agent workflows, **A2A** for service-to-service calls, **Exa MCP** for fresh web retrieval in chat search mode, and **Azure AI Search** as the **RAG** layer for study-mode uploads. Study mode now uses a dedicated Azure Search index with per-session filtering and vector search so uploaded-file answers stay isolated to the current study chat while paraphrased follow-up questions retrieve more reliably.

### Architecture

<img src="final.svg" alt="Dream architecture diagram" width="100%" />

## Service READMEs

The root README is the system overview. Service-specific request shapes, env vars, endpoints, and troubleshooting live in the README for each app.

| Service | README |
|---|---|
| Main Orchestrator | [`backend/main-maf-chat/README.md`](backend/main-maf-chat/README.md) |
| Character Maker | [`backend/a2a-crew-ai-character-maker/README.md`](backend/a2a-crew-ai-character-maker/README.md) |
| Story Book Maker | [`backend/a2a-maf-story-book-maker/README.md`](backend/a2a-maf-story-book-maker/README.md) |
| Quiz Maker | [`backend/a2a-maf-quiz-maker/README.md`](backend/a2a-maf-quiz-maker/README.md) |
| Exa MCP Notes | [`backend/mcp-exa/README.md`](backend/mcp-exa/README.md) |
| Website | [`website/README.md`](website/README.md) |

## What The Platform Does

The live Azure runtime is a shared **Azure Container Apps** environment named `dream-env` in **East US** under the `dream-rg` resource group. It currently hosts `dream-website`, `dream-orchestrator`, `dream-character-a2a`, `dream-storybook-a2a`, and `dream-quiz-a2a`.

| Capability | What Happens | [Microsoft Product(s) Used](#deployment-walkthrough) |
|---|---|---|
| **Kid-safe chat** | Two MAF agents classify and answer each message. `mode=search` grounds answers with **Exa MCP** and `mode=study` grounds answers with uploaded study-file content from **Azure AI Search**. | **Microsoft Agent Framework** inside the `dream-orchestrator` Container App, **Azure Content Safety** (`dream-contentsafety`) for moderation checks, **Azure AI Search** for study-mode grounding, and the `dream-orchestrator` Azure Container App in `dream-env` for the live chat API. |
| **Study mode** | Users upload one or more supported study files into the current study chat. Dream creates a fresh study session for that upload batch and answers later study questions only from those indexed files, not from earlier uploads. | **Azure AI Search** for `study_session_id`-scoped retrieval and vector search, **Azure OpenAI** for study embeddings, and the `dream-orchestrator` Azure Container App in `dream-env` for upload, indexing, and retrieval orchestration. |
| **Character creation** | A prompt and optional drawings go through CrewAI-based character development, optional vision enrichment, and final image rendering for a story-ready character packet. | The `dream-character-a2a` Azure Container App in `dream-env` hosts the character-generation backend that the orchestrator calls. |
| **Storybook generation** | The storybook backend creates a structured blueprint, writes story pages, generates character art in parallel through A2A, creates scene prompts, renders images, and normalizes the result into a fixed 12-spread storybook. | **Microsoft Agent Framework** inside the `dream-storybook-a2a` service and the `dream-storybook-a2a` Azure Container App in `dream-env` for the live storybook pipeline. |
| **Audio narration** | The storybook backend can generate per-page MP3 narration for right-side story pages when `STORY_AUDIO_ENABLED=true`. | The `dream-storybook-a2a` Azure Container App in `dream-env`, which hosts the narration-capable storybook backend. |
| **Quiz generation** | The quiz backend turns a prompt or story context into a normalized quiz with a fixed question count, exactly four options, exactly two hints, answer explanations, and learning-goal metadata. | **Microsoft Agent Framework** inside the `dream-quiz-a2a` service and the `dream-quiz-a2a` Azure Container App in `dream-env` for the live quiz pipeline. |
| **Job tracking** | Story, character, and quiz runs can be tracked as jobs. The orchestrator stores progress events in SQLite, streams updates over SSE, and downloads produced assets locally. | The `dream-orchestrator` Azure Container App in `dream-env`, which owns the SQLite-backed job state and streaming endpoints. |
| **Dashboard** | The website includes story, character, job, and API test workspaces. Legacy video jobs are still viewable in the dashboard, but video generation is not an active backend pipeline in this repo. | The `dream-website` Azure Container App in `dream-env`, which serves the Next.js frontend and its backend proxy routes. |

<table>
  <tr>
    <td>
      <p><strong>Azure Resources</strong></p>
      <ul>
        <li>Resource group: <code>dream-rg</code></li>
        <li>Region: <code>East US</code></li>
        <li>Azure Container Apps environment: <code>dream-env</code></li>
        <li>Container Apps: <code>dream-website</code>, <code>dream-orchestrator</code>, <code>dream-character-a2a</code>, <code>dream-storybook-a2a</code>, <code>dream-quiz-a2a</code></li>
        <li>Azure AI Search service: <code>dreamsearch03052211</code></li>
        <li>Azure AI Search indexes: <code>dream-rag-index</code>, <code>dream-study-index</code></li>
        <li>Azure OpenAI account: <code>dream-openai-hack</code></li>
        <li>Azure OpenAI embedding deployment used by study mode: <code>dream-embed-3-small</code></li>
        <li>Azure Content Safety account: <code>dream-contentsafety</code></li>
        <li>Application Insights instance: <code>dream-appinsights</code></li>
        <li>Azure Container Registry: <code>dreamacr64808802c</code></li>
        <li>Storage account: <code>dreamstoragedata</code></li>
        <li>Log Analytics workspace: <code>workspace-dreamrgGzL4</code></li>
      </ul>
      <p align="center">
        <img src="https://raw.githubusercontent.com/yashwanth-3000/svg/refs/heads/main/dream/dream_resources.jpeg" alt="Dream Azure resources" width="100%" />
      </p>
    </td>
  </tr>
</table>

## Protocol Stack

| Protocol | Where Used | Why |
|---|---|---|
| **A2A** | Orchestrator <-> Character Maker, Orchestrator <-> Story Book Maker, Orchestrator <-> Quiz Maker, Story Book Maker <-> Character Maker | Standard agent-to-agent protocol for backend calls and streaming task results. |
| **MCP** | Orchestrator <-> Exa MCP | Tool protocol for fresh web retrieval in chat search mode. |
| **REST** | Website <-> Orchestrator and direct service health checks | Standard request-response API layer for non-streaming calls. |
| **NDJSON** | Orchestrator storybook and quiz streaming endpoints | Streaming transport for incremental progress and final payload events. |
| **SSE** | Orchestrator -> Website job stream | Real-time browser updates for tracked jobs. |

## Services

### Website — `website/`

The frontend is a Next.js 16 app with React 19, TypeScript, and Tailwind CSS v4. It contains the public marketing and chat pages, the dashboard workspaces, and thin server-side API routes that proxy browser requests to the orchestrator.

Key areas in the UI:

- Public pages: `/`, `/about`, `/chat`
- Dashboard workspaces: `/dashboard/stories`, `/dashboard/characters`, `/dashboard/jobs`
- Backend test workspaces: `/dashboard/api-test`, `/dashboard/storybook-test`, `/dashboard/quiz-test`
- Legacy archive view: `/dashboard/videos`

### Main Orchestrator — `backend/main-maf-chat/`

The orchestrator is the entrypoint for chat, study uploads, character generation, storybook generation, quiz generation, and job tracking.

It owns:

- Kid-safe chat through `QuestionReaderAgent` and `ResponderAgent`
- Character routing through `MAFRoutingAgent`
- Study-mode file upload and Azure AI Search indexing
- A2A calls to the character, storybook, and quiz backends
- SQLite-backed job lifecycle and asset download/storage

Core orchestrator routes:

- `POST /api/v1/orchestrate/chat`
- `POST /api/v1/orchestrate/study/upload`
- `POST /api/v1/orchestrate/character`
- `POST /api/v1/orchestrate/storybook`
- `POST /api/v1/orchestrate/storybook/stream`
- `POST /api/v1/orchestrate/quiz`
- `POST /api/v1/orchestrate/quiz/stream`

### Character Maker — `backend/a2a-crew-ai-character-maker/`

The character backend is a FastAPI service that produces story-ready characters from text plus optional user drawings or references. It uses CrewAI for narrative design tasks, direct vision analysis for reference enrichment, and Replicate for final portrait rendering.

Typical workflow:

1. Optional vision analysis extracts cues from uploaded drawings
2. CrewAI agents build concept, narrative, and image prompt structure
3. Replicate renders the final character illustration
4. The service returns backstory, image prompt, and generated images

### Story Book Maker — `backend/a2a-maf-story-book-maker/`

The storybook backend generates complete illustrated storybooks in a fixed 12-spread contract. It uses MAF agents for blueprinting, story writing, and scene prompt generation, calls the character backend over A2A, renders scene images, and can generate narration audio for each story page.

The current story pipeline includes:

- Optional vision enrichment from user-provided references
- Story blueprint generation
- Parallel character generation and story writing
- Per-page MP3 narration
- Scene prompt generation
- Image rendering
- Output normalization into a cover/title spread, 10 story page spreads, and an end spread

### Quiz Maker — `backend/a2a-maf-quiz-maker/`

The quiz backend generates children-friendly quizzes from either a standalone prompt or story context. It exposes both REST and A2A, but both paths run the same `QuizWorkflow`.

The workflow:

1. Chooses `story_based` or `prompt_only`
2. Uses `QuizBlueprintAgent` to plan the quiz
3. Uses `QuizWriterAgent` to write the full quiz
4. Normalizes the result to enforce the frontend contract
5. Falls back deterministically if either agent step fails

### Retrieval Layer

Chat retrieval uses split routing:

- `mode=search` -> **Exa MCP** for fresh web grounding
- `mode=study` -> **Azure AI Search** over uploaded study-file chunks filtered by `study_session_id`

Both modes return normalized citations and retrieval metadata back through the orchestrator.

Study-mode retrieval details:

- dedicated index: `dream-study-index`
- isolation field: `study_session_id`
- vector field: `content_vector`
- first-turn retrieval: Azure AI Search hybrid + vector query scoped to the active study session
- guardrail: if retrieval returns no relevant evidence for the current upload, the orchestrator responds that the answer was not found in the uploaded file instead of answering from general knowledge

## Data Flows

### Kid-Safe Chat And Study Mode

1. The website sends chat requests to `POST /api/v1/orchestrate/chat`.
2. `QuestionReaderAgent` classifies the message by safety, category, reading level, and style.
3. `ResponderAgent` writes the answer using the classification and original message.
4. In `mode=search`, the orchestrator retrieves fresh evidence through Exa MCP.
5. In `mode=study`, the frontend first uploads one or more supported study files to `POST /api/v1/orchestrate/study/upload`. Dream creates a fresh study session for that upload batch, and later study chat requests use that session to retrieve only the indexed chunks from those files in Azure AI Search.
6. The final response returns the answer plus classification and retrieval metadata.

### Character Creation

1. The website creates a job record if the run should be tracked.
2. The orchestrator receives `POST /api/v1/orchestrate/character`.
3. `MAFRoutingAgent` decides whether the request is `create` or `regenerate` when mode is `auto`.
4. The orchestrator calls the character backend over A2A.
5. The character backend runs vision enrichment when references are present, builds the narrative packet, and renders final images.
6. The orchestrator stores generated assets under the job folder and finalizes the job state.

### Storybook Generation

1. The website creates a story job and calls `POST /api/v1/orchestrate/storybook/stream`.
2. The orchestrator forwards the request to the storybook backend over A2A and relays NDJSON progress events.
3. The storybook backend builds a story blueprint.
4. Character generation and story writing run in parallel.
5. Narration audio and illustration prompts are generated for story pages.
6. Scene images are rendered and normalized into the 12-spread storybook contract.
7. The orchestrator stores images and job metadata, then streams completion back to the frontend.

### Quiz Generation

1. The website can call the orchestrator through `POST /api/v1/orchestrate/quiz` or `POST /api/v1/orchestrate/quiz/stream`.
2. The orchestrator forwards the request to the quiz backend over A2A.
3. The quiz backend chooses `story_based` or `prompt_only`.
4. `QuizBlueprintAgent` creates the question plan.
5. `QuizWriterAgent` writes the final quiz.
6. The workflow normalizes the quiz so the output always matches the expected contract.
7. When a `job_id` is present, the orchestrator records progress and stores the final quiz payload in the job record.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Orchestration | FastAPI, Microsoft Agent Framework, A2A SDK |
| Character Engine | FastAPI, CrewAI, OpenAI vision, Replicate |
| Storybook Engine | FastAPI, Microsoft Agent Framework, OpenAI TTS, Replicate |
| Quiz Engine | FastAPI, Microsoft Agent Framework, A2A |
| Retrieval | Exa MCP, Azure AI Search |
| Persistence | SQLite via `aiosqlite` |
| Realtime | NDJSON streams and SSE |
| Deployment | Azure Container Apps and ACR |

## Deployment Notes

Each backend service includes a `scripts/deploy_azure.sh` script for Azure Container Apps deployment.

Documented live deployment URLs currently referenced in this repo include:

- Website: `https://dream-website.greenplant-2d9bb135.eastus.azurecontainerapps.io`
- Main orchestrator default used by the website: `https://dream-orchestrator.greenplant-2d9bb135.eastus.azurecontainerapps.io`
- Character Maker: `https://dream-character-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io`
- Story Book Maker: `https://dream-storybook-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io`
- Quiz Maker: `https://dream-quiz-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io`

### Current Live Wiring

- `dream-orchestrator` is the live app wired to:
  - Azure AI Search service: `dreamsearch03052211`
  - default search index: `dream-rag-index`
  - study index: `dream-study-index`
  - Azure Content Safety account: `dream-contentsafety`
  - Azure OpenAI embedding deployment: `dream-embed-3-small`
- `dream-study-index` exists and includes:
  - `study_session_id` as the session-isolation field
  - `content_vector` as the vector field
- `dream-study-index` currently has vector search configured.
- Azure OpenAI account `dream-openai-hack` exists, and `dream-embed-3-small` is deployed there.

### Deployment Walkthrough

Use these links when you want the service-specific deployment details and environment-variable docs:

- [Website deploy guide](website/README.md#deploy)
- [Main orchestrator deploy guide](backend/main-maf-chat/README.md#deploy-to-azure)
- [Character deployment details](backend/a2a-crew-ai-character-maker/README.md#current-production-deployment)
- [Storybook deploy guide](backend/a2a-maf-story-book-maker/README.md#deploy-to-azure)
- [Quiz deploy guide](backend/a2a-maf-quiz-maker/README.md#deploy-to-azure)

Detailed live deployment summary:

1. Shared Azure platform:
   - All live apps run in the `dream-env` Azure Container Apps environment in `dream-rg`, East US.
   - Images are stored in `dreamacr64808802c.azurecr.io`.
   - Telemetry is wired to `dream-appinsights`, backed by Log Analytics workspace `workspace-dreamrgGzL4`.

2. Website deployment:
   - Container App: `dream-website`
   - Latest revision: `dream-website--0000038`
   - Current image: `dreamacr64808802c.azurecr.io/dream-website:20260314022530-amd64`
   - Scale: `minReplicas=1`, `maxReplicas=3`
   - Role: serves the Next.js app and proxies browser requests to the orchestrator

3. Orchestrator deployment:
   - Container App: `dream-orchestrator`
   - Latest revision: `dream-orchestrator--0000036`
   - Current image: `dreamacr64808802c.azurecr.io/maf-orchestrator:20260314030630-amd64`
   - Scale: `minReplicas=1`, `maxReplicas=3`
   - Role: owns chat, study upload, job tracking, A2A dispatch, search-mode MCP routing, and study-mode retrieval

4. Study-mode Azure wiring:
   - Search service: `dreamsearch03052211`
   - Search indexes: `dream-rag-index` and `dream-study-index`
   - Session-isolation field in `dream-study-index`: `study_session_id`
   - Vector field in `dream-study-index`: `content_vector`
   - Embedding resource: Azure OpenAI account `dream-openai-hack`
   - Embedding deployment: `dream-embed-3-small`
   - Moderation resource: Azure Content Safety account `dream-contentsafety`

5. Specialist backend deployments:
   - Character app: `dream-character-a2a`, revision `dream-character-a2a--0000001`, image `dreamacr64808802c.azurecr.io/dream-character-a2a:latest`
   - Storybook app: `dream-storybook-a2a`, revision `dream-storybook-a2a--0000005`, image `dreamacr64808802c.azurecr.io/dream-storybook-a2a:no-chapter-text-20260306-144021`
   - Quiz app: `dream-quiz-a2a`, revision `dream-quiz-a2a--57fum6f`, image `dreamacr64808802c.azurecr.io/dream-quiz-a2a:20260304-v1`
   - Each specialist app is pinned warm with `minReplicas=1` and can scale to `maxReplicas=3`

For local development, always override the website base URLs in `website/.env.local` so the frontend points to your local orchestrator and, when needed, the local character backend.
