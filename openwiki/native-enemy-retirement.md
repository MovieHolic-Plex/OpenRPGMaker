# 공용 몬스터 옛 그림 폐기와 RM2003 효과 비교 (2026-10-02)

사용자 결정: 옛 그림만 있는 **97종도 새 도트로 제작하여 유지**한다. 종/적 레코드를 지우거나 특정 프로젝트에만 그림을 저장하는 작업이 아니다.

## 공용 자산과 표시 계약

- 기존 native 40종 + 요청 97종 + 추가 감사 일반 적 3종(`leaf-fox`, `fire-pup`, `spirit-earth`) = **140종**. `pixelEnemySheets.ts`가 포즈 시트 정본이며, 공용 리소스 ID는 그대로다.
- 셀 48/64/96px, 3×3의 idle a/b/c · windup/move/attack · recover/hit/dead. 최종 격자에서 저작한 원본 픽셀, 16색 이하, 알파 0/255. 도트 측면 전투는 2배 포즈 시트로 재생한다.
- 일반 이미지 소비자(자료집·미리보기·필드 몬스터·일반 전투 스킨)는 **idle_a 한 칸**을 받는다. 시트 전체를 `<img>`로 보내면 아홉 마리가 동시에 보인다. 경로는 `pixelEnemyPortraits.ts`에서 파생하며 `prepare-pixel-enemy-portraits.mts`가 원본 픽셀을 그대로 복사한다.
- 사용자 업로드가 공용 ID를 재사용하면 업로드를 우선한다. `battleFieldDom.applyPixelEnemySheet`도 업로드를 포즈 시트로 덮지 않는다.
- 기존 수집용 `generated-enemy-sparkit-fire`는 **이미 사람이 선택한** `monster-collect-species/sparkit/front.png`를 사용한다. ledger 선택은 바꾸지 않는다. 이번 100종은 일반 JRPG 적 9포즈이고 수집 종의 앞/뒤 후보 제작은 아니다.
- `collectWebExportAssets`는 같은 ID의 초상과 포즈 시트를 함께 싣는다. 정본 SQLite·사용자 프로젝트 행을 직접 수정하지 않는다. 새 프로젝트의 기본 적 106개와 기존 공용 ID 141개가 모두 해석된다.

## 폐기와 호환성

- `starter/monster-*.png`, 옛 hornet/트룹 미리보기, 영상 기반 몬스터 idle 3장, `generated/monsters/`의 옛 풀·원본·corrected를 포함하여 **343장 / 56,190,101 bytes** 삭제. 정확한 목록과 해시는 `verify-shots/legacy-monsters/retired-images.json`.
- 숫자로 재색칠한 옛 120장 생성기 `scripts/generate-monster-images.mts`도 제거했다. 옛 이름의 부분 일치로 슬라임을 추정하는 폴백은 폐기했다.
- `generated-enemy-zombie-01-enemy_extra_016`처럼 종을 알 수 있는 옛 ID는 등록된 기본 ID로 해석한다. `enemy_extra_016`처럼 숫자만 있는 ID는 확인된 종 정보가 없어 `null`이다. 사용자 레코드는 그대로 유지되며, 그 경우 직접 이미지 선택이 필요하다.
- 알려진 옛 promotedPath는 새 초상으로 해석한다. 숫자 풀이나 옛 idle의 경로는 거부한다. 아티스트 플랜의 기존 6개 ID는 유지하되 출처를 `native-pixel`, rawPath를 원본 포즈 PNG, promotedPath를 초상 PNG로 갱신했다. 모델 생성 출처로 위장하지 않는다.
- 기존 40종의 자료집 설명도 실제 도트 색·몸·장비에 맞춰 갱신했다. 프로젝트의 이름/태그/설명 오버라이드는 기존 우선순위를 유지한다. `monsterCatalogReview.json`의 URL·해시는 현재 그림을 가리킨다.

## 기존 RM2003 스킬과 새 시안의 비교

현재 `retroSkillCatalog.ts`에는 클래스 스킬 **1,088개**, 중복 키를 제거한 효과 시트 **895개**, 별도로 몬스터 스킬 42개가 있다. 옛 `generatedEffectSheets` 30종만 보고 현재 효과 전체라고 말하면 틀린다.

| 항목 | 기존 RM2003 | 새 시안 |
|---|---|---|
| 화염/빙결/번개/회복 착탄 | 64px, 8~10칸, 60ms/칸 | 96px, 32칸, 50ms/칸 |
| 색/알파 | 비교 4종 7~10색, 0/255 | 178~406 RGB색, 알파 32단계 |
| 실제 동작 | 시전자 포즈, 투사체/착탄 층, 피격, 효과음 연결 | 효과 그림 시안만 재생, 제품 등록 없음 |
| 완성 액션 시간 | 1.74~2.166초 (시전·투사체 포함) | 효과 시안만 1.6초 |

결론: 기존 도트 연출 체계를 유지하고 부족한 효과를 같은 픽셀/레이어 계약으로 보강한다. 새 시안을 전체 대체로 채택하지 않았다. 비교 GIF는 **착탄 층만**, 같은 native 골렘·정수 2배·실제 칸 간격으로 비교한다. 완성 전투 흐름은 별도 실제 플레이어 GIF이며, GIF에는 소리가 없으므로 소리 연결은 report의 런타임 계측이 근거다.

## 원본·근거·재생성

- 저작 원본과 100종 입력/카탈로그: `scripts/asset-gen/pixel-enemy/retirement/{organic,arcane,humanoid}/`. 각 README에 해부 구조, 재생성, 남은 표현 한계가 있다.
- 전체 포즈 보드·GIF·검토 해시: `verify-shots/legacy-monsters/{organic,arcane,humanoid}/`. 부모가 15개 전체 포즈 보드와 전체 140종 idle contact를 직접 확인했다.
- 자산 참조 검사: `node node_modules/vite-node/vite-node.mjs --script scripts/content/audit-native-enemy-assets.mts`. PNG 재로드/초상 픽셀/색/알파, 모든 옛 공용 ID, 기본 적, JSON 직렬화 후 ID, 내보내기 참조, 업로드 우선권. 단위 테스트/SQLite 저장 검증이 아니다.
- 실제 플레이어: `node scripts/qa/runtime/native-enemy-retirement.mjs`. `player.html` + export shim의 retro2003/rm2000/업로드 3사례, native 140종 초상과 시트 모두 브라우저 디코드. `runtime/SUMMARY.md`부터 읽는다. 전투 도입 실루엣이 끝난 명령 화면을 캡처한다.
- 효과 비교: `verify-shots/legacy-monsters/skill-comparison/`, 현재 계약·원본 시안·합성 코드·4개 비교 GIF·실제 스킬 녹화 report. 시안은 공용 효과 카탈로그에 등록하지 않았다.
- 세션 규칙에 따라 gates/vitest/typecheck는 실행하지 않았다. 이 문서의 자산/브라우저 관찰은 전체 테스트 통과 주장이 아니다.

## 히드라 재저작 (2026-10-03)

`hydra-three`는 `scripts/asset-gen/pixel-enemy/hydra-three.py`의 직접 저작 도트로 교체했다.
96px·16색·9포즈 계약과 기존 공용 ID/시트/초상 경로를 유지하고 humanoid 일괄 생성도 이 원본을 쓴다.
실제 RM2003 플레이어/네 native 아군 증거는 `verify-shots/hydra-rm2003/SUMMARY.md`,
저작 설명은 `tiledata/pixel-enemies/hydra-three/README.md`.
기존 프로젝트 행/정본 SQLite는 수정하지 않는다.
