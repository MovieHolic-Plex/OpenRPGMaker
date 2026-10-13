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
- 결과의 `entrances`(건물 문 칸, 그 아래 access 는 비움)·`exits`(정문)·`doorCells`(실내)에 이동 이벤트를 단다. 오류가 있으면 맵을 바꾸지 않는다.

## 적대적 시각 QA (1회, 2026-10-14)
네 장면(저택 정원·공동묘지·저택 홀·전시실)을 원본 해상도로 보고 결함 10건을 적었고 한 번 고쳤다.
- D2·D3 땅 섞기가 4칸 덩이 붉은 낙엽·갈색 진흙 네모로 떠 조각보처럼 보임 → 비슷한 명도 땅만 섞고 낙엽은 덧그림으로.
- D1·D7 안개 이끼 오토타일이 잔디 위 초록 깔개, 이끼 땅 위 흰 점선 테두리로 뜸 → 구성기에서 빼고 흐르는 안개 덧그림만(조각은 남김 — 다시 그릴 후보).
- D4 남북 산울타리가 납작한 초록 막대 → 동서 짧은 줄로.
- D5 일하는 소품이 철책 구석에 흩어짐 → 곁 건물 옆으로. D6 모든 묘비 아래 무덤 흙이 말뚝 줄처럼 → 둘에 하나. D8 연못이 십자 모양 → 덜 흔들리는 타원. D10 묘비가 오두막 지붕에 닿음 → 건물과 한 칸 띄움.
- I1 체크 대리석이 검정·흰 대비로 방을 다 먹음 → 회청·상아로 다시 그려 관문 재통과. I5 홀 빈 바닥 → 기본 22×16 → 18×14.
- 남은 것: 연못 오토타일 가장자리가 각짐, 미술관 앞 잔디가 비어 보임, 안개 이끼 조각 자체.

## 남은 일
- 안개 이끼 오토타일 다시 그리기(속을 잔디 명도로, 테두리 점선 없애기) 후 구성기에 다시 넣기.
- 사람·유령 걷기 칩 없음(Actor1 사용). 2층 저택 실내(계단 잇기)는 아직 단일 방 단위.
