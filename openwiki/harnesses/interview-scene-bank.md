# 인터뷰 선택 배경 하네스

새 게임 만들기 배경은 게임 저작물이 아니다. 인물 외형을 임의로 고정하지 않고, 실제 인터뷰 질문의 누적 선택을 장면 키로 삼는다. 장르 네 개 × (장르 소개 1 + 답변 접두 경로 363) + 첫 화면 1 = **1,457개**다. 혼합 장르·직접 입력·주인공 설정·추가 메모·수정 요약은 이 숫자에 포함되지 않는다.

## 제작과 검수

`harness-data/interview-scene-bank/seed.json`이 배치 크기 10과 도트·시각 관문을 소유한다. 실제 질문 원본은 `src/editor/projectInterviewScenes.json`, 계획과 스타일 프롬프트는 `src/editor/interviewScenePlan.ts`다. 그림은 기본 제공 image_gen으로 하나씩 독립 요청하며 열 개를 동시에 실행한다. CLI/API 이미지 생성으로 자동 전환하지 않는다.

```bash
npm run harness -- interview-scene-bank plan
npm run harness -- interview-scene-bank batch
npm run harness -- interview-scene-bank import --key romance --image /path/candidate.png --prompt /path/exact-request.txt
npm run harness -- interview-scene-bank import-batch --records /path/generated-records.json
npm run harness -- interview-scene-bank gate
npm run harness -- interview-scene-bank review --key romance --verdict /path/review.json
npm run harness -- interview-scene-bank review-batch --records /path/hash-bound-reviews.json
npm run harness -- interview-scene-bank build
npm run harness -- interview-scene-bank status
```

`plan`/`batch`의 출력은 `qa-runs/harnesses/interview-scene-bank/`에 있다. `import-batch`의 입력은 `{key,path,prompt}` 배열이다. 원본 PNG와 정확한 생성 요청을 같은 산출물 폴더에 복사하고 SHA-256을 ledger에 기록한다. 요청은 해당 장면의 고정 프롬프트로 시작해야 한다. 장면 키에는 옵션 ID를 쓰며 표시 문구나 배열 인덱스로 파일을 찾지 않는다.

2026-10-04 스타일 v2: 사용자가 새로 생성한 여섯 장의 도트 스타일을 확인하고 전체 제작을 승인했다. 16비트 표현은 특정 파일 크기나 물리적 색 개수와 같지 않으므로 **320×180 정수 확대·64색 파일 제한을 폐기**했다. 원본 관문은 16:9 비율(오차 0.02), 불투명 전체 배경, 원본 해시 불변, 다른 장면과 원본 해시 중복 없음이다. 파일 크기와 RGB 색 수는 진단으로만 남긴다. 실제 도트 관문은 여전히 강하다: 보통 크기에서 보이는 사각 픽셀 덩어리·계단 윤곽·절제된 명암, 모든 선택 반영·새 구도를 실제 이미지에서 검사한다. 네모 무늬만 얹은 회화는 탈락한다. 자동 도트 필터로 합격시키지 않는다. 제작 원본·기본 프롬프트가 바뀌면 이전 판정은 무효다.

시각 검수 JSON은 `sourceSha256`, `promptSha256`, `reviewer`, `findings: []`, `checks`를 가진다. `checks`의 `pixelArt`, `composition`, `allChoices`, `latestChoice`, `identityUnset`, `noText`, `distinctShot`이 모두 true여야 한다. 실제 그림을 열고 이전 장면과 비교해 판단한다. 불확실한 항목은 false이며 단순 완료 선언이나 규격 검사만으로 합격시키지 않는다. 재탕 구도, 금지된 사람 실루엣, 선택 내용 누락, 글자 유사 무늬는 다시 그린다.

한 장면은 한 배치 작업에서 세 번까지 시도한다. 세 번 실패한 원인을 고치지 않은 채 무한 반복하지 않는다. `status.exhausted`에 남기고 다음 작업에서 생성 방법/프롬프트를 교정한다. 사용자 선택 권한을 다른 캐릭터·칩셋 하네스와 혼동하지 않는다. 이 배경은 사용자가 위임한 AI 검수 대상이다.

## 앱 연결

`build`는 현재 원본을 다시 검사하고 합격작만 `public/assets/harnesses/interview-scene-bank/`에 복사한다. `src/editor/interviewSceneBank.json`에는 URL·원본 해시·프롬프트 해시만 있다. 장면이 없으면 없는 상태를 유지하며 임시 그림을 복제해 1,457개가 완성됐다고 표시하지 않는다.

합격작의 정확한 생성 요청은 `harness-data/interview-scene-bank/requests/<생성 요청 SHA-256>.txt`에도 보존한다. 새 체크아웃에는 세션용 `qa-runs`가 없으므로, 하네스는 이미 배포한 원본 PNG와 이 요청 사본을 대체 원본으로 읽는다. 현재 기본 프롬프트 일치·전체 요청 해시·PNG 해시·실제 검수 해시를 모두 재확인하며, 파일이 없거나 바뀌었으면 합격으로 취급하지 않는다. 세션 파일이 없다는 이유로 정상 배포 목록을 0장으로 덮어쓰지 않는다.

`src/editor/interviewSceneBank.ts`는 실제 답변 텍스트와 고정 옵션 ID가 둘 다 일치할 때만 정확한 누적 키를 반환한다. 직접 입력이나 혼합·추가 설정은 기존 신규 생성/실제 비전 검수 경로로 간다. 마지막 답을 바꾸거나 앞 질문을 다시 편집해도 현재 보존된 모든 답이 키에 반영된다. 앞 답이 비었는데 뒤 답만 있는 초안에는 고정 그림을 잘못 붙이지 않는다.

대화마다 현재 장면과 다음 세 선택지만 디코드해 둔다. 첫 화면은 소개 장면 네 개를 추가해 최대 다섯 장이다. 캐시가 준비된 클릭은 같은 이벤트 안에서 배경을 바꾸고, 늦은 파일·오래된 생성 응답은 토큰으로 차단한다. 닫으면 이미지 캐시와 생성 요청을 정리한다. 배경을 바꾸는 동안 프로젝트 저장/생성은 하지 않는다.

## 현재 제작 결과

초기 v1 공식 후보 13개는 과도한 파일 규격 제한으로 탈락했다. 이후 스타일 참고를 강하게 적용한 새 샘플 여섯 장(원본 1672×941)을 직접 검수하고 사용자에게 보여 주었으며 사용자가 이 스타일로 전체 제작을 승인했다. 이 샘플과 v1 후보의 예전 프롬프트를 현재 요청처럼 위조하지 않는다. 스타일 v2의 정확한 고정 프롬프트와 장면별 구체 지시로 다시 생성하고 새 해시 판정을 등록한다. 도트 스타일 원본 참고는 `harness-data/interview-scene-bank/references/pixel-craft-v2.png`와 해시·역할 기록에 보존한다. 참고는 픽셀 표현만 따르며 장면·구도·팔레트는 복제하지 않는다. 장면별 구체 지시에는 선택한 분기의 소품만 넣는다. 모든 분기의 소품을 조건문처럼 나열하면 교감 그림에 전투 훈련장이 섞이므로, 실제로 고른 플레이·분위기만 구체화한다. 생성 요청·원본·참고 이미지 해시·각 배치 결과는 `qa-runs/harnesses/interview-scene-bank/`에 보존한다. **1,457개 계획과 1,457개 합격 배경은 다르다.** 현재 합격/배포 수는 ledger와 `status`, 앱 매니페스트로 확인한다. `outdated`는 현재 프롬프트와 다른 옛 후보이며, 재시도 상한은 현재 프롬프트의 시도만 센다.
