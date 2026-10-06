#!/usr/bin/env python3
"""이미 올린 OPRN 공식 상품에 다국어 글을 넣고(캐릭터 상품은 표지도 새로 굽고) 새 판본으로 올린다.

  python3 store-server/scripts/refresh_library.py --base http://mdc-server:18320 --dev admin@openrpgmaker.com
  python3 store-server/scripts/refresh_library.py --base https://store.openrpgmaker.com --link-token <admin-link 토큰>
  python3 store-server/scripts/refresh_library.py --base ... --dry   # 바뀔 상품만 본다(로그인 없이)

- 상품은 한국어 제목으로 찾는다. library_locales.py 에 없는 상품은 건드리지 않는다.
- 그림·타일셋 내용은 최신 판본 것을 그대로 둔다. 바뀌는 것은 locales 와 (얼굴·걷기 칩 상품의) 미리보기뿐이다.
- 이미 같은 글·같은 미리보기면 새 판본을 만들지 않는다(다시 돌려도 판본이 쌓이지 않는다).
"""
from __future__ import annotations

import argparse
import json
import sys
import time

from library_locales import locales_for
from seed_library import Session, character_items, face_items


def latest_manifest(session: Session, slug: str, version: int) -> dict:
    status, body = session.request("GET", f"/api/v1/items/{slug}/versions/{version}/manifest")
    if status != 200:
        raise RuntimeError(f"판본 읽기 실패 {slug} {status}")
    return json.loads(body)


def upload_missing(session: Session, blobs: dict[str, bytes]) -> None:
    if not blobs:
        return
    status, body = session.request("POST", "/api/v1/blobs/check", json.dumps({"sha256s": list(blobs)}).encode(), {"content-type": "application/json"})
    if status != 200:
        raise RuntimeError(f"blob 확인 실패 {status}")
    for key in json.loads(body)["missing"]:
        for _ in range(10):
            status, body = session.request("POST", "/api/v1/blobs", blobs[key], {"x-sha256": key, "content-type": "application/octet-stream"})
            if status != 429:
                break
            time.sleep(20)
        if status not in (200, 201):
            raise RuntimeError(f"blob 올리기 실패 {status}: {body[:200]!r}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--dev")
    parser.add_argument("--link-token")
    parser.add_argument("--dry", action="store_true")
    args = parser.parse_args()

    built = {item.title: item for item in [*face_items(), *character_items()]}
    session = Session(args.base)
    if not args.dry:
        if args.dev:
            session.form("/auth/dev", {"email": args.dev, "name": "OPRN", "next": "/"})
        elif args.link_token:
            session.form("/auth/link", {"token": args.link_token})
        else:
            sys.exit("--dev 또는 --link-token 이 필요합니다(--dry 는 필요 없음).")
        session.finish_login()
    try:
        status, body = session.request("GET", "/api/v1/items?pageSize=24&lang=ko")
        listing = json.loads(body)
        if listing["total"] > len(listing["items"]):
            sys.exit("상품이 한 쪽(24개)보다 많습니다. 쪽 넘김을 넣어 주세요.")
        for summary in listing["items"]:
            manifest = latest_manifest(session, summary["slug"], summary["latestVersion"])
            locales = locales_for(manifest["title"], manifest["summary"], manifest["description"])
            if locales is None:
                print("모름:", manifest["title"])
                continue
            changed = manifest.get("locales") != locales
            new_blobs: dict[str, bytes] = {}
            item = built.get(manifest["title"])
            if item is not None:
                previews = item.previews[:6]
                if previews != manifest["previews"]:
                    changed = True
                    known = {ref["sha256"]: ref for ref in manifest["blobs"]}
                    used = {asset["blob"] for asset in manifest["content"]["assets"].values()}
                    refs = [known[key] for key in sorted(used)]
                    for key in previews:
                        data, mime = item.blobs[key]
                        new_blobs[key] = data
                        if key not in used:
                            refs.append({"sha256": key, "mime": mime, "bytes": len(data)})
                            used.add(key)
                    manifest["previews"] = previews
                    manifest["blobs"] = refs
            if not changed:
                print("그대로:", manifest["title"])
                continue
            manifest["locales"] = locales
            if args.dry:
                print("바꿈(dry):", manifest["title"], "· 표지 새로" if new_blobs else "")
                continue
            upload_missing(session, new_blobs)
            time.sleep(3.5)  # 상품 만들기·새 판본은 분당 20번이 상한이다
            status, body = session.request("POST", f"/api/v1/items/{summary['slug']}/versions", json.dumps({"manifest": manifest}).encode(), {"content-type": "application/json"})
            if status != 201:
                raise RuntimeError(f"판본 올리기 실패 {summary['slug']} {status}: {body[:400].decode(errors='replace')}")
            result = json.loads(body)
            print("바꿈:", manifest["title"], f"→ 판본 {result['version']} ({result['status']})")
    finally:
        if not args.dry:
            session.logout()


if __name__ == "__main__":
    main()
