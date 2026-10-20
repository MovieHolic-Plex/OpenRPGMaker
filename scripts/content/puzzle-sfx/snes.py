#!/usr/bin/env python3
"""퍼즐 효과음 SNES 샘플 악기풍 합성기 + 비교 예제.

출하 퍼즐 효과음은 `build.py` 가 이 모듈의 변형 A(`build_cues(...)[cue]["A"]`, 오르간은 `organ_note`)로 굽는다.
이 파일을 직접 실행하면 옛 칩튠(`build.py` 의 CHIP_PATCHES) | 변형 A | 변형 B 비교용 WAV 를 쓴다.

녹음·샘플·원작 멜로디는 쓰지 않는다. 악기 「샘플」도 전부 이 파일에서 수식으로 합성한다:
  하프 = Karplus-Strong, 글로켄·셀레스타·금속 = FM/가산, 마림바·팀파니·우드블록 = 감쇠 부분음 가산,
  현·금관·파이프오르간·오카리나 = 한 주기 정수배 길이의 루프 파형.
그다음 SNES 소리 경로를 흉내 낸다:
  1. 샘플을 32 kHz 로 만들고 BRR(16표본 블록, 4비트 ADPCM, 필터 0~3·시프트 0~12) 로 인코딩→디코딩한다(15비트 손실 포함).
  2. 피치 레지스터(1/4096 단위, 4배 상한)로 재생하고 4탭 가우스 보간(SNES 표에 맞춘 σ≈0.63)으로 읽는다.
  3. SNES 식 ADSR(선형 어택·지수 디케이/서스테인·키오프 선형 릴리스), 채널 8개 상한(같은 채널 새 음은 앞 음을 끊는다).
  4. 하드웨어 잡음 발생기(32단 클록, 표본 유지) — 보간을 거치지 않는다.
  5. 에코: 16 ms 단위 지연 + 8탭 FIR + 되먹임 + 에코 음량.
  6. 16비트 클리핑 후 32 kHz → 44.1 kHz.

  python3 scripts/content/puzzle-sfx/snes.py [OUT_DIR]   # 기본 ~/claude-viz/puzzle-sfx-snes-1
"""
from __future__ import annotations

import importlib.util
import json
import math
import sys
import wave
from fractions import Fraction
from pathlib import Path

import numpy as np
from scipy import signal as sps

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "content" / "monster-sfx"))
import synth  # noqa: E402

FS = 32000          # SNES DSP 출력률
OUT_SR = 44100
RNG = np.random.default_rng(20261020)


def hz(note) -> float:
    return synth.note_hz(note)


# ---------------------------------------------------------------- BRR ----
def _brr_decode_one(n: int, shift: int, filt: int, p1: int, p2: int) -> int:
    s = (n << shift) >> 1 if shift <= 12 else (-2048 if n < 0 else 0)
    if filt == 1:
        s += p1 + ((-p1) >> 4)
    elif filt == 2:
        s += 2 * p1 + ((-3 * p1) >> 5) - p2 + (p2 >> 4)
    elif filt == 3:
        s += 2 * p1 + ((-13 * p1) >> 6) - p2 + ((3 * p2) >> 4)
    s = max(-32768, min(32767, s))
    s = ((s << 1) & 0xFFFF)  # 15비트로 감김
    if s >= 0x8000:
        s -= 0x10000
    return s >> 1


def brr_roundtrip(x: np.ndarray, loop_start: int | None = None) -> np.ndarray:
    """float(-1..1) → BRR 인코딩 → 디코딩한 float. 길이는 16의 배수로 맞춘다."""
    n = int(math.ceil(len(x) / 16) * 16)
    tgt = np.zeros(n)
    tgt[: len(x)] = x
    tgt = np.round(np.clip(tgt, -1, 1) * 15000).astype(int)
    out = np.zeros(n, dtype=int)
    p1 = p2 = 0
    for b in range(0, n, 16):
        blk = tgt[b:b + 16]
        filters = (0,) if (b == 0 or b == loop_start) else (0, 1, 2, 3)  # 첫 블록·루프 시작 블록은 필터 0(실기 관례)
        best = None
        for f in filters:
            for sh in range(13):
                q1, q2, err, dec = p1, p2, 0, []
                step = (1 << sh) / 2
                for t in blk:
                    s0 = _brr_decode_one(0, sh, f, q1, q2)
                    nib = int(round((t - s0) / step)) if step else 0
                    nib = max(-8, min(7, nib))
                    d = _brr_decode_one(nib, sh, f, q1, q2)
                    err += (d - t) ** 2
                    dec.append(d)
                    q2, q1 = q1, d
                    if best is not None and err >= best[0]:
                        break
                if best is None or err < best[0]:
                    best = (err, dec, q1, q2)
        _, dec, p1, p2 = best
        out[b:b + 16] = dec
    return out / 16384.0


# ------------------------------------------------------- instrument samples ----
class Sample:
    def __init__(self, name: str, data: np.ndarray, root_hz: float, loop_start: int | None = None, tail_loop: int = 0):
        if tail_loop:  # 감쇠 악기: 끝의 몇 주기를 루프로 돌리고 감쇠는 ADSR 에 맡긴다(실기 관례, ARAM 절약)
            data = data[: len(data) // 16 * 16]
            loop_start = len(data) - tail_loop
        if loop_start is not None:
            loop_start = (loop_start // 16) * 16
            assert (len(data) - loop_start) % 16 == 0, (name, len(data), loop_start)
        self.name = name
        self.root = root_hz
        self.loop = loop_start
        self.data = brr_roundtrip(data, loop_start)
        self.raw_len = len(data)


def _norm(y: np.ndarray, peak: float = 0.95) -> np.ndarray:
    return y * (peak / (np.max(np.abs(y)) or 1.0))


def _t(n: int) -> np.ndarray:
    return np.arange(n) / FS


def make_harp() -> Sample:
    root, period = 500.0, 64
    n = int(0.35 * FS)
    buf = sps.lfilter([0.5, 0.5], [1], RNG.uniform(-1, 1, period))
    y = np.zeros(n)
    y[:period] = buf
    for i in range(period, n):  # KS: 두 표본 평균 + 감쇠
        y[i] = 0.4985 * (y[i - period] + y[i - period + 1])
    y += 0.25 * np.sin(2 * np.pi * root * _t(n)) * np.exp(-_t(n) / 0.5)  # 몸통 기음
    return Sample("harp", _norm(y), root, tail_loop=512)


def make_glock() -> Sample:
    root = 1000.0
    n = int(0.3 * FS); t = _t(n)
    idx = 2.2 * np.exp(-t / 0.05) + 0.3
    y = np.sin(2 * np.pi * root * t + idx * np.sin(2 * np.pi * root * 3.5 * t)) * np.exp(-t / 0.35)
    y += 0.25 * np.sin(2 * np.pi * root * 2.76 * t) * np.exp(-t / 0.12)
    return Sample("glock", _norm(y), root, tail_loop=512)


def make_celesta() -> Sample:
    root = 1000.0
    n = int(0.3 * FS); t = _t(n)
    y = (np.sin(2 * np.pi * root * t) * np.exp(-t / 0.45)
         + 0.35 * np.sin(2 * np.pi * root * 4.0 * t) * np.exp(-t / 0.08)
         + 0.12 * np.sin(2 * np.pi * root * 9.9 * t) * np.exp(-t / 0.03))
    return Sample("celesta", _norm(y), root, tail_loop=512)


def make_marimba() -> Sample:
    root = 500.0
    n = int(0.35 * FS); t = _t(n)
    y = (np.sin(2 * np.pi * root * t) * np.exp(-t / 0.22)
         + 0.45 * np.sin(2 * np.pi * root * 3.93 * t) * np.exp(-t / 0.05)
         + 0.12 * np.sin(2 * np.pi * root * 9.2 * t) * np.exp(-t / 0.015))
    y[:48] += RNG.uniform(-0.3, 0.3, 48) * np.linspace(1, 0, 48)  # 채 소리
    return Sample("marimba", _norm(y), root)


def make_timpani() -> Sample:
    root = 110.0
    n = int(0.55 * FS); t = _t(n)
    f = root * (1 + 0.06 * np.exp(-t / 0.04))
    ph = 2 * np.pi * np.cumsum(f) / FS
    y = (np.sin(ph) * np.exp(-t / 0.45) + 0.5 * np.sin(1.5 * ph) * np.exp(-t / 0.25)
         + 0.3 * np.sin(1.99 * ph) * np.exp(-t / 0.2))
    nz = sps.lfilter(*sps.butter(2, 1800 / (FS / 2)), RNG.uniform(-1, 1, n))
    y += 0.6 * nz * np.exp(-t / 0.02)
    return Sample("timpani", _norm(y), root)


def make_woodblock() -> Sample:
    root = 800.0
    n = int(0.12 * FS); t = _t(n)
    y = np.sin(2 * np.pi * root * t) * np.exp(-t / 0.03) + 0.5 * np.sin(2 * np.pi * root * 2.6 * t) * np.exp(-t / 0.012)
    y[:24] += RNG.uniform(-0.5, 0.5, 24)
    return Sample("woodblock", _norm(y), root)


def make_metal() -> Sample:
    root = 1000.0
    n = int(0.25 * FS); t = _t(n)
    idx = 6 * np.exp(-t / 0.03) + 1.0
    y = np.sin(2 * np.pi * root * t + idx * np.sin(2 * np.pi * root * 1.41 * t)) * np.exp(-t / 0.09)
    y += 0.4 * np.sin(2 * np.pi * root * 2.32 * t) * np.exp(-t / 0.05)
    return Sample("metal", _norm(y), root)


def make_grit() -> Sample:
    """돌 긁힘용 잡음 루프(대역 제한)."""
    n = 4096
    nz = RNG.uniform(-1, 1, n)
    nz = sps.sosfiltfilt(sps.butter(3, [150 / (FS / 2), 2400 / (FS / 2)], "band", output="sos"), nz)
    nz[:64] *= np.linspace(0, 1, 64)
    return Sample("grit", _norm(nz), 1000.0, loop_start=1024)


def _periodic(root_period: int, partials: dict[float, float], cycles: int) -> np.ndarray:
    n = root_period * cycles
    t = np.arange(n)
    y = np.zeros(n)
    for h, a in partials.items():
        y += a * np.sin(2 * np.pi * h * t / root_period)
    return y


def make_strings() -> Sample:
    root_p = 64  # 500 Hz
    loop = _periodic(root_p, {h: 1 / h for h in range(1, 14)}, 32)
    t = np.arange(len(loop))
    loop2 = np.zeros_like(loop)
    for h in range(1, 14):  # 33/32 배 → 루프 안에서 정수 주기(코러스)
        loop2 += (1 / h) * np.sin(2 * np.pi * h * 33 * t / len(loop))
    body = sps.lfilter(*sps.butter(1, 3500 / (FS / 2)), np.tile(loop + 0.8 * loop2, 3))[len(loop) * 2:]  # 정상 상태 한 루프
    att = np.tile(body, 1)[:1024] * np.linspace(0, 1, 1024) ** 1.5
    return Sample("strings", _norm(np.concatenate([att, body])), 500.0, loop_start=1024)


def make_brass() -> Sample:
    root_p = 128  # 250 Hz
    cycles_att = 24
    att = []
    for c in range(cycles_att):  # 밝기가 점점 열리는 어택
        k = c / cycles_att
        att.append(_periodic(root_p, {h: (1 / h) * min(1.0, (k * 14) / h) for h in range(1, 20)}, 1) * (0.3 + 0.7 * k))
    att = np.concatenate(att)
    body = _periodic(root_p, {h: 1 / h ** 1.05 for h in range(1, 20)}, 16)
    return Sample("brass", _norm(np.concatenate([att, body])), 250.0, loop_start=len(att))


def make_organ() -> Sample:
    root_p = 64
    body = _periodic(root_p, {1: 1.0, 2: 0.7, 3: 0.45, 4: 0.35, 6: 0.18, 8: 0.15, 0.5: 0.5}, 32)  # 16'·8'·4'… 드로바
    chiff = RNG.uniform(-1, 1, 512) * np.exp(-np.arange(512) / 120) * 0.25
    head = body[:512] + chiff
    return Sample("organ", _norm(np.concatenate([head, body])), 500.0, loop_start=512)


def make_ocarina() -> Sample:
    root_p = 64
    body = _periodic(root_p, {1: 1.0, 2: 0.12, 3: 0.06}, 32)
    breath = sps.lfilter(*sps.butter(2, [1500 / (FS / 2), 6000 / (FS / 2)], "band"), RNG.uniform(-1, 1, 1024))
    head = body[:1024] * np.linspace(0.2, 1, 1024) + 0.35 * breath * np.linspace(1, 0.1, 1024)
    return Sample("ocarina", _norm(np.concatenate([head, body])), 500.0, loop_start=1024)


def make_bass() -> Sample:
    root, period = 125.0, 256
    n = int(0.35 * FS)
    y = np.zeros(n)
    y[:period] = sps.lfilter(*sps.butter(1, 1200 / (FS / 2)), RNG.uniform(-1, 1, period))
    for i in range(period, n):
        y[i] = 0.499 * (y[i - period] + y[i - period + 1])
    return Sample("bass", _norm(y), root, tail_loop=512)


# ------------------------------------------------------------- DSP voice ----
SIGMA = 0.63


def _gauss_weights(frac: np.ndarray) -> np.ndarray:
    ks = np.array([-1, 0, 1, 2])[None, :]
    w = np.exp(-((ks - frac[:, None]) ** 2) / (2 * SIGMA ** 2))
    return w / w.sum(axis=1, keepdims=True)


def _adsr(n_on: int, n_total: int, a: float, d: float, sl: float, sr: float | None, rel: float) -> np.ndarray:
    env = np.zeros(n_total)
    t = np.arange(n_total) / FS
    na = max(1, int(a * FS))
    lvl = np.where(t < a, t / max(a, 1e-6), 0.0)
    after = t >= a
    ta = t - a
    dec = sl + (1 - sl) * np.exp(-ta / max(d, 1e-4))
    if sr:
        dec = dec * np.exp(-np.maximum(ta - 3 * d, 0) / sr)
    lvl = np.where(after, dec, lvl)
    env[:] = lvl
    off = min(n_on, n_total)
    if off < n_total:
        start = env[off - 1] if off > 0 else 0.0
        nr = max(1, int(rel * FS))
        tail = start * np.clip(1 - np.arange(n_total - off) / nr, 0, 1)  # 키오프 = 선형 릴리스
        env[off:] = tail
    env[:na] = np.minimum(env[:na], np.linspace(0, 1, na))
    return np.round(env * 2047) / 2047  # 11비트 엔벨로프


def play(sample: Sample, note, dur: float, *, a=0.002, d=0.3, sl=0.6, sr=None, rel=0.008,
         vib: tuple[float, float, float] | None = None, glide=None) -> np.ndarray:
    """한 채널의 한 음. note 는 음이름/Hz, glide=(끝 음, 시간) 은 피치 레지스터를 미끄러뜨린다."""
    f0 = hz(note)
    n_on = int(dur * FS)
    n_total = n_on + int(rel * FS) + 4
    f = np.full(n_total, f0)
    if glide:
        f1, gt = hz(glide[0]), glide[1]
        k = np.clip(np.arange(n_total) / (gt * FS), 0, 1)
        f = f0 * (f1 / f0) ** k
    if vib:
        rate, depth_semi, delay = vib
        tt = np.arange(n_total) / FS
        f = f * 2 ** (depth_semi / 12 * np.sin(2 * np.pi * rate * tt) * np.clip((tt - delay) / 0.08, 0, 1))
    step = np.round(f / sample.root * 4096) / 4096  # 피치 레지스터 정밀도
    assert step.max() < 4.0, (sample.name, note, step.max())
    pos = np.concatenate([[0.0], np.cumsum(step)[:-1]])
    L = len(sample.data)
    if sample.loop is None:
        alive = pos < L - 2
        pos = np.where(alive, pos, 0)
    else:
        alive = np.ones(n_total, bool)
        ll = L - sample.loop
        pos = np.where(pos >= sample.loop, sample.loop + np.mod(pos - sample.loop, ll), pos)
    i = np.floor(pos).astype(int)
    fr = pos - i
    w = _gauss_weights(fr)
    taps = i[:, None] + np.array([-1, 0, 1, 2])[None, :]
    if sample.loop is not None:
        taps = np.where(taps >= L, sample.loop + np.mod(taps - sample.loop, L - sample.loop), taps)
    taps = np.clip(taps, 0, L - 1)
    y = (sample.data[taps] * w).sum(axis=1) * alive
    return y * _adsr(n_on, n_total, a, d, sl, sr, rel)


NOISE_HZ = [0, 16, 21, 25, 31, 42, 50, 63, 83, 100, 125, 167, 200, 250, 333, 400, 500, 667, 800, 1000, 1300, 1600,
            2000, 2700, 3200, 4000, 5300, 6400, 8000, 10700, 16000, 32000]


def noise(dur: float, clock_hz: float, *, a=0.01, d=0.2, sl=0.5, sr=None, rel=0.03) -> np.ndarray:
    """하드웨어 잡음 발생기 — 15비트 LFSR, 가장 가까운 클록 단계로, 보간 없이 표본 유지."""
    clk = min(NOISE_HZ[1:], key=lambda v: abs(v - clock_hz))
    n_on = int(dur * FS)
    n_total = n_on + int(rel * FS) + 4
    reg = 0x4000
    vals = []
    steps = int(n_total * clk / FS) + 2
    for _ in range(steps):
        fb = (reg ^ (reg >> 1)) & 1
        reg = (reg >> 1) | (fb << 14)
        vals.append(1.0 if reg & 1 else -1.0)
    idx = (np.arange(n_total) * clk // FS).astype(int)
    return np.array(vals)[idx] * _adsr(n_on, n_total, a, d, sl, sr, rel) * 0.6


class Song:
    """8채널 믹서 + SPC 에코."""

    def __init__(self, length: float, echo: dict | None = None):
        self.n = int(length * FS)
        self.dry = np.zeros(self.n + FS)
        self.wet_in = np.zeros(self.n + FS)
        self.busy = [0] * 8  # 채널별 마지막 키온 표본(같은 채널 새 음은 앞 음을 자른다)
        self.echo = echo
        self.parts: list[tuple[int, int, np.ndarray, float, bool]] = []

    def add(self, ch: int, t: float, y: np.ndarray, vol: float = 0.7, echo: bool = True):
        assert 0 <= ch < 8
        self.parts.append((ch, int(t * FS), y, vol, echo))

    def render(self) -> np.ndarray:
        by_ch: dict[int, list] = {}
        for p in sorted(self.parts, key=lambda p: p[1]):
            by_ch.setdefault(p[0], []).append(p)
        for ch, parts in by_ch.items():
            for k, (_, s, y, vol, echo) in enumerate(parts):
                y = y.copy()
                if k + 1 < len(parts):
                    cut = parts[k + 1][1] - s
                    if cut < len(y):
                        fade = min(64, cut)
                        y[cut - fade:cut] *= np.linspace(1, 0, fade)
                        y[cut:] = 0
                e = min(len(self.dry), s + len(y))
                self.dry[s:e] += vol * y[: e - s]
                if echo:
                    self.wet_in[s:e] += vol * y[: e - s]
        out = self.dry.copy()
        if self.echo:
            D = int(self.echo["edl"] * 16 * FS / 1000)
            fir = np.array(self.echo.get("fir", [12, 33, 43, 43, 19, -2, -13, -7])) / 128.0
            efb, evol = self.echo["efb"], self.echo["evol"]
            buf = np.zeros(len(out) + D + 8)  # buf[i] = 시각 i 에 쓴 에코 버퍼 값
            fir_out = np.zeros(len(out))
            for s0 in range(0, len(out), D):  # 지연 D 만큼씩 벡터화(읽기는 항상 D 이전 값)
                s1 = min(len(out), s0 + D)
                idx = np.arange(s0, s1)
                acc = np.zeros(s1 - s0)
                for k in range(8):
                    j = idx - D - (7 - k)
                    acc += fir[k] * np.where(j >= 0, buf[np.clip(j, 0, None)], 0.0)
                fir_out[s0:s1] = acc
                buf[s0:s1] = np.clip(self.wet_in[s0:s1] + efb * acc, -1, 1)
            out = out + evol * fir_out
        out = np.clip(out[: self.n], -1, 1)
        out = np.round(out * 32767) / 32767  # 16비트 DAC
        fo = int(0.004 * FS)
        out[-fo:] *= np.linspace(1, 0, fo)
        return out


def to_out(y32: np.ndarray, rms_like: np.ndarray) -> np.ndarray:
    """32k → 44.1k. 크기는 현행판 RMS 에 맞춘다(큰 소리가 좋게 들리는 편향 제거), 피크는 -1 dBFS 상한."""
    r = Fraction(OUT_SR, FS)
    y = sps.resample_poly(y32, r.numerator, r.denominator)
    y = sps.sosfilt(sps.butter(1, 30 / (OUT_SR / 2), "high", output="sos"), y)
    y = y * (np.sqrt(np.mean(rms_like ** 2)) / (np.sqrt(np.mean(y ** 2)) or 1.0))
    peak = float(np.max(np.abs(y)))
    return y * min(1.0, 10 ** (-1 / 20) / peak) if peak else y


def write(path: Path, y: np.ndarray) -> None:
    pcm = np.clip(np.round(y * 32767), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(OUT_SR)
        w.writeframes(pcm.tobytes())


# ---------------------------------------------------------------- cues ----
ECHO_ROOM = {"edl": 4, "efb": 0.35, "evol": 0.32}     # 64 ms, 돌방 울림
ECHO_SHORT = {"edl": 2, "efb": 0.25, "evol": 0.25}    # 32 ms


def organ_note(S: dict[str, Sample], nt: str) -> np.ndarray:
    """오르간 발판 한 음(출하 organ-c/e/g/c2) — 파이프오르간 + 옥타브 아래 겹, 64 ms 에코. 같은 음색·음높이만 다르다."""
    s = Song(0.75, ECHO_ROOM)
    s.add(0, 0.0, play(S["organ"], nt, 0.42, a=0.01, d=0.15, sl=0.75, rel=0.12), 0.55)
    s.add(1, 0.0, play(S["organ"], hz(nt) / 2, 0.42, a=0.01, d=0.15, sl=0.75, rel=0.12), 0.3)
    return s.render()


def all_samples() -> dict[str, Sample]:
    makers = [make_harp, make_glock, make_celesta, make_marimba, make_timpani, make_woodblock, make_metal,
              make_grit, make_strings, make_brass, make_organ, make_ocarina, make_bass]
    return {smp.name: smp for smp in (m() for m in makers)}


def aram_kib(S: dict[str, Sample]) -> float:
    return sum(len(s.data) // 16 * 9 for s in S.values()) / 1024


def build_cues(S: dict[str, Sample]) -> dict[str, dict[str, tuple[np.ndarray, str]]]:
    cues: dict[str, dict[str, tuple[np.ndarray, str]]] = {}

    # 1) 퍼즐 해결 징글 — 현행과 같은 자체 음형(A장7 상행 → 높은 A). 원작 「비밀 발견」 선율은 쓰지 않는다.
    run = ["A4", "C#5", "E5", "G#5", "B5", "E6"]
    s = Song(1.9, ECHO_ROOM)
    for k, nt in enumerate(run):
        s.add(k % 4, k * 0.08, play(S["harp"], nt, 0.9, d=0.25, sl=0.3, sr=0.6, rel=0.05), 0.55)
    s.add(4, 0.48, play(S["harp"], "A6", 1.2, d=0.3, sl=0.4, sr=0.8, rel=0.1), 0.6)
    s.add(5, 0.48, play(S["glock"], "A6", 1.2, d=0.4, sl=0.3, sr=0.6, rel=0.1), 0.35)
    for ch, nt in ((6, "A3"), (7, "E4")):
        s.add(ch, 0.46, play(S["strings"], nt, 0.9, a=0.08, d=0.4, sl=0.7, rel=0.35), 0.32)
    a = s.render()
    s = Song(1.9, ECHO_ROOM)
    for k, nt in enumerate(run):
        s.add(k % 3, k * 0.08, play(S["celesta"], nt, 0.5, d=0.3, sl=0.2, sr=0.4, rel=0.04), 0.5)
    for ch, nt in ((3, "A4"), (4, "C#5"), (5, "E5")):  # 금관 화음 팡파르
        s.add(ch, 0.48, play(S["brass"], nt, 0.75, a=0.02, d=0.25, sl=0.7, rel=0.3, vib=(5.5, 0.12, 0.25)), 0.28)
    s.add(6, 0.48, play(S["celesta"], "A6", 1.1, d=0.5, sl=0.25, sr=0.6, rel=0.1), 0.5)
    s.add(7, 0.48, play(S["timpani"], "A2", 0.7, d=0.5, sl=0.0, rel=0.05), 0.55, echo=False)
    b = s.render()
    cues["secret-solved"] = {
        "A": (a, "하프 상행 아르페지오 + 글로켄 반짝임 + 현 패드 화음(A·E). 에코 64 ms."),
        "B": (b, "셀레스타 상행 + 금관 3화음 팡파르(비브라토) + 팀파니 한 번. 에코 64 ms."),
    }

    # 2) 바위 밀기
    s = Song(0.6, ECHO_SHORT)
    s.add(0, 0.0, play(S["timpani"], "A1", 0.2, d=0.12, sl=0.0, rel=0.04), 0.9, echo=False)
    s.add(1, 0.02, play(S["grit"], 680, 0.38, a=0.03, d=0.15, sl=0.75, rel=0.06, vib=(23, 1.5, 0.0)), 0.6, echo=False)
    s.add(2, 0.05, play(S["grit"], 1000, 0.3, a=0.02, d=0.2, sl=0.3, rel=0.05), 0.3, echo=False)
    a = s.render()
    s = Song(0.6, None)
    s.add(0, 0.0, play(S["timpani"], "C2", 0.18, d=0.1, sl=0.0, rel=0.04), 0.85)
    s.add(1, 0.0, noise(0.4, 800, a=0.03, d=0.1, sl=0.65, rel=0.06), 0.55)
    for k in range(4):  # 돌이 걸리며 튀는 둔한 나무 노크
        s.add(2 + k % 2, 0.06 + k * 0.09, play(S["woodblock"], ["E3", "D3", "F3", "C3"][k], 0.06, d=0.04, sl=0.0, rel=0.02), 0.35)
    b = s.render()
    cues["stone-push"] = {
        "A": (a, "BRR 잡음 샘플(돌 긁힘) 피치 떨림 + 팀파니 쿵. 에코 꺼짐(마른 소리)."),
        "B": (b, "SNES 하드웨어 잡음 발생기 + 팀파니 쿵 + 낮은 우드블록 덜컥 4번."),
    }

    # 3) 레버·스위치
    s = Song(0.45, ECHO_SHORT)
    s.add(0, 0.0, play(S["metal"], "E5", 0.05, d=0.04, sl=0.0, rel=0.02), 0.45)
    s.add(1, 0.07, play(S["metal"], "B5", 0.12, d=0.08, sl=0.0, rel=0.03), 0.6)
    s.add(2, 0.07, play(S["timpani"], "E2", 0.08, d=0.06, sl=0.0, rel=0.02), 0.7, echo=False)
    a = s.render()
    s = Song(0.45, ECHO_SHORT)
    s.add(0, 0.0, play(S["woodblock"], "A4", 0.05, d=0.03, sl=0.0, rel=0.01), 0.6)
    s.add(1, 0.07, play(S["woodblock"], "D5", 0.06, d=0.04, sl=0.0, rel=0.01), 0.7)
    s.add(2, 0.07, play(S["marimba"], "A5", 0.12, d=0.1, sl=0.0, rel=0.03), 0.5)
    s.add(3, 0.07, play(S["timpani"], "A1", 0.1, d=0.06, sl=0.0, rel=0.02), 0.6, echo=False)
    b = s.render()
    cues["switch-clack"] = {
        "A": (a, "FM 금속 샘플 두 번 철컥(낮게→높게) + 팀파니 바닥 울림."),
        "B": (b, "우드블록 딸깍 두 번 + 마림바 확인음 + 낮은 쿵. 나무 레버 느낌."),
    }

    # 4) 발판 눌림
    s = Song(0.45, ECHO_SHORT)
    s.add(0, 0.0, play(S["timpani"], "D2", 0.1, d=0.08, sl=0.0, rel=0.02), 0.85, echo=False)
    s.add(1, 0.09, play(S["marimba"], "C6", 0.06, d=0.1, sl=0.0, rel=0.02), 0.5)
    s.add(2, 0.15, play(S["marimba"], "G6", 0.2, d=0.15, sl=0.0, rel=0.04), 0.55)
    a = s.render()
    s = Song(0.5, ECHO_ROOM)
    s.add(0, 0.0, play(S["woodblock"], "G2", 0.06, d=0.04, sl=0.0, rel=0.01), 0.7, echo=False)
    s.add(1, 0.0, play(S["timpani"], "G1", 0.08, d=0.08, sl=0.0, rel=0.02), 0.6, echo=False)
    s.add(2, 0.09, play(S["harp"], "C6", 0.25, d=0.2, sl=0.2, rel=0.05), 0.45)
    s.add(3, 0.15, play(S["harp"], "G6", 0.3, d=0.25, sl=0.2, rel=0.06), 0.5)
    s.add(4, 0.15, play(S["glock"], "G6", 0.25, d=0.2, sl=0.0, rel=0.05), 0.25)
    b = s.render()
    cues["plate-press"] = {
        "A": (a, "팀파니 쿵 + 마림바 두 음(도→솔) 확인."),
        "B": (b, "낮은 나무 노크 + 하프 두 음 + 글로켄 겹. 짧은 에코."),
    }

    # 5) 오답
    s = Song(0.5, ECHO_SHORT)
    for ch, (n1, n2) in enumerate((("D#4", ("A3", "G#3")), ("E4", ("A#3", "A3")))):
        s.add(ch, 0.0, play(S["brass"], n1, 0.1, a=0.005, d=0.1, sl=0.6, rel=0.02), 0.45)
        s.add(ch + 2, 0.12, play(S["brass"], n2[0], 0.2, a=0.005, d=0.12, sl=0.6, rel=0.06, glide=(n2[1], 0.2)), 0.45)
    s.add(4, 0.0, play(S["bass"], "A2", 0.3, d=0.15, sl=0.3, rel=0.05), 0.6)
    a = s.render()
    s = Song(0.5, None)
    s.add(0, 0.0, play(S["organ"], "D#4", 0.1, d=0.2, sl=0.8, rel=0.02), 0.4)
    s.add(1, 0.0, play(S["organ"], "A3", 0.1, d=0.2, sl=0.8, rel=0.02), 0.4)
    s.add(0, 0.12, play(S["organ"], "G#3", 0.2, d=0.2, sl=0.8, rel=0.05), 0.4)
    s.add(1, 0.12, play(S["organ"], "D4", 0.2, d=0.2, sl=0.8, rel=0.05), 0.4)
    s.add(2, 0.0, play(S["timpani"], "A1", 0.3, d=0.2, sl=0.0, rel=0.04), 0.7)
    s.add(3, 0.12, play(S["bass"], "G#2", 0.2, d=0.15, sl=0.3, rel=0.05), 0.5)
    b = s.render()
    cues["wrong"] = {
        "A": (a, "약음 금관 두 음 하강(반음 부딪힘) + 피치카토 베이스. 현행과 같은 음형."),
        "B": (b, "파이프오르간 트라이톤 두 번 + 팀파니 둔한 쿵. 더 어둡고 무거운 「아니야」."),
    }

    # 6) 수정·룬 판 뒤집힘
    s = Song(0.8, ECHO_ROOM)
    s.add(0, 0.0, play(S["glock"], "E6", 0.05, d=0.1, sl=0.0, rel=0.02), 0.5)
    s.add(1, 0.05, play(S["glock"], "B6", 0.5, d=0.3, sl=0.2, sr=0.3, rel=0.08), 0.7)
    a = s.render()
    s = Song(0.8, ECHO_ROOM)
    s.add(0, 0.0, play(S["celesta"], "E6", 0.06, d=0.1, sl=0.0, rel=0.02), 0.5)
    s.add(1, 0.05, play(S["celesta"], "B6", 0.5, d=0.35, sl=0.2, sr=0.3, rel=0.08), 0.6)
    s.add(2, 0.05, play(S["harp"], "B5", 0.4, d=0.3, sl=0.1, rel=0.06), 0.35)
    b = s.render()
    cues["crystal-ping"] = {
        "A": (a, "FM 글로켄 두 음(미→시), 64 ms 에코."),
        "B": (b, "셀레스타(뮤직박스) 두 음 + 하프 배음 겹."),
    }

    # 7) 오르간 발판 4음 (도·미·솔·높은 도, 0.5초 간격으로 이어 들려준다)
    seq = ["C5", "E5", "G5", "C6"]
    s = Song(2.4, ECHO_ROOM)
    for k, nt in enumerate(seq):
        s.add(k % 2, k * 0.5, play(S["organ"], nt, 0.42, a=0.01, d=0.15, sl=0.75, rel=0.12), 0.55)
        s.add(2 + k % 2, k * 0.5, play(S["organ"], hz(nt) / 2, 0.42, a=0.01, d=0.15, sl=0.75, rel=0.12), 0.3)
    a = s.render()
    s = Song(2.4, ECHO_ROOM)
    for k, nt in enumerate(seq):
        s.add(k % 2, k * 0.5, play(S["ocarina"], nt, 0.42, a=0.03, d=0.2, sl=0.8, rel=0.1, vib=(5.5, 0.18, 0.15)), 0.7)
    b = s.render()
    cues["organ-seq"] = {
        "A": (a, "파이프오르간(드로바 가산 루프 + 칩 바람소리) 4음, 옥타브 아래 겹. 에코 64 ms."),
        "B": (b, "오카리나(사인+약한 배음 루프, 숨소리 어택, 늦은 비브라토) 4음."),
    }
    return cues


def current_versions() -> dict[str, np.ndarray]:
    spec = importlib.util.spec_from_file_location("puzzle_build", HERE / "build.py")
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)  # type: ignore[union-attr]
    out = {}
    for cue in ("secret-solved", "stone-push", "switch-clack", "plate-press", "wrong", "crystal-ping"):
        out[cue] = synth.normalise(synth.render({"id": cue, **mod.CHIP_PATCHES[cue]}), mod.PEAK_DBFS.get(cue, -4.0))
    seq = np.zeros(int(2.4 * synth.SR))
    for k, cue in enumerate(("organ-c", "organ-e", "organ-g", "organ-c2")):
        y = synth.normalise(synth.render({"id": cue, **mod.CHIP_PATCHES[cue]}), -4.0)
        s0 = int(k * 0.5 * synth.SR)
        seq[s0:s0 + len(y)] += y[: len(seq) - s0]
    out["organ-seq"] = synth.normalise(seq, -4.0)
    return out


TITLES = {
    "secret-solved": "퍼즐 해결 징글", "stone-push": "바위 밀기", "switch-clack": "레버·스위치",
    "plate-press": "발판 눌림", "wrong": "오답", "crystal-ping": "수정·판 뒤집힘", "organ-seq": "오르간 발판 4음(도·미·솔·도)",
}


def main(argv: list[str]) -> int:
    out = Path(argv[1]) if len(argv) > 1 else Path.home() / "claude-viz" / "puzzle-sfx-snes-1"
    out.mkdir(parents=True, exist_ok=True)
    S = all_samples()
    print(f"ARAM 합계 {aram_kib(S):.1f} KiB (실기 64 KiB)")
    cur = current_versions()
    cues = build_cues(S)
    meta = {}
    for cue, variants in cues.items():
        write(out / f"{cue}-current.wav", cur[cue])
        meta[cue] = {"title": TITLES[cue], "current": f"{cue}-current.wav", "variants": {}}
        for v, (y, desc) in variants.items():
            fn = f"{cue}-snes-{v.lower()}.wav"
            write(out / fn, to_out(y, cur[cue]))
            meta[cue]["variants"][v] = {"file": fn, "desc": desc}
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    print(f"wrote {len(cues)} cues -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
