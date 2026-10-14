# prehistoric — 선사 시대 원시 세계 칩셋 (2026-10-14)

원시 부족 마을(움집·족장 긴 집·무당 천막·뼈 집·동굴 입구·모닥불 광장·작업터·개울과 밧줄 다리), 원시 늪지(진흙·늪 웅덩이·늪 나무·타르 웅덩이),
화산 골짜기(화산재·굳은 용암·용암 웅덩이·현무암·고목), 공룡 화석 계곡(긴 목 뼈대·갈비뼈·머리뼈·발자국 진흙·고인돌),
실내 넷(동굴 거처·동굴 벽화 회랑·족장 집 안·무당 천막 안). 16px · 3/4 탑뷰 · 코드 손 도트 · 잠금 팔레트 22 램프. 사람·글자·상표 없음.
**그냥 동굴·던전·광산은 던전 칩셋(beodeul_dungeon)의 몫이다** — 여기서 잡지 않는다.

## 한 줄 지도

| 무엇 | 어디 |
|---|---|
| 그림(코드 손 도트) | `scripts/content/prehistoric/art/` — terrain(바닥 20 + 꼭짓점 가장자리 9쌍×14 + 조립 표본 9)·dwellings 13·nature 22·props 38·interior 66 등록부, `palette.py`(잠금), `px.py`/`kit.py`/`shapes.py`/`pelt.py`/`topview.py`(자른 면·판돌·통나무 윗면) 그리개 |
| 관문 내보내기 | `tiledata/prehistoric/<묶음>/_gate/ph-<id>.png` + `items.jsonl`; 조립 표본 `terrain/_gate_assembled/ph-swatch-<쌍>.png`·`interior/_gate_assembled/ph-room-*.png`(+ `manifest.json` 부품 좌표). `python3 scripts/content/prehistoric/gate_batch.py > batch.jsonl` → `npm run harness -- object-gate review --batch batch.jsonl` |
| 굽기 | `python3 scripts/content/prehistoric/bake_ph.py [--dry]` → `public/assets/prehistoric/prehistoric-chipset.png` · `src/assets/prehistoric{Tileset,Sheet}.json` · `tiledata/prehistoric/bake-{pins,report}.json`(핀 덧붙이기 전용). `--dev` 는 관문을 건너뛰는 구성기 시험용 — 커밋 금지 |
| 참고문서 | `python3 scripts/content/prehistoric/bake_refs_ph.py` → `src/assets/prehistoricReferences.json`(이미지 바이트 없음, 문서 9·그림 9) + `public/assets/prehistoric-references/*.png`. 예제 6장은 구성기 실제 출력, 변조 5종(문 앞 막힘·집 겹침·길 끊김·문 칸 열림·가장자리 모서리 어긋남)이 모두 잡히는지 굽기 때 단언 |
| 타일셋 정의·기존 프로젝트 심기 | `src/project/defaults/prehistoric.ts`, `defaultAssets.ts` 의 `ensureBundledTilesets`, 가족 `oprn-prehistoric` = 「선사 원시 세계(도트)」(`tilesetFamily.ts`) |
| 구성기(순수 함수) | `src/project/prehistoricComposer.ts` `composePrehistoric(spec, pal)` — 야외 village·swamp·volcano·fossil, 실내 cave-dwelling·cave-gallery·chieftain-hut·shaman-hut |
| 조수 도구 | `src/editor/tools/prehistoricTools.ts` — `compose_prehistoric_map`, `link_prehistoric_interior` |
| 조수 길잡이 | `src/ai/prehistoricPolicy.ts` (plainTurn 에서 jp_city 보다 먼저 판정). 컨셉 힌트 「선사 시대·원시 부족·공룡 세계」 → prehistoric, `BUILDABLE_CONCEPT_TILESETS`, 월드맵 테마 `prehistoric` 의 마을 칩셋 |
| 장면 QA | `node_modules/.bin/vite-node scripts/content/prehistoric/qa/compose-scene.mts -- out.json <style> W H seed` → `python3 scripts/content/prehistoric/qa/render_scene.py out.json out.png 1`(렌더 + MZ 통행 검증) |

## 꼭짓점(Wang) 바닥

칸 이름 `w-<쌍>-<NW NE SW SE>`(1 = 그 모서리가 안 재질). 쌍 9: grass/dirt · fern/dirt · mud/dirt · ash/dirt · stone/grass · swamp/mud · water/dirt · lava/crust · crust/ash.
구성기는 (W+1)×(H+1) 꼭짓점 격자에 가족·단(사슬 흙→풀→암반 · 흙→고사리 · 흙→진흙→늪 · 흙→재→굳은 용암→용암 · 흙→물)을 칠하고 `settle()` 로
부모 올리기 → 가족 충돌 정리(8이웃) → 단 차 1 이하 → 칸 고르기를 한다. 길·자갈·실내 조각은 `over[]` 덮어쓰기가 이긴다. 꺼진 쌍(늪·물·용암)은 모서리 1 이 둘 이상이면 막힘.
`open(f, lv)` 는 한 칸 폭 실오라기 웅덩이를 지운다. `variety()` 는 dirt/grass/mud/ash/stone/path/floor-cave 를 큰 덩이 잡음으로 -b 변주와 섞는다.

## 칸 통행 (bake_ph.py)

MZ 규칙: 맨 위 ★ 아닌 층이 정한다. `FOOT` 키 큰 키트는 밑 N줄만 막힘, `SMART` 나무·뼈대·바위는 밑줄 중 밑 6줄 불투명 12화소 이상인 칸만 막힘.
`BLOCKED` 물·늪·용암·타르·천장·벽면·벽화. 연잎·뗏목은 ★(물을 건너지 못한다), 밧줄 다리·들꽃·발자국은 걷는 덧그림.

## 3/4 관문 (object-gate)

낱 조각은 그림 화소 해시 영수증, 가장자리 낱칸·벽면·천장·벽화 칸은 그 칸을 화소 그대로 품은 조립 표본 영수증(`ph_bake_lib.covered_status`)으로 덮는다.
**프로필 미보정이라 통과는 「provisional」** — 「관문 합격」이라고 쓰지 말 것.

### 관문 결과 (2026-10-14)

- 낱 조각 283(야외 217 · 실내 66) 전부 provisional 통과, 조립 표본으로 덮은 칸 170. `bake_ph.py` 막힘 0.
- 1차 146 중 110 통과 → 떨어진 36을 다시 그려 세 번 더 돌렸다(16/31 · 10/17 · 마지막 시렁·장대·항아리·김 구멍). 점수·기준은 건드리지 않았다.
- 뺀 것: 들꽃(`flowers`) — 평평한 꽃 점이 어느 종류로도 읽히지 않았다. 구성기는 `fl >= 0` 으로 건너뛴다.
- 다시 그린 요령(판정자 gemini 버릇): 정면 입면도(세운 틀·가로 띠·얇은 테)는 떨어진다. 자른 면 타원(`topview.cut_face`·`post_top`),
  판돌(`slab`), 뒤가 좁고 앞이 넓은 원근 평상(`props.trap_deck`), 속이 4줄 넘게 보이는 큰 아가리는 붙는다.
  가로 줄무늬 발·가로로 누운 창대는 「앞면」으로 읽히니 결을 앞뒤로 두거나 비스듬히 눕힌다.
- 시렁 둘(`fish-rack`·`spear-rack`)은 생김새가 낮은 평상이라 종류를 `low_furniture`(윗면 3줄 하한 같음)로 바꿨다.
  `spear-rack` 은 낱말 「rack」이 세운 걸이로 읽혀 `gate_batch.py` `DESC` 에 실제 생김새를 적었다(이미 받은 영수증 이름은 그대로).
- 긴 목 뼈대(`longneck`)는 도랑 속에 누운 뼈대 위 그림으로 다시 그려 `debris`.

## 적대적 시각 QA (한 번, 2026-10-14)

원본 해상도 6장면(마을·늪·화산·화석 계곡·동굴 거처·벽화 회랑, seed 1)에서 결함 21건 → 한 번 고침(고침 15 · 일부 5 · 남음 1), 다시 돌리지 않았다.
- 바닥 격자(흙길·진흙·화산재·용암·동굴 바닥·암반): 8px 잡음 덩이가 16px 마다 같은 얼룩을 찍었다 → 4·2px 잔 무늬 + 낱점, 대비 한 단, stone-b·path-b 변주.
- 그림: 차양(초록 당구대) → 사다리꼴 짚 지붕 + 갈래 기둥, 맷돌(모루) → 낮은 갈판 + 현무암 갈돌, 털 깔개(빗금 얼룩) → 짐승 가죽 모양, 털 잠자리(상자) → 고사리 단 위 털가죽 두 겹.
- 배치: 마을 울타리 밖 빈 풀밭 → 나무 덩이 세 곳, 맨 암반 → 바위 언덕, 화산 쓰임 없는 흙 네모 제거 + 죽은 숲 두 덩이, 늪 한 칸 도랑 → `open`, 화석 골짜기 뼈 무더기 두 곳, 동굴 거처 짐승 벽화.
남은 약점: 늪 물 판이 여전히 평평하다, 용암·자갈·암반은 16px 반복이 보인다, 늪에 한 칸 폭 도랑 하나가 남았다, 화석 골짜기 가운데가 넓다.

## 조수 실제 실행 (gemini-3.8-flash high, 2026-10-14)

실제 입력창 Pi 경로, 빈 프로젝트에서 시작, 저장 후 재로드. 점수는 사람 눈 0~10.

| 요청 | 개선 전 | 개선 후 | 메모 |
|---|---|---|---|
| 원시 부족 마을 만들어줘 | 7 (64×40, 북동 풀밭 빔) | 8 (48×36) | 길이 직각으로 꺾인다 |
| 공룡 화석 계곡 | 6 (가운데 텅 빔) | 7 (동굴·천막 실내 둘을 만들어 문 연결) | 뼈 무더기 반복, 가운데 흙이 넓다 |
| 동굴 벽화 거처 | 7 | 7 | 털 잠자리 고사리 단이 바깥 풀처럼 읽힌다 |

개선 한 번: 구성기 `fillEmpty`(가장 먼 빈 땅에 주제 덩이) + 도구·길잡이에 「크기는 비워 기본값」.

- **시작 위치 (2026-10-14):** `compose_prehistoric_map` 야외 style 이 빈 시작 맵을 새 맵의 시작 칸으로 옮긴다(`src/editor/tools/composerStart.ts`; 실내 방·작가가 정한 시작은 건드리지 않는다). 모델이 `set_start_position` 을 안 부르면 빈 20×15 맵에서 시작하던 결함.
