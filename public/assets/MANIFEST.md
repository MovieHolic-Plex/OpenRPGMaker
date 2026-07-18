# 에셋 매니페스트

이 디렉토리의 기본 캐릭터/대화 PNG 에셋은 codex로 생성되었으며, 동일한 32비트 모던 픽셀 스타일(Stardew Valley / RPG Maker MZ 감성, 따뜻한 팔레트)을 공유한다. `rm2k3-original-chipset.png`는 예외적으로 EasyRPG RTP의 공개 대체 칩셋을 vendoring한 파일이다. 에셋을 정밀수정할 때는 기존 PNG를 codex에 첨부한 뒤 수정 요청 → 덮어쓰기 → Vite HMR로 자동 반영.

## 공통 스타일 프롬프트 (모든 에셋에 적용)
```
32-bit modern pixel art, Stardew Valley / RPG Maker MZ aesthetic,
warm and friendly tone, soft gradient shading, NO anti-aliasing on edges
(crisp pixel boundaries), consistent warm palette across all assets,
light from top-left.
```

---

## tiles_default.png
- **치수**: 256×32 (8 타일 × 1행, 타일당 32px)
- **용도**: 게임 타일셋. 인덱스 0~7 순서:
  - 0: grass / 1: water / 2: wall / 3: path
  - 4: floor / 5: sand / 6: tree / 7: stairs
- **버전 히스토리**:
  - v1 (2026-06-18): 최초 생성. 일관된 팔레트, seam 없음. 단 tree/stairs가 너무 희박(시각 진단 3/10, 2/10).
  - v2 (2026-06-18): 전체 재생성. tree(명확한 갈색 trunk + 3단계 음영의 큰 둥근 canopy)와 stairs(깊이 있는 3-4단 계단, wall과 회색 톤 일치)를 풍부하게 개선. 진단 tree/stairs 각 9/10.
- **정밀수정 시 참고**: 타일 경계 anti-aliasing 금지. 인덱스 순서 절대 변경 금지(코드가 `TILE` 상수로 매핑).

## dialogue-frame.png
- **치수**: 64×64 (9-slice용, 슬라이스 16px)
- **용도**: 대사창 프레임 테두리. CSS `border-image`로 사용. 코너 장식 + 반복 가능한 가장자리 + 반투명 어두운 중앙.
- **버전 히스토리**:
  - v1 (2026-06-18): 최초 생성. 9-slice slice=16.
- **정밀수정 시 참고**: 슬라이스 영역(코너 16px) 보존. 중앙은 텍스트 가독성 위해 충분히 어둡게(~75% 불투명).

## ui/windowskin-rm2003.png
- **치수**: 96×96 (9-slice용, 슬라이스 24px)
- **용도**: 런타임 게임 표면의 메시지/선택지/메뉴/상점/여관/전투/타이틀 메뉴 창 스킨. CSS `--runtime-window-skin`과 `border-image`로 사용.
- **출처**: `scripts/generate-window-skin.mjs`가 절차 생성한 원본 프로젝트 에셋.
- **버전 히스토리**:
  - v1 (2026-07-07): 진한 파란 세로 그라데이션과 텍스처, 밝은 외곽선/내부 하이라이트/그림자 이중 테두리, 직각 모서리. slice=24.
- **정밀수정 시 참고**: 전체 96×96과 24px slice 구조를 유지. 라운딩 금지, 중앙 fill 영역은 텍스트 대비를 충분히 유지.

## fonts/Galmuri*.woff2
- **파일**: `Galmuri9.woff2`, `Galmuri11.woff2`, `Galmuri11-Bold.woff2`
- **용도**: 런타임 게임 표면 전용 픽셀 폰트. 에디터 셸에는 적용하지 않는다.
- **출처**: quiple/galmuri v2.40.3.
- **라이선스**: SIL Open Font License 1.1. `public/assets/fonts/LICENSE.txt`와 `public/assets/ATTRIBUTION.md` 유지.

## rm2k3-original-chipset.png
- **치수**: 480×256 (RPG Maker 2000/2003 ChipSet 호환, 16px 타일)
- **용도**: 에디터 ChipSet 팔레트와 기본 RM2K3식 맵 타일 리소스.
- **출처**: EasyRPG RTP `ChipSet/Exterior.png` (`vendor/easyrpg-rtp/ChipSet/Exterior.png`)
- **라이선스**: EasyRPG RTP materials are Creative Commons Attribution 4.0 International. Upstream attribution for `ChipSet/Exterior.png`: JasonPerry, CC0, https://finalbossblues.itch.io/
- **주의**: Enterbrain/RPG Maker 원본 RTP가 아니라 EasyRPG의 자유 대체 리소스다. 라이선스/저작자 표기는 `public/assets/ATTRIBUTION.md`와 `vendor/easyrpg-rtp/` 문서를 유지한다.

## easyrpg-chipset-*.png / easyrpg-charset-object*.png
- **치수**:
  - ChipSet: 480x256, 16px tile, RPG Maker 2000/2003 ChipSet compatible.
  - CharSet Object: 288x256, 24x32 frames, RPG Maker 2000/2003 CharSet compatible.
- **용도**:
  - `easyrpg-chipset-interior.png`: indoor walls, furniture, interior door-adjacent map tiles.
  - `easyrpg-chipset-dungeon.png`, `easyrpg-chipset-retro-dungeon.png`: cave/dungeon floors, walls, stairs, traps.
  - `easyrpg-chipset-ship.png`: ship deck and nautical structures.
  - `easyrpg-chipset-world.png`, `easyrpg-chipset-retro-world.png`: overworld terrain and world-map objects.
  - `easyrpg-chipset-retro-exterior.png`: alternate exterior village/building/object style.
  - `easyrpg-charset-object1.png`, `easyrpg-charset-object2.png`: event-object sprites; use these for real door/chest/sign objects instead of forcing every door into ChipSet tiles.
- **출처/라이선스**: EasyRPG RTP. See `public/assets/ATTRIBUTION.md` and `vendor/easyrpg-rtp/AUTHORS.md`.

## easyrpg/chipset/*.png
- **치수**: 480x256, 16px tile, RPG Maker 2000/2003 ChipSet compatible.
- **용도**: generated EasyRPG RTP runtime package entries for Resource Manager and project resource references.
- **출처/라이선스**: EasyRPG RTP `ChipSet/*.png`, pinned in `public/assets/easyrpg/rtp-manifest.json`. License text and authors are mirrored in `public/assets/easyrpg/COPYING` and `public/assets/easyrpg/AUTHORS.md`.

## scarloxy/*.png
- **출처/라이선스**: Scarloxy "Monster Taming Game Essentials" (https://scarloxy.itch.io/mpwsp01, 구매본), CC-BY 4.0. `ATTRIBUTION.md` 참조.
- **생성**: `scripts/import-scarloxy-pack.py` 가 `vendor/scarloxy-mpwsp01/graphics/` 원본(2x/4x 업스케일본)을 원본 해상도로 복원해 변환. 수동 편집 금지 — 스크립트를 고치고 재실행할 것. 블록 배치는 `src/assets/scarloxyPackManifest.json` 에 기록된다.
- **구성**:
  - `scarloxy-chipset-{grassland,wilds,indoor}.png`: 480x256/16px RM2K3 ChipSet. 초원+마을 건물 / 사막·설원+해안+유적+아레나 / 실내. 물 타일은 정적(비기본 칩셋은 물 애니메이션 미지원). 오토타일 미지원 — 지형 전환은 일반 타일.
  - `scarloxy-charset-people{1,2}.png`: 288x256/24x32 RM2K3 CharSet. 팩 캐릭터 10종(4프레임 걸음→3패턴 매핑, 32px 프레임→24x32 중앙 크롭).
  - `scarloxy-monster-*.png`: 96x96 정적 배틀러(원본 idle 첫 프레임). `scarloxy-monster-icon-*.png`: 메뉴 아이콘.
  - `scarloxy-backdrop-{forest,ice,sand}.png`: 640x360 전투 배경.
  - `scarloxy-battle-anim-*.png`: 96x96 4프레임 가로 스트립(384x96). DB 기본 레코드 `anim_scarloxy_*` 가 사용. 크로마키(초록) 간섭 없음을 검증함.
  - `scarloxy-ui-*.png`: 스탯 아이콘.
- **버전 히스토리**:
  - v1 (2026-07-12): 최초 변환·등록. 등록 코드는 `src/assets/scarloxyPack.ts`.

## farming/*.png
- **출처/라이선스**: 자체 절차 생성 (외부 에셋 없음). `scripts/lib/pixelPng.mjs` 기반 순수 픽셀 버퍼 드로잉.
- **생성**: `node scripts/generate-farming-crop-sprites.mjs` / `node scripts/generate-farming-animal-sprites.mjs`. 수동 편집 금지 — 스크립트의 ASCII 그리드를 고치고 재실행할 것.
- **구성**:
  - `farming/crops/crop_{potato,strawberry}.png`: 32x16, 16px 성장 프레임 2개(새싹 → 수확기) 가로 나열.
  - `farming/crops/crop_{tomato,corn}.png`: 48x16, 성장 프레임 3개(새싹 → 줄기 → 수확기).
  - `farming/animals/{chicken,cow}.png`: 288x256/24x32 RM2K3 CharSet, 캐릭터 슬롯 0, 3패턴 x 4방향(up/right/down/left). 배경 투명 — 런타임 색키가 좌상단 RGB 를 투명 처리하므로 아트에 순수 검정 없음.
- **등록 코드**: `src/assets/farmingSprites.ts` (작물 시트 로딩·프레임 등록은 `src/assets/bundled.ts`, 캐릭셋 합류는 `src/assets/charsetCatalog.ts`).
- **버전 히스토리**:
  - v1 (2026-07-13): 최초 생성. 농사 데모(봄 밭) 작물 4종 성장 스프라이트 + 농장 동물 2종.

---

## 정밀수정 워크플로우
1. 대상 PNG를 codex에 첨부.
3. 새 PNG → 해당 파일 덮어쓰기 (파일명 유지).
4. Vite dev 서버가 HMR로 자동 반영.
5. 이 매니페스트의 버전 히스토리에 한 줄 추가.

## CC0 Mabaci medieval props (EXCLUDED / unused)

- Path: 
- License: CC0-1.0 (see LICENSE.txt + root ATTRIBUTION.md)
- CharSet:  registered as  via 
- Runtime: **excluded** — interiors use native chipset BOX/CRATE tiles only
