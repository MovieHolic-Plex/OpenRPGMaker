# 캐릭터별 전투 동작 확인 — 2026-10-03

## 바로 볼 증거

- [실제 플레이어 6종 비교 GIF](comparison.gif): 수호자·도적·발키리·개·전차·유령이 같은 돌진 스킬을 실행한다. 각 녹화를 행동 시작에 맞춰 나란히 놓았다. 실시간 합성 데모가 아니다.
- [통상 공격 시간순 표](basic-timeline.jpg): 수호자·도적·발키리·궁수의 접근/접촉/복귀 차이. 궁수는 제자리 발사한다.
- 전체 136종 촬영 표: [1–30](roster-page-1.jpg), [31–60](roster-page-2.jpg), [61–90](roster-page-3.jpg), [91–120](roster-page-4.jpg), [121–136](roster-page-5.jpg).
- [편집기 배우 선택·저장 결과](editor/report.json), [직업별 프로필 전체 목록](roster-summary.json).

## 확인한 범위

| 확인 | 결과 / 근거 |
|---|---|
| 공용 배우 136종 × 동작 32종 | 모든 배우에 명시적 계열, 명중/빗나감/취소 경로, 유한 좌표·시간, 배우/장비 정규화. `character-motion-coverage.mjs` |
| 같은 돌진을 136종 실제 재생 | 136개 녹화, 실행 오류 0. `native-summary.json`. 처음 이끼 골렘만 정지 구간 표본 누락, 단독 재촬영은 통과(`golem-recheck-summary.json`). 최초 실패는 원본 보고서에서 지우지 않았다 |
| 최신 main 통합 뒤 대표 6종 | `merged-representatives-summary.json`, 모두 완료·계측 문제 0. 비교 GIF의 원본 |
| 통상 공격 11계열 | `basic-final-summary.json`, 11/11 완료·계측 문제 0 |
| 파이어볼·매직 미사일·별빛 폭풍 | `casting-final-summary.json`, `finisher-final-summary.json`. 실제 `cast_charge → cast_raise → cast_release → idle`, 근접 공격 자세 없음 |
| 기존 검격·불 마법 | `legacy-final-summary.json`, 2/2 완료. 기존 레시피의 연속 자세와 접근 방법을 보존하고 공통 함수로 시간만 조정 |
| 실제 편집기 | 136종 선택 시 레코드/그림 일치. 배우 스타일 UI 수정, 현재 직업 변경, 전투 인스턴스 ID, 장비 변경과 명시적 무장 해제, serialize→deserialize 필드 보존. 페이지 오류 0 |
| 시트 접촉 경계 | 사람 73 + 비인간 파티 64 + 적 140 = 277 PNG. main 통합 후 SHA-256/알파 경계를 재생성해 바이트 동일 확인 |
| 코드 확인 | 변경된 TS 42파일의 구문/의미 진단 0, 플레이어·편집기 4진입점 esbuild 성공. 전체 typecheck/gates/vitest는 저장소 세션 규칙에 따라 실행하지 않음 |

화면은 편집기 play를 거치지 않는 `player.html` 및 export store shim 경로에서 키보드로 행동을 실행해 녹화했다.
전수 촬영은 공용 돌진 한 가지이며 136×32 전체 조합을 영상으로 검수했다는 뜻은 아니다. 나머지 조합은 공유 타임라인 검사다.
샘플 수는 미술 품질 점수가 아니다. 전체 촬영 표와 대표 동작의 시간순 프레임을 직접 검토했다.

## 재현

```bash
node scripts/qa/runtime/character-motion-coverage.mjs
npm run dev:worktree
EDITOR_QA_URL=http://127.0.0.1:<작업트리포트> node scripts/qa/runtime/character-motion-editor.mjs
node scripts/qa/runtime/retro2003-skills-gif.mjs --set custom --custom verify-shots/character-motion/recording-spec.json --out verify-shots/character-motion/all-actors-final --fps 12 --width 640 --impact-audit
node scripts/qa/runtime/retro2003-skills-gif.mjs --set custom --custom verify-shots/character-motion/basic-recording-spec.json --out verify-shots/character-motion/basic-final --fps 15 --width 640 --impact-audit
node scripts/qa/runtime/retro2003-skills-gif.mjs --set class --skills skill_mage_fireball,skill_mage_magic_missile,skill_mage_starfall --out verify-shots/character-motion/casting-final --fps 15 --width 640 --impact-audit
node scripts/qa/runtime/retro2003-skills-gif.mjs --set legacy --skills skill_sword_slash,skill_fire --out verify-shots/character-motion/legacy-final --fps 15 --width 640 --impact-audit
```

`coverage`가 공용 배우에서 전수 촬영 spec을 만든다. 큰 원본 GIF/WebM/fixture는 로컬 촬영 폴더에 있고,
Git에는 검토용 비교 GIF·전체 표·작은 보고서와 재현 코드를 남긴다. `basic-recording-spec.json`은 11계열 표본이다.

## 경계

- 장비 설정은 동작을 바꾼다. 시트에 이미 그려진 무기 그림을 실시간으로 바꾸지는 않는다.
- 업로드 그림은 공용 알파 경계가 없으면 기존 거리 추정과 개별 접촉 보정을 쓴다.
- 직접 저작한 경로와 던지기/끌기의 대상 경로는 저작 안무를 유지한다. 일반 피격 반동은 대상 프로필을 쓴다.
- QA는 fixture 작업이다. `freshProject` 및 JSON 왕복은 사용자 프로젝트 SQLite 정본 저장 증거가 아니다. 사용자 정본 콘텐츠는 수정하지 않았다.
