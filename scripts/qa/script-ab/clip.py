#!/usr/bin/env python3
"""Script A/B PoC — cut a 1x-speed mp4 of one walkthrough for the report page.

  python3 scripts/qa/script-ab/clip.py <root> <arm>-<prompt>-<rep> [--from <check-id>] [--max 90]
→ ~/claude-viz/script-ab-poc/<arm>-<prompt>-<rep>.mp4 (+ .txt caption)
"""
import json, os, subprocess, sys
root, run = sys.argv[1], sys.argv[2]
frm = sys.argv[sys.argv.index("--from") + 1] if "--from" in sys.argv else "boot"
mx = float(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 90
w = json.load(open(f"{root}/walk/{run}/walk.json"))
cs = w["checks"]
start = next(c["startSec"] for c in cs if c["id"] == frm)
end = min(cs[-1]["endSec"] + 3, start + mx)
out = os.path.expanduser(f"~/claude-viz/script-ab-poc/{run}.mp4")
os.makedirs(os.path.dirname(out), exist_ok=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.2f}", "-to", f"{end:.2f}", "-i", f"{root}/walk/{run}/video/walk.webm",
                "-vf", "scale=640:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "26", "-an",
                "-movflags", "+faststart", out], check=True)
KO = {"door-shut-after-wrong": "틀린 순서 뒤에도 문이 지나가짐", "gate-closes-after-10s": "10초 뒤에도 철창이 안 닫힘",
      "boss-phase-line": "보스 반피 대사 없음", "door-opens-in-order": "순서대로 밟아도 문이 안 열림", "gate-open-in-time": "레버 직후 철창 통과 실패",
      "boss-won": "보스전 실패", "ending": "엔딩 없음", "sign-order": "팻말 순서 안내 없음", "wrong-order-reset": "틀린 순서 초기화 없음"}
fails = [KO.get(c["id"], c["id"]) for c in cs if not c["pass"]]
cap = f"{run.rsplit('-',1)[1]}회차 — 점검 {w['pass']}/{w['total']} 통과" + (f", 실패: {', '.join(fails)}" if fails else "") + f" · {end-start:.0f}초 · 1배속"
open(out[:-4] + ".txt", "w").write(cap)
print(out, cap)
