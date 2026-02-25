from app.schemas import CharacterCreationRequest
from app.workflows.character_creation import CharacterWorkflowDecider


def test_choose_prompt_only_when_no_references():
    payload = CharacterCreationRequest(
        user_prompt="A lone desert knight haunted by prophetic dreams.",
        world_references=[],
        character_drawings=[],
    )
    assert CharacterWorkflowDecider.choose_workflow(payload) == "prompt_only"


def test_choose_reference_enriched_when_world_references_exist():
    payload = CharacterCreationRequest(
        user_prompt="An airship mechanic turned revolutionary.",
        world_references=[
            {
                "title": "Steampunk Trade Guilds",
                "description": "Hierarchical guild politics in sky cities.",
            }
        ],
    )
    assert CharacterWorkflowDecider.choose_workflow(payload) == "reference_enriched"


def test_force_workflow_overrides_automatic_selection():
    payload = CharacterCreationRequest(
        user_prompt="A cold-blooded archivist mage collecting forbidden memories.",
        force_workflow="prompt_only",
        world_references=[
            {
                "title": "Arcane Archive",
                "description": "Catalog of memory spells and warded vaults.",
            }
        ],
    )
    assert CharacterWorkflowDecider.choose_workflow(payload) == "prompt_only"
