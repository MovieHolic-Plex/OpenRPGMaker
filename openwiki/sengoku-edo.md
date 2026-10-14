# sengoku_edo — 전국·에도 일본 칩셋 (손 도트, 2026-10-14)

전국·에도 시대 일본 무대: 성하마을, 여관 거리(역참), 무가 저택과 다실, 천수각과 해자, 신사·절 경내, 논이 있는 농촌, 그리고 다다미 실내.
현대 일본 거리 `jp_city`, 조선 `joseon_baram` 과는 **다른 계열**(`oprn-sengoku`)이다. 칸 번호를 섞지 않는다.
모든 그림은 코드 손 도트다(생성 이미지 없음). 사람·글자·상표·가문 문장은 없다. 사람은 Actor1 캐릭터 이벤트로 둔다.
`.herdr-web-ui/paste-20261013-*.png` 같은 참고 스크린샷은 분위기 참고로만 봤다. 따라 그리거나 커밋하지 않았다.

## 파일 지도

| 무엇 | 어디 |
|---|---|
| 팔레트 잠금·그림 엔진 | `scripts/content/sengoku-edo/art/px.py`(램프 24개, 칸마다 재질+단) · `kit.py` · `arch.py`(지붕·벽·도리이 그리개) |
| 야외 조각 | `art/terrain.py`(바닥·오토타일 43) · `art/buildings.py`(건물 32) · `art/props.py`(소품·나무 47) |
| 실내 | `art/interior.py`(jp-city `ikit` Registry 재사용: 바닥 4 · 벽면 5 · 천장 · 가구 36) |
| 굽기 | `bake_se.py`(lib/se_bake_lib.py = campus theme_bake 사본 + walk·floor·blocked_ground) → `public/assets/sengoku-edo/sengoku-edo-chipset.png`, `src/assets/sengokuEdo{Tileset,Sheet,RoomSpec}.json`, 핀 `tiledata/sengoku-edo/bake-pins.json` |
| 참고문서 | `bake_refs_se.py` → `src/assets/sengokuEdoReferences.json`(그림은 `public/assets/sengoku-edo-references/` 경로만). 용도 `se-outdoor`(howto·사전·예제 4·변조 오류)와 `se-interior` |
| 정의·번들 | `src/project/defaults/sengokuEdo.ts`, `bundled.ts`·`bundledChipsetGeometry.ts`·`defaultAssets.ts ensureBundledTilesets`·`defaultMaps`(바닥 1번 풀밭) |
| 구성기 | `src/project/sengokuEdoComposer.ts`(순수 함수) · 도구 `src/editor/tools/sengokuEdoTools.ts`(`compose_sengoku_edo_map`, `link_sengoku_edo_interior`) |
| 방 견본 | `src/assets/sengokuEdoRoomTemplates.json`(손으로 짠 15방 + 방 구성 7개). `handInterior/templates.ts` 가 공용 견본과 합친다 |
| 조수 연결 | `src/ai/sengokuEdoPolicy.ts` → plainTurn(jp_city 보다 먼저)·executionRoute 노트·systemPrompt 줄 · 월드맵 sengoku 테마 → `THEME_TOWN_TILESETS` |
| QA | `qa/compose-scene.mts`+`render_scene.py`(구성기 → 시트 칸 그림) · `qa/check-sengoku-compose.mts`(도구 그대로, 6 용도×6 씨앗) · `qa/check-sengoku-interiors.mts`(방 구성 7 + 다실) |

재생성은 다음 두 줄이다. 이때 칸 번호는 덧붙이기만 한다.

```
python3 scripts/content/sengoku-edo/bake_se.py
python3 scripts/content/sengoku-edo/bake_refs_se.py
```

## 3/4 관문 (object-gate)

- 모든 조각은 `npm run harness -- object-gate review --batch <jsonl>` 영수증을 받은 화소 해시만 굽는다(`se_bake_lib.gate_status`).
- **판정자 프로필이 보정되지 않았다.** 그래서 지금 «pass» 는 전부 **임시 통과**로 센다. 야외 119와 실내 44다.
- 판정자는 윗면을 수평 띠로만 그린 조각을 「정면 입면도」로 떨어뜨린다. 다시 그린 방법은 다음과 같다.
  - 사다리꼴 윗면(뒤 변이 2~4px 좁다), 깊이 방향 결, 밝은 윗면과 어두운 뒤 테두리를 쓴다.
  - 둥근 부분은 타원 원반(`props.disc`)으로 그린다.
  - 석등·길등은 큰 타원 갓으로 그린다.
- 3~4번 다시 그려도 떨어진 조각은 **굽지 않았다.** 물레방아, 볏덕(하자), 대울타리, 병풍이다. 종류(kind)나 기준은 완화하지 않았다.
  - 바꾼 종류는 하나뿐이다. 차 주전자를 container → round_body 로 바꿨다. 뚜껑 있는 둥근 몸통이라 사실에 맞는 분류다.

## 구성기 규칙 (요약 — 정본은 참고문서 se-howto)

- 물과 논을 먼저 깐다. 그다음 남향 건물 줄, 길(문 접근칸에서 아래로 내려가 옆으로 곧게), 소품(발자국 + 여백 예약), 나무, 가장자리(풀↔흙길, 물가 축대), 바닥 변주 순서다.
- 다리 상판은 위층 O 칸이라 밑의 물 X 를 이긴다(엔진 collision.ts 규칙). 도리이·성문·문루 통로는 ★ 걷는 칸이다.
- 성의 서·동 해자와 성벽은 맵 북쪽 끝까지 닿는다. 북쪽 틈으로 다리를 건너지 않고 성에 들어가는 길을 막기 위해서다.
- 도구는 엔진 통행(BFS)으로 확인한다. 시작 칸에서 모든 문 접근칸에 닿아야 한다.
  - 실패하면 다음 씨앗을 최대 4번까지 본다. 그래도 안 되면 맵을 바꾸지 않는다.
  - 빈 맵이 작으면 그 용도의 기본 크기로 키운다.

## 적대 시각 QA 한 번 + 개선 한 번 (2026-10-14)

QA 대상은 엔진 렌더러 원본 해상도다. 성하마을·성·신사/절·농촌·무가 저택 다섯 장면과 다다미 실내(무가 저택 방 구성)를 봤다. 칸 좌표는 씨앗 0 기준이다.

| # | 결함(상자) | 원인 | 개선 |
|---|---|---|---|
| D1 | 짙은 풀 네모 덩이 | 값 잡음에 문턱 하나만 걸었고, 대비가 큰 칸을 썼다 | 덩이 속만 채우고 가장자리는 확률로 흩뜨림 |
| D2 | 들판에 외톨이 검은 네모 | 숲 덤불 목록에 생울타리 토막(`se-hedge`)이 들어 있었다 | 덤불 목록에서 뺐다 |
| D3 | 배 둘레 회색 축대 테 (15..17,23) | 마감 단계가 배 칸을 뭍으로 보고 물가 칸을 깔았다 | 아래층이 물인 칸은 물로 본다 |
| D5 | 절 경내 빈 자갈 벌판 11×17 | 자갈 정원이 남는 자리를 다 채웠다 | 8×5 이하 `zenGarden`(바위 셋) + 소나무·석등 |
| D6 | 경계 대숲이 한 줄로 늘어섬 | 4칸 간격 직선 | 두세 포기 덩이, 간격·x 흔들기 |
| D7 | 새전함이 풀밭 아무 데나 | 빈 자리 찾기로 놓였다 | 본전 앞마당 돌 위, 참배길 옆 |
| D8 | 벼 사각형에 물 테, 논이 연못처럼 보임 | 논두렁 칸이 물논 그림인데 자란 벼 논에도 둘렀다 | 자란 벼·익은 벼 논은 한 칸으로 채우고 풀 두렁이 경계. 물논 비율을 줄였다 |
| D9 | 집 뒤 나무가 일렬로 등간격 | 고정 간격 줄 | 건너뛰기·덩이·높이 흔들기 |
| D10 | 무가 정원 전체가 빈 자갈판 | D5 와 같다 | 자갈 8×5 + 작은 연못(축대) + 눈 석등·소나무 |
| D11 | 다실 아래 5×10 이끼 판 | 다실 아래 끝까지 이끼로 칠했다 | 다실 앞 3줄만 |
| D12 | 다실 앞 흙길 띠 + 물통 | 이끼가 길망이 아니라서 마지막 connect 가 흙길로 이었다 | 디딤돌 바닥 칸(걷는 stone 쓰임)으로 잇는다. 다실 자리 후보는 세 곳 |

- 실내에는 큰 결함이 없었다. 성 알현실과 도장에서 「ㅁ자 한 방」 경고가 나서, 방 구성에 두 번째 방을 더했다(대기 다다미 방·서재).
- 남은 것(개선하지 않음):
  - 성 세로 성벽(`se-castle-wall-v`)이 1칸 폭이라 가늘게 보인다.
  - 짙은 풀 변주가 아직 칸 단위로 보인다.

## 조수 실측

`/tmp/se-gemini/rerun.sh` 는 `/tmp/ai-gemini/rerun.sh` 사본이다. 실제 편집기 입력창 경로로 gemini-3.8-flash(high)를 새 기본 프로젝트에서 돌린다. 세 판 모두 SQLite 에 저장한 뒤 다시 읽었고, 해시가 같았다(reloadEqual true).

점수는 엄격한 0~10 이다. 1차를 돌린 뒤 지침을 한 번 고쳤고(커밋 `e88d336e7`), 2차를 돌렸다. 개선 반복은 한 번만 했다.

| 요청 | 1차 | 2차 | 남은 감점 |
|---|---|---|---|
| 전국시대 성하마을 만들어줘 | 7 | 7 | 집 모양 반복, 풀 변주가 칸 단위, compose 뒤에도 노점·볏단을 3개 덧찍음 |
| 에도 시대 여관 거리 | 6.5 | 6 | resize_map 으로 64×40 을 64×25 로 줄임(「줄이지 말라」 지침 무시), 삼나무가 일렬 |
| 사무라이 저택과 다실 | 6 | 6.5 | 덧찍기·크기 변경은 사라졌다. 두 저택 마당이 좌우 거울, 다실 실내 7×7 이 작다 |

- 지침 개선으로 생긴 효과:
  - 빈 시작 맵에서 계열을 묻지 않는다.
  - floor/wall 빠짐 오류가 0이 됐다.
  - 다실은 se-chashitsu 문에 잇는다.
- 지침으로 막지 못한 것:
  - compose 뒤 덧찍기.
  - 맵 축소.
  - 이 둘은 도구 쪽에서 막아야 한다(남은 일). 예를 들어 compose 한 맵의 resize 축소를 거부하는 식이다.
