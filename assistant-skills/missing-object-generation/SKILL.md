---
name: missing-object-generation
description: "When the in-editor assistant is asked to place one object (prop, furniture, decoration) that the current map's chipset may not have: search existing tiles/kits first, use them if they fit, and only for a named object that truly does not exist call generate_missing_object (workshop object-gen card, user's own AI account, user or auto-pick). Never for people/animals or terrain tiles."
---

# 없는 기물 하나 — 먼저 찾고, 정말 없을 때만 그린다

정본 문서: `openwiki/editor-ai-tools.md` 「없는 기물 그리기」. 도구 `generate_missing_object`(src/editor/tools/objectGenTool.ts).

## 순서

1. **찾는다** — 같은 낱말을 한국어·영어로 두세 번:
   - 손 도트 실내 맵: `list_hand_interior_parts({query})` → 있으면 `build_hand_interior_room` 다시 짓기나 `stamp_object`.
   - 그 밖의 맵: `list_tileset_objects({mapId, query})`(팩·공방 물체) → `list_spatial_designs({kind:"object", query})`(칩셋 소품 킷 `kit:…`·공용 오브젝트 `obj:…`) → `stamp_object`.
2. **있으면 놓고 끝낸다.** 모양이 조금 달라도(색·크기) 가까우면 그것을 쓰고, 무엇을 골랐는지 말한다.
3. **사용자가 콕 집은 물건이 정말 없을 때만** `generate_missing_object({mapId, title, description, objectKind, tilesW, cellsTall, gateKind, base:{x,y}, need})`.
   - `objectKind` 는 `floor`(바닥에 세움) · `wall`(북쪽 벽 앞) · `hang`(벽에 걸기) · `flat`(밟는 깔개) 넷뿐이다. `prop` 같은 말은 거부된다.
   - **크기(칸 수)를 먼저 정한다** — 사람은 1칸 폭·2칸 키다. `tilesW`(가로)와 `cellsTall`(그림 전체 키 = 발밑 줄 + 위로 솟은 줄)만 준다.
     흔한 크기(손 도트 실내 v5·버들항 소품 킷 실측): 상자·통·항아리 1×1, 벤치 2×1, 의자 1×1, 탁자 2×2, 침대 1×2, 옷장 1×2,
     짐마차 3×2(큰 것 4×3), 분수 4×3, 우물 2×2, 나무 2×3, 시장 노점 3×3~5×4, 가로등 1×3, 석상 1×2, 천막 3×3.
   - 도구가 크기 사전(object-gen `footprint.py`)으로 확인한다: 그 종류 범위를 벗어나면 고치고, 발밑 줄(막힘 X)과 위로 솟은 줄(* — 캐릭터 위에 그려짐)로 나눠
     `summary`·`data.footprint`(passage·reason)로 돌려준다. 깊은 물건(짐마차·노점·분수)은 발밑을 늘리고, 키 큰 물건(나무·가로등)은 위를 늘린다.
   - 맵 기물 6×(발밑 4)+위 64px(전체 6칸 키)까지, 실내 가구 4×(발밑 3)+32px 까지. 건물(집·가게·탑)은 거부된다 — 손 도트 건물 킷 영역이다.
   - `base` 는 발밑 맨 아래 줄 왼쪽 칸. 위로 솟은 줄까지 맵 안이어야 한다.
   - `gateKind` 는 3/4 검사 종류(선택): 상자·궤·벌통 `box`, 항아리·어항·우물 `container`, 통 `round_body`, 키 큰 가구·부스 `tall_furniture`, 탁자 `low_furniture`, 의자 `seat`, 기둥·석등 `column`, 식물 `organic` …
   - `description` 에 재료·색·그 배경에서의 모양을 적는다(예: 일본 거리의 공중전화 부스 = 일본식). 공방이 맵 칩셋으로 배경(나라·시대)을 붙이고, 검수는 「1배에서 그 배경의 그 물건으로 읽히나」를 본다.
   - 이름이 맞는 기물이 이미 있으면 도구가 그 id 를 돌려주며 거부한다. 그 id 들을 **실제로 보고** 다른 물건일 때만 `notThese` 에 적어 다시 부른다.
   - 부른 뒤에는 칠하지 말고 턴을 끝낸다. 「그렸다·놓았다」고 말하지 않는다 — 카드가 사용자 AI 계정으로 후보를 그리고, 사용자가 고르거나 사용자가 켠 「알아서 고르기」가 검수 통과 후보를 고른다.
4. 「[공방에서 그려 넣음] … 물체 id workshop:…」 후속 요청이 오면 **다시 그리지 말고** `stamp_tileset_object({mapId, objectId, base})` 로 적힌 자리에 놓고 `show_map_region` 으로 본다. 발이 벽·천장·허공·물 위거나 다른 물체와 겹치면 도구가 거부하며 가장 가까운 빈 바닥 자리(at·base)를 알려 준다 — 그 자리로 다시 부른다.

## 그리지 않는 것

| 요청 | 할 일 |
|---|---|
| 「분위기 있게」「뭐 하나 놔 줘」(무엇인지 안 정함) | 있는 기물에서 고른다. 그리지 않는다 |
| 사람·동물·캐릭터(「아낙네를 그려서」 포함) | 그리지 않는다 — `list_npc_graphics` 로 있는 캐릭터 칩을 골라 `place_npc` |
| 바닥·벽·물·길 같은 칸 타일 | `ask_missing_tiles` |
| 16px 가 아닌 칩셋 | 그릴 수 없다고 말하고 있는 기물로 대안 |

## 지킬 것

- 공방 그림은 이 게임에만 들어간다. 스토어·공용 DB 로 올리라고 하지 않는다(후보 카드의 3/4 배지는 참고용 조언이고 관문 영수증이 아니다 — 막힌다).
- 기물 크기는 자리에 맞춘다. `stamp_object`·`stamp_tileset_object` 는 서는 소품의 발이 벽·천장·허공·물 위거나 다른 물체와 겹치면 거부하고 가까운 빈 바닥을 알려 준다(2×4 혼천의를 방 사이 벽에 찍은 실측). 그 자리로 다시 찍는다.
