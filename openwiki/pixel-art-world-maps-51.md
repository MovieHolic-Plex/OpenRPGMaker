# Pixel Art World 맵 51종

`scripts/content/paw-maps/` 의 생성기 51개(`m01`~`m61`)가 PAW 팩 시트를 직접 찍어 완성 맵을 만든다. 외부 거리·주택가 16,
가정·저택 실내, 상점·시설 실내, 하수도·월드맵·특수 장소를 포함한다. 그림은 사용자가 받은 원본에서만 읽고 Git 에는 넣지 않는다.

## 만들고 확인하기

- `python3 run_all.py [m01 m09 …]` — 렌더(`~/claude-viz/paw-maps/*.png`)·갤러리 `paw-maps.html` 생성. 실패 맵이 있으면 0 이 아닌 코드로 끝난다.
- 실내 맵은 `Map.layout(rows, legend)` 평면도로 그린다. `#` 칸이 천장이고, 천장 아래가 열린 곳은 어디든 벽면을 자동으로 내린다.
- `save()` 는 실내 구조 린트를 통과해야 저장한다. L1 layout 미사용, L2 천장 바로 아래 바닥, L3 모든 방이 직사각형, L4 천장 위 물건.
  위반이 하나라도 있으면 그 맵은 FAIL 이다. 규칙 설명은 `scripts/content/paw-maps/README.md`.

## 공용 DB 등록 (2026-09-27)

1. `python3 scripts/content/paw-maps/pack.py` — 51맵을 아래층(바닥·벽·천장)과 위층(물건, 투명 배경)으로 따로 렌더해 32px 칸으로 자르고,
   같은 그림 칸을 합쳐 아틀라스 하나(8열, 5,187칸)로 굽는다. 결과 `output/paw-maps-pack.json` 은 gitignore 이다.
   천장·벽 칸과 불투명 부분이 400px 을 넘는 위층 칸은 통행 불가(`solid`)로 둔다.
2. `node scripts/content/publish-pixel-art-world-maps.mjs [--dry]` — 호스트 공용 SQLite 라이브러리
   `pixel-art-world-maps-51-local` 한 개로 올린다. 맵마다 root 장소 → 층 장소 → `raster_paw51_<id>` 구획 키트이며,
   타일셋은 `shared_paw_maps51`, 태그는 `그림체:Pixel Art World`·`장소유형:`·`공간형태:`·`용도:`. 각 장소의 AI 참고문서에
   구성 메모와 사용 시트 목록을 붙인다. 같은 id 에 비교 교환으로 덮으므로, 맵을 고치면 1→2 를 다시 돌린다.
3. 증명은 `tiledata/pixel-art-world/maps-shared-library-proof.json`. 게시 직후 다시 읽은 본문이 게시본과 같아야 성공이다.

`pack.py` 는 굽는 즉시 아틀라스+칸 번호만으로 51장을 되살려 원래 렌더와 비교하고, 채널 차이가 4/255 를 넘으면 실패한다
(반투명 픽셀 합성 반올림만 허용, 눈으로는 구분 불가). 최대 차이는 팩과 증명의 `rebuildMaxChannelDiff` 에 남는다.
맵 스크립트를 고친 뒤 1→2 를 다시 돌리지 않으면 공용 DB 가 옛 판으로 남으니, 고친 뒤에는 반드시 재발행한다.
등록 전 DB 는 `~/.local/share/oprn/backups/shared-content-before-paw51-*.sqlite` 로 떠 두었고, 이전 판은 `content_history` 에도 남는다.
