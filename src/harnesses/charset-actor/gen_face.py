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
