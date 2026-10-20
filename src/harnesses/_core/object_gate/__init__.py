"""공용 오브젝트 게이트 — 굽기·게시 스크립트(Python)용 출구 확인.

모델을 부르지 않는다. 판정은 `npm run harness -- object-gate review` 가 하고, 여기서는 그 영수증만 읽어
그림 해시·종류·보정 프로필·출구 규칙을 확인한다. TS 쪽 같은 규칙: src/harnesses/_core/objectGate/receipt.ts.

    import sys; sys.path.insert(0, "src/harnesses/_core")
    from object_gate import require_pass, ObjectGateRefused
    require_pass(img, kind="tall_furniture", context="bundle", label="murim/prop_scroll_shelf")

최종 통과는 서명된 사람 허용이다(2026-10-20 사용자 결정 — AI 판정 보정 2회 실패, 사용자가 매번 눈으로 판정 → AI 는 1차 거름·조언).
사람이 검토 화면(`object-gate serve-holds`, 18323)에서 허용한 기록(approvals/hold/<해시>.json, 저장소 밖 키로 HMAC 서명)이
그림 해시·종류와 맞고 그 그림의 영수증(어느 프로필이든 — AI 조언)이 있으면 모든 출구를 지난다. 사람 거절은 최종이다.
서명이 안 맞는 기록(손으로 쓴 것)은 없는 것과 같다. 사람 결정이 없으면 보정된 프로필의 pass 만 지난다.
front_prop 은 사람 승인 기록(approvals/front_prop/<해시>.json)이 있어야만 3/4 반쪽을 면제한다(승인은 CLI approve-front-prop, 터미널에서 사람이 직접).
출구(context): bundle·shared·store 는 pass 만(사람 덮어쓰기도 무효), workshop-local 은 pass 또는 사람의 「그래도 넣기」.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from pathlib import Path

KINDS = (
    "tall_furniture", "low_furniture", "seat", "frame", "container", "round_body", "column", "box",
    "structure", "figure", "organic", "debris", "flat", "wall_mounted", "front_prop", "terrain", "other",
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


def read_front_prop_approval(sha: str) -> dict | None:
    """front_prop 종류 선언의 사람 승인 기록. 그림 해시에 묶인다 — 그림이 한 화소라도 바뀌면 해시가 달라져 승인은 없는 것과 같다."""
    path = GATE_DATA / "approvals" / "front_prop" / sha[:2] / f"{sha}.json"
    if not path.exists():
        return None
    a = json.loads(path.read_text())
    ok = (a.get("schema") == "oprn-object-gate-front-prop-approval/1" and a.get("by") == "human" and a.get("kind") == "front_prop"
          and a.get("pixelSha256") == sha and str(a.get("approvedBy") or "").strip() and a.get("approvedAt"))
    return a if ok else None


HOLD_KEY_PATH = Path(os.environ.get("OBJECT_GATE_HOLD_KEY") or Path.home() / ".config" / "oprn" / "object-gate-hold.key")
_HOLD_KEYS = ("schema", "pixelSha256", "profileHash", "kind", "decision", "decidedBy", "decidedAt", "by", "via", "reasons", "note")


def hold_payload(d: dict) -> str:
    """서명 대상 문자열. TS objectGateHoldPayload 와 같다."""
    return json.dumps([[k, d.get(k)] for k in _HOLD_KEYS], ensure_ascii=False, separators=(",", ":"))


def read_hold_decision(sha: str) -> dict | None:
    """보류 판정의 사람 결정 기록. 검토 화면 서버의 서명이 맞을 때만 돌려준다."""
    path = GATE_DATA / "approvals" / "hold" / sha[:2] / f"{sha}.json"
    if not path.exists() or not HOLD_KEY_PATH.exists():
        return None
    key_hex = HOLD_KEY_PATH.read_text().strip()
    if len(key_hex) != 64:
        return None
    d = json.loads(path.read_text())
    want = hmac.new(bytes.fromhex(key_hex), hold_payload(d).encode(), hashlib.sha256).hexdigest()
    return d if hmac.compare_digest(str(d.get("sig") or ""), want) else None


def human_decision(d: dict | None, receipt: dict | None) -> str | None:
    """서명 확인을 마친 사람 결정이 이 영수증(그림 해시·종류)에 묶였으면 'allow'|'reject', 아니면 None. 프로필 보정 여부는 보지 않는다(TS humanDecision 과 같다)."""
    if not d or not receipt:
        return None
    ok = d.get("schema") == "oprn-object-gate-hold-decision/1" and d.get("by") == "human" and d.get("via") == "review-page" \
        and d.get("decision") in ("allow", "reject") and d.get("pixelSha256") == receipt.get("pixelSha256") \
        and d.get("kind") == receipt.get("kind") and str(d.get("decidedBy") or "").strip() != "" and bool(d.get("decidedAt")) \
        and bool(d.get("profileHash"))
    return d.get("decision") if ok else None


def hold_allows(d: dict | None, receipt: dict) -> bool:
    return human_decision(d, receipt) == "allow"


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
        return "3/4·화풍 판정 영수증이 없다 — object-gate review 를 먼저 받아라"
    if kind and receipt.get("kind") != kind:
        return f"영수증 종류({receipt.get('kind')})가 요청 종류({kind})와 다르다"
    # 사람 결정이 최종이다(2026-10-20): 허용 = 통과(프로필 보정 여부·AI 판정과 무관), 거절 = 모든 출구에서 막는다(TS objectGateRefusal 과 같다).
    held = read_hold_decision(sha)
    human = human_decision(held, receipt)
    if human == "reject":
        return f"사람이 검토 화면에서 거절했다({held.get('decidedBy')}, {str(held.get('decidedAt'))[:10]}) — 최종이다. 다시 그려 새 해시로 다시 받아라"
    if human == "allow":
        return None
    if receipt.get("profileHash") not in calibrated_profiles():
        return f"판정 프로필 {receipt.get('profileHash')} 가 보정되지 않았다 — AI 판정({receipt.get('verdict')})은 조언일 뿐이다. 검토 화면(serve-holds, 18323)에서 사람이 허용해야 지나간다"
    # front_prop: 이 그림 해시에 사람이 종류를 승인했다면 3/4 반쪽은 면제 — 화풍 반쪽만 본다(TS objectGateRefusal 과 같다).
    if receipt.get("kind") == "front_prop" and read_front_prop_approval(sha):
        sv = (receipt.get("style") or {}).get("verdict")
        if sv == "pass":
            return None
        if sv == "refer":
            return "화풍 판정 보류(정면형 소품은 사람이 종류를 승인했으나 화풍 반쪽이 사람 확인 필요) — 보류는 통과로 세지 않는다"
        return f"화풍 불합격(정면형 소품은 3/4 면제를 승인받았으나 화풍 반쪽이 떨어졌다: {' · '.join((receipt.get('style') or {}).get('reasons') or []) or 'fail'})"
    if receipt.get("verdict") == "pass":
        return None
    if receipt.get("verdict") == "refer":
        # 보류(판정자 의견이 갈림·사용자 정의 영역)는 pass 가 아니다 — 모든 출구에서 막는다(workshop-local 의 사람 덮어쓰기만 예외).
        if not (context == "workshop-local" and (receipt.get("override") or {}).get("by") == "human"):
            why = " · ".join(receipt.get("reasons") or []) or "판정자 의견이 갈림"
            return f"판정 보류(사람 확인 필요: {why}) — 보류는 통과로 세지 않는다"
        return None
    if context == "workshop-local" and (receipt.get("override") or {}).get("by") == "human":
        return None
    why = " · ".join(receipt.get("reasons") or []) or "fail"
    if context == "workshop-local":
        return f"판정 불합격({why}) — 다시 그리거나 사람이 「그래도 넣기」를 눌러야 한다"
    return f"판정 불합격({why}) — {context} 출구는 예외 없이 막는다"


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
