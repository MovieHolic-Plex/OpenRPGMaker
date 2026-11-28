# object-gen-v2 — Carbon Medium 1-Pass 3/4 오브젝트 서브레포 하네스

> **권장 모델 경고:** `gemini-4-carbon` (`thought_level: "medium"`) 전용 설계다. 다른 모델이나 낮은 추론 설정으로 실행하면 평면 `fillRect` 직사각형과 검은 외곽선 상자로 급격히 퇴행한다.

## 1. 서브레포 구조와 양방향 동기화 (`2026-11-28`)

`object-gen-v2`는 `object-gate`(`scripts/object-gate-sync.mjs`) 및 `gen-kits`(`scripts/gen-kits-sync.mjs`)와 동일한 **모노레포 내장 사본 + 비공개 개별 저장소 양방향 동기화** 방식으로 작동한다.

| 구분 | 경로 / 명령 | 역할 |
|---|---|---|
| **개별 정본 저장소** | `MovieHolic-Plex/object-gen-v2` (`~/object-gen-v2`, 비공개) | 독립 실행·외부 프로젝트 재사용 가능한 Python 패키지 |
| **모노레포 서브레포 사본** | `harness/object-gen-v2/` (`scripts/oss/publicSet.mjs` 공개 제외) | 모든 워크트리·에이전트가 별도 클론 없이 즉시 실행하는 바이트 동일 사본 |
| **양방향 동기화** | `npm run object-gen-v2:sync -- status \| export [--push] \| import` | `harness/object-gen-v2/` ↔ `~/object-gen-v2` 3-way git blob 동기화 |
| **버전 고정 & 계약 검증** | `tiledata/gen-kits.lock.json` (`kits["object-gen-v2"]`) · `npm run gen-kits:sync` | CLI 동사(`verify`, `sheet`, `pack`, `init-batch`)·`oprn-store-pack/1` 스키마·지시문 지문 추적 |
| **하네스 CLI** | `npm run harness -- object-gen-v2 <단계>` | `status` · `init-batch` · `verify` · `sheet` · `pack` · `test` · `sync` |
| **스킬** | `assistant-skills/object-gen-v2/SKILL.md` | 코딩 에이전트 및 조수 스킬 번들(`assistantSkills.json`) |

## 2. 실행 흐름 (`npm run harness -- object-gen-v2`)

1. **배치 초기화:** `npm run harness -- object-gen-v2 init-batch tiledata/<테마>/<배치명>`
2. **Carbon Medium 1-Pass 병렬 저작:** 워커당 5~6개 기물씩 `harness/object-gen-v2/references/`의 골드 1배율 앵커 2~3장과 `harness/object-gen-v2/palettes/fable-city.json` 잠금 팔레트를 읽고 단일 Python(Pillow) 스크립트로 1배율 PNG 생성(중간 이미지 왕복 루프 금지).
3. **기계 관문 (`verify`):** `npm run harness -- object-gen-v2 verify tiledata/<테마>/<배치명>/pieces` — 16px 격자 배수, `palette_violations == 0`, `alpha_violations == 0` (`0` 또는 `255`), `pure_black == 0`(`#000000` 금지) 검증.
4. **4배율 검수판 (`sheet`):** `npm run harness -- object-gen-v2 sheet tiledata/<테마>/<배치명>/pieces --out tiledata/<테마>/<배치명>/qa --html` — 4배율 라벨 시트에서 시각 결함이 있는 항목만 선별 재실행.
5. **패키지 컴파일 (`pack`) & 번들 굽기:** `npm run harness -- object-gen-v2 pack tiledata/<테마>/<배치명>/spec.json --out <dist>` 로 `oprn-store-pack/1` 생성. 번들 시트(`public/assets/...`)에 구울 때는 기존과 동일하게 `object-gate` 출구 규칙(`Opus 최종 판정` / `사람 허용` / 오너 명시 시 `owner-waive`)을 거친다.
