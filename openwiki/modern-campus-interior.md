# modern_campus 실내 · 조수 길 · 참고문서 (2026-10-13)

> 야외·건물 외형은 `openwiki/modern-campus.md`(다른 작업자 소유). 이 쪽은 **실내 12방 + 가구 + 조수 연결 + 참고문서**다.
> 상태: 조각은 전부 object-gate PASS 이지만 **시트에 굽지 않았고 `bundled.ts`·`defaultAssets.ts` 에 배선하지 않았다.** 그래서 조수 정책은 «프로젝트에 칩셋이 있을 때만» 열린다.

## 만든 것

| 무엇 | 파일 |
|---|---|
| 그림(가구 43 · 바닥 6 · 벽면 5, 코드 손 도트) | `scripts/content/modern-campus/interior/campus_interior.py` (jp_city 실내 틀 `jp-city/interior/ikit.py` Registry 를 읽기만 함) |
| 평면 5장 + 좌표 검증 + 변조 | `…/interior/campus_plans.py` → `tiledata/modern-campus/interior/plans/*.json` |
| 합성 그림(정상/오류·도감) | `…/interior/campus_plan_render.py` → `public/assets/modern-campus-references/interior-*.png` |
| 참고문서 번들 + 방 표 | `…/interior/prepare_campus_interior_refs.py` → `src/assets/modernCampusInteriorReferences.json`(용도 1·문서 6·그림 7) · `src/assets/modernCampusRoomTable.json` |
| 조수 정책 | `src/ai/campusPolicy.ts`(+ `plainTurn.ts`·`executionRoute.ts`·`systemPrompt.ts` 배선, `startVariety.ts` KIT_BUILD_LINES) |
| 테스트(작성만, **not run**) | `test/campusPolicy.test.ts` |

재실행: `python3 campus_interior.py`(selftest + `_gate/` PNG + `items.jsonl`) → `npm run harness -- object-gate review --batch tiledata/modern-campus/interior/_gate/items.jsonl` → `campus_plans.py --render` → `prepare_campus_interior_refs.py`.

## 방 12종과 가구 (재사용 59 · 새 조각 43 = 102)

방: 교실·복도·계단실·화장실·사물함 구역·교무실·급식실·도서관·기숙사 방·동아리방·강의실·보건실(+ 라운지·공용 욕실). 방 → 재사용/새 조각 표는 참고문서 `mci-rules` 와 `campus_interior.REUSE`.
**다시 그리지 않은 것**(jp_city 사양 id): 학생 책상 `sc-desk-n`·교탁·칠판 `sc-blackboard`·사물함 `sc-back-locker`·신발장·보건실 침대·서가·계단 `sc-stairs-up`·`sc-stairwell-down`·변기·소변기·침대·옷장 등. 새 조각은 id 머리 `mc-`.

### 관문 결과 (gemini-3.8-flash ×4 과반, 투명 PNG, 정직한 종류)
- 계획 새 조각 57 가구 중 **43 통과 · 14 탈락(≤4회차 못 통과 → 버림)**, 바닥 6/6 · 벽면 5/5(terrain) 통과. 걸이(칠판·시계·영사막·코르크판·시력표·창) 6종은 `wall_mounted` 통과.
- **버린 14**(`DROPPED`): 키 크고 좁은 1칸 가구 — 쌓은 의자·쓰레기통(원형)·실내 자판기·이동 게시판·화장실 칸막이 칸·청소 카트·도서 반납 카트·목록 서랍장·구급 약장·미니 냉장고·이동 화이트보드·트로피 장·앰프(1칸)·칸막이 2칸 묶음·낮은 자판기. 이유는 항상 같다: 윗면이 앞면과 한 색이라 판정자가 **정면 입면도**로 읽는다(「윗면 0행」). 같은 가구를 **낮고 넓게(2칸·up 8)** 다시 그리면(서랍장·도서 수레·약 진열대·냉장 보관대·트로피 선반·청소 수레) 통과했다.
- 교훈: ① 1칸 폭 키 큰 가구는 윗면을 키워도(+3행·밝은 색·앞면 어둡게) 통과 못 했다 — 2칸 이상·낮은 형태로. ② 윗면에 **작은 물건**(상자·책 더미·화분·약병)을 올리면 윗면이 «위에서 본 평면»으로 읽힌다. ③ 컨테이너는 아가리가 4행 이상 + 어두운 안쪽 + 밝은 림. ④ 같은 그림이라도 판정자 4회 표결이 흔들린다 — 한 번 통과한 해시는 영수증으로 고정된다.

## 평면 5장 (학교 3 + 기숙사 2) — 참고문서 `mci-ex-*`

교실 동(교실 둘 + 복도) · 특별교실 동(도서관·보건실·교무실 + 계단) · 급식·동아리 동(급식실·화장실·동아리방) · 기숙사 1층(라운지·방 둘·현관·계단) · 기숙사 2층(방 셋·공용 욕실·계단).
**문 그림 / 접근칸 / 출입 이벤트 세 가지를 분리**한다: 교실 문은 같은 맵 안이라 이벤트가 없다. 이벤트는 계단(기숙사 1층 `sc-stairs-up` 그림 칸 ↔ 2층 `sc-stairwell-down` 아래 줄)과 건물 출입구 틈에만. 접근칸(문 위·아래 칸)은 비운다.
검증기(`campus_plans.py`)는 `builder.ts` 규칙을 **옮긴 것**이다 — 발밑 바닥·겹침·벽 가구 북쪽 벽면·걸이 벽면 윗줄·문 틈·출구 덩이·출구 위 칸·4방 도달·문 접근칸. 정상 5장 0 오류, 변조 6종이 각 코드로 잡힌다.
**확인하지 않는 것**: 엔진 `passabilityOf`·4층 칸 번호(사양이 안 구워짐)·이벤트 실행·미감. 합성 그림은 엔진 출력이 아니다.

## 조수 길 (`campusPolicy.ts`)

- 대상 판정 `campusTargetFor`: 의도 선언이 create/modify + (보는 맵이 캠퍼스 **또는** 야외 생성 + 학교·학원·캠퍼스·교실·동아리·교정 낱말/칩셋 이름) — **프로젝트에 칩셋이 있을 때만**. 일본풍 학교는 jp_city, 마법 학교는 wizarding_world 가 이긴다(낱말 제외). jp_city 가 이미 잡았으면 부르지 않는다.
- 시스템 프롬프트 `campusPromptLines`: 칩셋이 없으면 **아무 줄도 없다**(없는 칩셋을 «있다»고 말하지 않는다). 있으면 포인터 줄, 범위에 캠퍼스 맵이 있으면 상세·실내 줄.
- 컨셉 힌트 「현대 학원·캠퍼스 → modern_campus」: `CAMPUS_CONCEPT_HINT` 로만 둔다. `seed.json` tilesetHints·`BUILDABLE_CONCEPT_TILESETS` 에는 **활성화 때 같이** 더한다(`test/conceptSource.test.ts` 가 둘이 같은 집합이 아니면 막는다 — 지금 더하면 그림 없는 칩셋 컨셉이 «지을 수 있음»이 된다).
- 「현대 시작 칩셋 고르기」(#10): `startVariety.ts` `KIT_BUILD_LINES.modern_campus` — 컨셉 tilesetHint 가 이 id 일 때만 읽힌다(`planStart` 가 `tilesetId` 로 그대로 쓰므로 `prebuildTown:false`).

## 활성화(칩셋이 구워진 뒤 해야 할 일 — 아직 안 함)

1. 야외 쪽 `bake_mc.py` 에 **실내 블록**으로 `campus_interior.py` 의 R 을 등록(jp_city `bake_jp.py` 가 `interior_*` 블록을 굽는 방식, 새 id 는 `categories.py` 같은 분류 표에 한 줄씩) → `modernCampusInteriorSpec.json`(가구·바닥·벽면·방 표 `modernCampusRoomTable.json` 의 `kinds/buildings/examples`).
2. `HAND_INTERIOR_SPECS` 에 `modern_campus` 사양 등록(`builder.ts`) — `build_hand_interior_room({tileset:"modern_campus"})`·`list_hand_interior_parts` 가 도는 단계. 그 뒤 평면 5장을 **조수 도구 그대로** 지어 엔진 BFS 로 다시 검사하고(jp 의 `check-interior-examples.mts` 선례) 4층 전체 배열을 문서에 넣는다.
3. 참고문서를 번들 소유로 연결: `ensureModernCampusReferences`(jpCity.ts `ensureJpCityReferences` 선례, id 머리 `mci-`) + 타일셋 정의 `referenceDocuments`. 새 프로젝트·기존 프로젝트 양쪽 검증.
4. 컨셉 힌트 활성화: seed.json tilesetHints + `BUILDABLE_CONCEPT_TILESETS` + `startRoutePaint.ts`(`startMapSizeFor`·`ROUTE_STYLES`).
5. 굽기 출구에 `require_all(..., context="bundle")` — 영수증 54장은 `harness-data/object-gate/receipts` 에 커밋됨.

## 관련
- `openwiki/atlas-biome-interior.md`(v5 조립기) · `openwiki/jp-city.md`(「일본 집 실내」 사양·예제·검사기) · `openwiki/harnesses/object-gate.md` · `tiledata/AI-REFERENCE-CONTRACT.md`.
