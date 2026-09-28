#!/usr/bin/env python3
"""몬스터 울음소리 합성 — 종마다 짧은 효과음(WAV)을 코드로 만든다.

샘플이나 외부 음원을 쓰지 않는다. 종 이름으로 씨앗을 정하고, 타입이 음색을, 진화 단계가
높낮이·길이를 정한다. 같은 입력이면 항상 같은 파일이 나온다(결정적).

출력: public/assets/scarloxy/cries/scarloxy-cry-<key>.wav (22.05kHz, 16bit, 모노)
실행: python3 scripts/content/synth-scarloxy-cries.py [--only key1,key2]
"""
import argparse
import hashlib
import os
import wave

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "assets", "scarloxy", "cries")
SR = 22050

# key: (타입 목록, 진화 단계 0=아기 1=중간 2=최종·전설)
SPECIES = {
    # 기존 19종(scarloxyPokemonDemoGame.ts SCARLOXY_GEN1_TYPES 와 같은 타입)
    "sparchu": (["electric"], 0), "cindrill": (["fire", "fighting"], 1), "charmadillo": (["fire", "rock"], 2),
    "finsta": (["water"], 0), "gulfin": (["water", "ground"], 1), "finiette": (["water", "ice"], 2),
    "larvea": (["bug", "poison"], 0), "cleaf": (["bug", "grass"], 1), "ivieron": (["grass"], 2),
    "plumette": (["flying"], 0), "pluma": (["normal", "flying"], 1),
    "mossling": (["grass"], 0), "emberkit": (["fire"], 0), "puddlup": (["water"], 0),
    "jacana": (["water", "flying"], 0), "pouch": (["normal"], 1), "draem": (["psychic", "ghost"], 1),
    "friolera": (["ice"], 1), "atrox": (["dragon"], 2),
    # 새 11종(src/project/defaults/scarloxyExtraSpecies.ts)
    "pebblit": (["rock", "ground"], 0), "bouldurr": (["rock", "ground"], 2),
    "zaplet": (["electric"], 0), "voltail": (["electric"], 1),
    "wispin": (["ghost"], 0), "lanterghast": (["ghost", "fire"], 1),
    "hornbeet": (["bug", "fighting"], 1), "toxtoad": (["poison"], 1), "brawlape": (["fighting"], 0),
    "frostpip": (["ice"], 0), "sandscorp": (["ground", "poison"], 1),
}

# 타입별 음색: (기본 음높이 배율, 배음 구동, 잡음량, 떨림 Hz, 떨림 깊이, 트릴 Hz, 음절 수 가중)
TIMBRE = {
    "normal":   (1.00, 1.6, 0.02, 6.0, 0.02, 0.0),
    "fire":     (1.05, 2.4, 0.10, 7.0, 0.03, 0.0),
    "water":    (1.10, 1.2, 0.03, 11.0, 0.06, 0.0),
    "grass":    (1.00, 1.1, 0.02, 5.0, 0.02, 0.0),
    "electric": (1.35, 3.0, 0.04, 30.0, 0.04, 0.0),
    "ice":      (1.55, 1.4, 0.03, 9.0, 0.015, 0.0),
    "fighting": (0.80, 2.8, 0.06, 4.0, 0.02, 0.0),
    "poison":   (0.75, 2.0, 0.05, 8.0, 0.08, 0.0),
    "ground":   (0.70, 2.2, 0.12, 4.0, 0.02, 0.0),
    "rock":     (0.62, 2.6, 0.16, 3.0, 0.015, 0.0),
    "flying":   (1.45, 1.1, 0.02, 7.0, 0.03, 0.0),
    "psychic":  (1.15, 1.3, 0.02, 5.5, 0.03, 0.0),
    "bug":      (1.30, 2.0, 0.04, 6.0, 0.02, 38.0),
    "ghost":    (0.95, 1.0, 0.14, 3.5, 0.07, 0.0),
    "dragon":   (0.55, 3.2, 0.10, 5.0, 0.03, 0.0),
}


def rng_for(key):
    seed = int(hashlib.sha256(key.encode()).hexdigest()[:8], 16)
    return np.random.default_rng(seed)


def lowpass(x, alpha):
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y


def syllable(rng, n, f0, timbre, contour, types):
    pitch_mul, drive, noise_amt, vib_hz, vib_depth, trill_hz = timbre
    t = np.arange(n) / SR
    u = t / max(t[-1], 1e-6)
    if contour == "up":
        shape = u
    elif contour == "down":
        shape = 1 - u
    else:
        shape = np.sin(np.pi * u)
    bend = rng.uniform(0.25, 0.6)
    freq = f0 * (1 + bend * (shape - 0.5)) * (1 + vib_depth * np.sin(2 * np.pi * vib_hz * t))
    phase = 2 * np.pi * np.cumsum(freq) / SR
    tone = np.tanh(drive * np.sin(phase)) / np.tanh(drive)
    tone += 0.35 * np.sin(2 * phase + rng.uniform(0, np.pi))
    if "psychic" in types:
        tone *= 0.6 + 0.4 * np.sin(2 * np.pi * f0 * 0.5 * t)  # 링 변조
    if "ice" in types:
        tone += 0.25 * np.sin(3.01 * phase)  # 맑은 고배음
    if "electric" in types:
        tone += 0.3 * np.sign(np.sin(phase * 0.5 + 3 * np.sin(2 * np.pi * 45 * t)))
    if trill_hz:
        tone *= 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * trill_hz * t))
    noise = rng.standard_normal(n)
    if any(k in types for k in ("rock", "ground", "dragon")):
        noise = lowpass(noise, 0.08) * 3
    elif "ghost" in types:
        noise = lowpass(noise, 0.25) * 1.5
    elif "fire" in types:
        noise *= (rng.random(n) < 0.02) * 4  # 타닥 불티
    sig = tone * (1 - noise_amt) + noise * noise_amt
    attack = max(1, int(0.012 * SR))
    env = np.minimum(1, np.arange(n) / attack) * np.exp(-2.2 * u) * (1 - u ** 6)
    return sig * env


def synth(key):
    types, stage = SPECIES[key]
    rng = rng_for(key)
    timbre = TIMBRE[types[0]]
    if len(types) > 1:
        other = TIMBRE[types[1]]
        timbre = tuple((a * 2 + b) / 3 for a, b in zip(timbre, other))
    base = [620.0, 430.0, 300.0][stage] * timbre[0] * rng.uniform(0.9, 1.12)
    total = [0.42, 0.58, 0.78][stage] + rng.uniform(-0.05, 0.08)
    count = int(rng.choice([1, 2, 2, 3] if stage == 0 else [1, 2, 2] if stage == 1 else [1, 1, 2]))
    gap = 0.035
    each = (total - gap * (count - 1)) / count
    parts = []
    for i in range(count):
        contour = rng.choice(["up", "down", "arch"])
        f = base * (1.0 + 0.12 * (i % 2) * (1 if rng.random() < 0.5 else -1))
        length = each * (1.35 if i == count - 1 and count > 1 else 0.85 if count > 1 else 1)
        parts.append(syllable(rng, int(length * SR), f, timbre, contour, types))
        if i < count - 1:
            parts.append(np.zeros(int(gap * SR)))
    sig = np.concatenate(parts)
    if "ghost" in types or "dragon" in types:  # 짧은 메아리
        d = int(0.07 * SR)
        echo = np.zeros(len(sig) + d * 2)
        echo[: len(sig)] += sig
        echo[d : d + len(sig)] += 0.45 * sig
        echo[2 * d : 2 * d + len(sig)] += 0.2 * sig
        sig = echo
    fade = int(0.01 * SR)
    sig[-fade:] *= np.linspace(1, 0, fade)
    sig = sig / max(1e-6, np.max(np.abs(sig))) * 0.8
    return sig


def write_wav(path, sig):
    data = (np.clip(sig, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    args = parser.parse_args()
    keys = [k for k in args.only.split(",") if k] or list(SPECIES)
    os.makedirs(OUT, exist_ok=True)
    for key in keys:
        sig = synth(key)
        path = os.path.join(OUT, f"scarloxy-cry-{key}.wav")
        write_wav(path, sig)
        print(f"{key}: {len(sig) / SR:.2f}s -> {os.path.relpath(path, ROOT)}")


if __name__ == "__main__":
    main()

