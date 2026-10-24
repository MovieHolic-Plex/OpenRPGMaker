#!/usr/bin/env python3
"""런타임 QA 영상 클립에 기록된 소리 큐를 다시 섞는다.

Playwright 녹화(webm)에는 소리 트랙이 없다. runtimeQaRun.mjs 가 HTMLMediaElement.play 마다 남긴
audio-cues.json(시각·파일·음량·반복·멈춘 시각·음량 변화)을 읽어 같은 파일을 같은 시각·음량으로 놓는다.
반복 곡(BGM)은 멈춘 시각(없으면 클립 끝)까지 이어 붙인다. 음량 변화(페이드)는 구간별 평균 음량으로 근사한다.

  mux-audio-cues.py VIDEO START_JSON CUES_JSON START_S END_S OUT.mp4 [--scale 2] [--crop W:H:X:Y]

START_JSON 의 startedAt(ms)이 영상 0초다. START_S/END_S 는 영상 안 초.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[3]


def local(src: str) -> Path | None:
    path = unquote(urlparse(src).path).lstrip("/")
    for base in (ROOT / "public", ROOT):
        p = base / path
        if p.is_file():
            return p
    return None


def gain_at(cue: dict, t_ms: float) -> float:
    v = cue.get("volume", 1.0)
    for at, vol in cue.get("vol") or []:
        if at <= t_ms:
            v = vol
    return v


def main() -> None:
    args = sys.argv[1:]
    scale = 1
    crop = None
    if "--scale" in args:
        i = args.index("--scale"); scale = int(args[i + 1]); del args[i:i + 2]
    if "--crop" in args:
        i = args.index("--crop"); crop = args[i + 1]; del args[i:i + 2]
    video, start_json, cues_json, s0, s1, out = args
    s0, s1 = float(s0), float(s1)
    t0 = json.loads(Path(start_json).read_text())["startedAt"]
    cues = json.loads(Path(cues_json).read_text()) if Path(cues_json).is_file() else []
    dur = s1 - s0
    inputs: list[str] = []
    parts: list[str] = []
    used = []
    for cue in cues:
        start = (cue["at"] - t0) / 1000
        end = ((cue.get("end") or (t0 + s1 * 1000)) - t0) / 1000
        if end <= s0 or start >= s1:
            continue
        f = local(cue["src"])
        if f is None:
            continue
        lead = max(0.0, s0 - start)  # 클립 앞에서 이미 울리던 소리는 그만큼 건너뛴다
        delay_ms = max(0, round((start - s0) * 1000))
        play_len = min(end, s1) - max(start, s0)
        if play_len <= 0.02:
            continue
        idx = len(inputs) // 2 + 1
        if cue.get("loop"):
            inputs += ["-stream_loop", "-1", "-i", str(f)]
        else:
            inputs += ["-i", str(f)]
        # 음량: 큐 구간 중간 시각의 값(페이드는 근사). 음량 변화 기록이 있으면 시작·끝 평균.
        mid_ms = t0 + (max(start, s0) + play_len / 2) * 1000
        vol = (gain_at(cue, t0 + max(start, s0) * 1000) + gain_at(cue, mid_ms) + gain_at(cue, t0 + min(end, s1) * 1000)) / 3
        rate = cue.get("rate") or 1
        tempo = f",atempo={rate}" if abs(rate - 1) > 0.01 and 0.5 <= rate <= 2 else ""
        parts.append(
            f"[{idx}:a]atrim={lead:.3f}:{lead + play_len:.3f},asetpts=PTS-STARTPTS{tempo},aresample=48000,"
            f"aformat=channel_layouts=stereo,volume={vol:.3f},adelay={delay_ms}|{delay_ms}[a{len(parts)}]"
        )
        used.append(f"{max(0, start - s0):6.2f}s {'BGM ' if cue.get('loop') else 'SE  '}{f.name} v{vol:.2f}")
    vf = []
    if crop:
        vf.append(f"crop={crop}")
    if scale != 1:
        vf.append(f"scale=iw*{scale}:ih*{scale}:flags=neighbor")
    vfilter = ",".join(vf) or "null"
    if parts:
        mix = ";".join(parts) + ";" + "".join(f"[a{i}]" for i in range(len(parts))) + \
            f"amix=inputs={len(parts)}:normalize=0:duration=longest,alimiter=limit=0.95,apad,atrim=0:{dur:.3f}[aout]"
    else:
        mix = f"anullsrc=r=48000:cl=stereo,atrim=0:{dur:.3f}[aout]"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{s0:.3f}", "-to", f"{s1:.3f}", "-i", video, *inputs,
           "-filter_complex", f"[0:v]{vfilter}[vout];{mix}", "-map", "[vout]", "-map", "[aout]",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-t", f"{dur:.3f}", out]
    subprocess.run(cmd, check=True)
    print(f"{Path(out).name}: {dur:.1f}s, {len(used)} cues")
    for u in used:
        print("  " + u)


if __name__ == "__main__":
    main()
