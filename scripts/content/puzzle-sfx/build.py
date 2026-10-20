#!/usr/bin/env python3
"""JRPG 퍼즐 방 효과음 세트 — 원본 SNES 샘플 악기풍 합성(CC0).

2026-10-20 부터 출하음은 `snes.py` 의 변형 A 다: 코드로 합성한 악기 샘플(하프·글로켄·마림바·팀파니·금관·파이프오르간…)을
SNES 경로(32 kHz·BRR 왕복·가우스 보간·ADSR·8채널·FIR 에코)로 재생한다. 녹음·원작 샘플·원작 멜로디는 쓰지 않았다.
해결 징글은 장7화음을 위로 쌓는 자체 음형이다.

아래 CHIP_PATCHES 는 옛 칩튠판(#3060)이다. 지우지 않는 이유: ① 새 소리의 크기를 옛 소리의 게이트 RMS 에 맞추는 기준,
② `snes.py` 비교 예제의 「현행」 줄. 칩튠 합성기는 `scripts/content/monster-sfx/synth.py`.

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
sys.path.insert(0, str(HERE))
import snes  # noqa: E402

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


CHIP_PATCHES: dict[str, dict] = {
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


SNES_DESC = {
    "secret-solved": "harp rising A-maj7 arpeggio + glockenspiel sparkle + string pad (A, E), 64 ms echo",
    "stone-push": "band-limited BRR noise sample (stone scrape, pitch wobble) + timpani thud, dry",
    "switch-clack": "FM metal sample, two clanks low->high + timpani floor knock",
    "plate-press": "timpani thud + marimba C6 -> G6 confirm",
    "wrong": "muted brass two-note fall (semitone rub) + plucked bass",
    "crystal-ping": "FM glockenspiel E6 -> B6, 64 ms echo",
    "organ": "pipe organ (additive drawbar loop + chiff) with octave-below double, 64 ms echo",
}
ORGAN_NOTES = {"organ-c": "C5", "organ-e": "E5", "organ-g": "G5", "organ-c2": "C6"}


def gated_rms(y: np.ndarray, sr: int) -> float:
    """30 ms 창 중 가장 큰 창보다 30 dB 이내인 창만 평균한 RMS(꼬리·무음 길이에 흔들리지 않는 크기)."""
    w = int(0.03 * sr)
    fr = np.array([np.sqrt(np.mean(y[i:i + w] ** 2)) for i in range(0, len(y) - w + 1, w)])
    keep = fr[fr >= fr.max() * 10 ** (-30 / 20)]
    return float(np.sqrt(np.mean(keep ** 2)))


def finish(y32: np.ndarray, ref: np.ndarray) -> np.ndarray:
    """32 kHz SNES 출력 → 44.1 kHz, 옛 칩튠판 게이트 RMS 에 맞추고 피크 -1 dBFS 상한, -60 dB 아래 꼬리는 잘라 20 ms 로 닫는다."""
    from fractions import Fraction
    from scipy import signal as sps
    r = Fraction(synth.SR, snes.FS)
    y = sps.resample_poly(y32, r.numerator, r.denominator)
    y = sps.sosfilt(sps.butter(1, 30 / (synth.SR / 2), "high", output="sos"), y)
    y = y * (gated_rms(ref, synth.SR) / gated_rms(y, synth.SR))
    peak = float(np.max(np.abs(y)))
    if peak > 10 ** (-1 / 20):
        y = y * (10 ** (-1 / 20) / peak)
    loud = np.nonzero(np.abs(y) > np.max(np.abs(y)) * 10 ** (-60 / 20))[0]
    end = min(len(y), int(loud[-1]) + int(0.02 * synth.SR))
    y = y[:end].copy()
    fo = int(0.02 * synth.SR)
    y[-fo:] *= np.linspace(1, 0, fo)
    return y


def measure(y: np.ndarray, ref: np.ndarray) -> dict:
    sr = synth.SR
    onset = int(np.argmax(np.abs(y) > np.max(np.abs(y)) * 0.1))
    return {
        "gatedRmsDb": round(20 * np.log10(gated_rms(y, sr)), 2),
        "chipGatedRmsDb": round(20 * np.log10(gated_rms(ref, sr)), 2),
        "peakDbfs": round(20 * np.log10(float(np.max(np.abs(y)))), 2),
        "dc": round(float(np.mean(y)), 5),
        "maxStep": round(float(np.max(np.abs(np.diff(y)))), 3),  # 최대 표본 간 점프(클릭 검사)
        "onsetMs": round(onset / sr * 1000, 1),
        "seconds": round(len(y) / sr, 3),
        "chipSeconds": round(len(ref) / sr, 3),
    }


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    wav_dir = Path(os.environ["PUZZLE_SFX_WAV_DIR"]) if os.environ.get("PUZZLE_SFX_WAV_DIR") else None
    if wav_dir:
        wav_dir.mkdir(parents=True, exist_ok=True)
    S = snes.all_samples()
    cues = snes.build_cues(S)
    sounds = {}
    for cue in CHIP_PATCHES:
        ref = synth.normalise(synth.render({"id": cue, **CHIP_PATCHES[cue]}), PEAK_DBFS.get(cue, -4.0))
        raw = snes.organ_note(S, ORGAN_NOTES[cue]) if cue in ORGAN_NOTES else cues[cue]["A"][0]
        y = finish(raw, ref)
        m = measure(y, ref)
        assert m["peakDbfs"] <= -0.99 and abs(m["dc"]) < 0.002 and m["onsetMs"] < 15, (cue, m)
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / f"{cue}.wav"
            synth.write_wav(wav, y)
            if wav_dir:
                synth.write_wav(wav_dir / f"{cue}.wav", y)
            ogg = OUT / f"{cue}.ogg"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "libvorbis", "-q:a", "5", "-ar", "44100", "-ac", "1", str(ogg)], check=True)
        data = ogg.read_bytes()
        sounds[cue] = {
            "file": f"{cue}.ogg",
            "title": TITLES[cue],
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "durationSeconds": m["seconds"],
            "instrument": SNES_DESC["organ" if cue in ORGAN_NOTES else cue],
            "measure": m,
        }
        print(f"{cue:14s} {json.dumps(m)}")
    manifest = {
        "format": 2,
        "license": "CC0-1.0",
        "originality": "Instrument samples are synthesised in code (Karplus-Strong, FM, additive, looped single-cycle waves) and played through an SNES-like path. No recording, ripped sample or game melody is used.",
        "engine": "scripts/content/puzzle-sfx/snes.py (variant A): 32 kHz, BRR 4-bit ADPCM round-trip, Gaussian 4-tap interpolation, SNES ADSR, 8 voices, hardware noise, 8-tap FIR echo",
        "builder": "scripts/content/puzzle-sfx/build.py",
        "loudness": "gated RMS matched to the previous chiptune set (CHIP_PATCHES in build.py), peak capped at -1 dBFS",
        "aramKiB": round(snes.aram_kib(S), 1),
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
