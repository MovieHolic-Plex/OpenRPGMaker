#!/usr/bin/env python3
"""JRPG 퍼즐 방 효과음 세트 — 원본 칩튠 합성(CC0).

몬스터 효과음과 같은 합성기(`scripts/content/monster-sfx/synth.py`: 펄스·삼각·LFSR 잡음 + 엔벨로프)로 아래 패치를 렌더한다.
녹음·샘플·원작 멜로디는 쓰지 않았다. 해결 징글은 장7화음을 위로 쌓는 자체 음형이다.

  python3 scripts/content/puzzle-sfx/build.py            # public/assets/puzzle-sfx/*.ogg + manifest.json
  PUZZLE_SFX_WAV_DIR=/tmp/x python3 ...build.py           # 검수용 WAV 도 남긴다

id 는 src/assets/puzzleSfxAssets.ts 의 PUZZLE_SFX_CUES 와 같아야 한다.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "content" / "monster-sfx"))
import synth  # noqa: E402

OUT = ROOT / "public" / "assets" / "puzzle-sfx"
ENV_HIT = {"a": 0.001, "d": 0.06, "s": 0.0, "r": 0.01, "curve": "exp"}


def organ(pitch: str, sub: str) -> dict:
    """오르간 발판 음 — 같은 음색, 음높이만 다르다(따라 치기 기억 퍼즐은 귀로도 구별돼야 한다)."""
    env = {"a": 0.012, "d": 0.12, "s": 0.55, "r": 0.16, "curve": "exp"}
    return {
        "duration": 0.62,
        "seed": 701,
        "voices": [
            {"wave": "pulse", "duty": 0.5, "gain": 0.55, "amp_steps": 16, "env": env, "vibrato": {"rate_hz": 5.5, "depth_semitones": 0.08, "delay": 0.12},
             "notes": [{"t": 0.0, "dur": 0.42, "pitch": pitch, "vel": 1.0}]},
            {"wave": "pulse", "duty": 0.125, "gain": 0.28, "amp_steps": 16, "env": env,
             "notes": [{"t": 0.0, "dur": 0.42, "pitch": sub, "vel": 0.9}]},
            {"wave": "triangle", "steps": 32, "gain": 0.6, "env": env,
             "notes": [{"t": 0.0, "dur": 0.42, "pitch": pitch, "vel": 0.8}]},
        ],
        "post": {"highpass_hz": 80, "lowpass_hz": 7000, "echo": {"delay": 0.11, "feedback": 0.25, "mix": 0.22}},
    }


PATCHES: dict[str, dict] = {
    # 비밀이 풀린 순간 — 장7화음을 빠르게 올라가 높은 으뜸음에서 반짝이며 머문다(약 1.2초).
    "secret-solved": {
        "duration": 1.25,
        "seed": 4242,
        "voices": [
            {"wave": "pulse", "duty": 0.25, "gain": 0.8, "amp_steps": 16,
             "env": {"a": 0.002, "d": 0.07, "s": 0.55, "r": 0.03, "curve": "exp"},
             "vibrato": {"rate_hz": 6.0, "depth_semitones": 0.18, "delay": 0.12},
             "notes": [
                 {"t": 0.00, "dur": 0.075, "pitch": "A4", "vel": 0.8},
                 {"t": 0.08, "dur": 0.075, "pitch": "C#5", "vel": 0.85},
                 {"t": 0.16, "dur": 0.075, "pitch": "E5", "vel": 0.9},
                 {"t": 0.24, "dur": 0.075, "pitch": "G#5", "vel": 0.95},
                 {"t": 0.32, "dur": 0.075, "pitch": "B5", "vel": 0.95},
                 {"t": 0.40, "dur": 0.075, "pitch": "E6", "vel": 1.0},
                 {"t": 0.48, "dur": 0.62, "pitch": "A6", "vel": 1.0, "duty": [[0.0, 0.25], [0.2, 0.5]],
                  "env": {"a": 0.002, "d": 0.4, "s": 0.35, "r": 0.2, "curve": "exp"}},
             ]},
            {"wave": "pulse", "duty": 0.125, "gain": 0.34, "amp_steps": 16,
             "env": {"a": 0.002, "d": 0.06, "s": 0.4, "r": 0.03, "curve": "exp"},
             "notes": [
                 {"t": 0.04, "dur": 0.07, "pitch": "E5", "vel": 0.7},
                 {"t": 0.12, "dur": 0.07, "pitch": "A5", "vel": 0.75},
                 {"t": 0.20, "dur": 0.07, "pitch": "C#6", "vel": 0.8},
                 {"t": 0.28, "dur": 0.07, "pitch": "E6", "vel": 0.8},
                 {"t": 0.36, "dur": 0.07, "pitch": "G#6", "vel": 0.8},
                 {"t": 0.48, "dur": 0.55, "pitch": "C#6", "vel": 0.85, "arp": {"steps": [0, 3, 7, 12], "rate_hz": 40},
                  "env": {"a": 0.002, "d": 0.45, "s": 0.15, "r": 0.2, "curve": "exp"}},
             ]},
            {"wave": "triangle", "steps": 32, "gain": 0.38,
             "env": {"a": 0.002, "d": 0.1, "s": 0.6, "r": 0.04, "curve": "lin"},
             "notes": [
                 {"t": 0.0, "dur": 0.15, "pitch": "A3", "vel": 0.9},
                 {"t": 0.16, "dur": 0.15, "pitch": "E4", "vel": 0.9},
                 {"t": 0.32, "dur": 0.15, "pitch": "C#4", "vel": 0.9},
                 {"t": 0.48, "dur": 0.55, "pitch": "A3", "vel": 1.0, "env": {"a": 0.002, "d": 0.4, "s": 0.3, "r": 0.2, "curve": "exp"}},
             ]},
            {"wave": "noise", "lfsr": 7, "gain": 0.16, "highpass_hz": 4000,
             "env": {"a": 0.001, "d": 0.05, "s": 0.0, "r": 0.02, "curve": "exp"},
             "notes": [
                 {"t": 0.48, "dur": 0.2, "clock": [[0.0, 120000], [0.2, 70000]], "vel": 0.9, "env": {"a": 0.001, "d": 0.18, "s": 0.0, "r": 0.04, "curve": "exp"}},
                 {"t": 0.72, "dur": 0.1, "clock": 130000, "vel": 0.5},
             ]},
        ],
        "post": {"highpass_hz": 70, "lowpass_hz": 11000, "echo": {"delay": 0.09, "feedback": 0.25, "mix": 0.2}},
    },
    # 바위 밀기 — 돌이 바닥을 긁는 낮은 잡음(밀기 한 칸 ≈ 0.4초)과 시작의 둔한 쿵.
    "stone-push": {
        "duration": 0.46,
        "seed": 917,
        "voices": [
            {"wave": "noise", "lfsr": 15, "gain": 1.0, "lowpass_hz": 1400, "highpass_hz": 120,
             "env": {"a": 0.03, "d": 0.12, "s": 0.7, "r": 0.08, "curve": "lin"},
             "tremolo": {"rate_hz": 23, "depth": 0.45},
             "notes": [{"t": 0.0, "dur": 0.4, "clock": [[0.0, 5200], [0.08, 7800], [0.16, 5600], [0.24, 8200], [0.32, 6000], [0.4, 4200]], "vel": 1.0}]},
            {"wave": "noise", "lfsr": 7, "gain": 0.35, "lowpass_hz": 2600,
             "env": {"a": 0.01, "d": 0.3, "s": 0.0, "r": 0.05, "curve": "exp"},
             "notes": [{"t": 0.02, "dur": 0.35, "clock": [[0.0, 9000], [0.35, 5000]], "vel": 0.8}]},
            {"wave": "triangle", "steps": 32, "gain": 0.9, "env": {"a": 0.001, "d": 0.12, "s": 0.0, "r": 0.02, "curve": "exp"},
             "notes": [{"t": 0.0, "dur": 0.12, "pitch": [[0.0, 110], [0.12, 52]], "vel": 1.0}]},
        ],
        "post": {"highpass_hz": 45, "lowpass_hz": 4000},
    },
    # 발판이 눌림 — 둔한 쿵 + 짧게 올라가는 확인음.
    "plate-press": {
        "duration": 0.3,
        "seed": 311,
        "voices": [
            {"wave": "triangle", "steps": 32, "gain": 1.0, "env": ENV_HIT,
             "notes": [{"t": 0.0, "dur": 0.08, "pitch": [[0.0, 160], [0.08, 60]], "vel": 1.0}]},
            {"wave": "noise", "lfsr": 7, "gain": 0.5, "lowpass_hz": 3000, "env": {"a": 0.001, "d": 0.025, "s": 0.0, "r": 0.01, "curve": "exp"},
             "notes": [{"t": 0.0, "dur": 0.03, "clock": [[0.0, 24000], [0.03, 8000]], "vel": 1.0}]},
            {"wave": "pulse", "duty": 0.25, "gain": 0.45, "amp_steps": 16, "env": {"a": 0.002, "d": 0.06, "s": 0.2, "r": 0.03, "curve": "exp"},
             "notes": [{"t": 0.09, "dur": 0.05, "pitch": "C6", "vel": 0.8}, {"t": 0.15, "dur": 0.1, "pitch": "G6", "vel": 0.9}]},
        ],
        "post": {"highpass_hz": 50, "lowpass_hz": 9000},
    },
    # 레버·스위치 — 금속이 걸리는 두 번의 딸깍.
    "switch-clack": {
        "duration": 0.2,
        "seed": 512,
        "voices": [
            {"wave": "noise", "lfsr": 7, "gain": 0.9, "highpass_hz": 900, "env": {"a": 0.001, "d": 0.018, "s": 0.0, "r": 0.006, "curve": "exp"},
             "notes": [{"t": 0.0, "dur": 0.02, "clock": [[0.0, 40000], [0.02, 18000]], "vel": 0.8},
                       {"t": 0.07, "dur": 0.024, "clock": [[0.0, 52000], [0.024, 20000]], "vel": 1.0}]},
            {"wave": "pulse", "duty": 0.125, "gain": 0.6, "amp_steps": 16, "env": {"a": 0.001, "d": 0.03, "s": 0.0, "r": 0.01, "curve": "exp"},
             "notes": [{"t": 0.0, "dur": 0.03, "pitch": [[0.0, 900], [0.03, 500]], "vel": 0.7},
                       {"t": 0.07, "dur": 0.05, "pitch": [[0.0, 1400], [0.05, 700]], "vel": 1.0}]},
            {"wave": "triangle", "steps": 32, "gain": 0.7, "env": ENV_HIT,
             "notes": [{"t": 0.07, "dur": 0.06, "pitch": [[0.0, 220], [0.06, 90]], "vel": 0.9}]},
        ],
        "post": {"highpass_hz": 60, "lowpass_hz": 9000},
    },
    # 틀렸다 — 짧고 또렷한 두 음 하강(긴 버저 대신).
    "wrong": {
        "duration": 0.34,
        "seed": 66,
        "voices": [
            {"wave": "pulse", "duty": 0.5, "gain": 0.7, "amp_steps": 16, "lowpass_hz": 2600,
             "env": {"a": 0.002, "d": 0.05, "s": 0.6, "r": 0.03, "curve": "exp"},
             "notes": [{"t": 0.0, "dur": 0.1, "pitch": "D#4", "vel": 1.0}, {"t": 0.12, "dur": 0.18, "pitch": [[0.0, "A3"], [0.18, "G#3"]], "vel": 1.0}]},
            {"wave": "pulse", "duty": 0.25, "gain": 0.4, "amp_steps": 16, "lowpass_hz": 2200,
             "env": {"a": 0.002, "d": 0.05, "s": 0.5, "r": 0.03, "curve": "exp"},
             "notes": [{"t": 0.0, "dur": 0.1, "pitch": "E4", "vel": 0.8}, {"t": 0.12, "dur": 0.18, "pitch": [[0.0, "A#3"], [0.18, "A3"]], "vel": 0.8}]},
            {"wave": "triangle", "steps": 32, "gain": 0.6, "env": {"a": 0.002, "d": 0.08, "s": 0.4, "r": 0.03, "curve": "lin"},
             "notes": [{"t": 0.0, "dur": 0.3, "pitch": "A2", "vel": 0.9}]},
        ],
        "post": {"highpass_hz": 55, "lowpass_hz": 3200},
    },
    # 수정·룬 판이 뒤집힘 — 맑게 튀는 두 음(얼음 효과음은 너무 작고 느려 피드백이 묻혔다).
    "crystal-ping": {
        "duration": 0.42,
        "seed": 808,
        "voices": [
            {"wave": "triangle", "steps": 32, "gain": 0.8, "env": {"a": 0.001, "d": 0.18, "s": 0.0, "r": 0.06, "curve": "exp"},
             "notes": [{"t": 0.0, "dur": 0.05, "pitch": "E6", "vel": 0.8}, {"t": 0.05, "dur": 0.25, "pitch": "B6", "vel": 1.0}]},
            {"wave": "pulse", "duty": 0.125, "gain": 0.35, "amp_steps": 16, "env": {"a": 0.001, "d": 0.12, "s": 0.0, "r": 0.05, "curve": "exp"},
             "notes": [{"t": 0.0, "dur": 0.05, "pitch": "E7", "vel": 0.6}, {"t": 0.05, "dur": 0.18, "pitch": "B7", "vel": 0.7}]},
            {"wave": "noise", "lfsr": 7, "gain": 0.12, "highpass_hz": 5000, "env": {"a": 0.001, "d": 0.03, "s": 0.0, "r": 0.01, "curve": "exp"},
             "notes": [{"t": 0.0, "dur": 0.03, "clock": 140000, "vel": 0.8}]},
        ],
        "post": {"highpass_hz": 200, "lowpass_hz": 12000, "echo": {"delay": 0.07, "feedback": 0.25, "mix": 0.22}},
    },
    "organ-c": organ("C5", "C6"),
    "organ-e": organ("E5", "E6"),
    "organ-g": organ("G5", "G6"),
    "organ-c2": organ("C6", "C7"),
}

TITLES = {
    "secret-solved": "퍼즐 해결 징글",
    "stone-push": "바위 밀기",
    "plate-press": "발판 눌림",
    "switch-clack": "레버·스위치",
    "wrong": "오답",
    "crystal-ping": "수정·판 뒤집힘",
    "organ-c": "오르간 발판 · 도",
    "organ-e": "오르간 발판 · 미",
    "organ-g": "오르간 발판 · 솔",
    "organ-c2": "오르간 발판 · 높은 도",
}
PEAK_DBFS = {"secret-solved": -3.0, "stone-push": -4.0, "plate-press": -4.0, "switch-clack": -5.0, "wrong": -5.0}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    wav_dir = Path(os.environ["PUZZLE_SFX_WAV_DIR"]) if os.environ.get("PUZZLE_SFX_WAV_DIR") else None
    if wav_dir:
        wav_dir.mkdir(parents=True, exist_ok=True)
    sounds = {}
    for cue, patch in PATCHES.items():
        patch = {"id": cue, **patch}
        y = synth.normalise(synth.render(patch), PEAK_DBFS.get(cue, -4.0))
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / f"{cue}.wav"
            synth.write_wav(wav, y)
            if wav_dir:
                synth.write_wav(wav_dir / f"{cue}.wav", y)
            ogg = OUT / f"{cue}.ogg"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "libvorbis", "-q:a", "5", "-ar", "44100", "-ac", "1", str(ogg)], check=True)
        data = ogg.read_bytes()
        rms = float(np.sqrt(np.mean(y**2)))
        sounds[cue] = {
            "file": f"{cue}.ogg",
            "title": TITLES[cue],
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "durationSeconds": round(len(y) / synth.SR, 4),
            "peakDbfs": PEAK_DBFS.get(cue, -4.0),
            "rmsDbfs": round(20 * np.log10(max(rms, 1e-9)), 2),
            "patch": patch,
        }
    manifest = {
        "format": 1,
        "license": "CC0-1.0",
        "originality": "Synthesised from numeric patches (pulse/triangle/LFSR-noise oscillators and envelopes) written by hand. No recording, sample or game melody is used.",
        "synth": "scripts/content/monster-sfx/synth.py",
        "builder": "scripts/content/puzzle-sfx/build.py",
        "sampleRate": synth.SR,
        "channels": 1,
        "codec": "vorbis q5",
        "sounds": sounds,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {len(sounds)} sounds -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
