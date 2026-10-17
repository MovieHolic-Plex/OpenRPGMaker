#!/usr/bin/env python3
"""Ask the text model "Argon" to write synthesiser patches for the briefs in briefs.py.

The model never produces audio: it writes JSON patches (synth.py vocabulary) and
this script validates, renders and auto-checks each one, feeding failures back
for up to two repairs.  Patches and the run log go under patches/<id>/.

Endpoint: an OpenAI-compatible proxy that only answers streaming requests.
The key is read from the OPRN_LIVE_KEY environment variable only and is never
written to disk or logs.   Only `gemini-4-argon*` models are allowed.

  OPRN_LIVE_KEY=... argon_author.py --ids ui-cursor,ui-confirm --cands 4
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import qa  # noqa: E402
import synth  # noqa: E402
from briefs import BRIEFS  # noqa: E402

ENDPOINT = os.environ.get("ARGON_ENDPOINT", "http://127.0.0.1:8318/v1/chat/completions")
MODEL = os.environ.get("ARGON_MODEL", "gemini-4-argon-high")
PATCH_DIR = HERE / "patches"

SYSTEM = """You are a sound designer for a handheld creature-collecting RPG. You write SYNTHESISER PATCHES as JSON.
You do not make audio; a deterministic renderer turns your JSON into a mono 44.1 kHz WAV. Think in the language of a
4-channel handheld sound chip: two PULSE channels (duty 0.125 / 0.25 / 0.5 / 0.75 only), one TRIANGLE (or a 32-entry
4-bit WAVE table) and one NOISE register (7-bit = metallic/tonal hiss, 15-bit = white-ish hiss). Everything must be
ORIGINAL: invent your own tune and timbre; never reproduce a known game's melody or sound.

Patch format (strict; unknown keys are errors):
{
  "id": "<given id>",
  "duration": <total seconds incl. tail, 0.03..6>,
  "seed": <int>,                      // noise register seed
  "voices": [                         // 1..6 voices, 160 notes max in total
    {
      "wave": "pulse" | "triangle" | "noise" | "wave",
      "duty": 0.125|0.25|0.5|0.75,    // pulse only (voice default; a note may override or give [[t,duty],...] to switch)
      "gain": 0..1.5,                 // voice level in the mix
      "env": {"a":sec,"d":sec,"s":0..1,"r":sec,"curve":"exp"|"lin"},   // default envelope for notes; or [[t,level],...]
      "vibrato": {"rate_hz":6,"depth_semitones":0.2,"delay":0.05},      // optional, not for noise
      "tremolo": {"rate_hz":8,"depth":0.3},                             // optional
      "lowpass_hz": n, "highpass_hz": n,                                // optional per-voice filters
      "lfsr": 7|15,                   // noise only
      "steps": 4..64,                 // triangle only: amplitude quantisation (32 = authentic)
      "table": [32 ints 0..15],       // wave only
      "amp_steps": 4..16,             // optional: quantise volume like a 4-bit chip
      "notes": [
        {"t": start_sec, "dur": hold_sec,
         "pitch": "C5" | 440 | [[0,"G5"],[0.05,"C5"]],   // pulse/triangle/wave: note name, Hz, or pitch curve (times relative to the note start, interpolated exponentially)
         "clock": 20000 | [[0,60000],[0.1,8000]],        // noise only: register clock in Hz (2000..2000000; higher = brighter hiss)
         "vel": 0..1, "gain": 0..1.5,
         "env": {...},                                    // optional per-note override
         "arp": {"steps":[0,4,7], "rate_hz":50}           // optional fast arpeggio: semitone offsets cycled at rate_hz
        }
      ]
    }
  ],
  "post": {"lowpass_hz": n, "highpass_hz": n, "echo": {"delay":0.02..0.4,"feedback":0..0.6,"mix":0..0.6}}   // optional
}
Envelope: attack a, decay d falls to sustain s (use s=0 for blips), the note is held for `dur`, then release r.
Total time = t + dur + r must stay within "duration" (anything beyond is cut with a 4 ms fade).

Craft rules that matter:
- Start at t=0 with an immediate attack (a <= 0.003) - no leading silence. End decayed to silence before `duration`.
- Impacts: layer a fast noise burst (clock sweeping down, e.g. 60000 -> 6000 Hz over 30-120 ms) with a low pulse/triangle thump whose pitch
  falls quickly (e.g. 180 Hz -> 45 Hz). Use 7-bit noise for a tight 'tick', 15-bit for 'whoosh'.
- Pitch curves and arpeggios give chip character; keep note counts modest. Jingles: a clear lead (pulse 0.25/0.5), a supporting second pulse
  (0.125 for sparkle), a triangle bass. Vibrato only on long notes.
- Do not exceed the duration window given in the brief. Output ONLY the JSON object. No markdown fences, no commentary."""


def read_key() -> str:
    key = os.environ.get("OPRN_LIVE_KEY", "").strip()
    if not key:
        sys.exit("OPRN_LIVE_KEY is not set (export OPRN_LIVE_KEY=$(cat ~/.config/oprn/live-key))")
    return key


def call_model(messages: list[dict], key: str, tries: int = 8) -> str:
    if not re.match(r"^gemini-4-argon", MODEL):
        sys.exit(f"refusing to call model {MODEL!r}: only gemini-4-argon* is allowed on this endpoint")
    body = json.dumps({"model": MODEL, "stream": True, "messages": messages, "max_tokens": 16000, "temperature": 1.0}).encode()
    delay = 15.0
    for attempt in range(tries):
        req = urllib.request.Request(ENDPOINT, data=body, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            out = []
            with urllib.request.urlopen(req, timeout=300) as r:
                for raw in r:
                    line = raw.decode("utf-8", "replace").strip()
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        j = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    for c in j.get("choices", []):
                        out.append(c.get("delta", {}).get("content") or "")
            text = "".join(out)
            if text.strip():
                return text
            raise RuntimeError("empty response")
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504):
                raise
        except (urllib.error.URLError, TimeoutError, RuntimeError, ConnectionError):
            pass
        time.sleep(delay + (attempt * 3))
        delay = min(delay * 1.5, 90)
    raise RuntimeError("model unavailable after retries")


def extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.S)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("no JSON object in reply")
    return json.loads(text[start : end + 1])


def render_checked(patch: dict, brief: dict) -> tuple[list[str], dict | None]:
    """Render + level + gate. Returns (problems, metrics)."""
    try:
        y = synth.render(patch)
    except synth.PatchError as e:
        return [f"patch error: {e}"], None
    y = leveled(y, brief["rms"])
    metrics = qa.analyze(y, synth.SR)
    expect = {"dur": brief["dur"], "max_trail_ms": brief.get("max_trail", 60), "centroid": brief["centroid"]}
    return qa.gate(metrics, expect), metrics


def leveled(y, rms_target_db: float):
    import numpy as np
    fr = qa.frame_rms_db(y, synth.SR)
    act = np.where(fr > qa.SILENCE_DB)[0]
    if len(act):
        a0, a1 = int(act[0] * 5 * synth.SR / 1000), int((act[-1] + 1) * 5 * synth.SR / 1000)
        seg = y[a0:a1]
    else:
        seg = y
    rms = float(np.sqrt(np.mean(seg ** 2))) or 1e-9
    y = y * (10 ** (rms_target_db / 20) / rms)
    peak = float(np.max(np.abs(y))) or 1.0
    ceiling = 10 ** (-1.5 / 20)
    if peak > ceiling:
        y = y * (ceiling / peak)
    return y


ANGLES = [
    "Go for the most economical, characterful version.",
    "Go for a slightly richer version with one extra layer for body.",
    "Try an unexpected but tasteful timbre choice (different duty cycles / noise register).",
    "Make it the most polished, 'finished game' version you can within the duration window.",
    "Take a playful approach.",
    "Take a cleaner, more minimal approach.",
]


def author_one(sound_id: str, cand: int, key: str, log_dir: Path) -> dict:
    brief = BRIEFS[sound_id]
    lo, hi = brief["dur"]
    user = (
        f"Sound id: {sound_id}  ({brief['title']})\n"
        f"Brief: {brief['brief']}\n"
        f"Hard duration window for the rendered file: {lo}..{hi} s (set \"duration\" inside it; trailing silence must stay short).\n"
        f"Target brightness: spectral centroid roughly {brief['centroid'][0]}..{brief['centroid'][1]} Hz.\n"
        f"Candidate #{cand + 1}. {ANGLES[cand % len(ANGLES)]} Set \"id\": \"{sound_id}\" and \"seed\": {1000 * (cand + 1) + len(sound_id)}."
    )
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]
    prompt_hash = hashlib.sha256((SYSTEM + user).encode()).hexdigest()[:16]
    attempts = []
    patch: dict | None = None
    metrics = None
    problems: list[str] = ["not started"]
    for round_no in range(3):
        try:
            reply = call_model(messages, key)
        except Exception as e:  # noqa: BLE001
            attempts.append({"round": round_no, "error": str(e)[:200]})
            break
        try:
            patch = extract_json(reply)
            problems, metrics = render_checked(patch, brief)
        except Exception as e:  # noqa: BLE001
            patch, metrics, problems = None, None, [f"unreadable reply: {e}"]
        attempts.append({"round": round_no, "problems": problems})
        if not problems:
            break
        messages.append({"role": "assistant", "content": reply})
        messages.append({"role": "user", "content": "The renderer or checker rejected this patch:\n- " + "\n- ".join(problems) + "\nFix exactly these problems and return the full corrected JSON only."})
    record = {"id": sound_id, "cand": cand, "model": MODEL, "prompt_sha256_16": prompt_hash, "attempts": attempts,
              "passed_gate": patch is not None and not problems, "metrics": metrics}
    out = log_dir / f"{sound_id}"
    out.mkdir(parents=True, exist_ok=True)
    if patch is not None:
        (out / f"c{cand}.patch.json").write_text(json.dumps(patch, indent=1, ensure_ascii=False))
    (out / f"c{cand}.run.json").write_text(json.dumps(record, indent=1, ensure_ascii=False))
    return record


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", default=",".join(BRIEFS))
    ap.add_argument("--cands", type=int, default=4)
    ap.add_argument("--start", type=int, default=0, help="first candidate index (to add more later)")
    ap.add_argument("--workers", type=int, default=3)
    args = ap.parse_args()
    key = read_key()
    jobs = [(i, c) for i in args.ids.split(",") for c in range(args.start, args.start + args.cands)]
    done = 0
    with cf.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(author_one, i, c, key, PATCH_DIR): (i, c) for i, c in jobs}
        for f in cf.as_completed(futs):
            i, c = futs[f]
            done += 1
            try:
                r = f.result()
                print(f"[{done}/{len(jobs)}] {i} c{c}: {'PASS' if r['passed_gate'] else 'fail'} {r['attempts'][-1] if r['attempts'] else ''}", flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"[{done}/{len(jobs)}] {i} c{c}: ERROR {e}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
