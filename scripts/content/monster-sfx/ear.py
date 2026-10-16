#!/usr/bin/env python3
"""Listening check through the agy CLI (a multimodal model hears the attached WAV files).

  ear.py new   <wav-dir> <out.json>     score the shipped candidates (alone, plus next to the comparison reference when one exists)
  ear.py old   <out.json>               score the sounds being replaced (RTP) with the same question

Only the attached audio is heard; a single call is noisy (about +-2), so every file is scored several
times and the mean is reported.  The model is asked about *role fit and cleanliness*, never about
copying a reference.  If the listener is unavailable this script exits non-zero and nothing is claimed.
"""
from __future__ import annotations

import concurrent.futures as cf
import json
import os
import shutil
import statistics
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from briefs import BRIEFS  # noqa: E402

ROOT = HERE.parents[2]
RTP = ROOT / "public" / "assets" / "easyrpg" / "sound"
REF_DIR = Path(os.environ.get("MONSTER_SFX_REF_DIR", str(Path.home() / "claude-viz" / "battle-sfx-gba")))
MODEL = os.environ.get("EAR_MODEL", "Gemini 4 Argon (High)")
RTP_FILE = {"ui-cursor": "Cursor1.wav", "ui-confirm": "Decision1.wav", "ui-cancel": "Cancel1.wav", "ui-error": "Buzzer1.wav",
            "hit-weak": "Damage2.wav", "hit-normal": "Damage2.wav", "hit-super": "Damage2.wav", "faint": "Collapse2.wav"}
SCHEMA = {"type": "object", "properties": {
    "fit": {"type": "integer", "description": "0-10: how well it works as the named sound in a retro creature-battle RPG"},
    "clean": {"type": "integer", "description": "0-10: free of clicks, pops, harshness, aliasing hiss"},
    "issues": {"type": "string", "description": "one short sentence, or 'none'"}},
    "required": ["fit", "clean", "issues"]}


def ask(wav: Path, title: str, brief: str, tmp: Path, extra: Path | None = None) -> dict | None:
    schema = tmp / "schema.json"
    schema.write_text(json.dumps(SCHEMA))
    names = [wav.name] + ([extra.name] if extra else [])
    atts = " ".join(f"@{n}" for n in names)
    ref_note = (f" The second attachment ({extra.name}) is only a loudness/length/character yardstick from a different game; do not rate it." if extra else "")
    prompt = (f"{atts} Listen to the first attached sound effect ({wav.name}). It is meant to be: {title} - {brief}.{ref_note} "
              "Rate it on fit (0-10), clean (0-10) and give one short issues sentence. Answer JSON.")
    cmd = ["agy", "--model", MODEL, "--output-format", "json", "--json-schema", str(schema), "-p", prompt]
    try:
        r = subprocess.run(cmd, cwd=tmp, capture_output=True, text=True, timeout=240)
        j = json.loads(r.stdout.strip().splitlines()[-1])
        return j.get("structured_output") if j.get("status") == "SUCCESS" else None
    except Exception:  # noqa: BLE001
        return None


def job(sid: str, wav: Path, extra: Path | None, runs: int) -> dict:
    b = BRIEFS[sid]
    results = []
    for _ in range(runs):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            shutil.copy(wav, tmp / wav.name)
            if extra:
                shutil.copy(extra, tmp / extra.name)
            res = ask(tmp / wav.name, b["title"], b["brief"], tmp, (tmp / extra.name) if extra else None)
        if res:
            results.append(res)
    if not results:
        return {"id": sid, "ok": False}
    return {"id": sid, "ok": True, "n": len(results), "fit": round(statistics.mean(r["fit"] for r in results), 1),
            "clean": round(statistics.mean(r["clean"] for r in results), 1), "issues": [r["issues"] for r in results]}


def main(argv: list[str]) -> int:
    if len(argv) < 3 or argv[1] not in ("new", "old"):
        print(__doc__)
        return 2
    mode = argv[1]
    jobs = []
    if mode == "new":
        wav_dir, out = Path(argv[2]), Path(argv[3])
        only = set(argv[4].split(",")) if len(argv) > 4 else set(BRIEFS)
        for sid, b in BRIEFS.items():
            if sid not in only:
                continue
            ref = REF_DIR / f"{b['ref']}.wav" if b["ref"] else None
            jobs.append((sid, wav_dir / f"{sid}.wav", ref if ref and ref.exists() else None, 3))
    else:
        out = Path(argv[2])
        seen = set()
        for sid, name in RTP_FILE.items():
            if name in seen:
                continue
            seen.add(name)
            jobs.append((sid, RTP / name, None, 2))
    results = {}
    with cf.ThreadPoolExecutor(max_workers=3) as pool:
        futs = {pool.submit(job, *j): j[0] for j in jobs}
        for f in cf.as_completed(futs):
            r = f.result()
            results[r["id"]] = r
            print(r, flush=True)
    out.write_text(json.dumps({"model": MODEL, "results": results}, indent=1, ensure_ascii=False))
    return 0 if any(r["ok"] for r in results.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
