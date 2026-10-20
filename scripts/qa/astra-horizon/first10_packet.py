"""첫 10분 검수 묶음 — first10.mjs 결과 폴더에서 장면 띠·오프닝 띠·대사 대본을 만든다.
  python3 first10_packet.py <runDir>
→ <runDir>/packet/strip.png(이름 붙은 장면, 1배 480×320), opening-strip.png(영상 0.5초 간격 오프닝), transcript.txt
"""
import json, os, re, subprocess, sys, glob
from PIL import Image, ImageDraw
run = sys.argv[1]; out = os.path.join(run, "packet"); os.makedirs(out, exist_ok=True)
names = sorted(p for p in glob.glob(os.path.join(run, "*.png")) if not os.path.basename(p).startswith("failure"))
def sheet(paths, dest, cols=4, w=480, h=320, label=True):
    rows = (len(paths) + cols - 1) // cols
    W = Image.new("RGB", (cols * w, rows * (h + (18 if label else 0))), "black"); d = ImageDraw.Draw(W)
    for i, p in enumerate(paths):
        im = Image.open(p).convert("RGB").resize((w, h), Image.NEAREST)
        x, y = (i % cols) * w, (i // cols) * (h + (18 if label else 0))
        W.paste(im, (x, y + (18 if label else 0)))
        if label: d.text((x + 4, y + 3), os.path.basename(p)[:-4], fill="white")
    W.save(dest)
sheet(names, os.path.join(out, "strip.png"))
vid = glob.glob(os.path.join(run, "video", "*.webm"))
rep = json.load(open(os.path.join(run, "report.json")))
if vid:
    marks = {m["label"]: m["t"] for m in rep.get("marks", [])}
    # 영상은 페이지가 열릴 때부터 찍힌다 — 타이틀까지 걸린 시간만큼 밀어 준다(타이틀 표시 프레임을 찾지 않고 보고서의 부팅 시간 근사).
    boot = rep.get("bootMs", 0) / 1000
    end = boot + marks.get("bedroom", 30000) / 1000
    fdir = os.path.join(out, "opening-frames"); os.makedirs(fdir, exist_ok=True)
    for f in glob.glob(os.path.join(fdir, "*.png")): os.remove(f)
    subprocess.run(["ffmpeg", "-v", "error", "-ss", str(boot), "-to", str(end), "-i", vid[0], "-vf", "fps=2,scale=480:320:flags=neighbor", os.path.join(fdir, "o%03d.png")], check=False)
    of = sorted(glob.glob(os.path.join(fdir, "*.png")))
    if of: sheet(of, os.path.join(out, "opening-strip.png"), cols=6, w=240, h=160, label=True)
lines = []
for d in rep.get("dialogue", []):
    t = d.replace("▼기록", "").replace("■기록", "")
    if lines and t.startswith(lines[-1][:max(1, min(len(lines[-1]), 6))]) and len(t) >= len(lines[-1]): lines[-1] = t
    else: lines.append(t)
tl = rep.get("timeline", {})
with open(os.path.join(out, "transcript.txt"), "w") as fh:
    fh.write("## 진행 표시(초)\n" + "\n".join(f"{m['t']/1000:6.1f}s {m['label']} {m.get('map') or ''}" for m in rep.get("marks", [])) + "\n\n")
    fh.write("## 상태별 누적(초)\n" + "\n".join(f"{k}: {v/1000:.1f}" for k, v in tl.get("totals", {}).items()) + "\n")
    fh.write("가장 긴 「글 없이 이벤트만 도는」 구간(ms): " + ", ".join(str(s["ms"]) for s in tl.get("longestNoText", [])) + "\n\n")
    fh.write("## 오프닝 컷(읽는 속도로 넘김)\n" + "\n".join(f"{s['sceneId']}: {s['ms']/1000:.1f}s {s['chars']}자" for s in rep.get("openingShots", [])) + "\n\n")
    fh.write("## 단계\n" + "\n".join(f"{'✓' if s['ok'] else '✗'} {s['id']}: {s.get('detail','')}" for s in rep.get("steps", [])) + "\n\n")
    fh.write("## 대사(화면에 뜬 순서, 말한 사람 이름이 뒤에 붙어 있다)\n" + "\n".join("- " + l for l in lines) + "\n\n")
    fh.write("## 전투 문장\n" + "\n".join("- " + l for l in rep.get("battleLines", [])[:200]) + "\n")
print(out)
