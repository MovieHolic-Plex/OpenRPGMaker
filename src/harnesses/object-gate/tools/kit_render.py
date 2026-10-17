"""칩셋 시트 + 타일셋 정의(JSON)에서 키트·타일 그룹을 그림으로 합성한다(어떤 커밋의 판이든).

object-gate 의 화풍 기준 그림(버들항)과 화풍 보정 표본(고치기 전/후 조각)을 만드는 데 쓴다.
    from kit_render import load_commit, render_kit, render_group_patch
"""
from __future__ import annotations

import io
import json
import subprocess
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[4]


def git_show(commit: str, path: str) -> bytes:
    return subprocess.run(["git", "show", f"{commit}:{path}"], cwd=REPO, check=True, capture_output=True).stdout


def load_commit(commit: str, tileset_json: str, sheet_png: str):
    """(tileset dict, sheet RGBA 이미지). commit 이 None 이면 작업 트리에서 읽는다."""
    if commit is None:
        tileset = json.loads((REPO / tileset_json).read_text())
        sheet = Image.open(REPO / sheet_png).convert("RGBA")
    else:
        tileset = json.loads(git_show(commit, tileset_json))
        sheet = Image.open(io.BytesIO(git_show(commit, sheet_png))).convert("RGBA")
    return tileset, sheet


def tile_image(sheet: Image.Image, tpr: int, ts: int, tid: int) -> Image.Image:
    x, y = (tid % tpr) * ts, (tid // tpr) * ts
    return sheet.crop((x, y, x + ts, y + ts))


def render_kit(kit: dict, sheet: Image.Image, tpr: int, ts: int = 16) -> Image.Image:
    w, h = kit["width"], kit["height"]
    out = Image.new("RGBA", (w * ts, h * ts), (0, 0, 0, 0))
    for r, row in enumerate(kit["rows"]):
        for layer in ("tiles", "upperTiles"):
            for c, tid in enumerate(row.get(layer, [])):
                if tid is None or tid < 0:
                    continue
                out.alpha_composite(tile_image(sheet, tpr, ts, tid), (c * ts, r * ts))
    return out


def render_group_patch(tile_ids: list[int], sheet: Image.Image, tpr: int, ts: int = 16, cols: int = 4, rows: int = 3) -> Image.Image:
    """바닥 타일 그룹 → cols×rows 칸 패치(돌아가며 깐다). 한 칸짜리 반복 대신 변형이 섞인 면을 본다."""
    out = Image.new("RGBA", (cols * ts, rows * ts), (0, 0, 0, 0))
    for i in range(cols * rows):
        out.alpha_composite(tile_image(sheet, tpr, ts, tile_ids[i % len(tile_ids)]), ((i % cols) * ts, (i // cols) * ts))
    return out


def trim(img: Image.Image) -> Image.Image:
    box = img.getchannel("A").getbbox()
    return img.crop(box) if box else img
