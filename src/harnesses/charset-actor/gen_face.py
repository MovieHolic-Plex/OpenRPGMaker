"""얼굴(48×48)을 이미지 생성으로 바꾼다 — 2026-10-02 사용자 결정: 「face 는 생성형 이미지를 통해 바꾸는 게 낫다」.

칩은 여전히 손 도트(생성 금지)다. 얼굴만 예외.
참고 그림 = [Actor1 원본 얼굴(뼈대) | 새 칩 정면·오른쪽(정답)] 한 장. 생성은 저장소 흉상·전신 파이프라인과 같은 API
(`MDC_IMAGE_API`, god-tibo-imagen). 결과는 1024 정사각 → 48×48 로 줄이고 96색으로 맞춘다.
"""
from __future__ import annotations

import base64
import io
import json
import os
import urllib.request
from pathlib import Path

from PIL import Image

import chr as C

API = os.environ.get('MDC_IMAGE_API', 'http://100.73.251.77:8091') + '/v1/generate/json'
PANEL = 512

PROMPT = """Edit task. The reference image has two panels.
LEFT: a 48x48 RPG Maker 2000 style dialogue face portrait (enlarged). This is the art style, framing and pose to keep.
RIGHT: the walking sprite of a NEW character (front and side view, enlarged pixel art). The sprite is the ground truth for this character's design.

Redraw the LEFT portrait as this new character: {brief}
Keep EXACTLY from the left portrait: the 16-bit SNES/RPG Maker 2000 anime portrait style, the head angle and pose, the crop (head and shoulders filling the square), the line art weight, the soft cel shading, the eye style and size, and a plain flat background in the same position.
Change to match the sprite and the description: hair style and hair color, headwear, accessories, eye color, facial hair, skin tone, and the clothing visible at the neck and shoulders (colors and collar).
Output ONE square portrait only, no text, no border, no second panel, no sprite. It will be downscaled to 48x48 pixels, so keep shapes bold and readable."""


def _b64(im):
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return base64.b64encode(buf.getvalue()).decode()


def _chip_panel(chip_file):
    pal, _, fr = C.load(chip_file)
    bg = (205, 205, 210, 255)
    im = Image.new('RGBA', (C.FW * 2 + 8, C.FH), bg)
    im.alpha_composite(C.frame_rgba(pal, fr[('down', 1)]), (0, 0))
    im.alpha_composite(C.frame_rgba(pal, fr[('right', 1)]), (C.FW + 8, 0))
    s = PANEL // C.FH
    return C.up(im, s).convert('RGB')


def reference(base_face_rgba, chip_file):
    face = base_face_rgba.convert('RGB').resize((PANEL, PANEL), Image.NEAREST)
    chip = _chip_panel(chip_file)
    W = PANEL + 32 + chip.width
    ref = Image.new('RGB', (W, PANEL), (255, 255, 255))
    ref.paste(face, (0, 0))
    ref.paste(chip, (PANEL + 32, (PANEL - chip.height) // 2))
    return ref


def generate(ref, brief, timeout=1200):
    body = json.dumps({'prompt': PROMPT.format(brief=brief), 'reference_b64': _b64(ref), 'fallback': True, 'priority': 0,
                       'size': '1024x1024', 'return_base64': True}).encode()
    req = urllib.request.Request(API, body, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        j = json.load(r)
    if not j.get('ok') or not j.get('image_b64'):
        raise RuntimeError(json.dumps(j, ensure_ascii=False)[:300])
    return Image.open(io.BytesIO(base64.b64decode(j['image_b64']))).convert('RGB'), j.get('engine'), j.get('duration_sec')


def to_face(raw, colors=96):
    """정사각으로 가운데 자르고 48×48 로 줄인 뒤 색을 맞춘다(RM2000 얼굴은 부드러운 명암이라 LANCZOS 축소가 결에 맞다)."""
    w, h = raw.size
    s = min(w, h)
    sq = raw.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    small = sq.resize((C.FACE, C.FACE), Image.LANCZOS)
    return small.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')


# ─────────────────────────────── 각도·구도 고정 검사 ───────────────────────────────
def kept_mask(base_rows, hand_rows, base_pal, hand_pal):
    """손 도트 얼굴이 뼈대에서 손대지 않은(색만 같은 단계로 옮긴 것도 포함) 칸 = 얼굴 골격 칸.
    색 글자가 아니라 밝기 순위로 비교한다 — 피부를 다른 톤으로 옮겨도 골격은 같다."""
    def lum(p, c):
        v = p.get(c)
        return 0 if v is None else 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]
    m = []
    for y in range(C.FACE):
        for x in range(C.FACE):
            if base_rows[y][x] == hand_rows[y][x] or abs(lum(base_pal, base_rows[y][x]) - lum(hand_pal, hand_rows[y][x])) < 6:
                m.append((x, y))
    return m


def pose_score(gen48, base_rgba, mask):
    """마스크 칸에서 밝기 구조가 뼈대와 얼마나 같은가(정규화 상관, -1..1). 각도·크기·위치가 바뀌면 크게 떨어진다.
    밝기 평균·대비는 정규화로 지우므로 피부색·조명 차이에는 둔하다."""
    import math
    g = gen48.convert('L').load()
    b = base_rgba.convert('L').load()
    a = [g[x, y] for x, y in mask]
    c = [b[x, y] for x, y in mask]
    if len(a) < 30:
        return 0.0
    ma, mc = sum(a) / len(a), sum(c) / len(c)
    va = math.sqrt(sum((v - ma) ** 2 for v in a))
    vc = math.sqrt(sum((v - mc) ** 2 for v in c))
    if va == 0 or vc == 0:
        return 0.0
    return sum((x - ma) * (y - mc) for x, y in zip(a, c)) / (va * vc)


# ─────────────────────────────── 고정 생성(v2) ───────────────────────────────
# v1 은 [원본 얼굴 | 칩] 을 주고 「이 캐릭터로 다시 그려라」였다 → 18명 모두 각도·구도가 바뀌었다(pose_score ≤0.47).
# v2 는 손 도트 얼굴(원본과 픽셀 골격이 같고 색·머리만 바뀐 것)을 정사각 그대로 주고 「손질만」 시킨다.
PROMPT_LOCK = """Clean-up repaint of THIS exact portrait. The reference is a 48x48 RPG Maker 2000 dialogue face (enlarged) that was hand-edited
into a new character: {brief}
It is crude where it was edited (hair, headwear, clothing at the shoulders). Repaint it as a clean, finished portrait in the SAME 16-bit
RPG Maker 2000 anime portrait style.

HARD LOCK — do not change any of these: the head angle and tilt, the direction the face looks, the face outline and jaw, the position,
size and shape of the eyes, eyebrows, nose and mouth, the crop and zoom (same head size, same position in the square), the shoulder line,
the light direction, and the flat background colour. Do not rotate, re-pose, zoom, move or redraw the face. Imagine tracing over it.

Only allowed: clean up the hair, headwear, accessories and clothing so they read clearly and match the description, and smooth the
shading to match the untouched parts of the face. Output ONE square image, same framing as the reference, no text, no border."""


def reference_lock(hand_rgba, size=1024):
    return hand_rgba.convert('RGB').resize((size, size), Image.NEAREST)


def generate_lock(ref, brief, timeout=1200):
    body = json.dumps({'prompt': PROMPT_LOCK.format(brief=brief), 'reference_b64': _b64(ref), 'fallback': True, 'priority': 0,
                       'size': '1024x1024', 'return_base64': True}).encode()
    req = urllib.request.Request(API, body, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        j = json.load(r)
    if not j.get('ok') or not j.get('image_b64'):
        raise RuntimeError(json.dumps(j, ensure_ascii=False)[:300])
    return Image.open(io.BytesIO(base64.b64decode(j['image_b64']))).convert('RGB'), j.get('engine'), j.get('duration_sec')


# ─────────────────────────────── 각도만 고정(v3) ───────────────────────────────
# 사용자(2026-10-02): 「얼굴은 생성으로 많이 바꿔도 괜찮다, 보는 각도만 유지한다면」. v2 는 눈코입 위치까지 잠가서 손 도트를 다듬는 데 그쳤다.
# v3 은 생김새·머리·표정·옷은 자유, 고개 방향·회전량·기울기·시선·구도만 잠근다. 판정은 각도 전용 검수자(judge_angle).
PROMPT_FREE = """Redraw this RPG Maker 2000 dialogue face portrait (48x48, enlarged) as a fully finished NEW character: {brief}
Style: the same 16-bit SNES / RPG Maker 2000 anime portrait style, soft cel shading, clean line art.

You may change freely: hair style and colour, face shape, eyes, eyebrows, nose, mouth, expression, apparent age, skin tone,
headwear, accessories, clothing, background colour. Make it look like a different person who matches the description.

HARD LOCK — the camera and the head pose must stay exactly as in the reference:
- the same direction the head is turned (the same side of the face toward the viewer) and the same amount of turn,
- the same head tilt and the same up/down angle,
- the same gaze direction,
- the same framing: head and shoulders, the head the same size and in the same place in the square, cut off at the same edges.
Output ONE square portrait, no text, no border, no second panel. It will be downscaled to 48x48, so keep shapes bold."""

JUDGE = """You judge ONLY the head pose of two RPG Maker dialogue face portraits. Ignore identity, hair, colours, clothing, expression, style.
Open both images with the Read tool:
- {BASE}: the original portrait (reference pose).
- {CAND}: a new portrait that must keep the reference pose.
Compare: (1) which way the head is turned and how much (yaw), (2) head tilt (roll), (3) up/down angle (pitch), (4) gaze direction,
(5) framing — head size and position in the square, where the shoulders are cut.
Write the file {OUT} (JSON only) with:
{{"same_direction": true|false, "score": 0-10, "yaw": "same|more|less|opposite", "issues": ["short note", ...]}}
score 10 = the pose and framing are the same; 7 = small differences a player would not notice; 4 or below = clearly a different angle or framing.
"same_direction" is false if the face turns to the other side or faces front while the reference is three-quarter (or the reverse).
Do not write anything else anywhere."""


def generate_free(ref, brief, timeout=1200):
    body = json.dumps({'prompt': PROMPT_FREE.format(brief=brief), 'reference_b64': _b64(ref), 'fallback': True, 'priority': 0,
                       'size': '1024x1024', 'return_base64': True}).encode()
    req = urllib.request.Request(API, body, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        j = json.load(r)
    if not j.get('ok') or not j.get('image_b64'):
        raise RuntimeError(json.dumps(j, ensure_ascii=False)[:300])
    return Image.open(io.BytesIO(base64.b64decode(j['image_b64']))).convert('RGB'), j.get('engine'), j.get('duration_sec')


def judge_angle(workdir, base_png, cand_png, out_json, model='claude-sonnet-5-5', effort='medium', timeout=600):
    """각도 전용 검수자(Claude). → dict 또는 None. 그림 두 장만 보고 고개 방향·회전·기울기·시선·구도를 비교한다."""
    import shutil
    import subprocess
    workdir = Path(workdir)
    prompt = JUDGE.format(BASE=base_png, CAND=cand_png, OUT=out_json)
    try:
        Path(out_json).unlink()
    except OSError:
        pass
    subprocess.run(['timeout', str(timeout), shutil.which('claude') or 'claude', '-p', '--model', model, '--effort', effort,
                    '--dangerously-skip-permissions', '--output-format', 'text'], input=prompt.encode(), cwd=workdir,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        return json.loads(Path(out_json).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None
