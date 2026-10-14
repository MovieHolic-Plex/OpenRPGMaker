# desert_east — 사막·동양풍 칩셋 (아라비아·실크로드·이집트·메소포타미아)

16px 3/4 탑뷰 코드 손 도트 공용 번들 칩셋. 계열 `oprn-desert-east`, 텍스처 `tex_desert_east`, 시트 `public/assets/desert-east/desert-east-chipset.png`(한 줄 48칸).
야외(오아시스 마을·바자르·궁전·피라미드 유적·대상 숙소)와 실내(찻집·가게·알현실·묘실·함맘·여관)를 한 시트에 담는다. 생성 이미지·사람·글자·상표 없음.

## 파일 지도
| 무엇 | 어디 |
|---|---|
| 잠긴 팔레트 | `scripts/content/desert-east/art/palette.json` (램프마다 7단) |
| 그림 등록부 | `art/terrain.py`(바닥·모서리 왕 타일 5벌) · `buildings.py` · `props.py` · `interior.py` — `python3 <파일>.py` 가 `tiledata/desert-east/<묶음>/_gate/de-*.png` + `items.jsonl` + `preview.png` 를 쓴다 |
| 굽기 | `scripts/content/desert-east/bake_de.py` (관문 영수증 pass 만 굽는다, `DE_UNGATED=/tmp/x` 는 관문 없이 /tmp 로만 — 개발용) |
| 참고문서 | `bake_refs_de.py` → `src/assets/desertEastReferences.json` + `public/assets/desert-east-references/*.png` (용도 de-outdoor · de-interior) |
| 구성기(순수 함수) | `src/project/desertEastComposer.ts` — `composeDesertEast`(야외 5종) · `composeDesertRoom`(실내 6종) |
| 타일셋 정의·보정 | `src/project/defaults/desertEast.ts` (`ensureDesertEastTileset`·`ensureDesertEastReferences`, `defaultAssets.ts` 의 `ensureBundledTilesets` 가 부른다) |
| 조수 정책·도구 | `src/ai/desertEastPolicy.ts` · `src/editor/tools/desertEastTools.ts` (`compose_desert_east_map` · `compose_desert_east_room` · `link_desert_east_interior`) |
| QA 렌더 | `scripts/content/desert-east/qa/compose-scene.mts` · `compose-room.mts` · `render_scene.py` |

## 바닥 문법
- 꼭짓점 재질 격자 (W+1)×(H+1): s 모래 · r 다진 흙길 · f 포석 · g 풀 · w 물 · d 사구.
- 칸 번호 = NW1 + NE2 + SW4 + SE8 (그 벌의 재질인 모서리). 물이 한 모서리라도 있으면 물 벌, 아니면 모래가 아닌 모서리를 모두 다수 벌로 센다 — 흙길↔포석, 풀↔포석이 만나는 칸에 모래 이(V자 틈)가 끼지 않는다.
- 순수 칸(15)은 변형을 섞는다(모래 4 + 물결·자갈 조각, 풀 3).

## 구성기 규칙 (적대 검수 2026-10-14 뒤 한 번 고친 것)
- 건물 문은 남향, 문 아래 접근칸은 길. 모든 접근칸이 시작 칸에서 닿아야 한다(씨앗 6번까지 다시, 도구는 엔진 `isPassable` BFS 로 다시 확인하고 실패하면 맵을 바꾸지 않는다).
- 소품 발 밑(키트 맨 아랫줄)의 꼭짓점: 덤불·마른 풀·바위·낙타·작은 천막은 모래(마른 풀은 사구도)만, 야자·협죽도는 풀만, 갈대는 물가 풀. 물 위에는 아무것도.
- 야영지는 다진 흙 마당 + 천막 둘 + 모닥불 + 깔개 + 앉은/선 낙타를 한 무리로. 바자르는 앞줄 노점(통로 향함) + 뒷줄 장인 묶음(같은 묶음 이웃 금지).
- 궁전: 앞 단은 마당 폭 끝까지, 정원은 축선 길까지 붙이고 분수 마당을 다시 깐다, 북쪽 귀퉁이 화단. 대상 숙소: 같은 방을 틈 없이 한 줄, 우물 단 → 성문 포석 길.
- 피라미드: 대피라미드(14×9, 오른쪽 2칸 땅 그림자), 입구 = px+5, 남쪽 끝 탑문(성문 키트), 신전 터 배치는 셋 중 하나(거울 금지), 아치는 판석 위.
- 실내: 맨 윗줄 천장, 그 아래 두 줄 벽면(1×2 키트), 아래 모서리는 일반 천장(테 조각 쓰지 않음), 벽등은 창·벽감 위에 걸지 않는다, 무덤 통로는 비운다(부장품은 묘실 벽 앞, 넣을 때마다 문에서 닿는지 확인 `putSafe`).

## 3/4 관문
`npm run harness -- object-gate review --batch tiledata/desert-east/<묶음>/_gate/items.jsonl --force` (묶음 terrain·buildings·props·interior).
모서리 왕 타일은 한 벌 4×4 묶음 그림 `de-wang-<벌>.png` 의 영수증이 16칸을 덮는다. 보정 프로필이 미보정이라 통과는 잠정이다(`object-gate status`).

## 조수 경로
`plainTurn.ts` 가 사막·오아시스·바자르·피라미드·아라비안·실크로드 낱말(로마풍·버들항·지중해 제외)을 보면 `desertEastTargetFor` 노트를 붙이고 위 세 도구를 첫 요청부터 노출한다.
월드맵 테마 `desert-east` 의 마을 칩셋도 desert_east 다(`worldTerrainTools.ts` THEME_TOWN_TILESETS).

## 현황 (2026-10-14)
- 굽기: 칸 928, 키트 127, 조각 245/247 (관문 항목 170/172 통과 — 모서리 왕 타일 5벌은 묶음 그림 5장이 80칸을 덮는다). 보정 프로필 미보정이라 통과는 잠정.
- 미통과로 굽지 않은 것: `de-obelisk`(구성기는 시트에 없으면 `de-stele` 로 대신 놓는다), `de-fence-wood`(구성기가 쓰지 않는다). 첫 판 57개 미통과는 윗면을 키워 다시 그렸다.
- 적대 시각 QA 1판(장면 5 + 방 3, 배치 4~6/10) → 개선 1판: 바닥 이음 V자 틈, 소품 발 밑 재질, 야영지·바자르·궁전·대상 숙소·피라미드 배치, 대피라미드, 방 모서리·벽등·양탄자 길.
- 조수 실제 입력창(gemini-3.8-flash high, `assistant-capability` 실행기 복제): 오아시스 7 · 바자르 6.5 · 피라미드+묘실 6 (연결까지 성공). 피라미드 판에서 배치 품질 권고를 받은 조수가 석재를 낱개로 덧찍어서
  구성기 맵·방에 `composed-layout` 이름표를 달았다(`scripts/lib/piAgentRuntime.ts` 가 그 맵을 권고에서 뺀다). 이 고침 뒤 실조수 재확인은 할당량 소진으로 못 했다.
- 남은 일: 오벨리스크 관문, 바자르 격자 단조로움, 조수 재확인.

- **시작 위치 (2026-10-14):** `compose_desert_east_map` 이 빈 시작 맵을 이 맵의 시작 칸으로 옮긴다(`src/editor/tools/composerStart.ts`; 실내 `compose_desert_east_room`·작가가 정한 시작은 제외). 모델이 `set_start_position` 을 안 부르면 시작 맵이 빈 맵으로 남던 결함.
- **화풍 정렬 quality-b (2026-10-14):** 버들항 수준 명암·질감으로 야자(렌즈 잎·빛/그늘 반·빗살 틈, 줄기 비늘, 밑동 풀 그늘), 평지붕 윗면(`bparts.flat_roof` 빛 기울기 디더·미장 덩이·빗물 얼룩·잔금 → 건물 15종), 풀(짙은 풀 덩이·풀잎 점), 흙길(눌린 흙 디더·잔돌·발굽 홈), 모래 잔 결, 물(흩어진 물결 — 칸마다 찍히던 글자 무늬 제거)을 다시 그렸다. 칸 번호·키트 크기 그대로. 관문 영수증 새로 52장(PASS 48 · FAIL 4: 지붕 첫 판의 회당·궁전 2 — 덩이를 둥글게 고친 뒤 통과, 오벨리스크 시도 2), 오벨리스크는 두 번 다시 그려도 미통과라 원래 그림으로(여전히 비석으로 대체). 시트 지표(칸당 고유색 중앙 7·p90 13, 어두운 V 62→61, 채도 0.49)는 잠긴 램프(6~7단) 때문에 거의 그대로 — 차이는 단 배치·디더라 눈으로 본다. 조수(gemini-4-argon medium, 실제 입력창) 「사막 오아시스 마을 만들어줘」 6 → 7(저장·재로드 일치). 남은 것: 야자 키트가 작아 버들항 나무만큼 덩이가 크지 않음, 사암 포석 광장이 평평함.
