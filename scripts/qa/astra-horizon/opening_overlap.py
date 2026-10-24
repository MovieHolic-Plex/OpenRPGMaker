"""오프닝 애니메틱 겹침 검사 — 컷마다 50ms 간격으로 인물·새·몬스터의 「불투명 픽셀 상자」가 화면에서 겹치는지 잰다.
  python3 opening_overlap.py <project.json>
새(하늘 레이어, space=screen)끼리, 새와 인물·몬스터가 한 픽셀이라도 겹치면 실패로 적는다. 인물끼리(동료가 주인공 뒤를 따르는 것)는 참고로만 적는다.
"""
import base64, io, json, sys
from PIL import Image
p = json.load(open(sys.argv[1]))
up = p.get("assets", {}).get("uploaded", {})
def sheet_img(rid):
    a = up.get(rid)
    if a and a.get("dataUrl", "").startswith("data:image"):
        return Image.open(io.BytesIO(base64.b64decode(a["dataUrl"].split(",", 1)[1]))).convert("RGBA")
    return None
cache = {}
def frame_bbox(rid, frame, sheet):
    key = (rid, frame)
    if key in cache: return cache[key]
    img = sheet_img(rid); fw, fh, cols = sheet["frameWidth"], sheet["frameHeight"], sheet["columns"]
    bb = None
    if img is not None:
        cx, cy = (frame % cols) * fw, (frame // cols) * fh
        bb = img.crop((cx, cy, cx + fw, cy + fh)).getbbox()
    if bb is None: bb = (4, 2, fw - 4, fh)  # 사람 칸 기본: 좌우 4px 여백
    cache[key] = bb
    return bb
def sample(keys, t, fallback):
    if not keys: return fallback
    if t <= keys[0]["atMs"]: return keys[0]["value"]
    for a, b in zip(keys, keys[1:]):
        if t > b["atMs"]: continue
        u = (t - a["atMs"]) / max(1e-9, b["atMs"] - a["atMs"]); e = b.get("ease", "linear")
        if e == "step": u = 0 if t < b["atMs"] else 1
        elif e == "ease-in": u = u * u
        elif e == "ease-out": u = 1 - (1 - u) ** 2
        elif e == "ease-in-out": u = u * u * (3 - 2 * u)
        return a["value"] + (b["value"] - a["value"]) * u
    return keys[-1]["value"]
fails = 0
for scene in p["system"]["opening"]["scenes"]:
    comp = scene["composition"]; W, H = comp["width"], comp["height"]; cam = comp.get("camera") or {}
    layers = [l for l in comp["layers"] if l.get("kind") == "image" and l.get("role") == "actor"]
    worst = {}
    for t in range(0, scene["durationMs"] + 1, 50):
        cx = sample((cam.get("keys") or {}).get("x"), t, cam.get("x", W / 2)); cy = sample((cam.get("keys") or {}).get("y"), t, cam.get("y", H / 2))
        rects = []
        for l in layers:
            if t < l.get("startMs", 0) or ("endMs" in l and t >= l["endMs"]): continue
            k = l.get("keys") or {}
            x = sample(k.get("x"), t, l["x"]); y = sample(k.get("y"), t, l["y"])
            if l.get("space") != "screen": x -= cx - W / 2; y -= cy - H / 2
            if l.get("sheet"):
                fr = int(sample(k.get("frame"), t, (l.get("walk") or {}).get("frames", [0])[0]))
                bb = frame_bbox(l["resourceId"], fr, l["sheet"]); sx = l["width"] / l["sheet"]["frameWidth"]; sy = l["height"] / l["sheet"]["frameHeight"]
                r = (x + bb[0] * sx, y + bb[1] * sy, x + bb[2] * sx, y + bb[3] * sy)
            else:
                r = (x + l["width"] * 0.15, y + l["height"] * 0.15, x + l["width"] * 0.85, y + l["height"])
            if r[2] < 0 or r[0] > W or r[3] < 0 or r[1] > H: continue
            bird = l.get("space") == "screen" and "flyer" in l["id"]
            rects.append((l["id"], bird, r))
        for i in range(len(rects)):
            for j in range(i + 1, len(rects)):
                a, b = rects[i], rects[j]
                if not (a[1] or b[1]): continue
                ix = min(a[2][2], b[2][2]) - max(a[2][0], b[2][0]); iy = min(a[2][3], b[2][3]) - max(a[2][1], b[2][1])
                if ix > 0 and iy > 0:
                    key = (a[0], b[0]); area = ix * iy
                    if area > worst.get(key, (0, 0))[0]: worst[key] = (area, t)
    print(scene["id"], "겹침 없음" if not worst else "")
    for (a, b), (area, t) in sorted(worst.items(), key=lambda kv: -kv[1][0]):
        fails += 1; print(f"   ✗ {a} × {b}: 최대 {area:.0f}px² @ {t}ms")
print("FAIL" if fails else "OK", fails)
