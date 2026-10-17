#!/usr/bin/env python3
"""Automatic checks for monster-genre sound effects.

Hard gates (a failing sound is never bundled): sample rate, clipping, DC offset,
leading/trailing silence, inner silence, click-free ends, duration window.
Soft descriptors (centroid, band balance, loudness vs. the RTP sound being
replaced) are reported and used to rank candidate patches.

The reference files used for `coarse_distance` are comparison-only inputs that
live outside the repository; nothing derived frame-by-frame from them is
shipped.  Only whole-sound band balance, duration and brightness are compared.
"""
from __future__ import annotations

import json
import sys
import wave
from pathlib import Path

import numpy as np

BAND_EDGES = [0, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 24000]
SILENCE_DB = -50.0


def read_wav(path: Path) -> tuple[np.ndarray, int, dict]:
    with wave.open(str(path), "rb") as w:
        sr, ch, width, n = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()
        raw = w.readframes(n)
    if width == 2:
        y = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
    elif width == 1:
        y = (np.frombuffer(raw, dtype=np.uint8).astype(np.float64) - 128) / 128.0
    else:
        raise ValueError(f"{path}: unsupported sample width {width}")
    if ch > 1:
        y = y.reshape(-1, ch).mean(axis=1)
    return y, sr, {"channels": ch, "bits": width * 8}


def _db(x: float) -> float:
    return 20 * np.log10(max(x, 1e-9))


def frame_rms_db(y: np.ndarray, sr: int, ms: float = 5.0) -> np.ndarray:
    n = max(1, int(sr * ms / 1000))
    k = len(y) // n
    if k == 0:
        return np.array([_db(float(np.sqrt(np.mean(y ** 2))))])
    frames = y[: k * n].reshape(k, n)
    return 20 * np.log10(np.maximum(np.sqrt(np.mean(frames ** 2, axis=1)), 1e-9))


def band_db(y: np.ndarray, sr: int) -> list[float]:
    spec = np.abs(np.fft.rfft(y * np.hanning(len(y)))) ** 2
    freqs = np.fft.rfftfreq(len(y), 1 / sr)
    total = spec.sum() or 1.0
    out = []
    for lo, hi in zip(BAND_EDGES, BAND_EDGES[1:]):
        out.append(10 * np.log10(max(spec[(freqs >= lo) & (freqs < hi)].sum() / total, 1e-9)))
    return out


def analyze(y: np.ndarray, sr: int, meta: dict | None = None) -> dict:
    meta = meta or {}
    n = len(y)
    peak = float(np.max(np.abs(y))) if n else 0.0
    fr = frame_rms_db(y, sr)
    active = np.where(fr > SILENCE_DB)[0]
    ms_per = 5.0
    lead_ms = float(active[0] * ms_per) if len(active) else n / sr * 1000
    trail_ms = float((len(fr) - 1 - active[-1]) * ms_per) if len(active) else n / sr * 1000
    gaps = np.diff(active) - 1 if len(active) > 1 else np.array([0])
    inner_gap_ms = float(gaps.max() * ms_per) if len(gaps) else 0.0
    if len(active):
        a0, a1 = int(active[0] * ms_per * sr / 1000), int((active[-1] + 1) * ms_per * sr / 1000)
        seg = y[a0:a1]
    else:
        seg = y
    rms_active = float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0.0
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) if len(seg) > 8 else np.array([1.0, 1.0])
    freqs = np.fft.rfftfreq(len(seg), 1 / sr) if len(seg) > 8 else np.array([0.0, 1.0])
    centroid = float((spec * freqs).sum() / (spec.sum() or 1.0))
    env = np.abs(y)
    if peak > 0:
        win = max(1, int(sr * 0.001))
        smooth = np.convolve(env, np.ones(win) / win, mode="same")
        attack_ms = float(np.argmax(smooth >= 0.5 * smooth.max()) / sr * 1000)
    else:
        attack_ms = 0.0
    last = y[-int(sr * 0.002):] if n else y
    return {
        "sample_rate": sr,
        "channels": meta.get("channels", 1),
        "bits": meta.get("bits", 16),
        "duration_s": round(n / sr, 4),
        "peak_dbfs": round(_db(peak), 2),
        "clipped_samples": int(np.sum(np.abs(y) >= 0.999)),
        "rms_active_dbfs": round(_db(rms_active), 2),
        "dc_offset": round(float(np.mean(y)), 5) if n else 0.0,
        "lead_silence_ms": round(lead_ms, 1),
        "trail_silence_ms": round(trail_ms, 1),
        "inner_gap_ms": round(inner_gap_ms, 1),
        "centroid_hz": round(centroid, 0),
        "attack_ms": round(attack_ms, 2),
        "first_sample": round(float(abs(y[0])) if n else 0.0, 5),
        "end_rms": round(float(np.sqrt(np.mean(last ** 2))) if len(last) else 0.0, 5),
        "band_db": [round(b, 1) for b in band_db(seg if len(seg) > 64 else y, sr)],
        "hf_over_12k_db": round(band_db(seg if len(seg) > 64 else y, sr)[-1], 1),
    }


def gate(m: dict, expect: dict) -> list[str]:
    """Return a list of failure messages (empty = pass)."""
    bad: list[str] = []
    if m["sample_rate"] != 44100:
        bad.append(f"sample rate {m['sample_rate']} != 44100")
    if m["channels"] != 1 or m["bits"] != 16:
        bad.append("must be mono 16-bit")
    if m["clipped_samples"] > 0:
        bad.append(f"{m['clipped_samples']} clipped samples")
    if m["peak_dbfs"] > -1.0:
        bad.append(f"peak {m['peak_dbfs']} dBFS above -1.0")
    if abs(m["dc_offset"]) > 0.003:
        bad.append(f"DC offset {m['dc_offset']}")
    if m["lead_silence_ms"] > expect.get("max_lead_ms", 8):
        bad.append(f"leading silence {m['lead_silence_ms']} ms > {expect.get('max_lead_ms', 8)}")
    if m["trail_silence_ms"] > expect.get("max_trail_ms", 60):
        bad.append(f"trailing silence {m['trail_silence_ms']} ms > {expect.get('max_trail_ms', 60)}")
    if m["inner_gap_ms"] > expect.get("max_gap_ms", 140):
        bad.append(f"inner silent gap {m['inner_gap_ms']} ms > {expect.get('max_gap_ms', 140)}")
    first_max = expect.get("max_first_sample", 0.01)
    if m["first_sample"] > first_max:
        bad.append(f"first sample {m['first_sample']} > {first_max} (click)")
    if m["end_rms"] > 0.006:
        bad.append(f"last 2 ms rms {m['end_rms']} (click at end)")
    lo, hi = expect["dur"]
    if not lo <= m["duration_s"] <= hi:
        bad.append(f"duration {m['duration_s']} s outside {lo}..{hi}")
    amax = expect.get("attack_ms_max")
    if amax is not None and m["attack_ms"] > amax:
        bad.append(f"attack {m['attack_ms']} ms > {amax}")
    return bad


def advice(m: dict, expect: dict) -> list[str]:
    """Soft notes (not gates): brightness window and harshness."""
    notes = []
    c = expect.get("centroid")
    if c and not c[0] <= m["centroid_hz"] <= c[1]:
        notes.append(f"brightness: spectral centroid {m['centroid_hz']:.0f} Hz outside {c[0]}..{c[1]} Hz")
    if m["hf_over_12k_db"] > -22:
        notes.append(f"harsh: {m['hf_over_12k_db']} dB of energy above 12.8 kHz")
    return notes


def coarse_distance(a: dict, b: dict) -> float:
    """Whole-sound comparison: octave-band balance (dB), log duration ratio, brightness ratio."""
    bands = np.mean(np.abs(np.array(a["band_db"]) - np.array(b["band_db"])))
    dur = abs(np.log2(max(a["duration_s"], 1e-3) / max(b["duration_s"], 1e-3)))
    cen = abs(np.log2(max(a["centroid_hz"], 50) / max(b["centroid_hz"], 50)))
    return float(bands / 6.0 + dur + cen)


def main(argv: list[str]) -> int:
    for p in argv[1:]:
        y, sr, meta = read_wav(Path(p))
        print(p, json.dumps(analyze(y, sr, meta)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
