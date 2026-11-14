import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "public" / "data" / "fixtures"
SCHEMAS = ROOT / "src" / "contracts" / "schema"

# dataset name -> contract schema file
DATASETS = {
    "investigations": "Investigation",
    "rank": "RankItem",
    "claims": "Claim",
    "sources": "Source",
    "habitats": "HabitatPreset",
}


@pytest.mark.parametrize("name", sorted(DATASETS))
def test_fixture_matches_schema(name):
    doc = json.loads((FIXTURES / f"{name}.fixture.json").read_text(encoding="utf-8"))
    assert doc["fixture"] is True
    assert doc["items"], "fixture must not be empty"
    validator = Draft202012Validator(json.loads((SCHEMAS / f"{DATASETS[name]}.json").read_text(encoding="utf-8")))
    for item in doc["items"]:
        validator.validate(item)
