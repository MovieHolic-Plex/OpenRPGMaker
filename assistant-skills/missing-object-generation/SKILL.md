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
3. **사용자가 콕 집은 물건이 정말 없을 때만** `generate_missing_object({mapId, title, description, objectKind, tilesW, tilesH, rise, base:{x,y}, need})`.
   - `objectKind` 는 `floor`(바닥에 세움) · `wall`(북쪽 벽 앞) · `hang`(벽에 걸기) · `flat`(밟는 깔개) 넷뿐이다. `prop` 같은 말은 거부된다.
   - 실내 가구는 3×2칸, 맵 기물은 4×3칸까지. 키 큰 것(부스·가로등)은 발밑 1칸 + `rise` 32.
   - 그림 높이 = 발밑 칸 + `rise`/16 칸. `rise` 를 빼면 서는 것은 16(한 칸 더 높게)이다 — 벌통·어항처럼 키가 낮은 물건은 `rise: 0` 으로 발밑 칸 높이 그대로 그린다.
   - 이름이 맞는 기물이 이미 있으면 도구가 그 id 를 돌려주며 거부한다. 그 id 들을 **실제로 보고** 다른 물건일 때만 `notThese` 에 적어 다시 부른다.
   - 부른 뒤에는 칠하지 말고 턴을 끝낸다. 「그렸다·놓았다」고 말하지 않는다 — 카드가 사용자 AI 계정으로 후보를 그리고, 사용자가 고르거나 사용자가 켠 「알아서 고르기」가 검수 통과 후보를 고른다.
4. 「[공방에서 그려 넣음] … 물체 id workshop:…」 후속 요청이 오면 **다시 그리지 말고** `stamp_tileset_object({mapId, objectId, base})` 로 적힌 자리에 놓고 `show_map_region` 으로 본다. 막히면 가까운 빈 바닥으로 옮긴다.

## 그리지 않는 것

| 요청 | 할 일 |
|---|---|
| 「분위기 있게」「뭐 하나 놔 줘」(무엇인지 안 정함) | 있는 기물에서 고른다. 그리지 않는다 |
| 사람·동물·캐릭터(「아낙네를 그려서」 포함) | 그리지 않는다 — `list_npc_graphics` 로 있는 캐릭터 칩을 골라 `place_npc` |
| 바닥·벽·물·길 같은 칸 타일 | `ask_missing_tiles` |
| 16px 가 아닌 칩셋 | 그릴 수 없다고 말하고 있는 기물로 대안 |

## 지킬 것

- 공방 그림은 이 게임에만 들어간다. 스토어·공용 DB 로 올리라고 하지 않는다(3/4 관문 미배선 — 막힌다).
- 기물 크기는 자리에 맞춘다. 2×4 처럼 큰 킷을 좁은 자리에 찍으면 벽·가구와 겹친다 — 놓기 전에 칸 수를 보고, 겹치면 자리를 옮긴다.
