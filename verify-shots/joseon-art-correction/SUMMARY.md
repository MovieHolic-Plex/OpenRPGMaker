# 조선 설화 그래픽 교정 — 후보 단계

## 먼저 볼 그림

- `before-foliage-x2.png`: 현재 공용 풀·나무를 하네스 조립기로 놓은 비교 기준.
- `candidate-foliage-x2.png`: 같은 배치/원본 Actor1/길에 조용한 풀과 이전 수정 나무를 놓은 후보.
- `content-packs/joseon-folklore/art-direction/monsters/review-sheet.png`: 새 몬스터3종과 옛 그림/원본 Actor1 비례 비교.

## 범위

사용자가 현재 나무·풀·몬스터 그래픽을 거부했다. 작동 단계19개의 통과는 시각 합격 기록이 아니다.
현재 프리셋의 공용 그림과 별도 pilot 수정 후보가 달랐다. 이전 후보는 실제 프리셋에 설치되지 않았다.

이번 결과는 새 몬스터 정지 자세3종, 새 풀 후보, 보존한 기존 나무 수정 후보다.
파일과 선택 상태는 공용 `content-packs/joseon-folklore/art-direction/`에 보존했다.
나무·풀 그림은 하네스 조립 예이며 게임 스크린샷이 아니다. 현재 게임·칩셋은 교체하지 않았다.
그림의 만족도·동작9포즈·15종 일관성·실제 전투 가독성은 아직 확정하지 않았다.

## 확인 근거

- 실제 SQLite를 읽고 참고문서6용도를 추출했다. `canonical-read.json`의 revision5/해시를 확인했다.
- `foliage-proof.json`: 현재 참고문서의 실제 칸 배열/72열 시트와 후보 소스 해시, 동일 배치.
- Joseon 하네스 `palette`: 기존91색 잠금 정상. 새 풀은 잠금 안의3색만 사용한다.
- `monster-proof.json`: 요청한 GPT 6.1 sol high의 새 문자 격자/64px PNG3종. 재생성한 PNG 해시와 원본이 같다.
- `visual-proof.json`: 공개 비교판의 탭4개/736px·320px에서 이미지 로드/가로 넘침/JS 오류 확인. 오류0.

정본 ID `f84dfa19-5b71-43f1-8523-b10910d23be7`,
저장 대상 `/home/main/z-project/rpg-zzu/.oprn-projects/joseon-starter-preset-20261004`는 이번에 읽기만 했다.
그림 선택 장부를 기록하거나 정본 저장을 했다고 보고하지 않는다.
전체 gates/Vitest/typecheck를 실행하지 않았다.
