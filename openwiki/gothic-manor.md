# gothic_manor — 고딕 저택·묘지·미술관 (호러) 번들 칩셋

호러·추리·미술관 무대용 공용 번들 타일셋. 북쪽 저택·예배당·미술관과 정원·공동묘지·철책·고사목·안개, 저택 실내(홀·서재·침실·부엌·지하실·예배당·납골당·전시실).
2026-10-14 다시 그림(손 도트, 잠긴 고딕 팔레트 20 램프 × 7단). 옛 Sonnet 초안(야외 gx_* · 실내 gothic-interior)은 그림·참고문서·테스트 모두 지웠다 — 이 문서의 한 벌만 있다.

## 파일 지도
| 무엇 | 어디 |
|---|---|
| 팔레트·캔버스·등록부 | `scripts/content/gothic-manor/gmlib.py` (`RAMPS_HEX`, `K(m,t)`, `REG.piece/autotile/run`) |
| 그리기 도구 | `gmdraw.py` (`masonry`, `ptop`/`pslab` 원근 윗면, `slab`, `arch_profile`…) · 건물 공용 `pieces/_bld.py` · 실내 벽 공용 `pieces/_int.py` |
| 조각 모듈 12개 | `pieces/{terrain,bld_manor,bld_chapel,bld_misc,yard2,gy_props,yard_props,yard3,int_walls,int_floors,int_furn,int_gallery}.py` |
| 3/4 관문 | `gate_export.py`(조각 → `tiledata/gothic-manor/_gate/<모듈>/items.jsonl`) · `assemble.py`(벽 부품을 품은 방 그림 = 조립 영수증) |
| 굽기 | `bake_gm.py` → `public/assets/gothic-manor/gothic-manor-chipset.png` · `src/assets/gothicManor{Tileset,Sheet,RoomSpec}.json` · `tiledata/gothic-manor/{pins,bake-report}.json` |
| 공간 사양(실내) | `space_recipes_gm.py` → `src/assets/gothicSpaceSpec.json` (바닥·벽 밝기 차 35 관문) · 방 짓기 역할표 `roomkit_gm.py` |
| 야외 구성기 | `src/editor/gothic/composer.ts` (`composeGothicPlace`) |
| 조수 도구 | `src/editor/tools/gothicPlaceTools.ts` (`list_gothic_places`, `build_gothic_place`) · 라우팅 `src/ai/gothicPolicy.ts` |
| 예제·참고문서 | `export_places.ts` → `tiledata/gothic-manor/places/*.json` · `render_places.py` → 같은 이름 PNG · `bake_refs_gm.py` → `src/assets/gothicManorReferences.json` + `public/assets/gothic-manor-references/` |
| 정의·배선 | `src/project/defaults/gothicManor.ts`(create/ensure, 소유 접두 `gm-`, roomKit builtin) · `bundled.ts` · `bundledChipsetGeometry.ts` · `defaultAssets.ts` · `tilesetFamily.ts`(`oprn-gothic`) · `concepts/format.ts`(`BUILDABLE_CONCEPT_TILESETS`) · `handInterior/builder.ts`(`HAND_INTERIOR_SPECS`) |

## 다시 굽기 한 줄씩
```bash
cd scripts/content/gothic-manor
python3 gate_export.py && python3 gate_export.py pending          # 영수증 없는 그림만 /tmp/gm-pending.jsonl
npm run harness -- object-gate review --batch /tmp/gm-pending.jsonl --concurrency 8   # (저장소 루트에서)
python3 bake_gm.py && python3 space_recipes_gm.py
npx tsx --tsconfig tsconfig.app.json scripts/content/gothic-manor/export_places.ts --seeds 1,2,3   # (루트)
python3 render_places.py && python3 bake_refs_gm.py
```
굽기 채택 규칙: 조각 자체 영수증이 PASS 이거나, 그 조각의 모든 프레임을 PASS 인 조립 그림이 품는다(실내 벽·문·창·촛대·벽난로).
칸 번호는 덧붙이기 전용(`pins.json`). 관문 점수·기준을 완화하지 않는다 — 떨어진 조각은 다시 그리거나 뺀다.

## 관문에서 배운 것 (판정자 gemini-3.8-flash ×4 과반)
- 밝은 네모 윗면은 「세운 판」으로 읽힌다. 통과하는 것: 뒤가 좁은 사다리꼴 윗면(`ptop`/`pslab`), 둥근·타원 윗면, 그림자 드리운 물건, 앞면과 색이 다른 윗면, 윗면·앞면 경계에서 꺾이는 띠.
- 여러 번 떨어진 조각은 완화하지 않고 뺐다: 닫힌 철문, 기울어진·켈트·아치·오벨리스크 묘비, 애도상, 까마귀 기둥, 장미 아치, 흉상 기둥, 나무 십자가, 가족묘, 허수아비, 이정표, 나무 울타리, 폐예배당, 독서대, 새장, 트렁크, 유령·까마귀·검은 고양이·작은 묘비·뿌리·화환·무덤 촛불, 지하 마름돌 벽난로.
- 벽난로는 혼자 가구로는 떨어져 북벽 부품(3×4)으로 다시 그리고 「벽난로를 박은 방」 조립 영수증으로 덮었다(저택만 통과).

## 구성기·도구
- `build_gothic_place({place})` 한 번에 한 장. 야외 `manor-grounds`·`graveyard`·`gallery-plaza` 는 `composeGothicPlace`, 실내 8종(`hall` 변형 corridor·dining, `library`, `bedroom`, `kitchen`, `cellar`, `chapel`, `crypt`, `gallery`)은 마법 학교 조립기 `buildWizardingSpace(input, tileset, GOTHIC_SPACE_SPEC)` 를 그대로 쓴다(조립기 `makeResolver` 가 `gm:floor:` 그룹도 읽는다).
- 야외 짜임: 둘레 런(저택·미술관 무쇠 철책, 묘지 이끼 돌담) + 남쪽 가운데 열린 쌍문 → 북쪽 본 건물 → 앞마당·진입로·가로 길 → 곁 건물(문 앞 `출입:` 칸에서 BFS 로 길을 이음) → 소품(놓을 때마다 엔진 통행 BFS — 문·정문·빈 땅이 끊기면 되돌림) → 덧그림.
- 결과의 `entrances`(건물 문 칸, 그 아래 access 는 비움)·`exits`(정문)·`doorCells`(실내)는 정보용이고, 맵을 잇는 값은 `transferEndpoints[].endpoint` 다 —
  `create_transfer_pair` 의 a/b 형식 그대로(바깥 건물 문은 `{mapId, x:access.x, y:access.y, doorAt:{x, y:access.y-1}}`, 2칸 문은 한 번만). 오류가 있으면 맵을 바꾸지 않는다.
- `overwrite:true` 로 다시 지으면: 맵 밖으로 나간 나가는 문 이벤트는 새 출입구 칸으로 옮기고, 다른 맵에서 이 맵으로 오는 transfer 중 새 벽·맵 밖을 가리키는 것은 시작 칸으로 옮긴다(경고로 알림). 예전엔 lint `transfer-bounds` 로 커밋이 거절됐다.
- 배치 품질: 도구 결과가 조수 실행기의 권고 잣대(`src/ai/piAgent/layoutQuality.ts`, 빈 바닥 ≤30%·빈 정사각형 ≤5)를 지은 그대로 넘는다. 야외는 마지막에 빈터 한가운데 덩이(고사목·덤불, 길이면 덧그림)를 두고,
  실내는 기본 크기를 줄이고(홀·식당·지하실 16×12, 서재 18×13, 전시실 20×13) 정해진 순서의 시드 몇 개를 재서 처음 기준 안인 배치를 쓴다. `export_places.ts` 가 같은 잣대로 시드 1~12 를 검사한다.
  안 그러면 권고가 「채우기 수리」를 시켜 조수가 방을 다시 짓다 들어오는 문을 어긋냈다(실제 입력창 r1·r2).

## 적대적 시각 QA (1회, 2026-10-14)
네 장면(저택 정원·공동묘지·저택 홀·전시실)을 원본 해상도로 보고 결함 10건을 적었고 한 번 고쳤다.
- D2·D3 땅 섞기가 4칸 덩이 붉은 낙엽·갈색 진흙 네모로 떠 조각보처럼 보임 → 비슷한 명도 땅만 섞고 낙엽은 덧그림으로.
- D1·D7 안개 이끼 오토타일이 잔디 위 초록 깔개, 이끼 땅 위 흰 점선 테두리로 뜸 → 구성기에서 빼고 흐르는 안개 덧그림만(조각은 남김 — 다시 그릴 후보).
- D4 남북 산울타리가 납작한 초록 막대 → 동서 짧은 줄로.
- D5 일하는 소품이 철책 구석에 흩어짐 → 곁 건물 옆으로. D6 모든 묘비 아래 무덤 흙이 말뚝 줄처럼 → 둘에 하나. D8 연못이 십자 모양 → 덜 흔들리는 타원. D10 묘비가 오두막 지붕에 닿음 → 건물과 한 칸 띄움.
- I1 체크 대리석이 검정·흰 대비로 방을 다 먹음 → 회청·상아로 다시 그려 관문 재통과. I5 홀 빈 바닥 → 기본 22×16 → 18×14.
- 남은 것: 연못 오토타일 가장자리가 각짐, 미술관 앞 잔디가 비어 보임, 안개 이끼 조각 자체.

## 버들항 화풍 맞추기 quality-b (2026-10-14)
풀밭을 16칸 같은 자리 풀 포기 반복(격자로 읽힘·2단) → 16 주기 값 잡음 덩이 5단+체크 디더+풀잎 1×2 로 다시 그리고, 짙은 풀 덩이 `gm-ground-grass-d`(칸 가운데 둥근 그늘, 테두리 값 공유라 A~D 이음새 없음)를 덧붙여 구성기 섞기에 넣었다. 흙길은 덩이 4단·빛 받은 잔돌·짧은 패임, 고사목·버들은 줄기 원통 5단·세로 껍질 골·북서 이끼·가지 윗변 빛, 윤곽은 램프 1단(`finish(soft=True)`, 선택 윤곽).
저택 정원 장면(seed 1) 칸당 고유색 med 10→11 · p90 14→16 · 어두운 5% V 33→41 · 채도 0.32 그대로. 새·바뀐 그림 16장 object-gate 임시 통과(미보정 프로필) 16/0. 건물 잉크 윤곽(V18)은 전 조각 재관문이 필요해 그대로 남겼다.
조수(gemini-4-argon medium, 실제 입력창, `/tmp/qb-asst-gothic/`) 「흉가 저택과 정원 만들어줘」 7 → 7: 정원+홀·이동·시작 위치, 도구 11회 실패 0, 165초, 저장→재로드 일치. 남은 감점: 연못 각진 십자형, 산울타리 대칭 4줄, 홀이 작다.

## 조수 실시험 (gemini-3.8-flash high, 실제 입력창, 새 기본 프로젝트 → SQLite 저장 → 재로드, 2026-10-14)
재현: `/tmp/ai-gothic/rerun.sh`(= sky-steam 의 `/tmp/ai-steam/rerun.sh` 를 이 워크트리로 돌린 사본, 호스트는 `dist-electron/browser-bridge.js` 필요). 점수는 저장본 렌더를 보고 매긴 0–10.

| 문장 | r1 | r2(개선 1회 뒤) |
|---|---|---|
| 흉가 저택과 정원 만들어줘 | 5 — 정원+홀, 이동 1회 실패, 배치 품질 권고로 홀 다시 짓기 → 들어오는 이동이 맵 밖 → 커밋 거절 → 600초 초과 | 7 — 정원+홀, 이동 한 번에, 시작 위치, 실패 0, 118초 |
| 공동묘지와 예배당 | 6 — 묘지+예배당, 이동 2회 실패 | 7 — 같은 구성, 실패 0, 120초 |
| 미술관 호러 갤러리 | 4 — 전시실 한 장만(이동·바깥 없음) | 7 — 앞마당+전시실, 이동, 실패 0, 91초 |

개선 1회 = 결과에 `transferEndpoints`(create_transfer_pair 형식 그대로) · 다시 짓기가 문·들어오는 이동을 옮김 · 도구 결과가 배치 품질 권고를 지은 그대로 통과 · 「한 요청 = 바깥 한 장 + 안 한 장」 지침.
첫 r2 시도는 OAuth 만료로 두 건이 도구 없이 끝났고(인프라), 그 시도에서 g1 이 배치 품질 권고로 다시 짓는 고리를 드러내 같은 개선 묶음에 넣고 다시 돌렸다.
남은 약점: NPC·사건 없음, 홀 북쪽 쌍문·전시실 동쪽 문·묘소·종탑은 미연결, 빈 시작 맵(`map_blank_start`)이 프로젝트에 남음, 전시실 진열장 넷이 같은 모양 한 줄.

## 남은 일
- 안개 이끼 오토타일 다시 그리기(속을 잔디 명도로, 테두리 점선 없애기) 후 구성기에 다시 넣기.
- 사람·유령 걷기 칩 없음(Actor1 사용). 2층 저택 실내(계단 잇기)는 아직 단일 방 단위.
