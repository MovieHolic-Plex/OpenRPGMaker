#!/usr/bin/env python3
"""OPRN 공용 캐릭터 그림을 스토어 상품으로 올린다(얼굴·흉상·전신·걷기 칩).

  python3 store-server/scripts/seed_library.py --base http://mdc-server:18320 --dev admin@openrpgmaker.com
  python3 store-server/scripts/seed_library.py --base https://store.openrpgmaker.com --link-token <admin-link 토큰>
  python3 store-server/scripts/seed_library.py --dry          # 상품 목록과 크기만 본다

- 같은 제목의 상품이 이미 있으면 건너뛴다(다시 돌려도 중복이 생기지 않는다).
- 팩 하나의 에셋은 256개가 상한이라 묶음(Actor1·Actor2·People1·People2·Monster)마다 얼굴·흉상·전신을 따로 낸다.
- 출처: 얼굴 원본은 EasyRPG RTP(CC BY 4.0). 표정·흉상·전신·새 걷기 칩은 OPRN 이 만든 파생물이다.
  자세한 출처는 public/assets/ATTRIBUTION.md 「Restored common expression library」·「Generated bust and full-body portraits」.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

from PIL import Image, ImageDraw

from library_locales import locales_for

REPO = Path(__file__).resolve().parents[2]
PUBLIC = REPO / "public"
SOURCES = json.loads((REPO / "scripts/shared-face-expression-sources.json").read_text())
CHARSET_ACCEPTED = REPO / "harness-data/charset-actor/accepted"
LAWN = REPO / "harness-data/charset-actor/lawn16.png"
BG = (24, 26, 38, 255)
SHOWCASE_BG = (22, 25, 34, 255)

EXPRESSIONS = ["base", "smile", "happy", "content", "surprised", "embarrassed", "doubtful", "serious",
               "annoyed", "angry", "sad", "crying", "worried", "determined", "shy", "wink"]
EXPRESSION_LABELS = ["기본", "눈웃음", "기쁨", "흐뭇함", "놀람", "당황", "의심", "진지함",
                     "짜증", "분노", "슬픔", "울음", "걱정", "결의", "수줍음", "윙크"]
GROUPS = [
    ("Actor1", "모험가 1", ["모험가", "주인공"]),
    ("Actor2", "모험가 2", ["모험가", "주인공"]),
    ("People1", "마을 사람 1", ["마을 사람", "NPC"]),
    ("People2", "마을 사람 2", ["마을 사람", "NPC"]),
    ("Monster", "몬스터·짐승", ["몬스터", "동물"]),
]
EASYRPG_CREDIT = "원본 얼굴: EasyRPG RTP (CC BY 4.0, EasyRPG 프로젝트 기여자)"
FACE_KEY = (0, 147, 146)  # 하네스 걷기 칩의 투명색(RM2000 0번 색)


def png_bytes(image: Image.Image) -> bytes:
    out = io.BytesIO()
    image.save(out, format="PNG", optimize=True)
    return out.getvalue()


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fit(image: Image.Image, box: tuple[int, int], pixel: bool) -> Image.Image:
    w, h = image.size
    scale = min(box[0] / w, box[1] / h)
    if pixel:
        scale = max(1, int(scale))
    size = (max(1, int(w * scale)), max(1, int(h * scale)))
    return image.resize(size, Image.NEAREST if pixel else Image.LANCZOS)


def board(images: list[Image.Image], cols: int, size: tuple[int, int], pixel: bool, background: Image.Image | None = None, pad: int = 16) -> bytes:
    """표지: 그림을 cols 열로 고르게 놓는다. 칸 안에서는 바닥에 맞춰 세운다."""
    canvas = Image.new("RGBA", size, BG)
    if background is not None:
        tile = background.convert("RGBA").resize((background.width * 4, background.height * 4), Image.NEAREST)
        for y in range(0, size[1], tile.height):
            for x in range(0, size[0], tile.width):
                canvas.alpha_composite(tile, (x, y))
    rows = (len(images) + cols - 1) // cols
    cell = ((size[0] - pad * (cols + 1)) // cols, (size[1] - pad * (rows + 1)) // rows)
    side = min(cell) if pixel else None
    for index, image in enumerate(images):
        col, row = index % cols, index // cols
        placed = fit(image.convert("RGBA"), (side, side) if side else cell, pixel)
        x0 = pad + col * (cell[0] + pad) + (cell[0] - placed.width) // 2
        y0 = pad + row * (cell[1] + pad) + (cell[1] - placed.height)
        canvas.alpha_composite(placed, (x0, y0))
    return png_bytes(canvas)


def showcase(images: list[Image.Image], cols: int, rows: int, pixel: bool, shadow: bool = False, size: tuple[int, int] = (1200, 900), pad: int = 28) -> bytes:
    """표지(카드 4:3): 그림을 cols×rows 격자로 가득 놓고 격자 전체를 가운데에 둔다. 도트는 모두 같은 정수 배율."""
    images = [image.convert("RGBA") for image in images[:cols * rows]]
    rows = (len(images) + cols - 1) // cols
    canvas = Image.new("RGBA", size, SHOWCASE_BG)
    cell = ((size[0] - pad * (cols + 1)) / cols, (size[1] - pad * (rows + 1)) / rows)
    max_w, max_h = max(i.width for i in images), max(i.height for i in images)
    scale = min(cell[0] / max_w, cell[1] / max_h)
    if pixel:
        scale = max(1, int(scale))
    placed = [image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.NEAREST if pixel else Image.LANCZOS) for image in images]
    cw, ch = round(max_w * scale), round(max_h * scale)
    gap_x = (size[0] - cols * cw) / (cols + 1)
    gap_y = (size[1] - rows * ch) / (rows + 1)
    draw = ImageDraw.Draw(canvas)
    for index, image in enumerate(placed):
        col, row = index % cols, index // cols
        count_in_row = min(cols, len(placed) - row * cols)
        offset = (cols - count_in_row) * (cw + gap_x) / 2  # 마지막 줄이 모자라면 가운데로
        x0 = round(gap_x + col * (cw + gap_x) + offset + (cw - image.width) / 2)
        y0 = round(gap_y + row * (ch + gap_y) + (ch - image.height))
        if shadow:
            foot = y0 + image.height
            draw.ellipse((x0 + image.width * .18, foot - image.height * .07, x0 + image.width * .82, foot + image.height * .03), fill=(10, 12, 18, 255))
        canvas.alpha_composite(image, (x0, y0))
    return png_bytes(canvas)


class Item:
    def __init__(self, title: str, summary: str, description: str, kind: str, tags: list[str], credits: str, ai: bool, license_: str = "CC-BY-4.0"):
        self.title, self.summary, self.description, self.kind, self.tags, self.credits, self.ai, self.license = title, summary, description, kind, tags, credits, ai, license_
        self.assets: dict[str, dict] = {}
        self.blobs: dict[str, tuple[bytes, str]] = {}
        self.previews: list[str] = []

    def add_blob(self, data: bytes) -> str:
        key = sha(data)
        self.blobs[key] = (data, "image/png")
        return key

    def add_asset(self, asset_id: str, name: str, kind: str, data: bytes, meta: dict) -> None:
        assert asset_id not in self.assets, asset_id
        self.assets[asset_id] = {"id": asset_id, "name": name[:120], "kind": kind, "blob": self.add_blob(data), "mime": "image/png", "meta": meta}

    def add_preview(self, data: bytes) -> None:
        self.previews.append(self.add_blob(data))

    def manifest(self) -> dict:
        assert 0 < len(self.assets) <= 256, (self.title, len(self.assets))
        return {
            "schema": "oprn-store-pack/1", "title": self.title, "summary": self.summary, "description": self.description,
            "tags": self.tags, "kind": self.kind, "license": self.license, "aiGenerated": self.ai, "credits": self.credits,
            "content": {"assets": self.assets, "tilesets": {}}, "previews": self.previews[:6],
            **({"locales": locales} if (locales := locales_for(self.title, self.summary, self.description)) else {}),
            "blobs": [{"sha256": key, "mime": mime, "bytes": len(data)} for key, (data, mime) in self.blobs.items()],
        }

    @property
    def size(self) -> int:
        return sum(len(data) for data, _ in self.blobs.values())


def image_meta(data: bytes, face: bool = False) -> dict:
    w, h = Image.open(io.BytesIO(data)).size
    meta = {"width": w, "height": h}
    if face:
        meta.update({"tileSize": 48, "frames": 1, "frameWidth": 48, "frameHeight": 48})
    return meta


def group_sets(sheet: str) -> list[dict]:
    return [source for source in SOURCES if source["baseSheet"] == sheet]


def face_items() -> list[Item]:
    items = []
    for sheet, label, tags in GROUPS:
        sets = group_sets(sheet)
        names = ", ".join(s["name"] for s in sets[:6]) + (" 외" if len(sets) > 6 else "")
        faces = Item(
            f"얼굴 16표정 — {label} ({len(sets)}명)",
            f"대화창 얼굴 48×48. 한 사람마다 기쁨·슬픔·분노·놀람 등 16표정. {names}",
            f"{label} 묶음 {len(sets)}명의 대화용 얼굴입니다. 한 사람마다 표정 16칸(기본·눈웃음·기쁨·흐뭇함·놀람·당황·의심·진지함·짜증·분노·슬픔·울음·걱정·결의·수줍음·윙크)이 낱장으로 들어 있습니다.\n"
            "프로젝트에 넣으면 자료집의 얼굴 고르기·대사 얼굴 바꾸기에서 바로 보입니다. 같은 사람의 흉상·전신은 「흉상 16표정」「전신 16표정」 상품에 있습니다.",
            "face", ["얼굴", "표정", "대화", *tags], f"{EASYRPG_CREDIT} · 표정 그림: OPRN", False)
        for source in sets:
            stem = source["stem"]
            for index, expression_label in enumerate(EXPRESSION_LABELS):
                data = (PUBLIC / f"assets/shared/faceset/{stem}/{index:02d}.png").read_bytes()
                faces.add_asset(f"{stem}-face-{index:02d}", f"{source['name']} · {expression_label}", "faceset", data, image_meta(data, face=True))
        base = [Image.open(PUBLIC / f"assets/shared/faceset/{s['stem']}/00.png") for s in sets]
        faces.add_preview(showcase(base, 4, 3, True))
        first = [Image.open(PUBLIC / f"assets/shared/faceset/{sets[0]['stem']}/{i:02d}.png") for i in range(16)]
        faces.add_preview(board(first, 6, (960, 720), True))
        items.append(faces)

        for mode, mode_label, box_cols in (("bust", "흉상", 4), ("full", "전신", 6)):
            item = Item(
                f"{mode_label} 16표정 — {label} ({len(sets)}명)",
                f"대화창 {mode_label} 그림. 얼굴 16표정과 같은 사람·같은 표정. {names}",
                f"{label} 묶음 {len(sets)}명의 대화용 {mode_label} 그림입니다. 얼굴 상품과 같은 사람, 같은 16표정입니다.\n"
                f"대사의 얼굴 칸에 고르면 대화창이 {mode_label} 모양으로 바뀝니다(그림 이름에 「{mode}」가 들어 있어 편집기가 알아봅니다).\n"
                "흉상·전신은 AI 이미지 도구로 그렸고, 사람마다 짝 걷기 칩과 얼굴을 기준으로 옷·머리를 맞췄습니다.",
                "face", [mode_label, "표정", "대화", *tags], f"{EASYRPG_CREDIT} · {mode_label} 그림: OPRN (AI 생성)", True)
            for source in sets:
                folder = source["stem"].removesuffix("-expressions")
                for expression, expression_label in zip(EXPRESSIONS, EXPRESSION_LABELS):
                    data = (PUBLIC / f"assets/shared/portraits/{folder}/{mode}-{expression}.png").read_bytes()
                    item.add_asset(f"{folder}-{mode}-{expression}", f"{source['name']} · {mode_label} {expression_label}", "faceset", data, image_meta(data))
            folders = [s["stem"].removesuffix("-expressions") for s in sets]
            lineup = [Image.open(PUBLIC / f"assets/shared/portraits/{f}/{mode}-base.png") for f in folders[:box_cols * 2]]
            item.add_preview(showcase(lineup, box_cols, 2, False))
            one = [Image.open(PUBLIC / f"assets/shared/portraits/{folders[0]}/{mode}-{e}.png") for e in EXPRESSIONS[:8]]
            item.add_preview(board(one, 4, (1200, 900), False))
            items.append(item)
    return items


def keyed(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            if pixels[x, y][:3] == FACE_KEY:
                pixels[x, y] = (0, 0, 0, 0)
    return image


def front_frame(sheet: Image.Image, index: int) -> Image.Image:
    """RM2K3 걷기 칩 시트(4열×2행, 칸 72×128)에서 index 번째 사람의 정면 가운데 걸음."""
    x0, y0 = (index % 4) * 72, (index // 4) * 128
    return sheet.crop((x0 + 24, y0 + 64, x0 + 48, y0 + 96))


def character_items() -> list[Item]:
    items = []
    lawn = Image.open(LAWN) if LAWN.exists() else None
    people = sorted(CHARSET_ACCEPTED.glob("*.json"))
    if people:
        records = [json.loads(p.read_text()) for p in people]
        item = Item(
            f"걷기 칩 — 새 마을 사람·모험가 {len(records)}명",
            "RM2000 규격 걷기 칩(24×32, 4방향 3걸음). 점술가·암살자·무용수·수녀·황제 등 새 인물.",
            "OPRN 캐릭터 하네스로 새로 찍은 걷기 칩입니다. 사람이 하나씩 보고 남긴 것만 담았습니다.\n"
            "RM2000/2003 걷기 칩 시트(288×256, 한 장에 8명) " + str((len(records) + 7) // 8) + "장으로 묶었습니다. 프로젝트에 넣으면 이벤트·배우의 캐릭터 그림에서 고를 수 있습니다.\n"
            "들어 있는 사람: " + ", ".join(r["name"] for r in records),
            "character", ["걷기 칩", "캐릭터", "RM2000", "NPC", "도트"],
            "뼈대: EasyRPG RTP 걷기 칩 (CC BY 4.0, EasyRPG 프로젝트 기여자) · 새 그림: OPRN (AI 저작)", True)
        fronts = []
        for start in range(0, len(records), 8):
            sheet = Image.new("RGBA", (288, 256), (0, 0, 0, 0))
            chunk = people[start:start + 8]
            for i, path in enumerate(chunk):
                sheet.alpha_composite(keyed(path.with_suffix(".png")), ((i % 4) * 72, (i // 4) * 128))
            for i in range(len(chunk)):
                fronts.append(front_frame(sheet, i))
            data = png_bytes(sheet)
            number = start // 8 + 1
            names = ", ".join(records[start + i]["name"] for i in range(len(chunk)))
            item.add_asset(f"oprn-people-chars-{number}", f"새 마을 사람 {number} · {names}"[:120], "charset", data, image_meta(data))
        item.add_preview(showcase(fronts, 7, 3, True, shadow=True))
        for key in list(item.assets)[:3]:
            sheet = Image.open(io.BytesIO(item.blobs[item.assets[key]["blob"]][0]))
            item.add_preview(board([sheet], 1, (1200, 900), True, lawn))
        items.append(item)

    monsters = Item(
        "걷기 칩 — OPRN 몬스터 24종",
        "숲·요괴, 저주받은 물건, 전설의 괴수. RM2000 규격 몬스터 걷기 칩 3장.",
        "OPRN 이 좌표 도트로 직접 찍은 몬스터 걷기 칩입니다(Monster4~6, 한 장에 8마리).\n"
        "필드에서 돌아다니는 적·동료 몬스터 이벤트 그림으로 씁니다.",
        "character", ["걷기 칩", "몬스터", "RM2000", "도트"], "몬스터 걷기 칩: OPRN", True)
    names = {4: "숲·요괴", 5: "저주받은 물건", 6: "전설의 괴수"}
    fronts = []
    for n, label in names.items():
        data = (PUBLIC / f"assets/generated/charsets/Monster{n}.png").read_bytes()
        monsters.add_asset(f"oprn-monster{n}", f"OPRN 몬스터 {n} · {label}", "charset", data, image_meta(data))
        sheet = Image.open(io.BytesIO(data)).convert("RGBA")
        fronts.extend(front_frame(sheet, i) for i in range(8))
    monsters.add_preview(showcase(fronts, 8, 3, True, shadow=True))
    for key in monsters.assets:
        monsters.add_preview(board([Image.open(io.BytesIO(monsters.blobs[monsters.assets[key]["blob"]][0]))], 1, (1200, 900), True, lawn))
    items.append(monsters)
    return items


class Session:
    def __init__(self, base: str):
        self.base = base.rstrip("/")
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar), NoRedirect())
        self.csrf = ""

    def request(self, method: str, path: str, body: bytes | None = None, headers: dict | None = None) -> tuple[int, bytes]:
        all_headers = {"x-csrf-token": self.csrf, **(headers or {})}
        req = urllib.request.Request(self.base + path, data=body, method=method, headers=all_headers)
        try:
            with self.opener.open(req, timeout=120) as res:
                return res.status, res.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()

    def form(self, path: str, fields: dict) -> int:
        return self.request("POST", path, urllib.parse.urlencode(fields).encode(), {"content-type": "application/x-www-form-urlencoded"})[0]

    def finish_login(self) -> None:
        _, page = self.request("GET", "/")
        marker = b'<meta name="csrf" content="'
        start = page.find(marker)
        if start < 0:
            sys.exit("로그인하지 못했습니다(csrf 없음).")
        self.csrf = page[start + len(marker):page.find(b'"', start + len(marker))].decode()

    def logout(self) -> None:
        # 웹 세션은 /logout 양식으로 지운다(/api/v1/logout 은 앱 토큰만 지운다). 쓰고 난 운영자 세션을 남기지 않는다.
        self.form("/logout", {"csrf": self.csrf})


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # 303 을 따라가지 않고 쿠키만 받는다
        return None


def existing_titles(session: Session) -> set[str]:
    titles, page = set(), 1
    while True:
        _, body = session.request("GET", f"/api/v1/items?page={page}")
        data = json.loads(body)
        titles.update(item["title"] for item in data["items"])
        if page * data["pageSize"] >= data["total"]:
            return titles
        page += 1


def publish(session: Session, item: Item) -> str:
    manifest = item.manifest()
    status, body = session.request("POST", "/api/v1/blobs/check", json.dumps({"sha256s": list(item.blobs)}).encode(), {"content-type": "application/json"})
    if status != 200:
        raise RuntimeError(f"blob 확인 실패 {status}: {body[:200]!r}")
    for key in json.loads(body)["missing"]:
        data, _ = item.blobs[key]
        for _ in range(10):
            status, body = session.request("POST", "/api/v1/blobs", data, {"x-sha256": key, "content-type": "application/octet-stream"})
            if status != 429:
                break
            time.sleep(20)  # 서버의 분당 blob 상한(1500)에 걸리면 기다렸다가 다시 보낸다
        if status not in (200, 201):
            raise RuntimeError(f"blob 올리기 실패 {status}: {body[:200]!r}")
    status, body = session.request("POST", "/api/v1/items", json.dumps({"manifest": manifest}).encode(), {"content-type": "application/json"})
    if status != 201:
        raise RuntimeError(f"상품 만들기 실패 {status}: {body[:400].decode(errors='replace')}")
    result = json.loads(body)
    return f"{result['slug']} ({result['status']})"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base")
    parser.add_argument("--dev", help="스테이징 개발 로그인 이메일")
    parser.add_argument("--link-token", help="운영자 일회용 링크 토큰(dist/admin-link.mjs)")
    parser.add_argument("--dry", action="store_true")
    parser.add_argument("--only", help="제목에 이 글자가 든 상품만")
    args = parser.parse_args()

    items = [*face_items(), *character_items()]
    if args.only:
        items = [item for item in items if args.only in item.title]
    for item in items:
        print(f"{item.title}: 에셋 {len(item.assets)} · 미리보기 {len(item.previews)} · {item.size / 1048576:.1f}MB")
    if args.dry:
        out = Path("/tmp/store-library-previews")
        out.mkdir(exist_ok=True)
        for index, item in enumerate(items):
            for p, key in enumerate(item.previews):
                (out / f"{index:02d}-{p}.png").write_bytes(item.blobs[key][0])
        print("미리보기:", out)
        return
    session = Session(args.base)
    if args.dev:
        session.form("/auth/dev", {"email": args.dev, "name": "OPRN 운영", "next": "/"})
    elif args.link_token:
        session.form("/auth/link", {"token": args.link_token})
    else:
        sys.exit("--dev 또는 --link-token 이 필요합니다.")
    session.finish_login()
    try:
        have = existing_titles(session)
        for item in items:
            if item.title in have:
                print("있음:", item.title)
                continue
            print("올림:", item.title, "→", publish(session, item))
    finally:
        session.logout()


if __name__ == "__main__":
    main()
