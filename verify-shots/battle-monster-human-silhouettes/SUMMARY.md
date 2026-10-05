# 검객 기본 자세 방향 비교 · 2026-10-05

## 이번 결과

사용자가 `wandering-swordsman/reference-v3`를 보고 “졸라 별론데...”라고 수정 요청했다.
해당 suite binding의 rework를 실제 ledger에 기록했다. 기존 Allow 8종과 Deny 3개는 유지했다.
새 후보는 자동 승인하거나 게임에 설치하지 않았다.

| 후보 | 화면 이름 | 실제 그림 | 독립 검수 | 사용자 선택 |
|---|---|---|---|---|
| silhouette-sd-a | 조선 SD 검객 | native64 idle_a 1장 | GPT 6.1 sol high, rework 의견 | pending |
| silhouette-wuxia-b | 무협 장포 검객 | native64 idle_a 1장 | GPT 6.1 sol high, rework 의견 | pending |

먼저 체형·얼굴·긴 옷 방향을 고르도록 기본 자세만 공개했다. 새 공격/피격/기술/상태이상이나
프레임 연속성은 아직 제작·검수하지 않았다. 실제 전투 화면도 아니다.

## 실제 참고와 원본

[Niao_K의 동양풍 캐릭터 공개 미리보기](https://niao-k.itch.io/pixel-art-ancient-chinese-character-series-pack-1)를
실제로 열고 저작 모델에 첨부했다. 묶인 머리, 겹친 깃, 긴 옷자락, 옷의 큰 명암 면을 연구했다.
이 참고의 셀 규격을 64px라고 주장하지 않는다. 외부 그림은 추출/트레이싱하거나 배포하지 않는다.
공개 후보/커밋에는 외부 PNG가 없고 URL·이미지 해시·관찰만 남긴다.

원본은 `harness-data/battle-monster/authored/20261005/wandering-swordsman/silhouette-*/`의
literal palette-index 격자와 팔레트다. 실제 job prompt/메타/구조화된 검수 결과를 보존했다.

SD 저작은 완료됐다. 장포 저작은 HTTP429로 중단됐지만 그전에 쓴 완전한 palette/idle_a가 남았다.
실패한 실제 저작 기록을 보존하고 하네스로 원본을 재디코드했다. 저작 호출의 성공으로 바꾸지 않았다.
별도 실제 GPT high 검수를 다시 실행한 뒤 공개했다. 첫 검수는 429, 다음 검수는 CLI exit 0이었으나
읽기 전용 sandbox 때문에 result.json이 없어 무효였다. `workspace-write`를 명시한 별도 검수에서
실제 result.json이 작성되고 현재 그림 binding/PNG 해시와 맞는 것을 확인했다.

## 남은 그림 문제

검수 의견은 둘 다 rework다. SD는 어린 체형과 도포 주름/칼집 분리, 장포는 밝은 배경의 소매·검날
윤곽과 칼집을 쥔 손이 주요 수정 지점이다. 기술 검사 PASS는 미감 승인으로 보고하지 않는다.
사용자가 Allow/Modify/Deny로 결정한다.

## 대시보드

- 기본 자세 후보는 실제 대기 그림만 표시하고 이전/새 그림을 비교한다. 없는 동작 칸은 숨긴다.
- 후보 이름은 표시 전용 provenance.displayName으로 읽는다. 기존 제작 brief와 binding을 바꾸지 않는다.
- Allow의 설명은 「이 그림으로 동작 만들기」다. 선택하면 기존 백그라운드 경로가 새 18자세 후보를 만들며
  완성 후보는 다시 사용자 선택을 받는다. 표시 이름도 이어받는다.
- 작업 중 안내도 기본 자세에서는 동작 제작 중이라고 표시한다. Modify/Deny와 기존 선택 저장 흐름을 사용한다.

## 확인 근거

- 실제 두 후보의 픽셀 검사와 current_critique의 job/result/첨부 해시 검증.
- 커밋용 원본을 하네스로 다시 디코드해 공개 후보와 같은 idle binding/64px 원본 한 장 확인.
- 실제 브라우저의 후보 링크·이름·대기 한 칸·이전/새 native64 GIF 두 장·Allow 안내 확인.
- 1360px, 375px, 320px의 화면 캡처. JS 오류와 가로 overflow 없음.
- `browser-proof.json`, `live-silhouette-*.png`, `pilot-375.png`, `pilot-320.png`.
- `three-idle-comparison.png`: 이전 후보와 새 두 기본 자세, nearest 3×/native1× 정지 비교.
- Python 문법, JavaScript 문법, git diff 공백 확인.
- 첫 브라우저 실행은 서비스 재시작 직후 선택 대기에서 timeout. 서비스가 준비된 뒤 재실행해 위 내용을 확인했다.
- 이 턴에서는 새 후보에 사용자 선택을 대신 누르거나 18자세 동작 확장을 실행하지 않았다.
- gates/Vitest/전체 typecheck는 실행하지 않았다. 게임 정본 설치/저장 작업은 없다.
