# Pixel Art World 맵 51종

`scripts/content/paw-maps/` 의 생성기 51개(`m01`~`m61`)가 PAW 팩 시트를 직접 찍어 완성 맵을 만든다. 외부 거리·주택가 16,
가정·저택 실내, 상점·시설 실내, 하수도·월드맵·특수 장소를 포함한다. 그림은 사용자가 받은 원본에서만 읽고 Git 에는 넣지 않는다.

## 만들고 확인하기

- `python3 run_all.py [m01 m09 …]` — 렌더(`~/claude-viz/paw-maps/*.png`)·갤러리 `paw-maps.html` 생성. 실패 맵이 있으면 0 이 아닌 코드로 끝난다.
- 실내 맵은 `Map.layout(rows, legend)` 평면도로 그린다. `#` 칸이 천장이고, 천장 아래가 열린 곳은 어디든 벽면을 자동으로 내린다.
- `save()` 는 실내 구조 린트를 통과해야 저장한다. L1 layout 미사용, L2 천장 바로 아래 바닥, L3 모든 방이 직사각형, L4 천장 위 물건.
  위반이 하나라도 있으면 그 맵은 FAIL 이다. 규칙 설명은 `scripts/content/paw-maps/README.md`.

## 공용 DB 등록 — 에디터 기본 모델 (2026-09-27)

구운 그림 한 장이 아니라 **원본 시트 타일셋 → 오브젝트 → 장소** 로 올린다.

**제약과 우회.** 에디터 맵은 타일셋을 하나만 쓴다(`GameMap.tilesetId`). PAW 맵 하나는 원본 시트를 여러 장 섞으므로,
맵을 네 무리(외부 m01–m19 · 가정 m20–m34 · 시설 m35–m49 · 특수 m50–)로 나누고 무리마다 합본 타일셋
`shared_paw51_<ext|home|fac|spec>`(64열)을 둔다. 합본에는 원본 시트를 **통째 블록**으로 싣는다.
칸 번호 = 블록 첫 칸 + 원본 칸의 (행 × 64) + 열. 즉 원본 칸 번호가 그대로 보존된다.

1. `python3 scripts/content/paw-maps/pack.py` — 맵을 다시 그리며 모든 칸 찍기를 기록해 무리별 합본을 만든다.
   - 원본 시트는 블록으로 싣는다. 블록 위치는 팩 `sheets[]`와 타일셋 참고문서 「원본 시트와 칸 번호」에 있다.
   - 공용 DB 에 **같은 그림의 PAW 타일셋이 이미 있으면**(100장 중 32장, 예: `shared_paw_library`, `shared_paw_sewer`),
     그 타일셋의 통행·층·칸 설명을 가져오고 `sharedTileset` 참조를 남긴다.
   - XP 자동타일은 256 마스크 변형 블록 + `autotileGroups` 로 싣는다(비트 = 에디터 AUTOTILE_DIR).
   - 격자에 안 맞는 원본 조각(문·가구·겹침 합성)은 블록 아래 32px 칸으로 자른다.
   - 맵에 찍힌 가구·소품·건물 599종은 오브젝트가 된다. 이름은 `object-names.json`(그림을 보고 붙인 한글 이름)과 맵 코드의 한글 라벨.
   - 그 자리에서 합본 칸만으로 51장을 되살려 갤러리 PNG 와 비교한다. 4/255 를 넘으면 실패.
2. `node scripts/content/publish-pixel-art-world-maps.mjs [--dry]` — 공용 SQLite 라이브러리 `pixel-art-world-maps-51-local`
   (`projectDefaults: true`) 로 올린다.
   - 오브젝트: `shared_paw51_obj_*` 구조 킷(위층 전용, `layerHome: upper`) + 같은 이름의 `tileGroups`(`previewMap`) + 미리보기 그림.
     자료집 → 맵 → 오브젝트에 「공용 오브젝트」로 나온다.
   - 장소: 맵마다 root → 층 장소 → `raster_paw51_<id>` 구획 킷(아래층 + 위층). 층 장소의 `maps` 기록은 위층 겹침(`upperTileStacks`)까지 담는다.
     구획 킷은 두 줄만 담으므로 위층이 두 겹인 칸은 겹친 그림을 조각 하나로 합성해 둔다.
     장소 참고문서에 배치 오브젝트 표(이름·킷·좌표)가 붙는다.
   - 게시 직전 SQLite 사본을 `~/.local/share/oprn/backups/shared-content-before-paw51-native-*.sqlite` 로 뜨고,
     게시 후 다시 읽은 본문이 게시본과 같은지, 다른 라이브러리 payload 해시가 그대로인지 확인한다.
3. `python3 scripts/content/paw-maps/verify_published.py` — 공용 DB 만 읽어 51맵을 두 경로(맵 기록 · 구획 킷)로 다시 그려
   갤러리와 비교하고, 오브젝트 미리보기가 칸 그림과 같은지 본다.

증명은 `tiledata/pixel-art-world/maps-shared-library-proof.json`. 맵 스크립트를 고치면 1→2→3 을 다시 돌린다.
옛 판(`shared_paw_maps51` 구운 아틀라스)은 같은 id 로 덮였고 `content_history` 에 남는다.
등록 전 DB 는 `~/.local/share/oprn/backups/shared-content-before-paw51-*.sqlite` 로 떠 두었고, 이전 판은 `content_history` 에도 남는다.
