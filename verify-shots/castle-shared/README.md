# 성채 학습 자료 — 번들 공용 배포와 이미지 축소 (2026-09-22)

성채 학습은 번들이 소유한다. 이 브랜치는 배포된 그림을 축소해 에디터가 싣는 페이로드를 줄인다.

- 이전: `src/assets/sharedCastleReferences.json` 14.25MB (그림 10.58MB, 원본 크기 그대로)
- 이후: 3.08MB (그림 2.18MB)
- 문서 ID·이름·캡션·본문은 main과 완전히 동일하다. 바뀐 것은 그림 `dataUrl` 바이트뿐이다.
- 축소 기준: 긴 변 820px, 128색 팔레트 PNG. 작은 그림(120KB 이하, 예: `숲 조립 완성.png`)은 정확한 픽셀을 지키려고 그대로 둔다.

## 확인

- `probe.json` — 새 프로젝트(`?freshProject=1`)의 성 타일셋이 4용도(4+8+8+21 MD / 7+2+10+1 이미지)를 갖고 페이로드가 3.04MB다. 이미지가 820×819로 렌더된다. pageerror 0.
- `castle-shared-database.png`, `castle-shared-images.png` — 실제 화면.

노드 실측:

- `createBlankProject()` → 4용도, 3.04MB.
- `validateTilesetReferences` 통과.
- `list_tileset_references` 4용도, `read_tileset_reference` 로 MD(705자)와 이미지 전달.
- 문서 ID·본문이 `origin/main` 과 동일함을 비교 확인.
- `scripts/content/prepare-castle-references.mjs` 는 멱등하다(`--dry` 로 대상만 확인 가능).

원격(Supabase)에는 쓰지 않았다. 프로젝트 정본은 SQLite 호스트다.
