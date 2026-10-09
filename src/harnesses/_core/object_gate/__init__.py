"""공용 오브젝트 게이트 — 굽기·게시 스크립트(Python)용 출구 확인.

모델을 부르지 않는다. 판정은 `npm run harness -- object-gate review` 가 하고, 여기서는 그 영수증만 읽어
그림 해시·종류·보정 프로필·출구 규칙을 확인한다. TS 쪽 같은 규칙: src/harnesses/_core/objectGate/receipt.ts.

    import sys; sys.path.insert(0, "src/harnesses/_core")
    from object_gate import require_pass, ObjectGateRefused
    require_pass(img, kind="tall_furniture", context="bundle", label="murim/prop_scroll_shelf")

출구(context): bundle·shared·store 는 pass 만(사람 덮어쓰기도 무효), workshop-local 은 pass 또는 사람의 「그래도 넣기」.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

KINDS = (
    "tall_furniture", "low_furniture", "seat", "frame", "container", "round_body", "column", "box",
    "structure", "figure", "organic", "debris", "flat", "wall_mounted", "terrain", "other",
)
CONTEXTS = ("bundle", "shared", "store", "workshop-local")

_REPO = Path(__file__).resolve().parents[4]
GATE_DATA = Path(os.environ.get("OBJECT_GATE_DATA") or _REPO / "harness-data" / "object-gate")


class ObjectGateRefused(Exception):
    """출구가 그림을 거절했다. 메시지는 사람이 읽을 이유."""


def normalize(img):
    """완전 투명 화소 RGB→0, 불투명 경계 상자로 자르기. TS normalizeObjectGateImage 와 같다."""
    from PIL import Image
    if not hasattr(img, "convert"):
        img = Image.open(img)
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    box = alpha.getbbox()
    if box is None:
        return Image.new("RGBA", (0, 0))
    rgba = rgba.crop(box)
    clear = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    mask = rgba.getchannel("A").point(lambda a: 255 if a > 0 else 0)
    return Image.composite(rgba, clear, mask)


def pixel_sha256(img) -> str:
    """sha256(f"{w}x{h}:" + RGBA 바이트) — normalize() 뒤의 그림. PIL Image 또는 PNG 경로."""
    rgba = normalize(img)
    w, h = rgba.size
    return hashlib.sha256(f"{w}x{h}:".encode() + rgba.tobytes()).hexdigest()


def read_receipt(sha: str) -> dict | None:
    path = GATE_DATA / "receipts" / sha[:2] / f"{sha}.json"
    return json.loads(path.read_text()) if path.exists() else None


def calibrated_profiles() -> set[str]:
    root = GATE_DATA / "profiles"
    if not root.exists():
        return set()
    out = set()
    for path in root.glob("*.json"):
        record = json.loads(path.read_text())
        if record.get("status") == "calibrated":
            out.add(record["profileHash"])
    return out


def refusal(img, *, kind: str | None, context: str) -> str | None:
    """통과면 None, 막으면 이유."""
    if context not in CONTEXTS:
        raise ValueError(f"모르는 출구 {context}: {CONTEXTS}")
    if kind is not None and kind not in KINDS:
        raise ValueError(f"모르는 종류 {kind}: {KINDS}")
    sha = pixel_sha256(img)
    receipt = read_receipt(sha)
    if not receipt:
        return "3/4 시점 판정 영수증이 없다 — object-gate review 를 먼저 받아라"
    if kind and receipt.get("kind") != kind:
        return f"영수증 종류({receipt.get('kind')})가 요청 종류({kind})와 다르다"
    if receipt.get("profileHash") not in calibrated_profiles():
        return f"판정 프로필 {receipt.get('profileHash')} 가 보정되지 않았다"
    if receipt.get("verdict") == "pass":
        return None
    if context == "workshop-local" and (receipt.get("override") or {}).get("by") == "human":
        return None
    why = " · ".join(receipt.get("reasons") or []) or "fail"
    if context == "workshop-local":
        return f"3/4 시점 판정 불합격({why}) — 다시 그리거나 사람이 「그래도 넣기」를 눌러야 한다"
    return f"3/4 시점 판정 불합격({why}) — {context} 출구는 예외 없이 막는다"


def require_pass(img, *, kind: str, context: str, label: str = "") -> str:
    """통과하면 화소 해시를 돌려주고, 아니면 ObjectGateRefused."""
    why = refusal(img, kind=kind, context=context)
    if why:
        raise ObjectGateRefused(f"{label or '그림'}: {why}")
    return pixel_sha256(img)


def require_all(items, *, context: str) -> list[str]:
    """[(img, kind, label), …] 를 전부 확인하고, 하나라도 막히면 전체 이유를 모아 ObjectGateRefused."""
    problems, hashes = [], []
    for img, kind, label in items:
        why = refusal(img, kind=kind, context=context)
        if why:
            problems.append(f"{label}: {why}")
        else:
            hashes.append(pixel_sha256(img))
    if problems:
        raise ObjectGateRefused(f"{len(problems)}개 거절\n" + "\n".join(problems))
    return hashes
