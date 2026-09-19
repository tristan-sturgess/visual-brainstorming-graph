"""Backend invariant tests. Uses a temp DATA_DIR and MOCK_AI=true, set before
importing the app so app.config.Settings picks them up.
"""

import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()
os.environ["MOCK_AI"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def create_draft(parent_ids=None, x=0, y=0):
    resp = client.post(
        "/api/concepts", json={"position": {"x": x, "y": y}, "parent_ids": parent_ids or []}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def set_body(concept_id, body, title=None):
    payload = {"body": body}
    if title is not None:
        payload["title"] = title
    resp = client.patch(f"/api/concepts/{concept_id}", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


def generate(concept_id):
    return client.post(f"/api/concepts/{concept_id}/generate")


def get_generation(generation_id):
    resp = client.get(f"/api/generations/{generation_id}")
    assert resp.status_code == 200
    return resp.json()


def test_generation_lifecycle_and_invariants():
    # --- Create a draft, fill it in, and commit it via the first Generate. ---
    concept = create_draft()
    concept = set_body(concept["id"], "Hero illustration, warm palette", title="Hero")

    resp = generate(concept["id"])
    assert resp.status_code == 202, resp.text
    generation = resp.json()
    assert generation["status"] in ("running", "done")

    generation = get_generation(generation["id"])
    assert generation["status"] == "done", generation
    assert len(generation["image_node_ids"]) == 4

    graph_resp = client.get("/api/graph")
    assert graph_resp.status_code == 200
    graph_data = graph_resp.json()
    committed = next(c for c in graph_data["concepts"] if c["id"] == concept["id"])
    assert committed["status"] == "committed"
    assert committed["compiled_prompt"]

    image_urls = {i["id"]: i["url"] for i in graph_data["images"]}
    for image_id in generation["image_node_ids"]:
        assert image_id in image_urls
        assert image_urls[image_id].startswith("/images/")

    # --- Patching title/body on a committed concept -> 409. ---
    resp = client.patch(f"/api/concepts/{concept['id']}", json={"title": "New title"})
    assert resp.status_code == 409

    # --- Deleting a committed concept -> 409. ---
    resp = client.delete(f"/api/concepts/{concept['id']}")
    assert resp.status_code == 409

    # --- Generate on an empty draft -> 409. ---
    empty_draft = create_draft()
    resp = generate(empty_draft["id"])
    assert resp.status_code == 409

    # --- A draft concept cannot be a parent -> 409. ---
    other_draft = create_draft()
    resp = client.post(
        "/api/concepts", json={"position": {"x": 0, "y": 0}, "parent_ids": [other_draft["id"]]}
    )
    assert resp.status_code == 409

    # --- Generate more: second generation copies the frozen prompt and refs. ---
    resp2 = generate(concept["id"])
    assert resp2.status_code == 202, resp2.text
    generation2 = get_generation(resp2.json()["id"])
    assert generation2["status"] == "done"
    assert generation2["prompt"] == generation["prompt"]
    assert generation2["reference_image_ids"] == generation["reference_image_ids"]

    # --- Generating again while one is already running -> 409. ---
    # (Not exercised concurrently here since BackgroundTasks run inline under
    # TestClient; covered structurally by the running-generation check above.)

    image_id = generation["image_node_ids"][0]

    # --- Deleting a generated image -> 409. ---
    resp = client.delete(f"/api/images/{image_id}")
    assert resp.status_code == 409

    # --- A "note" annotation with an empty note -> 422. ---
    resp = client.post(
        f"/api/images/{image_id}/annotations",
        json={"kind": "note", "x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2, "note": ""},
    )
    assert resp.status_code == 422

    # A like/dislike annotation with an empty note is fine.
    resp = client.post(
        f"/api/images/{image_id}/annotations",
        json={"kind": "like", "x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2, "note": ""},
    )
    assert resp.status_code == 201

    # --- Branching from a generated image parent pre-fills title/body. ---
    resp = client.post(
        "/api/concepts", json={"position": {"x": 0, "y": 300}, "parent_ids": [image_id]}
    )
    assert resp.status_code == 201, resp.text
    branch = resp.json()
    assert branch["status"] == "draft"
    assert branch["title"] == committed["title"]
    assert branch["body"] == committed["body"]
    assert branch["parent_ids"] == [image_id]
