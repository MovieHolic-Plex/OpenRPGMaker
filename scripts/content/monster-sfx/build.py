#!/usr/bin/env python3
"""Pick the best passing patch per sound, render masters, encode OGG, write the manifest.

  build.py select            rank every patches/<id>/c*.patch.json, copy winners to final/
  build.py render            render final/*.json -> public/assets/monster-sfx/*.ogg + manifest.json
                             (also writes WAV masters to $MONSTER_SFX_WAV_DIR when set, for the listening page)

Reference files (RTP sounds being replaced, and comparison-only reference renders) are read from
$MONSTER_SFX_REF_DIR (default ~/claude-viz/battle-sfx-gba) and are never copied into the repository.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import qa  # noqa: E402
import synth  # noqa: E402
from argon_author import leveled  # noqa: E402
from briefs import BRIEFS  # noqa: E402

PATCHES = HERE / "patches"
FINAL = HERE / "final"
OUT = ROOT / "public" / "assets" / "monster-sfx"
REF_DIR = Path(os.environ.get("MONSTER_SFX_REF_DIR", str(Path.home() / "claude-viz" / "battle-sfx-gba")))
OGG_QUALITY = "5"


ONLY_SET = int(os.environ["SFX_SET"]) if os.environ.get("SFX_SET") else None


def ids_in_scope() -> list[str]:
    """SFX_SET=2 limits select/render to the second batch (briefs with "set": 2); unset = the first batch + everything."""
    if ONLY_SET is None:
        return [i for i, b in BRIEFS.items() if b.get("set", 1) == 1]
    return [i for i, b in BRIEFS.items() if b.get("set", 1) == ONLY_SET]


def expect_for(b: dict) -> dict:
    return {"dur": b["dur"], "max_trail_ms": b.get("max_trail", 60), "centroid": b["centroid"]}


def ref_metrics(name: str | None):
    if not name:
        return None, None
    p = REF_DIR / f"{name}.wav"
    if not p.exists():
        return None, None
    y, sr, meta = qa.read_wav(p)
    return qa.analyze(y, sr, meta), (y, sr)


def max_xcorr(a: np.ndarray, sra: int, b: np.ndarray, srb: int) -> float:
    """Peak normalised cross-correlation between two sounds at 11.025 kHz: an originality guard
    (an independent synthesis never gets near 1.0; a copy would)."""
    from scipy.signal import resample_poly, fftconvolve
    def prep(y, sr):
        y = resample_poly(y, 11025, sr)
        return (y - y.mean()) / (np.linalg.norm(y - y.mean()) or 1.0)
    pa, pb = prep(a, sra), prep(b, srb)
    return float(np.max(np.abs(fftconvolve(pa, pb[::-1], mode="full"))))


def score(sound_id: str):
    b = BRIEFS[sound_id]
    ref_m, ref_wav = ref_metrics(b["ref"])
    rows = []
    for pf in sorted((PATCHES / sound_id).glob("c*.patch.json")):
        patch = json.loads(pf.read_text())
        try:
            y = leveled(synth.render(patch), b["rms"])
        except synth.PatchError:
            continue
        m = qa.analyze(y, synth.SR)
        problems = qa.gate(m, expect_for(b))
        notes = qa.advice(m, expect_for(b))
        xc = max_xcorr(y, synth.SR, *ref_wav) if ref_wav else 0.0
        if xc > 0.55:
            problems.append(f"too similar to the comparison reference (xcorr {xc:.2f})")
        s = (qa.coarse_distance(m, ref_m) if ref_m else 0.0) + 0.6 * len(notes)
        if not ref_m:
            lo, hi = b["centroid"]
            s += abs(np.log2(max(m["centroid_hz"], 50) / np.sqrt(lo * hi))) * 0.5
        rows.append({"cand": pf.name.split(".")[0], "file": pf, "metrics": m, "problems": problems, "notes": notes, "xcorr": round(xc, 3), "score": round(s, 3)})
    return rows


def cmd_select() -> None:
    FINAL.mkdir(exist_ok=True)
    report = {}
    for sid in ids_in_scope():
        rows = score(sid)
        ok = [r for r in rows if not r["problems"]]
        ok.sort(key=lambda r: r["score"])
        report[sid] = {"candidates": len(rows), "passed": len(ok), "ranked": [(r["cand"], r["score"], r["notes"]) for r in ok]}
        if not ok:
            print(f"{sid}: NO PASSING CANDIDATE ({len(rows)} tried)")
            continue
        win = ok[0]
        shutil.copy(win["file"], FINAL / f"{sid}.json")
        run = json.loads((PATCHES / sid / f"{win['cand']}.run.json").read_text())
        run.pop("metrics", None)
        (FINAL / f"{sid}.run.json").write_text(json.dumps(run, indent=1, ensure_ascii=False))
        print(f"{sid}: {len(ok)}/{len(rows)} pass -> {win['cand']} score {win['score']} {win['notes']}")
    (HERE / f"select-report{ONLY_SET or ''}.json").write_text(json.dumps(report, indent=1, ensure_ascii=False))


def encode_ogg(wav: Path, ogg: Path) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "libvorbis", "-q:a", OGG_QUALITY, "-ar", "44100", "-ac", "1",
                    "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", str(ogg)], check=True)


def decode_ogg(ogg: Path, wav: Path) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(ogg), "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", str(wav)], check=True)


def cmd_render() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    wav_dir = Path(os.environ["MONSTER_SFX_WAV_DIR"]) if os.environ.get("MONSTER_SFX_WAV_DIR") else None
    if wav_dir:
        wav_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / "manifest.json"
    existing = json.loads(manifest_path.read_text()) if manifest_path.exists() else None
    manifest = existing if existing else {
        "format": 1,
        "license": "CC0-1.0",
        "originality": "Synthesised from numeric patches (pulse/triangle/wave/LFSR-noise oscillators and envelopes). No recording, sample, "
                       "soundfont, MIDI or melody from any game is used; reference renders were only compared in listening/analysis and nothing "
                       "derived from them is shipped.",
        "authoring": {"model": "gemini-4-argon-high", "role": "wrote the synthesiser patches (JSON); it generated no audio"},
        "synth": "scripts/content/monster-sfx/synth.py",
        "sampleRate": 44100, "channels": 1, "codec": f"vorbis q{OGG_QUALITY}",
        "sounds": {},
    }
    for sid in ids_in_scope():
        b = BRIEFS[sid]
        pf = FINAL / f"{sid}.json"
        if not pf.exists():
            continue
        patch = json.loads(pf.read_text())
        y = leveled(synth.render(patch), b["rms"])
        with tempfile.TemporaryDirectory() as td:
            wav = Path(td) / f"{sid}.wav"
            synth.write_wav(wav, y)
            ogg = OUT / f"{sid}.ogg"
            encode_ogg(wav, ogg)
            dec = Path(td) / "dec.wav"
            decode_ogg(ogg, dec)
            yd, sr, meta = qa.read_wav(dec)
            m = qa.analyze(yd, sr, meta)          # gate runs on what the player will actually decode
            if wav_dir:
                shutil.copy(wav, wav_dir / f"{sid}.wav")
        problems = qa.gate(m, {**expect_for(b), "max_lead_ms": 12, "max_first_sample": 0.02})
        run = json.loads((FINAL / f"{sid}.run.json").read_text()) if (FINAL / f"{sid}.run.json").exists() else {}
        manifest["sounds"][sid] = {
            "file": f"{sid}.ogg", "title": b["title"], "bytes": ogg.stat().st_size,
            "sha256": hashlib.sha256(ogg.read_bytes()).hexdigest(),
            "durationSeconds": m["duration_s"], "peakDbfs": m["peak_dbfs"], "rmsDbfs": m["rms_active_dbfs"],
            "dcOffset": m["dc_offset"], "leadSilenceMs": m["lead_silence_ms"], "trailSilenceMs": m["trail_silence_ms"],
            "clippedSamples": m["clipped_samples"], "centroidHz": m["centroid_hz"],
            "gate": "pass" if not problems else problems,
            "replaces": b["old"], "model": run.get("model", "gemini-4-argon-high"), "promptSha256_16": run.get("prompt_sha256_16"),
            "patch": patch,
        }
        print(f"{sid}: {ogg.stat().st_size} B  {m['duration_s']}s  pk {m['peak_dbfs']}  rms {m['rms_active_dbfs']}  gate {'pass' if not problems else problems}")
    manifest_path.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    {"select": cmd_select, "render": cmd_render}[sys.argv[1]]()
