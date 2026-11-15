"""The research graph file: every link valid and explained, every experiment present, no paper text stored."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
G = json.loads((ROOT / "public" / "data" / "graph.json").read_text(encoding="utf-8"))
TYPES = {"reports_on", "mentions", "follow_up", "builds_on", "same_hardware", "psi_related", "same_event", "area"}


def test_links_join_known_dots_and_say_why():
    ids = {n["id"] for n in G["nodes"]}
    for e in G["edges"]:
        assert e["s"] in ids and e["t"] in ids
        assert e["type"] in TYPES
        assert len(e["why"]) > 5


def test_every_experiment_is_a_dot():
    invs = json.loads((ROOT / "public" / "data" / "investigations.json").read_text(encoding="utf-8"))
    invs = invs["items"] if isinstance(invs, dict) else invs
    have = {n["id"] for n in G["nodes"] if n["kind"] == "experiment"}
    assert have == {i["id"] for i in invs}


def test_no_source_text_in_the_file():
    assert '"text"' not in json.dumps(G)


def test_positions_fit_the_drawing():
    for n in G["nodes"]:
        assert -500 <= n["x"] <= 500 and -500 <= n["y"] <= 500
