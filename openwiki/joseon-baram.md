# 조선(바람의나라풍) 칩셋 — 공용 번들 타일셋 joseon_baram

2026-10-02. 손 도트 조선 조각(집·궁궐·성문·나무·담·소품·다리) 291종과 오토타일 10종을 **편집기 공용 번들 타일셋**으로 등록했다.
맵 세 장이 같은 시트 위에 들어 있다: 마을 20호(`joseon_v20`, 64×56), 국내성(`gungnae`, 96×96, 성벽·해자·왕궁·구획 건물), **국내성 원작 규모(`gungnae_full`, 200×208, 이름 「국내성 원작 규모」)**.
버들항(`beodeul_city`)의 등록 선례를 따랐다 — `openwiki/beodeul-city.md`.

| 항목 | 값 |
|---|---|
| tilesetId / 텍스처 / 접두 | `joseon_baram` / `tex_joseon_baram` / 키트·문서 id 는 `jb-` |
| 계열 | `oprn-joseon`(「조선 칩셋」, `tilesetFamily.ts`). 버들항(`oprn-atlas`)·숲마을과 섞지 않는다 |
| 칸 | 16px, 시트 **64열**(16열이면 높이가 4096px 을 넘어 자동 전환, `tilesPerRow` 는 JSON 에서 읽는다), 칸 수는 `build-stats.json` 의 `count` (2026-10-03 세 맵 합침, 통합 수정판: 13,632칸 = 기준 시트 8,496 + 덧붙임 + 통행 복사본 130. 두 맵일 때는 9,792칸) |
| 그림 | `public/assets/joseon-baram/joseon-baram-chipset.png` (번들 항목은 `src/assets/bundled.ts`) |
| 원본 그림 | 커밋하지 않았다. 손 도트이며 팔레트만 참고했다(재배포 금지 원본 없음) |

## 재실행 한 줄 (국내성 맵이 다시 바뀌면)

```
bash scripts/content/rebuild-joseon.sh                                   # 약 70초
GUNGNAE_DIR=<다른 워크트리>/tiledata/joseon-gungnae bash scripts/content/rebuild-joseon.sh
GUNGNAE_FULL_DIR=<다른 워크트리>/tiledata/joseon-gungnae-full bash scripts/content/rebuild-joseon.sh
REGEN_VILLAGE=1 bash scripts/content/rebuild-joseon.sh                    # 마을 20호 기준 시트를 다시 굽는다(기본은 건너뜀 — 아래 주의)
JOSEON_REPORT_ONLY=1 bash scripts/content/rebuild-joseon.sh              # 실패를 멈춤 없이 전부 보고(새 판을 처음 합칠 때)
```

한 줄이 순서대로 돌리는 것: ① `build-joseon-tileset.py`(시트 합치기·통행·오토타일·키트·맵 JSON) ② `prepare-joseon-baram-references.py`(참고문서 6용도·그림·오류 변조 검출·카드 그림)
③ `save-joseon-baram.mjs`(임시 폴더 저장 → 재로드 deepEqual → 엔진 대조, 재로드본을 `/tmp/joseon-reloaded.json` 으로 내보냄) ④ `prepare-joseon-regions.mjs`(장소 카드·스냅숏).
입력은 마을 20호 `tiledata/joseon-village20/{joseon-village20-chipset.png,pieces.json,map.json,extra.json}` 와 국내성 `$GUNGNAE_DIR/{joseon-gungnae-chipset.png,pieces.json,map.json,extra.json}` 와 국내성 원작 규모 `$GUNGNAE_FULL_DIR/{joseon-gungnae-full-chipset.png,pieces.json,map.json,extra.json}`(세 번째 시트·맵, 시트순번 2). `--map` 줄은 `rebuild-joseon.sh` 안에 있다.
⑤ 마지막에 장소 카드·칩셋 줄 축소본(`public/assets/catalog-thumbs/…`)을 만든다 — 없으면 목록이 원본으로 넘어가며 「리소스 로드 실패」 오류 로그가 쌓인다.
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
5. 그 위에 통행이 다른 같은 그림은 시트 꼬리에 복사본을 붙인다(`baseCount` 뒤). 덧붙임이 늘면 꼬리 번호가 밀리므로 **재실행하면 덧붙임·꼬리 칸 번호는 바뀔 수 있다**(기준 시트 구간은 불변). 맵 JSON 은 매번 같이 다시 쓴다.

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
`src/project/tilesetFamily.ts`(`oprn-joseon`) · `src/project/regionReferences.ts`·`regionReferenceSnapshots.ts`·`joseonPlaceReferences.ts`·`regionReferences/joseon-village.json`(장소 카드: 마을 20호·국내성·국내성 원작 규모 세 장; 스냅숏 청크 1.3MB, gzip 105KB, 동적 import 라 장소를 깔 때만 받는다) ·
`test/bundledTilesetIdParity.test.ts`(생성자 표 한 줄).

`ensureJoseonBaramTileset` 규칙: 타일셋이 없으면 만들고, 칸 수가 번들과 다르고 더 적으면 표(통행·메타·그룹·오토타일·키트)를 교체한다. 칸 수가 같으면 빠진 키트와 `jb-` 키트·참고문서만 번들 것으로 되돌리고 저자가 쓴 것은 건드리지 않는다. **번들보다 칸이 많으면 건드리지 않는다.**

## 참고문서 (번들 소유, AI-REFERENCE-CONTRACT 8항목)

`src/assets/joseonBaramReferences.json`(경로만, 바이트 0) + `public/assets/joseon-baram/references/*.png`(820px·128색) + `tiledata/joseon-village/references/*.md`(출처 사본) — 전부 `prepare-joseon-baram-references.py` 산출.
6용도: 한 장 조립(읽는 순서·작업 순서·반복/고정·문/디딤돌/접근칸·검사 범위·금지) · 땅 오토타일(비트·변형 표·알려진 불일치; 흙길·마당·논·석판·궁궐 마당·강/해자) · 건물 조각 사전 · 나무·소품·담·다리 조각 사전(조각마다 칸 배열·통행 JSON) · 조립 예제 4(양반댁·집 줄·다리·연못과 논: 전체 아래/윗층 배열 + 원본 해상도 완성 그림 — 마을 20호 구획) · 오류 교훈(정본 맵을 실제 변조: 문 앞 막힘·수관 아래층·반대 둑·다리 막힘 → 검출 코드·좌표, `qa-tamper-checks.json`).
국내성 구획(두 국내성 맵)은 아직 예제에 넣지 않았다(필요하면 스크립트의 `example(...)` 호출을 더한다).

## 검증 (실측, 임시 폴더 프로젝트, 세 맵 합친 판)

저장소는 `/tmp/oprn-joseon-baram-proof`(`JOSEON_SAVE_DIR`) — 사용자의 실제 프로젝트 폴더가 아니다. LegacyDb/Supabase·공용 DB 에는 쓰지 않는다. 증거: `tiledata/joseon-village/storage-proof.json`.

- 저장 → 다시 열기: 맵 둘과 타일셋 `deepEqual` 참. 프로젝트 전체 `deepEqual` 은 저장소 정규화(`database.actors[6].characterIndex`) 때문에 거짓이라 맵·타일셋만 엄격히, 나머지는 첫 차이 경로를 증거에 남긴다.
- 엔진 `isPassable` 대 구운 통행: 마을 20호 3,584칸 · 국내성 9,216칸 · 국내성 원작 규모 41,600칸 모두 불일치 0 (재로드 후도 0).
- 엔진 `canMove` 너비 우선: 국내성 걸을 수 있는 5,090칸 중 4,984칸에 닿고, **문 앞 17곳·디딤돌·성문/대문 통로 5곳·주민 21명(예외 1)·정전 앞** 놓침 0. 못 닿는 106칸은 목표가 아닌 막힌 틈이다(탑 뒤 처마 아래 마당 36, 서낭당 섬·가장자리·나무 사이 풀 틈 등).
- **건너는 곳 19곳(국내성)**: 해자 다리 8(세로 6폭 넷·가로 6폭 둘·좁은 둘), 대성문 2, 측면 성문 2, 궁문 2, 궁 측면 문루 2, 문루 대문 1, 열린 사립문 2 — 조각 둘레 상자 안에서만 걸어 한쪽 끝에서 반대쪽 끝으로 건넌다. 18곳이 건너지고 1곳(좁은 다리 `narrow_h5`)은 양끝이 막힌 빌더 결함으로 예외 처리했다(줄 59개 중 2줄은 가장자리 기둥에 닿아 제외). 마을 20호는 3곳 중 2곳이 건너지고 1곳(두 번째 다리)이 예외. 곳별 건넌 줄/시험한 줄은 `storage-proof.json` 의 `engineChecks.<맵>.reach.crossingDetail`(대성문 4/4·4/4, 측면 성문 4/4·4/4, 궁 측면 문루 4/4·4/4, 궁문 2/2·2/2, 서·동 가로 다리 4/4·4/4, 세로 다리 4곳 4/4, 문루 대문 1/1, 사립문 2/2·1/1, 좁은 다리 `h6` 1/1)에 남는다.
- 음성 대조: 물 위에 아무것도 없는 걷는 칸 0, 문 위 벽 열림 0, 해자·논 위에 걸어지는 칸은 다리 갑판·선착장·징검돌뿐.
- 오토타일 마스크: 국내성 흙길(4변형) 252/1623(전부 성벽·담 밑 칸, 아래 참고) · 마당(4변형) 0/856 · 푸른 물 0/914 · 석판 0/307 · 궁궐 마당 0/456 · 모 논 0/36. 마을 20호 흙길 33/306 · 마당 65/408(`expected-mismatch.json` 에 사유와 상한) · 강 0/374 · 모 논 0/100.
- **국내성 원작 규모 (200×208, 2026-10-03, 통합 수정판 a2622118f8)**: 시트를 세 번째로 합쳐도 변형 0. 새 조각은 꼬리 쪽에 덧붙는다: 문루 변형 `gnf_gate_great_12`(대성문)·`gnf_gate_side_5`(측면)·`gnf_palace_gate_side_3`(궁 측면), 세로 성벽 치 `gnf_bastion_w/e/w2/e2`(전부 `X`), 망루 `gnf_tower_corner_5w`, 4칸 사립문 `gnf_sarip_mud/stone`(`XFFX`, 중앙 둘이 통로), 굴 입구 `gnf_cave_dark/white/moss`(전부 `X`, 문 앞은 조각 아래 칸), 정전 `gnf_palace_hall_wide_14`(18×10, front [8,9]) + 대나무 3종. 통행 보정 줄은 옛 문루와 같은 모양이라 그대로 옮겼다(`piece-walk-overrides.json` 의 `gnf_*`). 통행 줄이 없으면 자동값이 문루 통째를 막아 건너는 곳이 40→27곳으로 줄고 통로 6→4곳으로 줄었다 — 새 조각 이름이 보이면 먼저 보정 줄이 있는지 본다. **기준 시트 8,496칸은 그림·통행·우선순위·지형 0칸 차이**. 칸 수 13,632(꼬리 복사 130). 걸을 수 있는 칸 20,496, 시작 (100,104)에서 **18,677칸 도달**(도달 못 하는 1,819칸은 나무·덤불 사이 작은 섬 496개, 가장 큰 것 36칸). 문 56곳·통로 6곳·주민 40명·정전 앞 1곳 놓침 0. 건너는 곳 40곳 **전부** 건너진다(예외 0): 대성문 4/4·4/4, 측면 성문 4/4·4/4, 궁 측면 문루 4/4·4/4, 궁문 2/2·2/2, 세로 다리 8곳 30/30, 세로 5폭 3곳 9/9, 가로 다리 8곳 30/30, 좁은 다리 `h` 1/1·`h6` 1/1·`v` 2곳 2/2, 문루 대문 2곳 4/4, 사립문 진흙 2곳 4/4·돌 5곳 10/10. 마스크: 흙길 22/4010 · 마당 102/5431 · 푸른 물 0/7189 · 석판 3/1196 · 궁궐 마당 0/1634 · 모 논 0/24.
- **마스크 규칙 전환(통합 수정판)**: 원작 규모 빌더가 이웃 규칙을 바꿨다 — 흙길·마당은 판석·물·다리·논밭 쪽도 이어짐으로 세고(풀 둑을 안 쓴다), 석판은 석판·다리·판석만 센다. 그래서 `road64`·`yard64` 의 `connect` 에 `palace_court, palace_court16, water47g, water_deep, rice16, field` 를 더하고 `slab_edge16` 은 `slab, slab_edge16, water47g, water_deep, palace_court, palace_court16` 으로 줄였다(원작 규모 마스크 불일치 1,270 → 127). 남은 127칸은 성벽·담 칸(`wall` = 풀 칸) 곁 22+102(빌더는 벽 곁을 이어짐으로 세고 엔진은 풀을 안 센다)와 석판이 물·다리 곁인 3칸(다리·물이 같은 물 타일이라 구분 못 함)이다(`expected-mismatch.json`). 같은 그룹을 쓰는 옛 국내성(96×96)은 옛 규칙으로 구운 맵이라 새 규칙에서 흙길 332·마당 94·석판 69칸이 어긋난다(옛 252/0/0 에서 늘었다, 구운 맵이 정답이고 붓은 새 규칙으로 다시 계산).
- 기존 프로젝트 보강: 타일셋 없음·옛(짧은) 사본·참고문서 빠짐·키트 빠짐 모두 복구, 저자 키트 보존, 재실행 멱등.
- 참고문서: `validateTilesetReferences` 통과, 그림 26장 전부 `/assets/...` 경로이고 파일이 있다.
- 통행 오버레이 PNG(`walk-overlay-gungnae.png`)를 확대해 눈으로 확인: 대성문·측면 성문·궁문 통로는 열리고 성벽·해자·건물·지붕은 막히며, 다리 갑판은 열리고 곁 물그림자는 막힌다.

돌리지 않은 것(규칙상 금지): vitest·게이트·전체 typecheck. 파일 단위 tsc 는 새 파일 오류 0(기존 `import.meta.env`·`__oprnVersion` 두 종만).
`test/generateMap.test.ts` 는 번들 자산을 전부 순회한다 — 아틀라스 계열 타일셋은 기준선에서도 이미 빨간지 감독자가 게이트로 확인한다.

## 새 판이 오면 손볼 곳

- `rebuild-joseon.sh` 가 `FAIL` 을 내면: ① `도달하지 못하는 …` → 출력의 조각 이름·좌표를 `walk-overlay-<id>.png` 에서 보고 `piece-walk-overrides.json` 에 줄을 더한다(새 문루·다리면 `cross` 도). ② `마스크 불일치` → 원인이 빌더 규칙이면 `terrain.<그룹>.connect/edgeConnects` 를 맞추고(맞출 수 없으면 `expected-mismatch.json` 에 사유와 상한), ③ 맵 빌더 쪽 결함이면 `expected-mismatch.json` 의 `_crossings`(건너지 못하는 다리)·`_people`(막힌 칸의 주민)·`_doors`(다른 조각에 덮인 문 앞·디딤돌)에 사유를 적거나 빌더를 고친다.
- **맵 빌더 쪽 결함(현재 판)**: 국내성 좁은 다리 `gungnae_bridge_narrow_h5`(19,39)는 서쪽 끝이 대장간 벽(18,40), 동쪽 끝이 서낭당(24,39)에 막혀 양끝이 모두 막힌 장식 다리, 주민 (54,49)는 드므(`palace_deumeu` 54,48)에 서 있다, 마을 20호 두 번째 다리 (40,24)는 서쪽 끝이 빨래터(38,25)에 막혀 있다. 마을 20호의 물레방아 홈통 (40,30)(41,30)·방앗간 (39,36)은 물 위 `F` 칸으로 걸어진다(기존). 모두 `expected-mismatch.json` 에 사유가 있다.
  **원작 규모 맵 빌더 쪽 결함: 통합 수정판에서 모두 해소**(남문 문루 밑 집, 연못 안 주민 (80,110), 짚가리에 막힌 사립, 항아리 물 칸 — 예외 등록 0, 걸을 수 있는 물 칸은 다리 갑판뿐). 아래 옛 국내성(96×96)의 결함은 그대로다.

## 한계

- 실내 맵이 없다(문 이동 이벤트 없음). 주민 NPC 만(마을 20호 20명·국내성 21명·국내성 원작 규모 40명).
- 공용 DB(`shared-content.sqlite`) 게시와 사용자 프로젝트 반영은 하지 않았다 — 소급 적용은 별도 `register-*`/게시 작업이다.
- 장소 카드 내려받기 JSON 이 각 6.3MB 다(타일셋 표 포함). 필요하면 `tileMeta` 를 줄이는 것은 후속.
- 합친 시트의 덧붙임/꼬리 칸 번호는 국내성 산출이 바뀌면 달라진다(기준 시트 구간만 불변 — 통행 복사본 꼬리 번호는 시트를 더 합칠 때 밀린다). 이미 저장된 사용자 프로젝트 맵이 있으면 칸 수 변경은 `ensureJoseonBaramTileset` 의 표 교체만 하고 맵 칸 번호는 다시 쓰지 않는다 — 번들 맵을 사용자 프로젝트에 올리는 일은 별도 작업이다.
