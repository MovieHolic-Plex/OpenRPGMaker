#!/usr/bin/env python3
"""Original chip-style sound-effect synthesiser for the monster-collection genre.

A *patch* is a small JSON document (written by a text model, "Argon", see
argon_author.py) that describes voices in the vocabulary of a 4-channel
handheld sound chip: pulse (12.5 / 25 / 50 / 75 % duty), triangle, 4-bit
wavetable and LFSR noise (15- or 7-bit).  This module turns a patch into PCM.

Nothing here reads a recording.  Oscillators, envelopes, pitch curves and a
seeded noise register are the only sources of signal, so every output is
original.  Rendering is deterministic: the same patch gives the same bytes.

Usage:  synth.py PATCH.json OUT.wav
"""
from __future__ import annotations

import json
import math
import re
import sys
import wave
from pathlib import Path

import numpy as np
from scipy import signal as sps

SR = 44100            # shipped sample rate (never below this: low rates cost "brightness")
OVER = 4              # oscillators run 4x oversampled, then are decimated with an anti-alias filter
DUTIES = (0.125, 0.25, 0.5, 0.75)
WAVES = ("pulse", "triangle", "noise", "wave")

NOTE_RE = re.compile(r"^([A-Ga-g])([#b]?)(-?\d)$")
_SEMI = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


class PatchError(ValueError):
    """Raised with a message meant to be read by the model that wrote the patch."""


def note_hz(value) -> float:
    if isinstance(value, (int, float)):
        if not 20 <= float(value) <= 16000:
            raise PatchError(f"pitch {value} Hz is outside 20..16000")
        return float(value)
    if isinstance(value, str):
        m = NOTE_RE.match(value.strip())
        if not m:
            raise PatchError(f"unknown note name {value!r} (use e.g. C5, F#4, Bb3)")
        letter, acc, octave = m.group(1).upper(), m.group(2), int(m.group(3))
        midi = 12 * (octave + 1) + _SEMI[letter] + (1 if acc == "#" else -1 if acc == "b" else 0)
        hz = 440.0 * 2 ** ((midi - 69) / 12)
        if not 20 <= hz <= 16000:
            raise PatchError(f"note {value} is outside 20..16000 Hz")
        return hz
    raise PatchError(f"pitch must be a number or note name, got {value!r}")


def _keyframes(spec, label: str, lo: float, hi: float, as_hz: bool = False):
    """[[t, v], ...] -> (times, values) with validation. Values may be note names when as_hz."""
    if not isinstance(spec, list) or not spec or any(not isinstance(k, list) or len(k) != 2 for k in spec):
        raise PatchError(f"{label}: keyframes must be [[t, value], ...]")
    times = [float(k[0]) for k in spec]
    vals = [note_hz(k[1]) if as_hz else float(k[1]) for k in spec]
    if any(b < a for a, b in zip(times, times[1:])):
        raise PatchError(f"{label}: keyframe times must not go backwards")
    if any(v < lo or v > hi for v in vals):
        raise PatchError(f"{label}: values must stay within {lo}..{hi}")
    return np.array(times), np.array(vals)


def _curve(spec, n: int, rate: int, label: str, lo: float, hi: float, as_hz: bool = False, log: bool = False):
    """Sample a keyframe list or constant over n samples at `rate`."""
    t = np.arange(n) / rate
    if isinstance(spec, (int, float, str)) and not isinstance(spec, bool):
        v = note_hz(spec) if as_hz else float(spec)
        if v < lo or v > hi:
            raise PatchError(f"{label}: {v} outside {lo}..{hi}")
        return np.full(n, v)
    times, vals = _keyframes(spec, label, lo, hi, as_hz)
    if log:
        return np.exp(np.interp(t, times, np.log(vals)))
    return np.interp(t, times, vals)


def _lfsr_table(bits: int, seed: int) -> np.ndarray:
    """One full period of the chip noise register, as +/-1."""
    width = 15 if bits == 15 else 7
    state = (seed % ((1 << width) - 1)) + 1
    period = (1 << width) - 1
    out = np.empty(period, dtype=np.float64)
    for i in range(period):
        bit = (state ^ (state >> 1)) & 1
        state = (state >> 1) | (bit << (width - 1))
        out[i] = 1.0 if (state & 1) else -1.0
    return out


_LFSR_CACHE: dict[tuple[int, int], np.ndarray] = {}


def _noise_table(bits: int, seed: int) -> np.ndarray:
    key = (bits, seed % 977)
    if key not in _LFSR_CACHE:
        _LFSR_CACHE[key] = _lfsr_table(bits, seed % 977)
    return _LFSR_CACHE[key]


def _adsr(env, n: int, rate: int, dur: float, label: str) -> np.ndarray:
    t = np.arange(n) / rate
    if isinstance(env, list):
        times, vals = _keyframes(env, label + ".env", 0.0, 1.0)
        return np.interp(t, times, vals, right=0.0 if vals[-1] == 0 else vals[-1])
    allowed = {"a", "d", "s", "r", "curve"}
    extra = set(env) - allowed
    if extra:
        raise PatchError(f"{label}.env has unknown keys {sorted(extra)} (allowed a,d,s,r,curve)")
    a = float(env.get("a", 0.002)); d = float(env.get("d", 0.05)); s = float(env.get("s", 0.0)); r = float(env.get("r", 0.01))
    curve = env.get("curve", "exp")
    if not (0 <= s <= 1) or a < 0 or d < 0 or r < 0:
        raise PatchError(f"{label}.env: a,d,r must be >= 0 and s within 0..1")
    out = np.zeros(n)
    a = max(a, 0.0005)
    att = np.minimum(t / a, 1.0)
    dec_phase = np.clip((t - a) / max(d, 1e-4), 0.0, 1.0)
    if curve == "exp":
        # 1 -> s along an exponential-looking fall that reaches s exactly at t = a + d
        dec = s + (1 - s) * (np.exp(-5.0 * dec_phase) - np.exp(-5.0)) / (1 - np.exp(-5.0))
    else:
        dec = 1 - (1 - s) * dec_phase
    body = att * np.where(t < a, 1.0, dec)
    rel_phase = np.clip((t - dur) / max(r, 1e-4), 0.0, 1.0)
    body = np.where(t <= dur, body, body * (1 - rel_phase) if r > 0 else 0.0)
    out[:] = body
    return out


def _osc(wave_kind: str, freq: np.ndarray, duty, rate: int, voice: dict, seed: int, label: str) -> np.ndarray:
    n = len(freq)
    if wave_kind == "noise":
        bits = int(voice.get("lfsr", 15))
        if bits not in (7, 15):
            raise PatchError(f"{label}: lfsr must be 7 or 15")
        table = _noise_table(bits, seed)
        # `freq` is the register clock in Hz for noise voices.
        ph = np.cumsum(freq) / rate
        return table[np.floor(ph).astype(np.int64) % len(table)]
    ph = np.cumsum(freq) / rate
    frac = ph - np.floor(ph)
    if wave_kind == "pulse":
        d = np.asarray(duty) if not np.isscalar(duty) else np.full(n, duty)
        return np.where(frac < d, 1.0, -1.0)
    if wave_kind == "triangle":
        y = 4.0 * np.abs(frac - 0.5) - 1.0
        steps = int(voice.get("steps", 32))
        if steps and steps >= 4:
            y = np.round((y + 1) / 2 * (steps - 1)) / (steps - 1) * 2 - 1
        return y
    if wave_kind == "wave":
        table = voice.get("table")
        if not isinstance(table, list) or len(table) != 32 or any(not isinstance(v, int) or not 0 <= v <= 15 for v in table):
            raise PatchError(f"{label}: wave voices need table = 32 integers 0..15")
        arr = (np.array(table, dtype=np.float64) / 15.0) * 2 - 1
        return arr[np.floor(frac * 32).astype(np.int64) % 32]
    raise PatchError(f"{label}: unknown wave {wave_kind!r}; use one of {WAVES}")


VOICE_KEYS = {"wave", "notes", "duty", "env", "gain", "lowpass_hz", "highpass_hz", "vibrato", "lfsr", "steps",
              "table", "amp_steps", "tremolo", "label"}
NOTE_KEYS = {"t", "dur", "pitch", "clock", "vel", "duty", "env", "arp", "gain"}
TOP_KEYS = {"id", "voices", "duration", "seed", "post", "note"}
POST_KEYS = {"lowpass_hz", "highpass_hz", "echo"}


def validate(patch: dict) -> None:
    if not isinstance(patch, dict):
        raise PatchError("patch must be an object")
    extra = set(patch) - TOP_KEYS
    if extra:
        raise PatchError(f"unknown top-level keys {sorted(extra)} (allowed {sorted(TOP_KEYS)})")
    dur = patch.get("duration")
    if not isinstance(dur, (int, float)) or not 0.03 <= dur <= 6.0:
        raise PatchError("duration (seconds, total length incl. tail) must be a number 0.03..6.0")
    voices = patch.get("voices")
    if not isinstance(voices, list) or not 1 <= len(voices) <= 6:
        raise PatchError("voices must be a list of 1..6 voices")
    n_notes = 0
    for vi, v in enumerate(voices):
        label = f"voices[{vi}]"
        if not isinstance(v, dict):
            raise PatchError(f"{label} must be an object")
        extra = set(v) - VOICE_KEYS
        if extra:
            raise PatchError(f"{label} unknown keys {sorted(extra)} (allowed {sorted(VOICE_KEYS)})")
        if v.get("wave") not in WAVES:
            raise PatchError(f"{label}.wave must be one of {WAVES}")
        notes = v.get("notes")
        if not isinstance(notes, list) or not 1 <= len(notes) <= 64:
            raise PatchError(f"{label}.notes must be a list of 1..64 notes")
        n_notes += len(notes)
        for ni, nt in enumerate(notes):
            nl = f"{label}.notes[{ni}]"
            if not isinstance(nt, dict):
                raise PatchError(f"{nl} must be an object")
            extra = set(nt) - NOTE_KEYS
            if extra:
                raise PatchError(f"{nl} unknown keys {sorted(extra)} (allowed {sorted(NOTE_KEYS)})")
            if not isinstance(nt.get("t"), (int, float)) or nt["t"] < 0:
                raise PatchError(f"{nl}.t (start seconds) required, >= 0")
            if not isinstance(nt.get("dur"), (int, float)) or not 0.004 <= nt["dur"] <= 4.0:
                raise PatchError(f"{nl}.dur must be 0.004..4.0 seconds")
            key = "clock" if v["wave"] == "noise" else "pitch"
            if key not in nt:
                raise PatchError(f"{nl} needs `{key}` ({'noise clock in Hz' if key == 'clock' else 'Hz, note name, or [[t,hz],..]'})")
    if n_notes > 160:
        raise PatchError("at most 160 notes in total")
    post = patch.get("post", {})
    if not isinstance(post, dict) or set(post) - POST_KEYS:
        raise PatchError(f"post may only contain {sorted(POST_KEYS)}")


def _render_note(voice: dict, note: dict, vi: int, ni: int, seed: int) -> tuple[int, np.ndarray]:
    label = f"voices[{vi}].notes[{ni}]"
    kind = voice["wave"]
    dur = float(note["dur"])
    env_spec = note.get("env", voice.get("env", {"a": 0.002, "d": dur, "s": 0.0, "r": 0.01}))
    rel = float(env_spec.get("r", 0.01)) if isinstance(env_spec, dict) else 0.0
    total = dur + rel
    if isinstance(env_spec, list):
        total = max(dur, float(env_spec[-1][0]))
    rate = SR * OVER
    n = max(8, int(math.ceil(total * rate)))
    if kind == "noise":
        freq = _curve(note["clock"], n, rate, label + ".clock", 20.0, 2_000_000.0, log=True)
    else:
        freq = _curve(note["pitch"], n, rate, label + ".pitch", 20.0, 16000.0, as_hz=True, log=True)
        arp = note.get("arp")
        if arp:
            steps = arp.get("steps")
            rate_hz = float(arp.get("rate_hz", 60))
            if not isinstance(steps, list) or not steps or not 4 <= rate_hz <= 240:
                raise PatchError(f"{label}.arp needs steps=[semitones...] and rate_hz 4..240")
            idx = (np.arange(n) / rate * rate_hz).astype(np.int64) % len(steps)
            freq = freq * (2.0 ** (np.array([float(s) for s in steps])[idx] / 12.0))
        vib = voice.get("vibrato")
        if vib:
            depth = float(vib.get("depth_semitones", 0.2)); vr = float(vib.get("rate_hz", 6)); delay = float(vib.get("delay", 0.0))
            tt = np.arange(n) / rate
            on = np.clip((tt - delay) / 0.03, 0, 1)
            freq = freq * 2.0 ** (depth * on * np.sin(2 * np.pi * vr * tt) / 12.0)
    duty = note.get("duty", voice.get("duty", 0.5))
    if kind == "pulse":
        if isinstance(duty, list):
            times, vals = _keyframes(duty, label + ".duty", 0.05, 0.95)
            tt = np.arange(n) / rate
            idx = np.searchsorted(times, tt, side="right") - 1
            duty_arr = np.array([min(DUTIES, key=lambda x: abs(x - v)) for v in vals])[np.clip(idx, 0, len(vals) - 1)]
        else:
            d = float(duty)
            if d not in DUTIES:
                raise PatchError(f"{label}.duty {d} is not a chip duty; use one of {DUTIES}")
            duty_arr = np.full(n, d)
    else:
        duty_arr = 0.5
    sig = _osc(kind, freq, duty_arr, rate, voice, seed + vi * 131 + ni * 17, label)
    env = _adsr(env_spec, n, rate, dur, label)
    vel = float(note.get("vel", 1.0))
    if not 0 <= vel <= 1:
        raise PatchError(f"{label}.vel must be 0..1")
    steps = voice.get("amp_steps")
    if steps:
        env = np.round(env * (int(steps) - 1)) / (int(steps) - 1)
    trem = voice.get("tremolo")
    if trem:
        tt = np.arange(n) / rate
        env = env * (1 - float(trem.get("depth", 0.3)) * 0.5 * (1 + np.sin(2 * np.pi * float(trem.get("rate_hz", 8)) * tt)))
    y = sig * env * vel * float(note.get("gain", 1.0))
    lp = voice.get("lowpass_hz"); hp = voice.get("highpass_hz")
    if lp:
        y = sps.sosfilt(sps.butter(2, min(float(lp), rate * 0.45) / (rate / 2), "low", output="sos"), y)
    if hp:
        y = sps.sosfilt(sps.butter(2, max(float(hp), 10.0) / (rate / 2), "high", output="sos"), y)
    # decimate to the output rate with an anti-alias filter
    y = sps.resample_poly(y, 1, OVER)
    start = int(round(float(note["t"]) * SR))
    return start, y


def render(patch: dict) -> np.ndarray:
    """Patch -> float mono array at SR, NOT yet level-normalised."""
    validate(patch)
    seed = int(patch.get("seed", 1))
    n_total = int(math.ceil(float(patch["duration"]) * SR))
    mix = np.zeros(n_total + SR)  # a second of slack so late tails can land before cropping
    for vi, voice in enumerate(patch["voices"]):
        gain = float(voice.get("gain", 0.5))
        if not 0 <= gain <= 1.5:
            raise PatchError(f"voices[{vi}].gain must be 0..1.5")
        for ni, note in enumerate(voice["notes"]):
            start, y = _render_note(voice, note, vi, ni, seed)
            end = min(len(mix), start + len(y))
            if start < len(mix):
                mix[start:end] += gain * y[: end - start]
    out = mix[:n_total]
    post = patch.get("post", {})
    lp = float(post.get("lowpass_hz", 16000))
    out = sps.sosfilt(sps.butter(2, min(lp, SR * 0.45) / (SR / 2), "low", output="sos"), out)
    out = sps.sosfilt(sps.butter(1, float(post.get("highpass_hz", 25)) / (SR / 2), "high", output="sos"), out)  # DC blocker
    echo = post.get("echo")
    if echo:
        delay = int(float(echo.get("delay", 0.09)) * SR); fb = float(echo.get("feedback", 0.3)); mixlvl = float(echo.get("mix", 0.25))
        if not (0.02 <= float(echo.get("delay", 0.09)) <= 0.4 and 0 <= fb <= 0.6 and 0 <= mixlvl <= 0.6):
            raise PatchError("post.echo: delay 0.02..0.4, feedback 0..0.6, mix 0..0.6")
        wet = np.zeros_like(out)
        for k in range(1, 5):
            off = delay * k
            if off < len(out):
                wet[off:] += out[: len(out) - off] * (fb ** (k - 1))
        out = out + mixlvl * wet
    # click guards: 0.5 ms in, 4 ms out
    fi = int(0.0005 * SR); fo = int(0.004 * SR)
    out[:fi] *= np.linspace(0, 1, fi)
    out[-fo:] *= np.linspace(1, 0, fo)
    return out


def normalise(y: np.ndarray, peak_dbfs: float) -> np.ndarray:
    peak = float(np.max(np.abs(y))) or 1.0
    return y * (10 ** (peak_dbfs / 20) / peak)


def write_wav(path: Path, y: np.ndarray) -> None:
    pcm = np.clip(np.round(y * 32767), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__)
        return 2
    patch = json.loads(Path(argv[1]).read_text())
    y = normalise(render(patch), -3.0)
    write_wav(Path(argv[2]), y)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
