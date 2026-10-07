# 마법 학교 번들 타일셋 (wizarding_world · 해리포터풍)

해리포터풍 게임 생성에 필요한 그림 전부(고딕 성채 공용 벽·바닥·문, 12공간 기물, 학생·교수·생물 걷기 칩, 마법 효과)를
**코드 손 도트 조각**으로 그려, 독립 검수를 통과한 것만 공용 번들로 굽는다. 새 프로젝트가 처음부터 갖고, 기존 프로젝트는 로드할 때 심긴다.
슈퍼하네스 해리포터 데모(지팡이 가게·마법약 교실, PR #2269)의 승인된 native 조각 168개가 화풍 기준이자 첫 재료다.

## 식별자

| 항목 | 값 |
|---|---|
| 타일셋 id | `wizarding_world` |
| 텍스처 키 | `tex_wizarding_world` |
| 계열 | `oprn-wizard` (라벨 "마법 학교(해리포터풍)", `src/project/tilesetFamily.ts`) |
| 시트 | 16px 칸, 48열 |
| 번들 소유 접두 | 키트·오토타일·참고문서 `wz-`, 타일 그룹 `wz:` |
| 팔레트 | 해리포터 테마 42색(`wzlib.PAL`)만, 알파 0/255 |
| 캐릭터 시트 | `public/assets/generated/charsets/Wizarding<N>.png` (288×256, 8명/장, 24×32·3프레임×4방향, 행 위·오른쪽·아래·왼쪽). 자원 id `oprn-charset-wizarding<n>`, 그룹 "Wizarding" |

## 공간 (wzlib.SPACES)

성채 공용(shared) · 부엉이 탑 · 마법약 교실 · 시계탑 · 지팡이 가게 · 도서관 · 온실 · 병동 · 허니듀크 지하 창고 · 호그스미드 우체국(눈 마을) ·
금지된 숲 길·마차 · 검은 호수 보트 창고 · 퀴디치 경기장. 모든 실내 예제는 `castle_kit` 의 공용 id(`CONTRACT.md` 4절: 북벽 1×4, 서·동 1×1, 남벽 1×2, 문 3상태, 계단, 포석 오토타일)를 쓴다.

## 파일

| 경로 | 역할 |
|---|---|
| `scripts/content/wizarding/CONTRACT.md` | 화풍 규칙·등록 API·자기 검사 루프·공용 id 표. **조각을 그리기 전에 읽는다** |
| `scripts/content/wizarding/wzlib.py` | 42색 램프 `K(재질,단)`, 캔버스 `Cv`, 등록 `REG`, 블롭 47종 합성, 검사, 검수 시트 |
| `scripts/content/wizarding/pieces/<모듈>.py` | 조각 모듈(18개 + native). `_` 로 시작하는 파일은 모듈 도우미(굽기에서 제외, 불러오기 경로에는 있다) |
| `scripts/content/wizarding/orders/*.md` | 모듈별 작업 주문·공통 읽기 예산(`common.md`)·검수자 규약(`review.md`) |
| `tiledata/wizarding/review/<모듈>.judgments.json` → `.verdict.json` | 독립 검수 판정 → `seal_verdict.py` 가 조각 해시에 봉인 |
| `tiledata/wizarding/pins.json` | 자리 키 핀(덧붙이기 전용 칸 번호) |
| `tiledata/wizarding/bake-report.json` | 채택·거절 목록(거절 이유 포함) |
| `src/assets/wizardingWorldTileset.json` · `wizardingWorldSheet.json` · `public/assets/wizarding-world/wizarding-world-chipset.png` | 굽기 산출물(손 편집 금지) |
| `src/assets/wizardingWorldReferences.json` + `public/assets/wizarding-world-references/*.png` | AI 참고문서(이미지 바이트 없음) |
| `src/assets/wizardingCharsets.json` · `wizardingCharsets.ts` | 캐릭터 시트 목록·외형 의미(조수가 외형으로 고른다) |
| `src/project/defaults/wizardingWorld.ts` | `createWizardingWorldTileset` · `ensureWizardingWorldTileset` · `ensureWizardingWorldReferences` (jpCity.ts 와 같은 갱신 규칙: `wz-` 항목만 번들 소유, 저자 항목 보존) |
| `src/project/wizardingPlaceReferences.ts` + `src/project/regionReferences/wz-*.json` + `public/assets/region-references/wz-*` | 「장소」 완성 예제(공간별) |

배선: `bundled.ts`(항목·칸 수), `bundledChipsetGeometry.ts`(열 수), `defaultAssets.ts`(`ensureBundledTilesets`·`bundledEasyRpgTilesetBase`), `tilesetFamily.ts`,
`tilesetHarness/combinedTown.ts`(제외), 캐릭터는 `charsetCatalog.ts`·`generatedAssetResourceResolver.ts`·`resourceReferenceValidation.ts`·`charsetSemantics.ts`,
장소는 `regionReferences.ts`·`regionReferenceSnapshots.ts`, 테스트 `test/bundledTilesetIdParity.test.ts`.

## 굽기 순서 (한 번에)

```bash
python3 scripts/content/wizarding/bake_wz.py            # 검수 PASS·해시 일치 조각만 → 시트·정의·키트·애니메이션·캐릭터 시트 (--dry 로 모듈별 채택 수만)
python3 scripts/content/wizarding/bake_refs_wz.py       # 참고문서 (wz-start · wz-space-<공간> · wz-characters · wz-effects · wz-check)
python3 scripts/content/wizarding/publish_places_wz.py  # 공간 예제 → 장소(빠진 조각이 있는 예제는 건너뜀)
python3 scripts/content/wizarding/viz_wz.py             # ~/claude-viz/wizarding-world.html (사용자 확인 페이지)
```

## 검수 흐름

1. 작업자(서브에이전트)가 모듈을 그리고 `pieces/<모듈>.py` 실행으로 기계 검사 0 + 시트를 직접 보고 메모.
2. 독립 검수자가 `orders/review.md` 기준으로 판정 → `seal_verdict.py <모듈>`. **판정 이유 문장이 그대로면 옛 해시를 유지**하므로, 판정 뒤 그림이 바뀐 PASS 조각은 굽기에서 빠진다.
3. FAIL 은 수정 작업자가 그 id 만 고친다(PASS 조각 해시 불변 확인).
4. 재검수는 얇게: `recheck_sheet.py <모듈>` 이 지난 FAIL id 만 한 장(`review/<모듈>-recheck.png`)으로 그리고, 재검수자는 그 한 장과 옛 FAIL 이유만 보고 판정을 고쳐 봉인한다
   (2026-10-07 사용자: 검수가 너무 무거워 토큰이 바닥 — 한 바퀴 이후로는 이 얇은 확인만, 그래도 FAIL 이면 그 조각은 빠진다).
5. 사용자는 `http://mdc-server:18301/wizarding-world.html` 한 장에서 싫은 것을 짚는다. 고친 조각은 다시 판정·봉인 후 굽는다.

## 한계

- 탈것(마차·보트·세스트랄)은 프로젝트 데이터로 갈아탈 수 없어 정적 키트다. 큰 생물은 캐릭터 시트(24×32 고정)로 못 넣는다.
- 움직이는 칸은 `animationStrips`(baseTile + 가로 연속 프레임). 장소 스냅숏에는 baseTile 만 칠해져 있다.
- 장소 예제에는 이벤트(사람)가 없다. 사람은 Wizarding 시트로 이벤트를 따로 둔다.
