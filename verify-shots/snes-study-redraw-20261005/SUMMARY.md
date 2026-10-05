# 주인공 마법 5종 재저작 — 확인 범위

그림 상태: **새 검토판, 사용자 검토 대기**. 형식·실행 확인은 미감 승인이 아니다.
공용 코드/에셋 변경이며 정본 프로젝트 SQLite와 외부 저장소는 수정하지 않았다.

## 즉시 확인

- 실제 플레이어 화염: `runtime-confirmed/samples-mage_fireball.png`, `skill-skill_mage_fireball.gif`.
- 실제 플레이어 홀리: `runtime-confirmed/samples-cleric_holy_smite.png`, `skill-skill_cleric_holy_smite.gif`.
- 실제 플레이어 소환: `runtime-summon-displayed/samples-summon.png`, `skill-skill_hand_summon_review.gif`.
- 실제 자료집 대표 장면: `editor/monk_dragon_fist.png`, `editor/mage_blizzard.png`.
- 대화의 별도 원본 합성 비교: `preview/summon.png`, `preview/holy.png`.

## 실제 플레이어

`player.html` + 내보내기 shim + 실제 키보드 입력의 기존 전용 하네스를 사용했다.
GIF는 무음이다. 효과음 재생 사건과 표시 프레임을 기록했으며 오디오를 녹음하지 않았다.

| 확인 대상 | 결과 | 범위 |
|---|---|---|
| 파이어볼 | 완료 | 투사체 + 새 화염 0~7셀 모두 표시, 효과음 3사건 |
| 블리자드 | 완료 | 적 셋에 새 결정 0~7셀 모두 표시, 효과음 2사건 |
| 연쇄 번개 | 완료 | 적 셋에 낙뢰 0~6셀 모두 표시, 효과음 2사건 |
| 심판의 빛 | 완료 | 배경/뒤 구슬/앞 구슬/착탄 표시, 구슬 0~11 및 착탄 0~5셀, 효과음 2사건 |
| 용권의 공용 소환 연출 | 대체 배우 사본에서 완료 | 원화/배경/착탄 세 층, 원화 0셀·착탄 0~5셀, 효과음 4사건 |
| 원래 무도가 파티 부팅 | 실패/미확인 | 시작 화면 시간 초과, 전투 진입 전 실패 |

`runtime-confirmed/SUMMARY.md`의 전체 실행은 무도가 조의 부팅 때문에 FAIL이다.
그 안의 앞 네 기술은 완료됐고 기술별 오류가 없다. 전체 통과로 보고하지 않는다.
`runtime-summon-displayed/SUMMARY.md`는 주인공이 같은 공용 연출을 빌린 단일 녹화의 PASS다.
이는 원래 무도가 배우/파티 부팅을 검증한 결과가 아니다. 피해 규칙과 정본 콘텐츠는 바꾸지 않는다.

처음 `runtime/`에서는 배경을 일반 효과 상자로 검사해 실패했고 화염의 중간 노출도 잘렸다.
새 배경 검사는 전장 폭과 고정 256px 타일을 확인한다. 직접 정한 셀 시간을 캐릭터 손잡이와
종료 계산이 보존하도록 고친 뒤, `runtime-confirmed/`에서 새 화염 8셀 전체가 표시됐다.
`runtime-final/`, `runtime-summon/`, `runtime-summon-borrowed*/`의 부팅/모듈 로딩 실패도 남겼다.
`boot/observations.json`은 별도 시작 화면 진단의 성공과 요청 실패/콘솔 오류 없음이다.
진단 캐시로 예열한 뒤 소환 녹화가 완료됐다. 모든 부팅 실패의 원인이 확정됐다는 뜻은 아니다.

## 에디터와 대화 비교판

실제 `renderSkillRetroStage`를 녹화 사본 데이터에 마운트했다. 5종이 올바른 새 시트를 읽고,
128px 배경 타일이 논리 전장 240px에 반복된다. 대표 소환은 한 원화와 착탄을 동시에 보여 준다.
DOM 관찰/스크린샷: `editor/observations.json`과 다섯 PNG. 페이지 오류/가로 넘침 없음.
이 확인은 전체 자료집 저장·재로드나 정본 프로젝트 설치 확인이 아니다.

대화 비교판은 픽셀 원본의 별도 무음 합성이다. 수정 전은 대표 셀, 수정 후는 단회 재생/시간 이동이다.
앞의 시전 준비 시간을 줄였으므로 실제 전투 전체 시간과 다르다.
다섯 선택/이전·다음/재생 종료, 736/320px 폭, 어두운 테마: `preview/observations.json`.

## 재현/형식

- 중앙 패킹 재실행의 PNG 바이트 재현: 확인.
- 기존 개별 생성기 5개의 전체 RGBA 재현: 확인.
- 10개 층의 native 크기/이진 알파/실제 3~13색/매니페스트 해시: 확인.
- 원본과 근거: `docs/experiments/snes-study-redraw-20261005/manifest.json`, `reproduction.json`.
- 편집한 TypeScript 7개 esbuild 구문 파싱, `git diff --check`: 확인.
- gates/vitest/전체 typecheck: 사용자 세션 지침에 따라 실행하지 않음.

새 공용 층 메타데이터/재현 명령/제한은 `docs/experiments/snes-study-redraw-20261005/README.md`를 따른다.
