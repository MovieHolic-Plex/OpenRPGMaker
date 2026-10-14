# pirate_isles — 열대 군도·해적 항구 칩셋 (16px 손 도트, 3/4 탑뷰)

열대 섬·해적 항구·해안 요새·난파선 보물섬과 배·술집·오두막·동굴 실내. 계열 `oprn-pirate`.
이 칩셋은 다른 칩셋(버들항 `oprn-atlas`, jp_city, 무림 등)과 칸 번호를 섞지 않는다.
번들 타일셋 `pirate_isles`(텍스처 `tex_pirate_isles`)는 모든 새 프로젝트에 들어가고, 기존 프로젝트에는 `ensureBundledTilesets` 가 심는다.

## 구조
- 그림은 코드 손 도트다. `scripts/content/pirate-isles/pi_*.py`
  - `pi_core.py`: 잠긴 팔레트 램프(6단 명암)·`Cv`·공용 붓(`box`·`barrel`·`planks`·`stones`·`hip_roof`…).
  - 묶음: `pi_terrain`(바닥·물·해안 오토타일 12), `pi_nature`, `pi_buildings`, `pi_props`, `pi_boats`, `pi_interior`(실내 53).
  - 생성 이미지·사람·글자·상표는 쓰지 않는다. `.herdr-web-ui/paste-*.png` 참고 그림은 분위기 참고일 뿐이며 커밋·추적하지 않는다.
- 관문: `python3 pi_all.py gate <묶음> --todo` 가 `object-gate` 의 `require_pass` 판정자(gemini ×4 과반)를 부른다.
  - 영수증은 `harness-data/object-gate/receipts` 에 있고, 그림 화소 해시에 묶인다.
  - 판정자가 본 그림은 `tiledata/pirate-isles/<묶음>/_gate/` 에 남는다.
- 굽기: `pi_bake.py` 는 영수증이 일치하는 조각만 굽는다.
  - 산출: 시트 `public/assets/pirate-isles/pirate-isles-chipset.png`, 정의 `src/assets/pirateIslesTileset.json`.
  - 배치용 조각 표는 `tiledata/pirate-isles/pieces.json`, 칸 번호 핀은 `pins.json`(덧붙이기 전용)이다.
  - 같은 실행에서 정의 검사, 재조립 대조, 팔레트 밖 칸 검사도 한다.
- 참고문서: `pi_refs.py` 가 `src/assets/pirateIslesReferences.json` 을 만든다(8용도·27문서·46그림).
  - 그림은 `public/assets/pirate-isles-references/` 경로만 넣고 바이트는 넣지 않는다.
  - 완성 예제 8장은 `compose_probe.ts` 를 `EXAMPLES=1` 로 돌려 만든다. 정상/오류 그림 31장과 구조 검사 `pi-check` 도 들어 있다.
  - 이 검사는 대문 안팎처럼 이동 이벤트로 잇는 칸 쌍(`portals`)을 한 덩이로 본다.

## 배치 = 구성기
조수는 견본을 붙이지 않는다. `compose_pirate_isles_map`(`src/editor/tools/pirateIslesTools.ts`)가 순수 함수 `src/project/pirateIslesComposer.ts` 를 부른다.

- 종류: `harbor`·`beach`·`fort`·`wreck`·`ship`·`tavern`·`hut`·`cave`.
- 짜는 순서: 계획 → 섬·해안 문자 격자 → 해안 다듬기 → 오토타일 → 건물(문 앞 접근칸이 길에 닿게) → 소품.
- 해안 다듬기(`tidyCoast`)
  - 섬 안 웅덩이와 한 칸 혀를 지운다.
  - 물에 닿은 풀은 모래로 바꿔 해변 띠를 보장한다.
  - 얕은 물 띠는 유클리드 거리에 잡음 두 겹을 얹어 만든다.
- 소품 규칙(`propFits`·`stampSafe`)
  - 땅 기물은 둘레 1칸에 물이 없어야 한다. 물 기물은 둘레 1칸에 땅이 없어야 한다.
  - 맵 가장자리에서 1칸 띄운다.
  - 같은 기물은 4칸 안에 다시 두지 않는다(`REPEATABLE` 은 예외).
  - 찍을 때마다 BFS 로 문 앞을 확인하고, 새로 갇힌 주머니가 생기지 않는지 본다.
- 나무는 덩이(`grove`)로만 놓는다. 풀밭 전체에 고르게 흩뿌리지 않는다.
- 요새
  - 남벽 문루의 대문은 막힌 문이다. 문 앞 접근칸과 안뜰 안쪽 칸을 `portals` 로 붙여 통행을 검사한다. 실제 게임에서는 이 두 칸에 이동 이벤트를 단다.
  - 대포(`cannon`·`cannon-int`)는 남쪽, 곧 보는 쪽을 겨눈다. 그래서 남벽 위와 배 남쪽 뱃전에 둔다.
- 배 실내는 뱃머리 쪽(오른쪽)으로 선체를 좁힌다.
  - 벽걸이는 벽 앞면(`x`) 칸 위에만 건다.
- 이름표(`labelPirateAreas`)에는 문 좌표와 접근칸 좌표가 들어간다.

## 조수 경로
- 정책은 `src/ai/pirateIslesPolicy.ts` 에 있다.
- 다음 낱말이면 이 칩셋으로 간다: 해적·열대·군도·카리브·야자·보물 섬/동굴·난파·무인도·pirate·tropical.
  - 「항구」 하나만으로는 오지 않는다. 로마풍 항구는 버들항이다.
- 경로를 고르는 순서: `plainTurn.ts` 에서 jp·gothic 다음, beodeul 앞이다. `executionRoute.ts` 의 안내는 beodeul 보다 앞선다.
- `layoutQuality.ts` 는 pirate-area 이름표가 있는 맵을 건너뛴다(구성기가 이미 검사한다).
- 실조수 시험: gemini-3.8-flash high 로 「해적 항구 마을 만들어줘」「열대 섬 해변 마을」「난파선과 보물 동굴 섬」을 돌린다.
  - 재현 스크립트 `/tmp/ai-pirate/rerun.sh` 는 /tmp/ai-gemini 패턴을 따른다. 저장소 밖에 있고, 깨끗한 기본 프로젝트에서 실제 입력창 경로를 탄다.

## 적대 검수 한 바퀴 (2026-10-14)
- 장면 5개를 원본 해상도로 검수했다: harbor-3·beach-5·fort-2·wreck-4·ship-2.
- 결함 59건 중 고침 48, 일부 7, 못 고침 4. 검수는 한 바퀴로 끝냈다.
- 못 고친 것
  - 방파제 양 끝 마감 조각이 없다.
  - 코코넛 더미 그림이 약하다.
  - 홀로 놓인 자루가 있다.
  - 수상 가옥 둘이 좌우 대칭 쌍둥이다.
- 일부만 고친 것
  - 섬 바깥선이 아직 조금 팔각형으로 읽힌다.
  - 항구 북쪽 풀밭이 넓다.
  - 선창 오른쪽이 비었다.

## 남은 일
- 방파제 끝 계단·마감 조각과 부두 앞면(기둥)을 그린다.
- 수상 가옥 좌우 변형을 그린다.
- 섬 모양 잡음을 더 키운다.
- 배 위 갑판(야외) 맵이 없다.
