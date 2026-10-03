# 조선(바람의나라풍) 칩셋 — 공용 번들 타일셋 joseon_baram

2026-10-02 등록, 2026-10-04 확장. 손 도트 조선 조각(집·궁궐·성문·나무·담·소품·다리·사냥터·동굴·실내·궁 내부) **623종**과 오토타일 **19종**(지형 묶음 55)을 **편집기 공용 번들 타일셋**으로 등록했다(처음 판은 291종·오토타일 10종).
맵 **14장**이 같은 시트 위에 들어 있다: 마을 20호(`joseon_v20`, 64×56), 국내성(`gungnae`, 96×96, 성벽·해자·왕궁·구획 건물), 국내성 원작 규모(`gungnae_full`, 200×208), **사냥터(`joseon_field`, 96×96)·동굴(`joseon_cave`, 48×48)·실내 6(민가·주막·대장간·약방·서당·관아 동헌)·궁 내부 3(정전 어좌 홀·회랑·침전)**. 새 11장의 설명은 아래 「사냥터·동굴·실내·궁 내부 (2026-10-04)」.
버들항(`beodeul_city`)의 등록 선례를 따랐다 — `openwiki/beodeul-city.md`.
작업 순서(관문·판정·지도 관문·재굽기·16구역 적대 검수)는 하네스 한 입구로 묶었다 — `npm run harness -- joseon-baram <단계>`, 문서 `openwiki/harnesses/joseon-baram.md`.

| 항목 | 값 |
|---|---|
| tilesetId / 텍스처 / 접두 | `joseon_baram` / `tex_joseon_baram` / 키트·문서 id 는 `jb-` |
| 계열 | `oprn-joseon`(「조선 칩셋」, `tilesetFamily.ts`). 버들항(`oprn-atlas`)·숲마을과 섞지 않는다 |
| 칸 | 16px, 시트 **128열**(칸 높이가 4096px 을 넘으면 열 수를 키운다: 64열이 기본이고 16,768칸은 128열 2048×2096px, `tilesPerRow` 는 `joseonBaramSheet.json` 에서 읽는다 — 열 수는 칸 번호에 영향이 없다), 칸 수는 `build-stats.json` 의 `count`: **16,768칸**(2026-10-04, 맵 14장) = 옛 판 13,632칸(기준 시트 8,496 + 덧붙임 + 통행 복사본 130 + 빈 칸 12, **번호 불변**) + 새 시트 덧붙임 + 통행 복사본 97(총 꼬리 복사 227). 옛 판은 13,632칸(맵 3장), 그 전은 9,792칸 |
| 그림 | `public/assets/joseon-baram/joseon-baram-chipset.png` (번들 항목은 `src/assets/bundled.ts`) |
| 원본 그림 | 커밋하지 않았다. 손 도트이며 팔레트만 참고했다(재배포 금지 원본 없음) |

## 재실행 한 줄 (국내성 맵이 다시 바뀌면)

```
bash scripts/content/rebuild-joseon.sh                                   # 약 2분(2026-10-04 실측 1분 44초)
GUNGNAE_DIR=<다른 워크트리>/tiledata/joseon-gungnae bash scripts/content/rebuild-joseon.sh
GUNGNAE_FULL_DIR=<다른 워크트리>/tiledata/joseon-gungnae-full bash scripts/content/rebuild-joseon.sh
REGEN_VILLAGE=1 bash scripts/content/rebuild-joseon.sh                    # 마을 20호 기준 시트를 다시 굽는다(기본은 건너뜀 — 아래 주의)
JOSEON_REPORT_ONLY=1 bash scripts/content/rebuild-joseon.sh              # 실패를 멈춤 없이 전부 보고(새 판을 처음 합칠 때)
```

한 줄이 순서대로 돌리는 것: ① `build-joseon-tileset.py`(시트 14장 합치기·동결 장부 해시 확인·통행·오토타일·키트·맵 JSON) ② `prepare-joseon-baram-references.py`(참고문서 9용도·그림·오류 변조 검출·카드 그림)
③ `save-joseon-baram.mjs`(임시 폴더 저장 → 재로드 deepEqual → 엔진 대조, 재로드본을 `/tmp/joseon-reloaded.json` 으로 내보냄) ④ `prepare-joseon-regions.mjs`(장소 카드 14장·스냅숏·내려받기 JSON, 내려받기 JSON 이 번들로 되살아나는지 `ensureBundledTilesets` 로 확인).
입력은 마을 20호 `tiledata/joseon-village20/{joseon-village20-chipset.png,pieces.json,map.json,extra.json}` 와 국내성 `$GUNGNAE_DIR/{joseon-gungnae-chipset.png,pieces.json,map.json,extra.json}` 와 국내성 원작 규모 `$GUNGNAE_FULL_DIR/{joseon-gungnae-full-chipset.png,pieces.json,map.json,extra.json}`(세 번째 시트·맵, 시트순번 2). 새 11장의 입력은 `FIELD_DIR`(`tiledata/joseon-field`)·`CAVE_DIR`(`tiledata/joseon-cave`)·`INTERIOR_B_DIR`(`tiledata/joseon-interior-b/<방id>/`)·`PALACE_INT_DIR`(`tiledata/joseon-palace-int/<방id>/`) 아래 `{머리}-chipset.png, pieces.json, map.json, extra.json`(시트순번 3~13). `--map` 줄은 `rebuild-joseon.sh` 안에 있다. `JOSEON_STOP_AFTER_BUILD=1` 이면 변환기까지만 돈다.
⑤ 마지막에 장소 카드(14장, `joseonPlaceReferences.ts` 에서 이름을 읽는다)·칩셋 줄 축소본(`public/assets/catalog-thumbs/…`)을 만든다 — 없으면 목록이 원본으로 넘어가며 「리소스 로드 실패」 오류 로그가 쌓인다.
새 판을 처음 합친 뒤 저장 단계가 실패하면 출력의 `FAIL` 줄을 보고 아래 「새 판이 오면 손볼 곳」 을 따른다.

## 변환기와 시트 합치기

`build-joseon-tileset.py` 인자: `--sheet A.png --pieces A.json [--sheet B.png --pieces B.json …]`(순서대로 짝) `--map ID:map.json[:extra.json[:이름[:시트순번]]]`(반복) `--meta --overrides --out-dir --id --texture --prefix --family --cols auto`.
인자 없이 돌리면 마을 20호 한 맵이다. **칸 수·열 수를 코드에 박지 않는다.**
`extra.json` 계약(맵 빌더가 `map.json` 옆에 낸다): `width,height, placed[{name,x,y,w,h}], groundKind[행][열](grass/road/yard/paving/water/paddy/field/slab/diamond/bridge/wall/other), doors[{x,y,piece}](문 앞 접근칸), people[{x,y,char,dir,frame}]`.

### 두 시트를 한 시트로 (칸 번호 불변 규칙)

국내성 시트는 마을 20호 시트의 상위집합이 **아니다**(칸 번호 배치가 다르고, 지형 묶음이 푸른 물·석판·궁궐 마당으로 늘었다). 그래서 합치기 규칙을 구현했다.

1. **첫 `--sheet`(마을 20호)가 기준이다.** 그 칸 번호(0 ~ 8,495)는 절대 바뀌지 않는다.
2. 다음 시트의 같은 이름 조각·지형 묶음은 **같은 모양이고 그림이 같으면**(알파가 같고 불투명 화소 RGB 가 같음; 반투명 가장자리 RGB 차이는 허용) 기준 시트의 칸으로 합친다. 이번 실측: 126개 합침, 그중 316칸은 반투명 가장자리 RGB 만 달랐고(최대 Δ198, 알파 낮은 화소) 합친 맵 그림은 빌더의 `map-from-sheet.png` 와 화소 최대 차이 1(부동소수 반올림)이다.
3. 새 조각·묶음·겹침 칸(조각 하나의 칸이 아닌 합성 칸)은 기준 시트 **뒤에 덧붙인다**(이번에는 지형 묶음 8개: `water47g, water_deep, slab, slab_edge16, slab_dirt, diamond, palace_court, palace_court16` + 국내성 겹침 칸). 겹침 칸은 화소 해시로 중복을 걸러낸다.
4. 이름은 같은데 모양/그림이 다르면 `<이름>__s<시트순번>` 변형으로 따로 두고 경고한다. 그 맵의 `extra.json` 이름도 바꿔 읽고, **변형은 따로 줄이 없으면 기준 이름의 `piece-walk-overrides.json` 줄을 이어받는다**(`walk.base_name`, 빌더 `OVP`). 최종 판은 0건이다. 국내성 최종판을 낡은 마을 20호 시트와 합치면 변형이 29개 생기는데, 이어받기만으로 걷는 칸·통로·건너는 곳이 새로 굽는 것과 똑같이 나온다(걷는 칸 5,019·통로 5·건너는 곳 17 비교). 변형의 **모양**이 기준과 달라지면 보정 줄(`rect/grid/passage` 범위)이 안 맞아 빌드가 조각 이름과 함께 멈춘다 — 새 그림에 맞게 줄을 고친다.
5. 그 위에 통행이 다른 같은 그림은 시트 꼬리에 복사본을 붙인다. **옛 판(13,632칸, 맵 3장)의 번호는 동결 장부가 고정한다(아래 「동결 장부」)** — 새 시트는 옛 구간 **뒤**에 덧붙고, 새 꼬리 복사본은 모든 칸의 맨 끝에 붙는다. 그래서 재실행해도 옛 번호는 한 칸도 안 움직인다(변환기가 해시로 확인하고 어긋나면 `동결 장부 위반` 으로 멈춘다). 맵 JSON 은 매번 같이 다시 쓴다.

### 동결 장부 (`tiledata/joseon-village/frozen-layout.json`) — 새 시트를 더하는 법

번들이 한 번 나가면 그 칸 번호는 사용자 프로젝트 맵 안에 박힌다. 그래서 칸 배치를 **append-only 장부**로 못 박는다.
- 옛 판 배치 = `[기준·덧붙임 칸 0..13,489][옛 꼬리 복사 130 = 13,490..13,619][빈 칸 12 → 13,632]`. 장부에는 파동(wave) 하나가 있고 그 꼬리 130칸의 (원래 칸 번호, 통행 종류)와 **그림 해시(칸 RGBA SHA-256)·메타 해시(통행·우선순위·지형·tileMeta)** 가 적혀 있다. 변환기는 새 판을 구운 뒤 앞 13,632칸의 두 해시를 장부와 대조한다(`동결 장부 확인: 앞 13632 칸(그림·통행·메타) 해시 일치`).
- 새 시트 칸은 13,632 이후에 붙고(옛 구간 자리는 자리표시자로 예약), 새 꼬리 복사본은 그 뒤에 붙는다. 옛 시트(0~2)의 맵이 새 꼬리 복사본을 필요로 하면 `동결 장부 위반` 으로 멈춘다(옛 칸을 못 건드린다).
- **장부에는 파동 1 만 적혀 있다.** 이 번들(14장)이 사용자에게 나간 **다음에야** `build-joseon-tileset.py --write-frozen` 으로 두 번째 파동을 적는다 — 그 전에 적으면 아직 나가지 않은 번호가 못 박혀 다음 정리가 막힌다.
- 증명(2026-10-04): 같은 장부를 JS(`save-joseon-baram.mjs`)와 Python 이 각자 계산한 앞 13,632칸 해시가 일치, 새 번들을 옛 13,632칸으로 자른 것과 이전 번들 사본 모두 `ensureJoseonBaramTileset` 이 올려 준다(`prevReleaseUpgraded`·`prevReleaseOldPrefixMatchesLedger`).

마을 20호 산출물(`tiledata/joseon-village20/*`)은 **기준 시트**다. 기본으로 다시 굽지 않는다(`REGEN_VILLAGE=1` 일 때만 `demo20.py` 시드 7 을 돌린다, 약 40초). 카탈로그가 바뀐 뒤 다시 구우면 기준 시트의 칸 수가 달라져(2026-10-03 실측: 12,928 → 13,184칸, 마을 걸을 수 있는 칸 2,175 → 2,151) 이미 배포된 칸 번호가 어긋난다. 새 시트의 새 조각·변형은 합치기 규칙이 꼬리에 덧붙이므로 기준을 다시 구울 필요가 없다.

산출: `src/assets/joseonBaramSheet.json`(시트 메타), `src/assets/joseonBaramTileset.json`(타일셋 정의), `tiledata/joseon-village/{piece-walk.json, maps/<id>.json, autotile-equiv.json, build-stats.json(sheetMerge 포함), piece-walk-overlay.png, walk-overlay-<id>.png}`.

## 통행 (X/C/F)

엔진 규칙(`src/project/collision.ts`): 맨 위에서 ★(통행 가능 + priority upper)를 건너뛴 첫 칸이 통행을 정한다.

| 기호 | 통행 | priority | 쓰임 |
|---|---|---|---|
| `X` | 막힘 | upper | 몸채·담·소품·줄기 |
| `C` | 걸음(★) | upper | 처마 끝·수관·문루 보·**물 위 그림자** (아래 땅이 정한다: 땅이면 걷고 물이면 막힘) |
| `F` | 걸음 | lower | 디딤돌·다리 갑판·성문 통로·선착장 |

- 조각마다 칸 통행을 `walk.py` 가 만든다: 칸 알파·발자국 열(최대 강한 칸의 45% 이상인 맨 아랫줄)·그림자(soft>0.6)·이름·분류(cls)로 자동 판정하고, 예외는 `tiledata/joseon-village/piece-walk-overrides.json` 이 덮는다. 조각 키: `all/grid/passage/rect/set`(격자 보정), `cross: "h"|"v"`(건너는 곳 — 다리·측면 성문·대문, 저장 스크립트가 엔진 canMove 로 센다), `front: [열…]`(조각 아래 접근칸 — 궁 정전 앞).
- **겹침 칸의 통행**: 한 칸에 조각이 여럿 걸치면 가장 제한적인 값(X>F>C). 단 `passage` 로 선언된 열(대문·성문 아치)은 그 위에 깔린 다른 조각(대문 밑에 겹쳐 놓인 성벽 칸)이 막지 않는다 — 국내성 대문 아치가 이 규칙이 없으면 통째로 막힌다.
- **같은 그림 칸을 다른 통행으로 쓰면 시트 꼬리에 복사본을 붙인다.** 기준 시트의 원래 칸 번호는 절대 바뀌지 않는다.
- **물 위 그림자는 `C`**: 다리 곁 물그림자 칸(국내성 다리 `FFFFC`)·갈대(`reeds` 전체 `C`)를 `F` 로 두면 물 위가 걸어진다(실측 13칸을 잡아 고쳤다). 굵은 갑판 칸만 `F`.
- 오토타일: 마스크 비트는 엔진 `N1 E2 S4 W8 NE16 SE32 SW64 NW128`, `neighborhood: 8`. 흙길·마당·논·석판·궁궐 마당은 `mask&15` 의 16변형, 강·해자는 블롭 47(`canon` 오름차순 순번, 변형 +47 은 `autotile-equiv.json` 등가표). 지형 묶음 정의 키: `kind/connect/edgeConnects/walk/role` + **`fold`**(몸통 칸을 평면 변형 여러 장으로 흩어 깐 묶음 — 석판 3·궁궐 마당 3 을 몸통과 같은 칸으로 봄) + **`deep`**(블롭의 사방 물 칸을 깊은 물 변형 8종으로 흩음, 첫 변형이 대표).
- 흙길·마당 규칙은 국내성에 맞춰 **마당·석판·마름모 바닥도 이어진 것으로** 센다(`connect: road16,yard16,diamond,slab,slab_edge16`, 길은 맵 밖도 이어짐). 마을 20호는 길만 세는 맵이라 흙길 33/306 이 어긋난다(`expected-mismatch.json` 에 사유). 국내성은 0.
- **변형 묶음 지형(국내성 16구역판)**: 흙길 `road64`·마당 `yard64`는 16칸 마스크 × 변형 4(64칸, 변형 0 을 엔진이 고르고 나머지는 같은 모양의 다른 무늬라 `autotile-equiv.json` 에서 같은 칸으로 본다), 풀 `grass8` 은 평면 8변형, 푸른 물 `water47g` 는 블롭 47 × 4변형(188칸)+깊은 물 8, 석판 `slab` 5변형, 궁궐 마당 3변형. `mask16` 묶음은 칸 수가 16의 배수면 된다. 마을 20호는 옛 16칸 `road16`·`yard16` 을 그대로 쓰므로 두 흙길 묶음이 함께 있다.
- **흙길 252칸 불일치(국내성)**: 맵 빌더가 성벽·담 밑(바닥 종류 `wall` = 풀 칸)을 길과 이어진 것으로 세어 그 변의 둑을 없앤다. 엔진은 풀을 이어짐으로 안 보므로 252칸이 어긋난다(전부 상하좌우에 `wall` 칸이 있음을 확인, `expected-mismatch.json` 에 사유와 상한). 구운 맵이 정답이다.
- 문: 집 맨 아래 줄의 계단 그림 칸 = 디딤돌(`F`, `parts.door`), 그 바로 아래 = 문 앞 접근칸(맵 `doors[]`), 성문류 = 아치 열 전체가 `F`(`parts.passage`).
- **측면 성문·궁 측면 문루**(`gungnae_gate_side_5` 5×8, `palace_gate_side_3` 3×8, 최종판): 남북으로 선 성벽 위에 지붕이 앉고, 길은 지붕 남쪽 끝 4줄(조각 4~7행)의 돌바닥을 **동서로** 가로지른다(얇은 기둥 칸도 지난다). 전부 `X` 로 자동 판정되면 성문이 안 열리므로 그 4줄을 `F`(`rect`)로 보정했다. 이전 판은 5×11 이라 7~10행이었다 — 그림이 바뀌면 줄 범위를 다시 맞춘다.
- **그림자 칸**: 어느 조각의 배치 기록에도 없는 칸 그림(물 위에 떨어진 그림자 등)은 막힘 조각 칸이면 `X`, 아니면 `C`(아래 땅이 정함)로 둔다. `F` 로 두면 해자 위가 걸어졌다(10칸을 잡아 고침).

## 등록 배선 (한 곳이라도 빠지면 어느 프로젝트에선가 빈 화면)

`src/assets/bundled.ts`(시트 import·`BUNDLED_EASYRPG_CHIPSET_ASSETS` 항목·frameCount) · `src/assets/bundledChipsetGeometry.ts`(tilesPerRow) ·
`src/project/defaults/joseonBaram.ts`(`createJoseonBaramTileset`·`ensureJoseonBaramTileset`·`ensureJoseonBaramReferences`) ·
`src/project/defaults/defaultAssets.ts`(import·`ensureBundledTilesets` 블록·create 분기) · `src/project/tilesetHarness/combinedTown.ts`(합본 마을 계열 제외) ·
`src/project/tilesetFamily.ts`(`oprn-joseon`) · `src/project/regionReferences.ts`·`regionReferenceSnapshots.ts`·`joseonPlaceReferences.ts`·`regionReferences/joseon-village.json`(장소 카드 14장; 스냅숏 청크 1.7MB, 동적 import 라 장소를 깔 때만 받는다; 카드 내려받기 JSON 은 가벼운 타일셋(통행·우선순위·지형)만 담고 나머지는 열 때 `ensureBundledTilesets` 가 되살린다) ·
`test/bundledTilesetIdParity.test.ts`(생성자 표 한 줄).

`ensureJoseonBaramTileset` 규칙: 타일셋이 없으면 만들고, 칸 수가 번들과 다르고 더 적으면 표(통행·메타·그룹·오토타일·키트)를 교체한다(**저자가 만든 키트·묶음·오토타일 — 번들 id 가 아닌 것 — 은 교체 뒤에도 남긴다**, 옛 번호가 불변이라 저자 맵이 안 깨진다). 칸 수가 같으면 빠진 키트와 `jb-` 키트·참고문서만 번들 것으로 되돌리고 저자가 쓴 것은 건드리지 않는다. **번들보다 칸이 많으면 건드리지 않는다.**

## 참고문서 (번들 소유, AI-REFERENCE-CONTRACT 8항목)

`src/assets/joseonBaramReferences.json`(경로만, 바이트 0) + `public/assets/joseon-baram/references/*.png`(820px·128색) + `tiledata/joseon-village/references/*.md`(출처 사본) — 전부 `prepare-joseon-baram-references.py` 산출.
**9용도**(옛 6 + 새 3: `joseon-baram-field-cave`·`-interior`·`-palace`, 아래 「사냥터·동굴·실내·궁 내부」): 한 장 조립(읽는 순서·작업 순서·반복/고정·문/디딤돌/접근칸·검사 범위·금지) · 땅 오토타일(비트·변형 표·알려진 불일치; 흙길·마당·논·석판·궁궐 마당·강/해자) · 건물 조각 사전 · 나무·소품·담·다리 조각 사전(조각마다 칸 배열·통행 JSON) · 조립 예제 4(양반댁·집 줄·다리·연못과 논: 전체 아래/윗층 배열 + 원본 해상도 완성 그림 — 마을 20호 구획) · 오류 교훈(정본 맵을 실제 변조: 문 앞 막힘·수관 아래층·반대 둑·다리 막힘 → 검출 코드·좌표, `qa-tamper-checks.json`).
국내성 구획(두 국내성 맵)은 아직 예제에 넣지 않았다(필요하면 스크립트의 `example(...)` 호출을 더한다). 옛 6용도의 조각 사전·오토타일 표는 마을·국내성 조각만 싣고, 새 접두(`fld_ cav_ in_b_ pal_`)는 새 3용도가 맡는다.

## 검증 (실측, 임시 폴더 프로젝트, 14맵 합친 판)

저장소는 `/tmp/oprn-joseon-baram-proof`(`JOSEON_SAVE_DIR`) — 사용자의 실제 프로젝트 폴더가 아니다. LegacyDb/Supabase·공용 DB 에는 쓰지 않는다. 증거: `tiledata/joseon-village/storage-proof.json`.

- 저장 → 다시 열기: 맵 14장과 타일셋 `deepEqual` 참. 프로젝트 전체 `deepEqual` 은 저장소 정규화(`database.actors[6].characterIndex`) 때문에 거짓이라 맵·타일셋만 엄격히, 나머지는 첫 차이 경로를 증거에 남긴다.
- 엔진 `isPassable` 대 구운 통행: 마을 20호 3,584칸 · 국내성 9,216칸 · 국내성 원작 규모 41,600칸 모두 불일치 0 (재로드 후도 0).
- 엔진 `canMove` 너비 우선: 국내성 걸을 수 있는 5,090칸 중 4,984칸에 닿고, **문 앞 17곳·디딤돌·성문/대문 통로 5곳·주민 21명(예외 1)·정전 앞** 놓침 0. 못 닿는 106칸은 목표가 아닌 막힌 틈이다(탑 뒤 처마 아래 마당 36, 서낭당 섬·가장자리·나무 사이 풀 틈 등).
- **건너는 곳 19곳(국내성)**: 해자 다리 8(세로 6폭 넷·가로 6폭 둘·좁은 둘), 대성문 2, 측면 성문 2, 궁문 2, 궁 측면 문루 2, 문루 대문 1, 열린 사립문 2 — 조각 둘레 상자 안에서만 걸어 한쪽 끝에서 반대쪽 끝으로 건넌다. 18곳이 건너지고 1곳(좁은 다리 `narrow_h5`)은 양끝이 막힌 빌더 결함으로 예외 처리했다(줄 59개 중 2줄은 가장자리 기둥에 닿아 제외). 마을 20호는 3곳 중 2곳이 건너지고 1곳(두 번째 다리)이 예외. 곳별 건넌 줄/시험한 줄은 `storage-proof.json` 의 `engineChecks.<맵>.reach.crossingDetail`(대성문 4/4·4/4, 측면 성문 4/4·4/4, 궁 측면 문루 4/4·4/4, 궁문 2/2·2/2, 서·동 가로 다리 4/4·4/4, 세로 다리 4곳 4/4, 문루 대문 1/1, 사립문 2/2·1/1, 좁은 다리 `h6` 1/1)에 남는다.
- 음성 대조: 물 위에 아무것도 없는 걷는 칸 0, 문 위 벽 열림 0, 해자·논 위에 걸어지는 칸은 다리 갑판·선착장·징검돌뿐.
- 오토타일 마스크: 국내성 흙길(4변형) 252/1623(전부 성벽·담 밑 칸, 아래 참고) · 마당(4변형) 0/856 · 푸른 물 0/914 · 석판 0/307 · 궁궐 마당 0/456 · 모 논 0/36. 마을 20호 흙길 33/306 · 마당 65/408(`expected-mismatch.json` 에 사유와 상한) · 강 0/374 · 모 논 0/100.
- **국내성 원작 규모 (200×208, 2026-10-03, 통합 수정판 a2622118f8)**: 시트를 세 번째로 합쳐도 변형 0. 새 조각은 꼬리 쪽에 덧붙는다: 문루 변형 `gnf_gate_great_12`(대성문)·`gnf_gate_side_5`(측면)·`gnf_palace_gate_side_3`(궁 측면), 세로 성벽 치 `gnf_bastion_w/e/w2/e2`(전부 `X`), 망루 `gnf_tower_corner_5w`, 4칸 사립문 `gnf_sarip_mud/stone`(`XFFX`, 중앙 둘이 통로), 굴 입구 `gnf_cave_dark/white/moss`(전부 `X`, 문 앞은 조각 아래 칸), 정전 `gnf_palace_hall_wide_14`(18×10, front [8,9]) + 대나무 3종. 통행 보정 줄은 옛 문루와 같은 모양이라 그대로 옮겼다(`piece-walk-overrides.json` 의 `gnf_*`). 통행 줄이 없으면 자동값이 문루 통째를 막아 건너는 곳이 40→27곳으로 줄고 통로 6→4곳으로 줄었다 — 새 조각 이름이 보이면 먼저 보정 줄이 있는지 본다. **기준 시트 8,496칸은 그림·통행·우선순위·지형 0칸 차이**. 칸 수 13,632(꼬리 복사 130). 걸을 수 있는 칸 20,496, 시작 (100,104)에서 **18,677칸 도달**(도달 못 하는 1,819칸은 나무·덤불 사이 작은 섬 496개, 가장 큰 것 36칸). 문 56곳·통로 6곳·주민 40명·정전 앞 1곳 놓침 0. 건너는 곳 40곳 **전부** 건너진다(예외 0): 대성문 4/4·4/4, 측면 성문 4/4·4/4, 궁 측면 문루 4/4·4/4, 궁문 2/2·2/2, 세로 다리 8곳 30/30, 세로 5폭 3곳 9/9, 가로 다리 8곳 30/30, 좁은 다리 `h` 1/1·`h6` 1/1·`v` 2곳 2/2, 문루 대문 2곳 4/4, 사립문 진흙 2곳 4/4·돌 5곳 10/10. 마스크: 흙길 22/4010 · 마당 102/5431 · 푸른 물 0/7189 · 석판 3/1196 · 궁궐 마당 0/1634 · 모 논 0/24.
- **마스크 규칙 전환(통합 수정판)**: 원작 규모 빌더가 이웃 규칙을 바꿨다 — 흙길·마당은 판석·물·다리·논밭 쪽도 이어짐으로 세고(풀 둑을 안 쓴다), 석판은 석판·다리·판석만 센다. 그래서 `road64`·`yard64` 의 `connect` 에 `palace_court, palace_court16, water47g, water_deep, rice16, field` 를 더하고 `slab_edge16` 은 `slab, slab_edge16, water47g, water_deep, palace_court, palace_court16` 으로 줄였다(원작 규모 마스크 불일치 1,270 → 127). 남은 127칸은 성벽·담 칸(`wall` = 풀 칸) 곁 22+102(빌더는 벽 곁을 이어짐으로 세고 엔진은 풀을 안 센다)와 석판이 물·다리 곁인 3칸(다리·물이 같은 물 타일이라 구분 못 함)이다(`expected-mismatch.json`). 같은 그룹을 쓰는 옛 국내성(96×96)은 옛 규칙으로 구운 맵이라 새 규칙에서 흙길 332·마당 94·석판 69칸이 어긋난다(옛 252/0/0 에서 늘었다, 구운 맵이 정답이고 붓은 새 규칙으로 다시 계산).
- 기존 프로젝트 보강: 타일셋 없음·옛(짧은) 사본·참고문서 빠짐·키트 빠짐 모두 복구, 저자 키트 보존, 재실행 멱등. **이전 배포판 사본(13,632칸·참고문서 6용도·저자 키트와 저자 참고문서 포함)**도 올려 준다: 칸 16,768 · 용도 9 · 옛 13,632칸 해시가 장부와 같음 · 저자 것 보존 · 두 번째 실행에 변화 없음(`storage-proof.json` 의 `prevRelease*` 여섯 값 참).
- 참고문서: `validateTilesetReferences` 통과, 그림 26장 전부 `/assets/...` 경로이고 파일이 있다.
- 통행 오버레이 PNG(`walk-overlay-gungnae.png`)를 확대해 눈으로 확인: 대성문·측면 성문·궁문 통로는 열리고 성벽·해자·건물·지붕은 막히며, 다리 갑판은 열리고 곁 물그림자는 막힌다.

돌리지 않은 것(규칙상 금지): vitest·게이트·전체 typecheck. 파일 단위 tsc 는 새 파일 오류 0(기존 `import.meta.env`·`__oprnVersion` 두 종만).
`test/generateMap.test.ts` 는 번들 자산을 전부 순회한다 — 아틀라스 계열 타일셋은 기준선에서도 이미 빨간지 감독자가 게이트로 확인한다.

## 사냥터·동굴·실내·궁 내부 (2026-10-04, 새 11장)

원래 작업 지시서에는 「12장」이라 적혀 있었으나 실제로 합친 것은 **11장**이다(사냥터 1 + 동굴 1 + 실내 6 + 궁 내부 3). 12번째 지도는 없었다.
조각은 접두로 구분한다: 사냥터 `fld_`, 동굴 `cav_`, 실내 `in_b_`, 궁 `pal_`. 이 조각은 이 11장 전용이 아니라 **번들의 일부**이므로, 마을·국내성에 섞어 쓰는 것도 되지만 접두 조각은 새 3용도의 문서가 설명한다.

| 맵 | 크기 | 걸을 수 있는 칸 | 시작 칸에서 닿는 칸 | 놓침 | 비고 |
|---|---|---|---|---|---|
| `joseon_field` 조선 사냥터 | 96×96 | 6,893 | 6,893 | 0 | 북 `fort_gate`(47,0) 가 맵 가장자리 출구, 굴 입구 문 앞 4곳(`doors` 4), 주민 7, 스폰 25(좌표 기록) |
| `joseon_cave` 조선 동굴 | 48×48 | 529 | 529 | 0 | 입구 (23,47)·(24,47), 출구 `side S x21..26 y47` → 사냥터, 스폰 17 |
| `joseon_in_house_b` 민가 | 15×11 | 35 | 35 | 0 | 출구 깔개 (11,9), 들어오는 칸 (11,8) |
| `joseon_in_inn_b` 주막 | 22×14 | 77 | 77 | 0 | 시작 (11,11) |
| `joseon_in_smith_b` 대장간 | 16×9 | 28 | 28 | 0 | 시작 (8,6) |
| `joseon_in_pharmacy_b` 약방 | 14×10 | 29 | 29 | 0 | 시작 (5,7) |
| `joseon_in_school_b` 서당 | 18×13 | 74 | 74 | 0 | 시작 (5,10) |
| `joseon_in_office_b` 관아 동헌 | 21×15 | 104 | 104 | 0 | 시작 (6,12) |
| `joseon_in_throne` 정전 어좌 홀 | 21×23 | 259 | 259 | 0 | 출구 (10,21), 북벽 협문 (2,4)(18,4) |
| `joseon_in_corridor` 궁 회랑 | 32×10 | 96 | 96 | 0 | 방으로 드는 쌍문 |
| `joseon_in_bedchamber` 침전 | 20×15 | 108 | 108 | 0 | 시작 (14,12) |

BFS 는 `save-joseon-baram.mjs` 가 **엔진 `canMove`** 로 돌린다(`storage-proof.json` 의 `engineChecks.<맵>.reach`). 새 11장은 `reachAll`(`exits` 또는 `interior` 가 있으면 참) 이라 **걸을 수 있는 칸 전부**가 닿아야 한다(`fullReach.strict`, 못 닿는 칸 0, 예외 0). 구운 통행과 엔진 `isPassable` 불일치는 11장 모두 0. 가장자리에 놓인 문루(`fort_gate`)는 반대편이 맵 밖이라 「건너는 곳」 검사에서 양끝 막힘으로 세지 않는다(`edgeGate`).

**통행 보정은 `piece-walk-overrides.json` 으로만 했다**(그림은 안 고쳤다). 보정 줄은 전체 335개다(`pieceWalkSource.override`, 옛 판은 50; 자동값 288). 변형 `__s<시트>` 는 기준 이름의 줄을 이어받는다 — 실내 시트 11(정전)의 `in_b_ondol`·`in_b_maru` 등 8개가 모양이 달라 변형이 됐다(합치기 경고 8줄).
**오토타일(지형 묶음 55, 오토타일 19종)** 새 9종: `fld_trail32 fld_tall32 fld_forest32 fld_bog94 fld_rock32`(사냥터), `cav_roof47 cav_pool94`(동굴), `in_b_ceil47`(실내 천장), `pal_ceil47`(궁 천장). 맵 칸의 마스크 대조는 사냥터 바위산 `fld_rock32` 만 110/1,129 불일치이고 나머지는 전부 0이다 — 빌더가 바위 안쪽 `fld_rock_in8`·가장자리 흙을 이어짐으로 세는 규칙 차이(엔진은 안 센다)로, `expected-mismatch.json` 에 사유와 상한 110 을 적었다. 오토타일 규칙 보정: `fld_trail32` edge 끔, `fld_tall32`·`fld_rock32`·`cav_roof47` edge 켬, `fld_rock32` 는 `fld_rock_in8` 에 connect.
**참고문서 3용도**(모두 `AI-REFERENCE-CONTRACT.md` 8항목: 상세 사전·실행 순서·전체 배열·정상/오류 그림·자동 좌표 검증·레이어 정정 조건): `joseon-baram-field-cave`(문서 15·그림 27: 구역 8곳과 동선·사냥터 지형 사전·마스크→타일 JSON·굴 입구·동굴 3단 벽·사냥터/동굴 전체 예제·오류 5), `joseon-baram-interior`(18/22: 방 평면→천장→바닥→벽면→입구→기물 순서·민가~관아 6방 예제·오류 5), `joseon-baram-palace`(11/15: 어좌 단·어도·기둥 줄·회랑 쌍문·침전 칸막이·오류 4). 오류 교훈은 **실제 맵을 변조**해 검출기가 코드·좌표를 내는 것만 싣는다: `door-unreachable` `region-unreachable` `entry-blocked` `object-tile-in-lower-layer` `autotile-mask-mismatch` `wall-missing-under-ceiling` `same-prop-three-in-row` `aisle-blocked`. 기준 맵은 검출 0건임을 단언하고, 변조 결과는 `tiledata/joseon-village/qa-tamper-checks-new.json`. 소스는 `scripts/content/lib/joseon_tileset/newrefs.py`(변조·검출)와 `scripts/content/lib/joseon_tileset/newrefs_text.py`(문서·그림). 이번 실측: 9용도 69문서 91그림, JSON 약 672KB, 그림 약 5.7MB(820px·128색), 가장 긴 문서 16,769자(한도 120,000).
**장소 카드**는 14장: 사냥터·동굴은 `placeKind: natural`, 실내·궁 내부는 `facility`, 마을·국내성은 `settlement`. 방 카드의 `rules` 에 **출구 깔개 좌표·들어오는 칸·방 문**을 적는다(이동 이벤트는 번들 맵에 없고 저작자가 심는다). 사냥터·동굴 카드는 출구·스폰 좌표를 적는다.

## 새 판이 오면 손볼 곳

- `rebuild-joseon.sh` 가 `FAIL` 을 내면: ① `도달하지 못하는 …` → 출력의 조각 이름·좌표를 `walk-overlay-<id>.png` 에서 보고 `piece-walk-overrides.json` 에 줄을 더한다(새 문루·다리면 `cross` 도). ② `마스크 불일치` → 원인이 빌더 규칙이면 `terrain.<그룹>.connect/edgeConnects` 를 맞추고(맞출 수 없으면 `expected-mismatch.json` 에 사유와 상한), ③ 맵 빌더 쪽 결함이면 `expected-mismatch.json` 의 `_crossings`(건너지 못하는 다리)·`_people`(막힌 칸의 주민)·`_doors`(다른 조각에 덮인 문 앞·디딤돌)에 사유를 적거나 빌더를 고친다.
- **맵 빌더 쪽 결함(현재 판)**: 국내성 좁은 다리 `gungnae_bridge_narrow_h5`(19,39)는 서쪽 끝이 대장간 벽(18,40), 동쪽 끝이 서낭당(24,39)에 막혀 양끝이 모두 막힌 장식 다리, 주민 (54,49)는 드므(`palace_deumeu` 54,48)에 서 있다, 마을 20호 두 번째 다리 (40,24)는 서쪽 끝이 빨래터(38,25)에 막혀 있다. 마을 20호의 물레방아 홈통 (40,30)(41,30)·방앗간 (39,36)은 물 위 `F` 칸으로 걸어진다(기존). 모두 `expected-mismatch.json` 에 사유가 있다.
  **원작 규모 맵 빌더 쪽 결함: 통합 수정판에서 모두 해소**(남문 문루 밑 집, 연못 안 주민 (80,110), 짚가리에 막힌 사립, 항아리 물 칸 — 예외 등록 0, 걸을 수 있는 물 칸은 다리 갑판뿐). 아래 옛 국내성(96×96)의 결함은 그대로다.

## 한계

- 실내·궁 내부·사냥터·동굴 맵은 번들 장소 카드로만 있다 — 방 사이 이동·굴 입구 이동 이벤트와 몬스터·보물 상자는 없다(주민 NPC 만: 마을 20호 20명·국내성 21명·국내성 원작 규모 40명·새 11장 합 34명, 출구·스폰은 좌표 기록). 사가 실내(후보 B)는 이제 `in_b_` 로 합쳐졌다.
- 새 번호 장부에는 파동 1 만 적혀 있다 — 이 번들이 나간 뒤 `--write-frozen` 으로 파동 2 를 적어야 다음 판이 이번 번호를 못 박는다(위 「동결 장부」).
- 사냥터 바위산 `fld_rock32` 마스크 110칸 불일치(빌더 규칙 차이, 위 표).
- 한 시트에 칸이 16,768개라 128열 2048px 시트다 — 편집기 팔레트가 칸이 많아진 만큼 스크롤이 길다(`tilesPerRow` 는 JSON 에서 읽으므로 코드는 그대로).
- 공용 DB(`shared-content.sqlite`) 게시와 사용자 프로젝트 반영은 하지 않았다 — 소급 적용은 별도 `register-*`/게시 작업이다.
- 장소 카드 내려받기 JSON 은 각 약 4.4MB(전부 `database` 3.7MB 와 가벼운 타일셋 표; 타일셋 조각·참고문서는 열 때 번들이 되살린다). 14장 합 약 62MB.
- 앞 13,632칸은 동결 장부로 불변이다. 옛 3개 시트의 맵 산출이 바뀌어 **새 꼬리 복사본이 필요해지면** 변환기가 `동결 장부 위반` 으로 멈춘다(옛 칸을 못 건드린다). 이미 저장된 사용자 프로젝트 맵이 있으면 칸 수 변경은 `ensureJoseonBaramTileset` 의 표 교체만 하고 맵 칸 번호는 다시 쓰지 않는다 — 번들 맵을 사용자 프로젝트에 올리는 일은 별도 작업이다.
