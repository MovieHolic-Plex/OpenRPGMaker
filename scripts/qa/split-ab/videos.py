#!/usr/bin/env python3
"""Lead/worker split battery — gameplay videos of each combo's best runs, recorded in the shipped player.

  python3 scripts/qa/split-ab/videos.py <batch dir> [arm ...]   env VIDEO_TOP (default 2), VIDEO_PAR (default 3)

Picks each arm's VIDEO_TOP highest-quality judged runs (page.py quality), plays them in the shipped player with walk.mjs
--video (logic requests: the same scripted checks; the others: story/<task>.json — talk to the request's characters,
pick choices, fight the boss) and converts to H.264 mp4 with a key frame every second (-g = fps) and +faststart.
Output: <batch>/videos/<arm>__<task>__<rep>/{walk.json, walk.mp4, sheet.jpg} and ~/claude-viz/lead-worker-split/<same>.mp4.
"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

L = sys.argv[1]; ONLY = sys.argv[2:]
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.abspath(os.path.join(HERE, "../../.."))
AB2 = os.path.join(HERE, "../script-ab/ab2")
VIZ = os.path.expanduser("~/claude-viz/lead-worker-split"); os.makedirs(VIZ, exist_ok=True)
P = json.load(open(os.path.join(HERE, "prompts.json"))); TASKS = {t["id"]: t for t in P["tasks"]}
sys.argv = [sys.argv[0], L, "/dev/null"]
import page  # noqa: E402,F401  (page.py reads measure.json; writes nothing with /dev/null)

from page import picks  # noqa: E402
TOP = int(os.environ.get("VIDEO_TOP", "2"))
arms_ = sorted({r["arm"] for r in json.load(open(f"{L}/measure.json"))["rows"]})
picks_ = [r for arm in arms_ if not ONLY or arm in ONLY for r in picks(arm, TOP)]


def one(r):
    key = f'{r["arm"]}__{r["task"]}__{r["rep"]}'; out = f"{L}/videos/{key}"; mp4 = f"{out}/walk.mp4"
    if os.path.exists(mp4): return key, "kept"
    walk = TASKS[r["task"]].get("walk")
    req, bind = (walk, f"{AB2}/bind/{walk}.json") if walk else ("story", f"{HERE}/story/{r['task']}.json")
    log = open(f"{L}/videos/{key}.log", "w")
    subprocess.run(["timeout", "1500", "node", "scripts/qa/script-ab/walk.mjs", "--project-dir", f'{L}/{r["arm"]}/{r["task"]}-{r["rep"]}/project',
                    "--request", req, "--bind", bind, "--out", out, "--video", "--netns"], cwd=REPO, stdout=log, stderr=subprocess.STDOUT)
    webm = f"{out}/video/walk.webm"
    if not os.path.exists(webm): return key, "no video"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", webm, "-vf", "fps=25,scale=720:-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "27",
                    "-pix_fmt", "yuv420p", "-g", "25", "-keyint_min", "25", "-sc_threshold", "0", "-movflags", "+faststart", "-an", mp4], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", webm, "-vf", "fps=1/3,scale=320:-2,tile=6x6", "-frames:v", "1", "-q:v", "4", f"{out}/sheet.jpg"])
    subprocess.run(["cp", mp4, f"{VIZ}/{key}.mp4"], check=True)
    os.remove(webm)
    return key, "ok"


os.makedirs(f"{L}/videos", exist_ok=True)
with ThreadPoolExecutor(int(os.environ.get("VIDEO_PAR", "3"))) as ex:
    for key, st in ex.map(one, picks_): print(key, st, flush=True)
