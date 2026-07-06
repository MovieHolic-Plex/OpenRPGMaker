# RM2K3 데이터베이스 편집기 전수 감사 (2026-07-07)

- 브랜치: `feat/database-overhaul` (base 942b350)
- 방법: dev 서버(127.0.0.1:5302) + Playwright chromium 으로 `/?freshProject=1` 예제 프로젝트를 열고 DB 모달 전 20개 탭 실측 + 소스 추적(`src/editor/panels/database*`, `src/battle/runtime.ts`).
- 스크린샷: `evidence/db-overhaul/audit/tab-*.png` (탭별 1장), 콘솔 로그 `evidence/db-overhaul/audit/console.log` (JS 에러 0건).
- 단위테스트 베이스라인: 1693 passed / 1 skipped (재실행 확인, 1건 flaky 있었으나 재현 안 됨). tsc clean.

## A. 미작동/결함 (심각도순)

| # | 심각도 | 위치 | 증상 | 근거 |
|---|---|---|---|---|
| A1 | 높음 | 스킬 탭 · 효과=스위치 | 효과 종류를 "스위치"로 바꿔도 **스위치 선택 UI가 없음** → `effect.switchId` 영구 미설정. 편집기에서 만든 스위치형 스킬은 절대 동작 불가 | `databaseSkillRecordView.ts` (switchId 컨트롤 부재), `SkillEffect` 타입은 `switchId` 보유 |
| A2 | 높음 | 전투 런타임 | 스위치형 스킬이 명중해도 **런타임이 아무것도 안 함** (빈 블록 + "별도 작업" 주석) | `src/battle/runtime.ts:436-439` |
| A3 | 높음 | 스킬 탭 · 속성 | 런타임은 `skill.elementId`로 속성 상성 배율을 적용(`runtime.ts:419`)하는데 **편집 UI가 없음** — fidelity contract("element or state effects") 위반 | `databaseSkillRecordView.ts`, `rm2k3-fidelity-contract.md` Database Contract |
| A4 | 높음 | 스킬 탭 · 상태 효과 | 런타임은 `skill.stateEffects`(부여/해제, 확률)를 적용(`runtime.ts:434`)하는데 **편집 UI가 없음** | 동상 |
| A5 | 높음 | 전투 애니메이션 탭 | **"▶ 재생" 버튼 클릭 핸들러 없음** — 클릭해도 무반응. "셀 일괄...", "셀 복사/지우기", "보간" 버튼도 enabled 상태로 무반응 | `databaseAnimationPreview.ts:50-62` (commandGrid — on 핸들러 전무) |
| A6 | 중간 | 전투 애니메이션 탭 · 스테이지 | 스테이지가 실제 시트 그래픽을 **렌더하지 않음** (실루엣만). `selectedCellSprite`가 url 있어도 aria-label만 설정, cells[0] 하나만 취급 | `databaseAnimationPreview.ts:64-77` |
| A7 | 중간 | 아이템 탭 | `ItemRecord.iconResourceId/imageResourceId`는 플레이어 메뉴에서 실제 표시되는데(`playerStatusMenuItemSaveScenes.ts:79`) **편집기에 그래픽 필드/미리보기 없음** — 데이터만 있고 편집 불가 | `databaseItemRecordView.ts` (그래픽 패널 부재; 장비 탭엔 있음) |
| A8 | 중간 | 주인공 탭 · 그래픽 | 배틀 캐릭터(`generated-actor-hero-01-battle`)는 미리보기 미표시(중립 슬롯) + **"설정..." 버튼이 토스트 스텁**("준비 중입니다") | `actorRecordControls.ts:37-54` |
| A9 | 중간 | 주인공 탭 · 인스펙터 탭 | "특성/장비/성장 곡선/능력치 보정/공격 속성/노트" 6개 탭 버튼에 **클릭 핸들러 없음** — 장식용 dead UI | `actorRecordView.ts:107-119` |
| A10 | 낮음 | 스킬 탭 · 종류 라벨 | 스킬 type "normal"이 **"일반 물품"**(아이템 용어)으로 표기 — "일반"이어야 함 | `databaseControls.ts:117-119` literalLabel 공유 |
| A11 | 낮음 | 전투 애니메이션 탭 · 대상 | "대상" 필드가 **"말벌" 하드코딩** | `databaseAnimationRecordView.ts:77` |
| A12 | 중간 | 스킬 탭 · 성공률 | `skill.successRate`(성공률 필드)를 편집할 수 있으나 **전투 런타임 어디에서도 소비하지 않음**(hitRate 만 사용) — 데이터만 바뀌고 전투 무효과 | `src/battle/` 전체 grep 0건, `battleDamage.ts:37` hitRate 만 |

메모: 공용 이벤트/스위치 탭의 빈 이름은 예제 프로젝트 데이터가 실제로 비어 있는 것(결함 아님, 편집 동작 코드상 정상). 지형/전투 명령/전투 화면 탭의 회색 라벨 행들은 실제로는 편집 가능(utilityTextRow 핸들러 존재).

## B. 이미지 부재 지점 (리치화 대상)

| # | 표면 | 현황 |
|---|---|---|
| B1 | 스킬 상세 | 이미지 0. 연결된 전투 애니메이션의 스프라이트 미리보기 없음 |
| B2 | 레코드 리스트 (전 컬렉션) | 번호+이름 텍스트만. 액터 얼굴/몬스터 스프라이트/아이템·장비 아이콘/스킬·애니메이션 썸네일 컬럼 없음 |
| B3 | 아이템 상세 | 아이콘/이미지 미리보기 없음 (A7과 동일 근원) |
| B4 | 주인공 상세 | 배틀 캐릭터(generated-*) 미리보기 없음 (A8) |
| B5 | 전투 애니메이션 스테이지 | 실제 그래픽 미렌더 (A6) |

양호(참고): 장비 상세(아이콘+이미지 미리보기), 몬스터 상세(스프라이트+색조), 적 그룹(배경+배틀러 배치 프리뷰), 타일셋(칩셋 풀 프리뷰), 액터 얼굴/캐릭터셋 크롭, 애니메이션 패턴 스트립(시트 크롭 8칸).

## C. 수리 결과 (2026-07-07 동일 세션)

| 항목 | 상태 | 수리 내용 | 커밋 |
|---|---|---|---|
| A1 스킬 스위치 피커 | 완료 | 효과=스위치 선택 시 스위치 select 노출, `effect.switchId` 저장 (`db-field-skill-effect-switch`) | db-skills |
| A2 런타임 스위치 스킬 | 완료 | 명중 시 `battleEventState.switches[switchId]=true`, 전투 이벤트 조건 재평가 연동 (테스트 포함) | db-skills |
| A3 스킬 속성 편집 | 완료 | 속성 select (`db-field-skill-element`) + `updateSkillRecord` 뮤테이터에 elementId 화이트리스트 추가 | db-skills |
| A4 스킬 상태 효과 편집 | 완료 | 상태+확률(0~100)+부여/해제 행 편집기, 추가/삭제 (`db-skill-state-effect-*`) | db-skills |
| A5 재생/무반응 버튼 | 완료 | ▶재생 실동작(15fps, 1프레임부터 1회, 정지 토글), 마지막 프레임 복제 활성화, 셀 복사/붙여넣기 분리 구현, 셀 일괄/보간은 disabled+"준비 중" 명시 | db-visuals |
| A6 스테이지 실렌더 | 완료 | 선택 프레임 전체 셀을 시트 크롭으로 렌더 (x/y/zoom/opacity/visible 반영) | db-visuals |
| A7 아이템 그래픽 편집 | 완료 | 이미지/아이콘 미리보기+텍스트 필드 패널 (`db-field-item-image-resource`, `db-field-item-icon-resource`) | db-skills |
| A8 액터 리소스 스텁 | 완료 | 얼굴/캐릭터셋/배틀차셋 선택 다이얼로그(`db-actor-resource-dialog`, 미리보기 포함), generated 배틀차셋 48x64 크롭 미리보기 | db-visuals |
| A9 액터 dead 탭 | 완료 | 5개 탭 기능화(대응 패널 스크롤 내비+active), 대응 없는 '노트' 탭 제거 | db-visuals |
| A10 종류 라벨 | 완료 | 스킬 type normal → "일반" | db-skills |
| A11 대상 하드코딩 | 완료 | 참조 스킬/아이템 이름으로 계산, 없으면 "(참조 없음)" | db-visuals |
| A12 successRate 미반영 | 완료 | hitRate×successRate/100 합성 판정 (기본값 100이라 기존 데이터 기대값 불변, 테스트 포함) | db-skills |
| B1 스킬 이미지 | 완료 | 연결 애니메이션 시트 미리보기 패널 (`db-skill-animation-preview`) | db-skills |
| B2 리스트 썸네일 | 완료 | 액터 얼굴/몬스터/아이템·장비 아이콘/스킬·애니메이션 패턴 크롭 (`databaseRecordThumbnails.ts`) | db-visuals |
| B3/B4/B5 | 완료 | A7/A8/A6 과 동일 수리로 해소 | — |

증거: `evidence/db-overhaul/after/` — `skills-rich.png`(속성/상태변화/미리보기+리스트 썸네일), `skills-switch-effect.png`, `items-rich.png`(그래픽 패널+아이콘 리스트), `animation-playing.png`(정지 토글), `animations-stage.png`, `actors-rich.png`, `actor-resource-dialog.png`, `enemies-list-thumbs.png`, `verify-results.json`(자동 프로브 13/13 PASS).

검증: `npx tsc --noEmit` clean · 단위 전체 재실행 결과는 아래 E · 실브라우저 자동 프로브 13/13 PASS.

## D. 수리 방식 메모

1. A1+A2+A3+A4+A10+B1+A7: codex worker A 구현, 뮤테이터 화이트리스트/successRate 합성은 팀장 직접.
2. A5+A6+A11+A8+A9+B2: codex worker B 구현, 재생 시작 프레임(선택 프레임→1프레임) 수정은 팀장 직접.
3. CSS 대비/레이아웃 교정(상태 변화 행, 캡션 색)은 팀장 직접.

## E. 최종 검증 (수리 후, feat/database-overhaul)

| 게이트 | 결과 |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (vitest 전체) | **1702 passed / 1 skipped, 실패 0** (베이스라인 1693 + 신규 9) |
| 실브라우저 자동 프로브 (`scripts/db-verify-driver.cjs`, 포트 5302) | **13/13 PASS**, JS 콘솔 에러 0 |
| DB e2e 21 spec (`rm2k3-database-*.spec.ts`) | 18 passed / 3 failed — 실패 3건은 **변경 전 베이스(942b350)에서도 동일 실패**(기존 결함, phase-6a 머지 유래). 신규 실패 0건. `rm2k3-database-animation.spec.ts:6` 은 베이스에서 실패하던 것이 이번 수리로 **복구**됨 |

기존 실패 3건(우리 귀책 아님, 별도 수리 대상): `rm2k3-database-animation.spec.ts:42`(리소스/타일셋 편집 지속성), `rm2k3-database-inventory-effects.spec.ts:9`, `rm2k3-database-party-class.spec.ts:22`(`db-actor-curve-edit-attack` 타임아웃).
