# Dream MAF Story Book Maker

This service generates short illustrated storybooks with a fixed 7-spread contract using Microsoft Agent Framework (MAF), A2A integration, and Replicate image rendering.

It is designed to run alongside:
- `backend/a2a-crew-ai-character-maker` (character pipeline)
- `backend/main` (top-level orchestrator)

## What It Produces

For every request it returns:
- a compact story draft (title page + 5 right-page chapter entries + end page)
- up to 2 character packets (generated through the existing character backend)
- scene prompts (cover + 5 illustrations)
- 6 generated images (cover + page 1..5 illustrations)
- exact 7-spread normalized payload

Spread layout is fixed:
- Spread 0: left cover image, right title page, no label
- Spread 1..5: left illustration, right chapter text, labels `Page 1 of 5` ... `Page 5 of 5`
- Spread 6: left end page, right empty, no label

## Pipeline

1. Optional vision enrichment for uploaded drawings/world references.
2. `StoryBlueprintAgent` creates structured story plan + character briefs.
3. In parallel:
   - Character generation branch (A2A call to character backend per brief)
   - Story writing branch (`StoryWriterAgent`)
4. `ScenePromptAgent` generates cover + 5 page prompts.
5. Replicate renders all 6 images in parallel.
6. Response is normalized to exact 7-spread contract.

## API

### `GET /health`
Health + character backend connectivity snapshot.

### `POST /api/v1/stories/create`
Runs full storybook workflow.

### A2A endpoints
- `POST /a2a`
- `GET /.well-known/agent-card.json`
- `GET /.well-known/agent.json`

## Request Schema (`/api/v1/stories/create`)

```json
{
  "user_prompt": "A moon explorer rescues a lost archive",
  "world_references": [
    { "title": "Orbital temple", "description": "Flooded silver halls", "image_data": "data:image/png;base64,..." }
  ],
  "character_drawings": [
    { "notes": "front pose", "image_data": "data:image/png;base64,..." }
  ],
  "force_workflow": "reference_enriched",
  "max_characters": 2,
  "tone": "hopeful",
  "age_band": "5-8"
}
```

## Response Highlights

```json
{
  "workflow_used": "reference_enriched",
  "story": {
    "title": "...",
    "title_page_text": "...",
    "right_pages": [{ "page_number": 1, "chapter": "Chapter 1", "text": "..." }],
    "end_page_text": "..."
  },
  "characters": [
    {
      "name": "...",
      "brief": "...",
      "backstory": { "...": "..." },
      "image_prompt": { "...": "..." },
      "generated_images": ["https://..."]
    }
  ],
  "scene_prompts": {
    "cover_prompt": "...",
    "illustration_prompts": ["...", "...", "...", "...", "..."],
    "negative_prompt": "..."
  },
  "generated_images": ["cover", "p1", "p2", "p3", "p4", "p5"],
  "spreads": [
    { "spread_index": 0, "left": {"kind":"cover_image"}, "right": {"kind":"title_page"} }
  ],
  "generation_sources": {
    "blueprint": "maf",
    "story": "maf",
    "scene_prompts": "maf",
    "character_branch": "parallel_success"
  },
  "reference_images_used_count": 3,
  "warnings": []
}
```

## Environment

Copy and fill:

```bash
cp .env.example .env
```

Key variables:
- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (default `gpt-4o-mini`)
- `REPLICATE_API_TOKEN` (required)
- `CHARACTER_BACKEND_BASE_URL` (default `http://127.0.0.1:8000`)
- `CHARACTER_BACKEND_RPC_PATH` (default `/a2a`)
- `CHARACTER_BACKEND_USE_PROTOCOL` (default `true`)
- `A2A_PUBLIC_BASE_URL` (default `http://127.0.0.1:8020`)

Model note:
- Use raw OpenAI model IDs (for example `gpt-4o-mini`), not provider-prefixed IDs like `openai/gpt-4o-mini`.

## Run

```bash
cd /Users/yashwanthkrishna/Desktop/Projects/dream/backend/maf-story-book-maker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn agent_storybook.main:app --reload --host 127.0.0.1 --port 8020
```

## Direct Test

```bash
curl -sS -X POST "http://127.0.0.1:8020/api/v1/stories/create" \
  -H "content-type: application/json" \
  -d '{
    "user_prompt": "A moon explorer rescues a lost archive",
    "max_characters": 2,
    "world_references": [],
    "character_drawings": []
  }'
```

## A2A Test

```bash
curl -sS -X POST "http://127.0.0.1:8020/a2a" \
  -H "content-type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "story-1",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{ "kind": "text", "text": "Create a short moon adventure storybook" }],
        "messageId": "story-msg-1",
        "metadata": {
          "operation": "story_create",
          "payload": {
            "user_prompt": "Create a short moon adventure storybook",
            "max_characters": 2,
            "world_references": [],
            "character_drawings": []
          }
        }
      }
    }
  }'
```
