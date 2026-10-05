# 실제 원본 배경 v2 체크포인트

이 증거의 카탈로그와 이미지는 `src/editor/interviewSceneBank.json` 및 `public/assets/harnesses/interview-scene-bank/`의 실제 배포 원본이다. 이미지/카탈로그를 합성하거나 대체하지 않았다. 1,457개 전체 제작 완료 증거는 아니다.

- `native-bank-proof.json`: 실제 76개 배경 목록에서 네 장르, 13개 선택을 production interview dialog로 클릭했다. 인증 연결 상태만 false로 설정했으며 신규 이미지 생성 요청은 0개, 브라우저 오류는 0개였다. 디코드된 캐시를 준비한 후 클릭 이벤트 안의 장면 키와 원본 URL을 확인했다. DOM 전환 시간 4.2–12.4ms는 다운로드/화면 합성 지연까지 재는 값이 아니다.
- `native-bank-browser.mjs`: 위 관찰의 재현 스크립트. Vite가 반환한 실제 대화창 모듈의 import URL을 읽어 같은 캐시 클래스의 디코드 완료를 관찰한다. HMR 쿼리를 제거한 다른 모듈을 관찰하면 잘못된 타임아웃이 발생하므로 URL을 그대로 사용한다. 배경 이미지나 카탈로그는 주입하지 않는다. 결과는 세션 `qa-runs/harnesses/interview-scene-bank/production-v2-browser/`에 쓴다.
- `fresh-checkout-proof.json`: 당시 51개 합격 목록에서 합격작 한 장의 세션 PNG와 정확한 생성 요청을 일시적으로 제외한 상태로 실제 하네스 status를 실행했다. 저장소의 배포 원본과 requests 사본으로 51개 합격이 유지됐다. 제외한 세션 파일은 finally에서 복원했다. 이 수치는 해당 관찰 시점이며 현재 전체 배포 수를 뜻하지 않는다.

검수는 원본을 직접 열어 pixelArt/composition/allChoices/latestChoice/identityUnset/noText/distinctShot을 각각 판단했다. 탈락 원인을 새 생성 요청에 추가하여 다시 그렸으며 원본을 픽셀 필터나 팔레트 변환으로 바꾸지 않았다. 실제 배포 수는 현재 manifest 및 하네스 status에서 읽는다. 76개 배경의 첫 관찰에서는 전체 typecheck/Vitest/gates를 실행하지 않았다.

2026-10-05 추가 증거: `targeted-startup-tests.log`는 기획 직렬화·장르 기본값·입력창 표시·저장 전 자동 실행 차단·전환/실패/중복 시작의 관련 테스트 15개 통과 기록이다. `published-integrity-proof.json`은 `python3 scripts/qa/interview-scene-bank-integrity.py`로 현재 질문 원본에서 모든 고정 선택 접두 키를 다시 열거하고 배포 키가 실제 조합에 속하는지 및 미배포 키 목록을 확인한다. 이어서 현재 배포 목록 전체의 원본 바이트·PNG 디코드·16:9/불투명·중복 없음·정확한 생성 요청 및 일곱 검수 해시를 확인한 결과다. 그 시점의 배포 수와 미완성 수를 함께 기록하며, 검사 통과를 남은 그림의 제작 완료나 전체 인터뷰 클릭 검증으로 확대하지 않는다.

`romance-native-bank.png`, `monster-native-bank.png`는 위 실제 카탈로그 관찰에서 찍은 production dialog 스크린샷이다. 인터뷰 컴포넌트를 별도 컨테이너에 올린 관찰이며, 앱 시작 전체 셸의 전체화면 동작이나 게임 생성·AI 조수 전달을 검증한 증거는 아니다.

159개 배포 체크포인트의 `latest-reviewed-click-proof.json`과 `latest-reviewed-native-bank.png`는 실제 production dialog에서 미스터리 → 비밀 공간 → 조사 → 위험을 네 번 클릭한 결과다. 새로 검수한 통로 안쪽 구도의 정확한 원본 URL로 전환됐고 신규 이미지 생성 요청과 브라우저 오류는 없었다. 첫 장르 클릭의 DOM 실행은 283.2ms, 이후 선택은 9.1–13.7ms였으며 다운로드/화면 합성 지연을 포함하는 수치는 아니다. `latest-reviewed-bank-browser.mjs`로 재현한다. 이 증거도 별도 컨테이너 관찰이며 전체 시작 셸·AI 저작 검증을 의미하지 않는다.

162개 배포 시점의 `depth-four-click-proof.json`과 `depth-four-native-bank.png`는 실제 production dialog에서 관계·연애 → 오랜 친구와 재회 → 대화 → 따뜻함 → 한 관계를 다섯 번 클릭한 결과다. 네 번째 고정 답변까지 정확한 누적 키와 배포 원본 URL이 일치했으며 신규 이미지 생성 요청과 브라우저 오류는 각각 0개였다. 캐시 디코드 후 DOM 실행은 6–11.9ms였고 다운로드/화면 합성 시간은 포함하지 않는다. `depth-four-bank-browser.mjs`로 재현한다. 원본 스크린샷을 직접 열어 도트 배경과 화면에 보이는 선택 버튼을 확인했다. 별도 컨테이너의 인터뷰 관찰이며 전체 앱 시작·AI 게임 저작의 완료 증거는 아니다.

181개 배포 시점의 `reviewed-structures-click-proof.json`은 당시 배포된 네 번째 고정 답변 배경 20개 모두를 실제 production dialog에서 클릭한 결과다. 각 경로의 캐시 관찰 상태를 비우고 장르부터 네 번째 답까지 총 100번 클릭했다. 모든 누적 키/원본 URL이 일치했고, 각 원본의 실제 디코드가 확인됐으며, 신규 이미지 생성 요청과 브라우저 오류는 각각 0개였다. `reviewed-structures-bank-browser.mjs`로 재현한다. `structure-romance--campus--talk--secret--routes.png`와 `structure-romance--campus--memory--bittersweet--routes.png` 원본 스크린샷을 직접 열어 배경과 노출된 버튼을 확인했다. 이 관찰은 배포된 네 번째 답변 경로 전체를 다루지만, 아직 미배포인 네 번째/다섯 번째 답변 경로나 전체 시작 셸·AI 게임 저작까지 확인했다는 의미는 아니다.

223개 배포 체크포인트의 `all-published-click-proof.json`은 첫 화면 원본과 배포된 고정 선택 접두 경로 222개 전부를 actual production dialog에서 총 878회 클릭한 결과다. 누적 키·정확한 원본 URL·네이티브 디코드가 모두 일치했고 신규 이미지 생성 요청과 브라우저 오류는 각각 0개였다. `node verify-shots/interview-scene-bank-v2/reviewed-structures-bank-browser.mjs --all-published`로 재현한다. 매 경로 대화창을 새로 열며 현재 캐시 인스턴스 소유권을 확인하여 닫힌 대화창의 지연 디코드를 준비 완료로 오인하지 않는다. `all-published-palace-perspectives.png`는 실제 선택 버튼과 새 가면무도회 배경을 직접 확인한 스크린샷이다. 별도 컨테이너의 인터뷰 컴포넌트 범위이며 전체 시작 셸·AI 저작을 확인하는 검사는 아니다.

앞선 210개 배포 체크포인트에서는 기존 가면무도회 원본 13개를 다시 열어 문장 깃발·휘장·선택하지 않은 소품을 발견하고 원본 해시에 묶인 기존 합격을 취소했다. 별도로 생성한 교체본을 직접 검수해 모두 배포한 뒤, 사용하지 않는 옛 PNG를 공용 배포 폴더에서 제거했다. 기존 후보와 생성 요청 및 판정 기록은 보존한다. 새 후보에서도 전경 흐림·인물상·선택 소품 누락·가려진 빈 자리는 반려했다. 현재 배포 223개는 무결성 검사를 통과했지만 전체 계획 중 1,234개는 아직 미완성이며 `complete: false`다.

추가 배치 031·032에서는 기본 제공 image_gen으로 열 장씩 동시에 원본 20장을 생성하고 각각 실제 원본과 앞 단계 배경을 열어 검수했다. 합격 13장을 추가 배치했으며 나머지 7개 시도는 가면·공통 물건 누락, 금지한 깃발, 실내 분위기 불일치 또는 반복 구도로 반려했다. 반려 판정은 원본 해시에 묶어 보존하며 다음 요청에 구체 실패 이유를 반영한다. 다음 배치 033은 재시도 1개와 새로운 누적 선택 9개를 준비한 상태이고 아직 생성하지 않았다.
