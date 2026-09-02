# 의도 라우팅을 LLM 선언으로 바꾼다 (2026-09-03)

## 1. 왜

2026-09-03 실측 감사(52문장 결정론 매트릭스 + 실모델 브라우저 17회)의 결론:

- 「의도 라우터」는 하나가 아니라 **substring 키워드 분류기 7개**였다 — 수정/생성 축(`modifyIntent`), 영역 카테고리 9종(`regionIntentRouter`), 집↔실내 되묻기(`intentClarify`), 툴 노출 도메인(`assistantToolMode.INTENT_KEYWORDS`), 볼륨 계약 정규식(`volumeContract`), 플래너 스킵(`plannerSkip`), 가이드 배치 힌트(`turnGuide`). 어휘 441개(고유 357), 정규화 4종, 단음절 17개(집·적·낮·밤·길·문·벽·눈…)가 형태소 없이 부분일치했다.
- 근인은 키워드가 아니라 **채널**이었다. 패널이 사용자 문장 뒤에 「도구 규칙」 17줄(약 1.7KB)을 붙였고, 분류기 3개가 그 기계 텍스트를 사용자 발화로 읽었다.
  - 되묻기(`resolveIntentClarification`)가 페이로드를 읽어 chat 모드 52문장 중 22개에 「집/건물을 어떻게 만들까요?」(「나무 몇 그루 추가해줘」「프로젝트 저장해줘」 포함, 0.5초·LLM 0회).
  - 플래너 스킵이 가이드 속 `start_interior_room_session` 에 protocol-lock 정규식으로 걸려 실내·수정 요청 15/52가 플래너를 건너뜀.
  - 툴 이름 언급 스캔이 가이드에 적힌 9~22개 툴을 강제 노출(금지 문구의 create_map·place_chest 포함) — 「40 상한」은 실제 49~59개.
- 볼륨 계약 정규식은 부정과 「추가」를 못 읽었다. 「이 마을에 상인 하나 추가해줘」는 플래너(LLM)가 direct 로 맞게 판정했는데 코드가 거부하고 3항목 계획을 강제해 93초·LLM 22회·맵 3장이 됐다. 「마을은 만들지 말고 여관만」 73초·맵 4·여관 2번, 「퀘스트 말고 상점만」 150초·LLM 53회·퀘스트 강제 등록, 「마을에 여관 하나」 86초·툴 50(실패 24)·author_village 6회.
- 개념 시설 9종 중 4종(여관·서재·창고·선술집)만 interior 라우팅. 대장간은 야외 author_house, 술집은 「집 」부분일치로 structure+되묻기(스코프 있으면 「야외 집 1채로 바로 시공」), 민가·교회·길드·도서관은 카테고리 ∅·가이드 0줄.

원칙: **뜻을 읽는 판정은 LLM, 사실과 집행은 코드.**

## 2. 경계

| 종류 | 예 | 담당 |
|---|---|---|
| 뜻(무엇을 원하나) | 수정/생성/질문, 실내/야외, 개념 시설, 되물을 만큼 모호한가, 다단계인가, 쓸 툴 | **의도 선언**(모델, 턴당 1회 JSON) |
| 사실(무엇이 참인가) | 열린 모달, 선택 사각형, 현재 맵, 타일셋 라벨, 맵 목록, 활성 툴 이름 | 코드가 모아 선언 입력에 싣는다 |
| 집행(지켜졌나) | 승인 게이트, 영역 하드클립, 스펙 게이트, 툴 결과 검증, 볼륨 **측정** | 코드 |

## 3. 구조

### 3.1 의도 선언 — `src/ai/intentDeclaration.ts`(순수) · `intentDeclarationClient.ts`(네트워크)

한 턴의 사용자 발화를 lite 모델이 `response_format: json_object`·temperature 0.1·20초 상한으로 한 번 읽는다.

```
{ mode: create|modify|question|other, space: interior|outdoor|both|none|unclear,
  facility: 개념 시설 라벨|null, targetMapId, useSelection, clarify|null, clarifyOptions[],
  needsPlan, resetsContext, tools[](레지스트리 이름만, ≤8), summary }
```

- 입력 사실: 요청 원문, 현재 맵, 선택 영역, 맵 목록, 개념 꾸러미 시설 라벨(`listLiveConceptFacilityLabels`), 활성 툴 이름 전부.
- 검증: 모르는 툴·맵 id·시설은 버림, enum 밖 mode 는 실패 → **중립 폴백**(되묻기 없음, 툴 없음, `needsPlan=true` 로 플래너에게 넘김, 선택 영역이 있으면 그 안).
- 「계속/이어서/다음」은 진행 중 계획·볼륨이 있을 때 모델 없이 continuation.
- 러너(영역 작업)와 세션이 같은 문장을 연달아 읽으므로 90초 캐시(폴백은 캐시하지 않음).

### 3.2 세션이 선언만 소비한다 — `assistantSession.ts`

`sendUserMessage(text, onEvent, signal, { autonomous, instruction, scope })`. `instruction` 은 사용자 원문, `scope` 는 선택 사각형(사실).

- 되묻기: `intent.clarify` 가 있고 chat 모드일 때만 그 질문(+선택지 마커)으로 턴을 끝낸다. auto/orchestrated 는 건너뛰고 의도 노트가 「택하고 밝혀라」고 알린다(F-05 유지).
- 플래너 스킵: 진행 중 계획이 없을 때 `scope`(selection) · `mode=question` · `!needsPlan`(single-step). 문장 길이·정규식 없음.
- 플래너 direct 는 존중한다. 볼륨 막대는 플래너가 `new_plan/replan` 에 선언한 `volume{authoredMaps,multiPageNpcs,shops,quests}` 만 세우고(`volume-contract:armed`), 미달 재주입(`HARNESS CONTINUE`)은 종전대로 코드가 한다. `requestNeedsVolumePlan`·`volumeBarForRequest`·`buildVolumeWorkPlan`·`forceVolumeWorkPlanIfNeeded` 는 삭제.
- 툴 노출: 코어 + UI 도메인 + **선언 툴의 레지스트리 도메인**(공간 시공→tile, 수정→tile·map·event) + 최근 사용 도메인 + 핀. 선언 툴·사용자 원문의 이름 언급·능력 승격은 상한 밖에서 얹는다. 문장 키워드 표는 삭제.
- 대상 맵: `mode=modify` 일 때 `intent.targetMapId ?? footer ?? currentMapId`.
- 완성도 린트(`proposalCompleteness`)는 선언이 있으면 `mode`(변경을 기대하나) · `space=interior && mode=create`(실내 신축 경고)로 판정하고, 없으면 종전 문장 휴리스틱.
- 본문 모델에게 두 노트를 오케스트레이션 메시지로 준다(턴 끝에 제거): **의도 노트**(선언이 확정한 경로 — 「대장간 = place_concept(query:"대장간"), 야외/실내 다시 묻지 말 것」 / 수정 대상·신축 금지 / 질문은 조회만 / auto 에서 건너뛴 되묻기는 택하고 밝혀라)와 **선택 영역 노트**(`useSelection` 이면 경계 + `author_village target existing+bounds`, 새 맵/실내면 참고용).

### 3.3 규칙은 툴 설명으로 — 가이드 블록 삭제

패널·영역 작업 메시지는 **사용자 발화 + `[컨텍스트]` 사실**(현재 맵·선택 영역·재료 라벨 예)만 싣는다. 옛 「도구 규칙」 17줄과 카테고리 가이드 9종은 해당 툴 설명 40곳에 옮겼다(place_props 밀도 enum·물 위 금지·장식 박스, place_chest↔place_storage_chest↔place_props 구분, place_npc 상태별 페이지·중복 금지, tile_query mapId, author_house 야외 외장·실내 금지, author_village forestDensity·선택 영역 target, place_concept/실내 세션/furnish 경로, build_wall 구조물, create_transfer_pair 좌표, tile_erase 상점 철거 절차, mirror_region 인자, 조명·전투·조사·퀘스트·컷신 툴의 「정본」 표시 …). 툴이 노출되면 규칙도 함께 보이므로 고를 필요가 없고, 기계 텍스트가 사용자 채널에 실리는 근인이 사라진다. 전역 규칙(「못 한 것: …」 명시)은 시스템 프롬프트 수칙 9로.

### 3.4 삭제·축소

- 삭제: `modifyIntent.ts`(→ `contextFooter.ts` 에 footer 함수만), `intentClarify.ts`, `plannerSkip.ts`, `regionIntentRouter.ts`, `INTENT_KEYWORDS` 및 문장 스캔, 볼륨 정규식/강제 계획, `workPlan.detectConstructionIntent`(폴백 계획이 문장으로 author_village 를 강제하던 경로), `turnGuide.buildTurnGuide/constructionFacadeLine/PLACEMENT_HINTS`.
- 유지: UI 상태 도메인, 핀·40 상한 라운드로빈, 최근 도메인 TTL, 이름 언급 승격, 능력 승격(설명 매칭), `formatMaterialLabelHint`(사실), `requestedPlacementCount`(숫자 추출).

## 4. 비용

| 모드 | 추가 호출 | 실측 지연(flash) |
|---|---|---|
| auto | +1(의도 선언; 짧은 요청은 플래너 대신 이것 하나) | 1.7~2.0초 |
| chat | +1 | 1.7~2.0초 |

## 5. 검증

- 단위: `test/intentDeclaration.test.ts`(파싱·폴백·도메인·탈출·노트), `test/intentDeclarationClient.test.ts`(lite·json·타임아웃·캐시), `test/assistantSessionIntent.test.ts`(되묻기 chat/auto·플래너 스킵·direct 존중·플래너 볼륨·선언 툴 노출·원문만 스캔·선택 영역 노트·수정 대상·continuation). 키워드 회귀 테스트 10파일 삭제, 15파일을 선언 픽스처(`test/intentFixture.ts`)로 전환.
- 실브라우저(`test/e2e/_intent-router-cases.spec.ts`, `CASES`/`AGENT_MODE`/`CASES_OUT` env): §6.

## 6. 실측 전후

전(2026-09-03 감사, auto) → 후(같은 날, 같은 모델 gemini-3.7-flash).

| 문장 | 전 | 후 |
|---|---|---|
| 나무 몇 그루 추가해줘 (chat) | 0.5초 「집/건물을 어떻게」 오답 | 13초, 침엽수 6그루 배치 |
| 대장간 지어줘 (chat) | 0.7초 오답 되묻기 | 13초, place_concept 실내(map_blacksmith) |
| 술집 지어줘 | 모델이 야외/실내 되물음 | 11초, place_concept 실내(map_tavern) |
| 그 외 auto 12문장 | §7 표 | §7 표 |

## 7. auto 모드 12문장 재측정

표 전체는 `reports/intent-routing/after.md`. 요지:

| 문장 | 전 | 후 |
|---|---|---|
| 이 마을에 상인 하나 추가해줘 | 93초 · LLM 22 · 맵 3 | 19초 · LLM 6 · 맵 1(상인 1명) |
| 마을은 만들지 말고 여관만 지어줘 | 73초 · 맵 4 · 여관 2번 | 11초 · 맵 2(여관 1번) |
| 퀘스트 말고 상점만 만들어줘 | 150초 · LLM 53 · 퀘스트 강제 | 7초 · 퀘스트 0 |
| 마을에 여관 하나 지어줘 | 86초 · 툴 50(실패 24) · 맵 5 | 22초 · 맵 1(야외 여관 외장) |
| 대장간·민가·교회·술집·길드 지어줘 | 야외 외장 또는 되물음 | 10~15초, 전부 place_concept 실내 |

개념 시설 9종 라벨은 선언 입력(`facilityLabels`)에서 오므로 사용자가 DB 에서 시설을 추가·개명하면 라우팅도 따라간다 — 코드에 시설명이 없다.
