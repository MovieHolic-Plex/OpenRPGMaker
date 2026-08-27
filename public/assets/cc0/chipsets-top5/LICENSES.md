# CC0 칩셋 TOP5 스테이징 (480×256 에디터 게이트 통과판)

조사 근거: `.omo/ulw-research/20260827-030906/report/cc0-chipset-report.html`
에디터 흡수 규격: 칩셋 업로드는 정확히 480×256 PNG(`src/assets/resourceSlicing.ts`).

## 파일 목록 (전부 RGBA, 16px 셀 그리드)

| 파일 | 출처 | 라이선스 | 원본 크기 | 재구성 방식 |
|---|---|---|---|---|
| nestor-480x256.png | https://opengameart.org/content/nestor-tileset (Demetrius) | CC0 | 480×256 (팔레트) | 원본 그대로 + 팔레트 인덱스0(마젠타) → 알파 변환 |
| beast-grass-480x256.png | https://opengameart.org/content/overworld-grass-biome (overworld_tileset_grass.png) | CC0 | 192×336 | 16px 셀 리플로우 (229셀, 절단 0) |
| zelda-overworld-480x256.png | https://opengameart.org/content/zelda-like-tilesets-and-sprites (gfx_3.zip → gfx/Overworld.png, ArMM1998) | CC0 | 640×576 | 좌측 320×400 크롭 후 리플로우 (471셀, 절단 0) |
| ninja-floor-480x256.png | Ninja Adventure Asset Pack (Pixel-Boy & AAA) https://pixel-boy.itch.io/ninja-adventure-asset-pack | CC0 (본문 전면 선언 + itch Asset license 필드) | 352×417 | 리플로우 (458셀, 절단 0) |
| ninja-interior-480x256.png | 〃 (content/map/tileset_interior_floor.png) | 〃 | 352×272 | 리플로우 (294셀, 절단 0) |
| kenney-tiny-town-480x256.png | https://kenney.nl/assets/tiny-town (Tilemap/tilemap_packed.png) | CC0 (Kenney 포괄 선언) | 192×176 | 리플로우 (132셀, 절단 0) |

## 교체 이력
- **Buch "Dungeon tileset"은 5위에서 제외**: 원본이 8px 기반 오프셋 구조라 16px 셀 정렬이 어긋남(페이지도 "split into 8x8" 명시). Kenney Tiny Town이 5위로 승격.

## 에디터 가져오기
1. 에디터 → 자료 보관함(리소스 관리자) → 칩셋 카테고리 → 이미지 가져오기 → 이 폴더의 PNG 선택.
2. Nestor는 마젠타가 이미 알파 처리돼 있어 추가 설정 불필요. 리플로우판도 RGBA라 그대로 사용.
3. 리플로우판의 타일 순서는 "원본을 16px 셀로 행 우선 재배치(빈 셀 스킵)" — 원본 좌표와 다르므로 브러시에서 눈으로 고르면 됨.
4. 480칸 중 사용하지 않는 뒷칸은 투명(빈 타일)으로 보임 — 정상.

## 라이선스 비고
전부 CC0(퍼블릭 도메인 전용) — 귀속 표기 의무 없음. 다만 OGA 예의상 크레딧 권장:
"Nestor tileset by Demetrius / Overworld Grass Biome (Beast 크레딧) / Zelda-like tilesets by ArMM1998 / Ninja Adventure by Pixel-Boy & AAA / Tiny Town by Kenney".
접근일: 2026-08-27. 1차 소스 프로비넌스 스크린샷: `.omo/ulw-research/20260827-030906/provenance/`.
