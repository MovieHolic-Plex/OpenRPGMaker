# charset 프레임 크롭 픽셀 누출 (Monster3 / 몬스터 3)

- `before-picker-slots.png` / `after-picker-slots.png` — NPC 그래픽 피커 슬롯 그리드(1440x900, DPR1).
  before 에는 스프라이트 위쪽에 **위 행 프레임의 하단 픽셀 띠**가 보인다(슬롯 0·1·5 등).
- `before-crop-geometry.json` / `after-crop-geometry.json` — 실브라우저 computed style 실측.
  before: `.npc-character-cell` borderBox 48x64 / paddingBox **44x60** / clip border-box.
  after:  paddingBox **48x64** / clip **padding-box** / box-sizing content-box.
- 픽셀 계약: `test/e2e/charset-frame-crop-alignment.spec.ts`
  (수정 전 슬롯 상단 스캔에서 프레임 밖 픽셀 73개 → 수정 후 0개).
- Phaser 렌더 경로는 무죄: 같은 시드로 캡처한 에디터 맵 캔버스가 수정 전후 **바이트 동일**
  (md5 97d22ae50cf704685f2406913b627d36).
