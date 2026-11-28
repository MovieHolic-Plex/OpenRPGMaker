---
name: object-gen-v2
description: "Batch-produce authentic 16px-grid 3/4 top-down RPG objects, furniture, props, vehicles, and buildings in pure 1-pass Carbon Medium (gemini-4-carbon, medium) batches via OpenRPGMaker's harness/object-gen-v2 subrepo (`npm run harness -- object-gen-v2`). 권장 LLM: Carbon (gemini-4-carbon, medium) 전용."
---

# object-gen-v2 — Carbon Medium 1-Pass 오브젝트 서브레포 스킬

> **모델 경고 (필수):** 이 파이프라인은 **`gemini-4-carbon` (`thought_level: "medium"`)** 전용으로 튜닝되었다. 하위 모델이나 낮은 추론 단계에서 실행하면 평면 `fillRect` 직사각형과 단색 검은 테두리로 퇴행한다.

## 모노레포 서브레포 위치 & 진입점

- **서브레포 사본:** `harness/object-gen-v2/` (원격 정본 `MovieHolic-Plex/object-gen-v2` 와 `npm run object-gen-v2:sync` 로 바이트 동기화)
- **잠금 팔레트:** `harness/object-gen-v2/palettes/fable-city.json`
- **골드 1× 레퍼런스:** `harness/object-gen-v2/references/` (`index.json` 참고)
- **공식 하네스 명령:**
  - `npm run harness -- object-gen-v2 status`
  - `npm run harness -- object-gen-v2 init-batch <배치폴더>`
  - `npm run harness -- object-gen-v2 verify <pieces폴더>` (기본 `fable-city.json` + `--no-pure-black` 강제)
  - `npm run harness -- object-gen-v2 sheet <pieces폴더> --out <qa폴더> [--html] [--before-dir <구형폴더>]`
  - `npm run harness -- object-gen-v2 pack <spec.json> --out <pack폴더>`
  - `npm run harness -- object-gen-v2 sync status|export|import`

## 4대 제작 원칙

1. **엄격한 3/4 탑다운 원근:** 윗면이 높이의 25~45% 면적으로 분명히 보이고, 정면 수직면에 재질 디테일·음영이 들어가며, 좌상단 광원 기준 우하단 접지 그림자(불투명 어두운 바닥 톤)를 둔다.
2. **재질 고유색 외곽선 (`#000000` 박스 금지):** 모든 재질은 자기 램프의 최암부(`kuro[0]`, `steel[0]`, `navy[0]`, `wood[0]`, `ink[0]`)로 부드럽게 윤곽을 잡고, 사각형 전체를 `#000000`으로 두르지 않는다.
3. **팔레트 100% 잠금 & 이진 알파:** 모든 불투명 픽셀은 `fable-city.json` 허용 RGB 안(`palette_violations == 0`), 알파는 오직 `0` 또는 `255`(`alpha_violations == 0`, 반투명 그림자 금지), `#000000` 화소 `0`개여야 한다.
4. **순수 1-Pass 병렬 배치:** 워커 1명당 관련 기물 5~6개씩 묶어 `harness/object-gen-v2/references/` 앵커 2~3장을 먼저 읽은 뒤 단일 Python(Pillow) 스크립트로 생성·검증하고 즉시 종료한다(개별 기물마다 다회차 이미지 재검수 루프 금지). 이후 코디네이터가 `sheet` 4배율 검수판으로 한눈에 확인해 결함 기물만 선별 재실행한다.

## 3/4 관문(`object-gate`) 및 번들·스토어 규칙

- `pack`이 만드는 `oprn-store-pack/1` 폴더는 에디터 공방에 로컬 에셋으로 바로 가져올 수 있다.
- 공식 번들 시트(`public/assets/...`) 굽기나 스토어 게시에는 여전히 `object-gate` 정책(`Opus 최종 판정` / `사람 허용` / 오너가 직접 지시한 경우 `owner-waive`)이 그대로 적용된다.
