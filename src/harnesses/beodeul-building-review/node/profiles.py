"""Per-tileset settings of the building review (profiles.json). Not signed: the visual gate does not read it."""
import json, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
FILE = Path(os.environ.get('BUILDING_REVIEW_PROFILES') or ROOT / 'src/harnesses/beodeul-building-review/profiles.json')  # env override: tests
DEFAULT = 'beodeul'


def all_profiles():
    return json.loads(FILE.read_text())['profiles']


def load_profile(profile_id=None):
    """The profile dict plus `data` (resolved data dir; the profile's env var overrides dataDir)."""
    profile_id = profile_id or os.environ.get('BUILDING_REVIEW_PROFILE') or DEFAULT
    found = next((p for p in all_profiles() if p['id'] == profile_id), None)
    if found is None:
        raise SystemExit(f'unknown profile {profile_id!r}; known: {[p["id"] for p in all_profiles()]}')
    data = os.environ.get(found.get('dataEnv', '')) or found['dataDir']
    return {**found, 'data': Path(data).expanduser()}
