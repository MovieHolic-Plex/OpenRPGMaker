# 바람·무협 인간형12종 · 완료 근거

## 결과

- 기준 검객1종과 새 원안11종: 여성5종, 금갑 무장·백의 검선의 상급2종 포함.
- 각 캐릭터 원본64×64·18자세·대기/공격/피격/쓰러짐/스킬/독/기절/수면의 실제8GIF.
- 신규11종은 실제 GPT6.1sol/high 저작과 별도 실제 시각 검수. 빈 원안에서 시작했고6종의 한정 보완판을 추가했다.
- 장면 이미지는 공식 그림을 관찰한 참고자료이며 그림 픽셀은 추출하지 않았다. 공식 연구용 이미지 바이트는 커밋/팩에 넣지 않았다.

## 즉시 확인

- `human-roster.png`: 최종12종의 실제 원본 도트 비교판.
- `latest-review-queue.png`: 실제 검토 대기 목록과8동작 GIF 화면.
- `female-shaman-paused.png`, `golden-armored-general-paused.png`: 복식·도구·갑주 보완의 전후8동작.
- `last-375.png`, `last-320.png`: 작은 화면의 실제 GIF 대시보드.

## 원본 저장·재로드

- 정본 후보 root: `qa-runs/harnesses/battle-monster/<종>/<후보>`.
- 지속 저작 출처: `harness-data/battle-monster/authored/20261005/<종>/<후보>`.
- `source-archive-proof.json`: 신규11종 모두 source/brief를 다시 읽어 live binding과 동일함을 확인했다. 원본/실제 모델 job/독립 critique/실제 production-timing을 보존한다.
- `roster-plan.json`: 최종 후보 ID. 이전 v1 원안도 보존하며 manifest는 각 종의 현재 후보를 가리킨다.
- 원안과 보완판의 독립 검수 의견은 각각 원본 해시에 묶였다. 검수 추천은 사용자 선택이 아니다.

| 현재 후보 | 실제 독립 검수 추천 |
|---|---|
| female-swordswoman/baram-wuxia-v2 | keep |
| female-shaman/baram-wuxia-v2 | keep |
| golden-armored-general/baram-wuxia-v2 | keep |
| female-assassin/baram-wuxia-v1 | rework |
| female-taoist/baram-wuxia-v1 | rework |
| white-robed-sword-immortal/baram-wuxia-v2 | rework |
| black-cloth-assassin/baram-wuxia-v2 | rework |
| fallen-taoist/baram-wuxia-v1 | rework |
| cult-sorcerer/baram-wuxia-v2 | keep |
| mountain-spearman/baram-wuxia-v1 | rework |
| mountain-bandit/baram-wuxia-v1 | rework |


## 실제 대시보드 확인

- `browser-proof-all.json`: 신규11종의 모든8동작 타일·원본64px GIF8/16장·전체 정지/재생을 실제 브라우저에서 확인했다.
- `review-queue-proof.json`: 현재12종만 검토 대기, 보완 전6원안은 지난 결과와 딥 링크에서 접근 가능하다. 선택을 대신 만들지 않았다.
- `final-state-proof.json`: 실제 기존 선택8종, 기존52결정 원문/순서를 보존했다. 새 사용자 결정0건, 제작 중0건, 폐기한 옛 검객7종은 복구하지 않았다.
- 기존11종 seed 계약과 전역 style은 동일하며 신규6종만 추가했다.
- 모바일375/320px 가로 넘침 없음·브라우저 오류0. 모든 확인은 읽기 전용이며 Allow/Modify/Deny를 눌러 선택을 꾸미지 않았다.

## 한정 보완 근거

- 검희: 발도/수면3자세 외15자세·팔레트 바이트 동일.
- 무녀: 선 자세17장의 얼굴/머리 행과 쓰러짐 얼굴 영역·팔레트 동일, 치마/방울/부적 군만 보완.
- 흑건 자객: 팔/단검/복면/결인7자세, 다른11자세·팔레트 동일.
- 백의 검선: 쓰러짐2픽셀만 변경, 다른17자세·팔레트 동일.
- 사교 술사: 옷/목4픽셀만 변경, 다른16자세·팔레트 동일.
- 금갑 무장: 원래 팔레트/얼굴 정체성을 유지한 갑주·손목·장도·검기·기절의 직접 도트 보완.
- 각 `*-scope-proof.json`과 실제 수정 모델/재검수 job을 보존했다. 검수 점수에 따른 자동 반복은 하지 않았다.

## 재개 기록과 범위

- 두 번째 제작 호출이 실제 exit143으로 종료됐다. 미완료 job의 종료 코드는 모르는 상태로 기록하고 소스 초안을 보존한 뒤 실제 새 모델 호출로 재개했다.
- 이후 한정 웨이브를 로컬 일회성 서비스로 실행했고 `production-controller-proof.json`의 두 제작 단계 모두 실제 exit0으로 끝났다.
- 게임/맵/정본 DB 설치와 실제 전투 충돌·스킬/상태 적용의 검증을 이 에셋 제작 결과로 주장하지 않는다.
- 세션 지시에 따라 Vitest·전체 typecheck·gates는 실행하지 않았다. 위 검증은 하네스의 필수 원본/GIF 검사와 실제 화면 확인이다.
