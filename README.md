# Dream

Dream is an AI storytelling and learning platform for kids. It combines a **Next.js** website with four backend services: a **MAF** orchestrator, a **CrewAI** character generator, a **MAF** storybook generator, and a **MAF** quiz generator. Together they support kid-safe chat, study-mode answers grounded on uploaded PDFs, story-ready character creation, illustrated 12-spread storybooks with narration, and structured quiz generation.

The backend stack uses **Microsoft Agent Framework (MAF)** for orchestration-time agent workflows, **A2A** for service-to-service calls, **Exa MCP** for fresh web retrieval in chat search mode, and **Azure AI Search** as the **RAG** layer for study-mode uploads. Supporting tasks such as vision analysis and narration use direct SDK integrations where appropriate.

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

| Capability | What Happens |
|---|---|
| **Kid-safe chat** | Two MAF agents classify and answer each message. `mode=search` grounds answers with **Exa MCP** and `mode=study` grounds answers with uploaded PDF content from **Azure AI Search**. |
| **Study mode** | Users upload a PDF, receive a `study_session_id`, and later chat requests use that session to retrieve only the indexed chunks for that study set. |
| **Character creation** | A prompt and optional drawings go through CrewAI-based character development, optional vision enrichment, and final image rendering for a story-ready character packet. |
| **Storybook generation** | The storybook backend creates a structured blueprint, writes story pages, generates character art in parallel through A2A, creates scene prompts, renders images, and normalizes the result into a fixed 12-spread storybook. |
| **Audio narration** | The storybook backend can generate per-page MP3 narration for right-side story pages when `STORY_AUDIO_ENABLED=true`. |
| **Quiz generation** | The quiz backend turns a prompt or story context into a normalized quiz with a fixed question count, exactly four options, exactly two hints, answer explanations, and learning-goal metadata. |
| **Job tracking** | Story, character, and quiz runs can be tracked as jobs. The orchestrator stores progress events in SQLite, streams updates over SSE, and downloads produced assets locally. |
| **Dashboard** | The website includes story, character, job, and API test workspaces. Legacy video jobs are still viewable in the dashboard, but video generation is not an active backend pipeline in this repo. |

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
- Study-mode PDF upload and Azure AI Search indexing
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
- `mode=study` -> **Azure AI Search** over uploaded PDF chunks filtered by `study_session_id`

Both modes return normalized citations and retrieval metadata back through the orchestrator.

## Data Flows

### Kid-Safe Chat And Study Mode

1. The website sends chat requests to `POST /api/v1/orchestrate/chat`.
2. `QuestionReaderAgent` classifies the message by safety, category, reading level, and style.
3. `ResponderAgent` writes the answer using the classification and original message.
4. In `mode=search`, the orchestrator retrieves fresh evidence through Exa MCP.
5. In `mode=study`, the frontend first uploads a PDF to `POST /api/v1/orchestrate/study/upload`, receives a `study_session_id`, and later chat requests use that ID to retrieve only the indexed study chunks from Azure AI Search.
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

Documented deployment URLs currently referenced in this repo include:

- Main orchestrator default used by the website: `https://dream-orchestrator.greenplant-2d9bb135.eastus.azurecontainerapps.io`
- Character Maker: `https://dream-character-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io`
- Quiz Maker: `https://dream-quiz-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io`

For local development, always override the website base URLs in `website/.env.local` so the frontend points to your local orchestrator and, when needed, the local character backend.
