# 조선(바람의나라풍) 칩셋 — 공용 번들 타일셋 joseon_baram

2026-10-02. 손 도트 조선 조각(집·궁궐·성문·나무·담·소품) 242종과 오토타일 5종을 **편집기 공용 번들 타일셋**으로 등록했다.
정본 마을 20호(`joseon_v20`, 64×56)가 첫 맵이고, 국내성 맵이 같은 시트에 이어 합쳐진다.
버들항(`beodeul_city`)의 등록 선례를 따랐다 — `openwiki/beodeul-city.md`.

| 항목 | 값 |
|---|---|
| tilesetId / 텍스처 / 접두 | `joseon_baram` / `tex_joseon_baram` / 키트·문서 id 는 `jb-` |
| 계열 | `oprn-joseon`(「조선 칩셋」, `tilesetFamily.ts`). 버들항(`oprn-atlas`)·숲마을과 섞지 않는다 |
| 칸 | 16px, 시트 **64열**(16열이면 높이가 4096px 을 넘어 자동 전환, `tilesPerRow` 는 JSON 에서 읽는다), 칸 수는 `build-stats.json` 의 `count` |
| 그림 | `public/assets/joseon-baram/joseon-baram-chipset.png` (번들 항목은 `src/assets/bundled.ts`) |
| 원본 그림 | 커밋하지 않았다. 손 도트이며 팔레트만 참고했다(재배포 금지 원본 없음) |

## 만드는 길 (전부 스크립트, 손으로 고치지 않는다)

```
python3 scripts/content/build-joseon-tileset.py            # 시트 → 번들 시트·타일셋 정의·통행·오토타일·키트·맵 JSON
python3 scripts/content/prepare-joseon-baram-references.py # 참고문서 6용도·그림·오류 변조 검출
JOSEON_EXPORT_RELOADED=/tmp/joseon-reloaded.json node scripts/content/save-joseon-baram.mjs   # 임시 폴더 저장 → 재로드 deepEqual → 엔진 대조
node scripts/content/prepare-joseon-regions.mjs /tmp/joseon-reloaded.json                      # 장소 카드(공용 DB 게시 아님)
```

`build-joseon-tileset.py` 인자: `--sheet --pieces --map ID:map.json[:extra.json[:이름]](반복) --meta --overrides --out-dir --id --texture --prefix --family --cols auto`.
인자 없이 돌리면 마을 20호다. **칸 수·열 수를 코드에 박지 않는다.** 두 번째 맵(국내성)은 `--sheet`·`--pieces` 를 새 것으로, `--map` 을 두 번 주면 같은 시트 위에 합쳐진다.
`extra.json` 계약(맵 빌더가 `map.json` 옆에 낸다): `width,height, placed[{name,x,y,w,h}], groundKind[행][열](grass/road/yard/paving/water/paddy/field/other), doors[{x,y,piece}](문 앞 접근칸), people[{x,y,char,dir,frame}]`.

산출: `src/assets/joseonBaramSheet.json`(시트 메타), `src/assets/joseonBaramTileset.json`(타일셋 정의), `tiledata/joseon-village/{piece-walk.json, maps/<id>.json, autotile-equiv.json, build-stats.json, piece-walk-overlay.png, walk-overlay-<id>.png}`.

## 통행 (X/C/F)

엔진 규칙(`src/project/collision.ts`): 맨 위에서 ★(통행 가능 + priority upper)를 건너뛴 첫 칸이 통행을 정한다.

| 기호 | 통행 | priority | 쓰임 |
|---|---|---|---|
| `X` | 막힘 | upper | 몸채·담·소품·줄기 |
| `C` | 걸음(★) | upper | 처마 끝·수관·문루 보 |
| `F` | 걸음 | lower | 디딤돌·다리 갑판·성문 통로·그림자 |

- 조각마다 칸 통행을 `walk.py` 가 만든다: 칸 알파·발자국 열(최대 강한 칸의 45% 이상인 맨 아랫줄)·그림자(soft>0.6)·이름·분류(cls)로 자동 판정하고, 예외는 `tiledata/joseon-village/piece-walk-overrides.json`(ops: all/grid/passage/rect/set)이 덮는다.
- **같은 그림 칸을 다른 통행으로 쓰면 시트 꼬리에 복사본(`baseCount + k`)을 붙인다.** 원래 칸 번호는 절대 바뀌지 않는다(`tailCopies`).
- 오토타일: 마스크 비트는 엔진 `N1 E2 S4 W8 NE16 SE32 SW64 NW128`, `neighborhood: 8`. 흙길·마당·논은 `mask&15` 의 16변형, 강·연못은 블롭 47(`canon` 오름차순 순번, 변형 +47 은 `autotile-equiv.json` 등가표). 강은 `edgeConnects: true`, 논은 막힘.
- 문: 집 맨 아래 줄의 계단 그림 칸 = 디딤돌(`F`, `parts.door`), 그 바로 아래 = 문 앞 접근칸(맵 `doors[]`), 성문류 = 아치 열 전체가 `F`(`parts.passage`).

## 등록 배선 (한 곳이라도 빠지면 어느 프로젝트에선가 빈 화면)

`src/assets/bundled.ts`(시트 import·`BUNDLED_EASYRPG_CHIPSET_ASSETS` 항목·frameCount) · `src/assets/bundledChipsetGeometry.ts`(tilesPerRow) ·
`src/project/defaults/joseonBaram.ts`(`createJoseonBaramTileset`·`ensureJoseonBaramTileset`·`ensureJoseonBaramReferences`) ·
`src/project/defaults/defaultAssets.ts`(import·`ensureBundledTilesets` 블록·create 분기) · `src/project/tilesetHarness/combinedTown.ts`(합본 마을 계열 제외) ·
`src/project/tilesetFamily.ts`(`oprn-joseon`) · `src/project/regionReferences.ts`·`regionReferenceSnapshots.ts`·`joseonPlaceReferences.ts`·`regionReferences/joseon-village.json`(장소 카드) ·
`test/bundledTilesetIdParity.test.ts`(생성자 표 한 줄).

`ensureJoseonBaramTileset` 규칙: 타일셋이 없으면 만들고, 칸 수가 번들과 다르고 더 적으면 표(통행·메타·그룹·오토타일·키트)를 교체한다. 칸 수가 같으면 빠진 키트와 `jb-` 키트·참고문서만 번들 것으로 되돌리고 저자가 쓴 것은 건드리지 않는다. **번들보다 칸이 많으면 건드리지 않는다.**

## 참고문서 (번들 소유, AI-REFERENCE-CONTRACT 8항목)

`src/assets/joseonBaramReferences.json`(경로만, 바이트 0) + `public/assets/joseon-baram/references/*.png`(820px·128색) + `tiledata/joseon-village/references/*.md`(출처 사본) — 전부 `prepare-joseon-baram-references.py` 산출.
6용도: 한 장 조립(읽는 순서·작업 순서·반복/고정·문/디딤돌/접근칸·검사 범위·금지) · 땅 오토타일(비트·변형 표·알려진 불일치) · 건물 조각 사전 · 나무·소품·담·다리 사전(조각마다 칸 배열·통행 JSON) · 조립 예제 4(양반댁·집 줄·다리·연못과 논: 전체 아래/윗층 배열 + 원본 해상도 완성 그림) · 오류 교훈(정본 맵을 실제 변조: 문 앞 막힘·수관 아래층·반대 둑·다리 막힘 → 검출 코드·좌표, `qa-tamper-checks.json`).
한 문서 최대 15KB(한도 120,000자), 용도당 문서 ≤ 8·그림 ≤ 5.

## 검증 (실측, 임시 폴더 프로젝트)

저장소는 `/tmp/oprn-joseon-baram-proof`(`JOSEON_SAVE_DIR`) — 사용자의 실제 프로젝트 폴더가 아니다. LegacyDb/Supabase 에는 쓰지 않는다. 증거: `tiledata/joseon-village/storage-proof.json`.

- 저장 → 다시 열기: 맵·타일셋 `deepEqual` 참. 프로젝트 전체 `deepEqual` 은 저장소 정규화(`database.actors[6].characterIndex`) 때문에 거짓이라 맵·타일셋만 엄격히, 나머지는 첫 차이 경로를 증거에 남긴다.
- 엔진 `isPassable` 대 구운 통행: 3584칸 불일치 0(재로드 후도 0).
- 엔진 `canMove` 너비 우선: 걸을 수 있는 2177칸 중 2168칸 도달, 문 앞·디딤돌·성문 통로·주민 20명 칸 놓침 0, 음성 대조(집 벽 칸)는 막힘. 도달 못 한 9칸은 문·통로·주민 목표가 아닌 막힌 틈 칸이다: (3,0)(4,0) 맵 위 가장자리, (39,34)(39,35)(39,36) 물레방아 곁, (19,55)(20,55)(22,55)(23,55) 맵 아래 가장자리(풀 틈이 연못·논·감나무에 둘러싸임).
- 오토타일 마스크: 흙길 6/306 · 마당 65/408(`expected-mismatch.json` 에 사유와 상한 — 맵 가장자리·논두렁에서 구운 변형이 엔진 규칙과 한 칸 어긋난 곳, 칠하면 그 칸만 다시 계산) · 강 0/374 · 모 논 0/100.
- 기존 프로젝트 보강: 타일셋 없음·옛(짧은) 사본·참고문서 빠짐·키트 빠짐 모두 복구, 저자 키트 보존, 재실행 멱등.
- 참고문서: `validateTilesetReferences` 통과, 그림 23장 전부 `/assets/...` 경로이고 파일이 있다.

돌리지 않은 것(규칙상 금지): vitest·게이트·전체 typecheck. 파일 단위 tsc 는 새 파일 오류 0(기존 `import.meta.env`·`__oprnVersion` 두 종만).
`test/generateMap.test.ts` 는 번들 자산을 전부 순회한다 — 아틀라스 계열 타일셋은 기준선에서도 이미 빨간지 감독자가 게이트로 확인한다.

## 알려진 한계 · 다음 일

- **국내성 맵 합치기 전 미확인**: `slab_edge16`(판석 가장자리)의 이웃 규칙과 성문·돌계단 보정(`gungnae_gate_*`, `gungnae_bridge_*`, `palace_*`)은 이 마을에서 쓰이지 않아 BFS 로 검증되지 않았다. 새 맵을 합친 뒤 `walk-overlay-<id>.png` 와 도달 검사를 눈으로 확인하고 `piece-walk-overrides.json`·`expected-mismatch.json` 에 줄을 더한다.
- 실내 맵이 없다(문 이동 이벤트 없음). 주민 NPC 20명만.
- 공용 DB(`shared-content.sqlite`) 게시와 사용자 프로젝트 반영은 하지 않았다 — 소급 적용은 별도 `register-*`/게시 작업이다.
- 장소 카드 내려받기 JSON 이 5.8MB 다(타일셋 표 포함). 필요하면 `tileMeta` 를 줄이는 것은 후속.
