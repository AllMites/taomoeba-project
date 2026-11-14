"""PSI (NASA Physical Sciences Informatics) fetch layer: polite, sequential, cached on disk.

Cache lives in data/raw/ (gitignored). A rerun with a warm cache makes no network calls.
Only "Experimental table" files under 20 MB are ever downloaded.
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://psi.nasa.gov/geode-py/ws"
RAW = Path(__file__).resolve().parents[2] / "data" / "raw"
MAX_BYTES = 20 * 1024 * 1024
SLEEP = 0.4
# Combustion search returns 24 combustion + these two non-combustion records.
EXTRA_IDS = ["PSI-20", "PSI-22", "PSI-47"]  # fetched by id if the search ever misses them


def _http(url, data=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": "flame-in-freefall-ingest"})
    if data is not None:
        req.add_header("Content-Type", "application/json")
    time.sleep(SLEEP)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def _cached_json(path, fetch):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    out = fetch()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out), encoding="utf-8")
    return out


def search():
    """All PSI investigation records matching 'combustion' (plus EXTRA_IDS if missing)."""
    def go():
        url = f"{BASE}/repo/search?term=combustion&source=psi&type=investigation&size=100"
        return json.loads(_http(url))
    hits = _cached_json(RAW / "search.json", go)["hits"]["hits"]
    return [h["_source"] for h in hits]


def search_by_id(psi_id):
    def go():
        url = f"{BASE}/repo/search?term={psi_id}&source=psi&type=investigation"
        return json.loads(_http(url))
    hits = _cached_json(RAW / psi_id / "search_by_id.json", go)["hits"]["hits"]
    return next((h["_source"] for h in hits if h["_source"].get("Accession") == psi_id), None)


def _post_files(psi_id, version):
    body = json.dumps({"folder": f"psi-data/{psi_id}/", "fileType": "study",
                       "studyId": psi_id, "version": version}).encode()
    return json.loads(_http(f"{BASE}/files/v2", body))


def file_tree(psi_id):
    """File list of the newest study version (probe 1, 2, 3 ... until 'Study Version not found')."""
    def go():
        best, v = None, 1
        while v < 40:
            try:
                out = _post_files(psi_id, v)
            except urllib.error.HTTPError:
                break
            if "files" not in out:
                break
            best, v = {"version": v, "tree": out}, v + 1
        return best
    return _cached_json(RAW / psi_id / "filelist.json", go)


def walk(node):
    """Yield every leaf file dict in a file tree."""
    for f in node.get("files", []):
        if f.get("files"):
            yield from walk(f)
        else:
            yield f


def tables_of(psi_id):
    """(name, file_version, size) of small 'Experimental table' files; dedupe by name."""
    seen = {}
    for f in walk(file_tree(psi_id)["tree"]):
        if f.get("sortingCategory") != "Experimental table":
            continue
        if float(f.get("bytes_size") or 0) > MAX_BYTES:
            continue
        name = f["key"].split("/", 2)[-1]
        seen[name] = (name, f["version"], int(float(f["bytes_size"])))
    return sorted(seen.values())


def download_table(psi_id, name, version):
    """Path of the cached table; fetches via presigned URL on a cold cache."""
    dest = RAW / psi_id / "tables" / Path(name).name
    if dest.exists():
        return dest
    q = urllib.parse.urlencode({"file": Path(name).name, "version": version, "redirect": "false"})
    url = _http(f"{BASE}/studies/{psi_id}/download?{q}").decode().strip().strip('"')
    blob = _http(url)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(blob)
    return dest
