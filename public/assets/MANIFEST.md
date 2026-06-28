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

## npc_villager.png
- **용도**: 마을 주민 NPC. 행/열 순서 hero와 동일.
- **버전 히스토리**:
- **정밀수정 시 참고**: hero와 팔레트/비율 일치 유지.

## dialogue-frame.png
- **치수**: 64×64 (9-slice용, 슬라이스 16px)
- **용도**: 대사창 프레임 테두리. CSS `border-image`로 사용. 코너 장식 + 반복 가능한 가장자리 + 반투명 어두운 중앙.
- **버전 히스토리**:
  - v1 (2026-06-18): 최초 생성. 9-slice slice=16.
- **정밀수정 시 참고**: 슬라이스 영역(코너 16px) 보존. 중앙은 텍스트 가독성 위해 충분히 어둡게(~75% 불투명).

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

---

## 정밀수정 워크플로우
1. 대상 PNG를 codex에 첨부.
3. 새 PNG → 해당 파일 덮어쓰기 (파일명 유지).
4. Vite dev 서버가 HMR로 자동 반영.
5. 이 매니페스트의 버전 히스토리에 한 줄 추가.
