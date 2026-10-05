# 몬스터 동시 GIF 검토 · 인간형 적 · 2026-10-05

## 먼저 볼 그림

- `humans-overview.png`: 새 인간형 6종의 실제 native64 도트를 최근접 3배로 모은 판.
- `live-wandering-swordsman.png`: 실제 사용자 대시보드의 8칸 GIF 화면.
- `live-wild-boar.png`: 기존/추가본을 동작별로 나란히 보는 화면.
- `compare-320.png`: 작은 화면의 비교 배치. 가로 overflow 0.

## 구현

대기·공격·피격·쓰러짐·스킬·독·기절·수면의 실제 GIF를 동시에 표시한다.
프레임 원본은 팔레트 인덱스 문자 격자이며 GIF에 확대/보간/자동 몸체 변형을 넣지 않는다.
일시 정지는 각 동작의 대표 PNG로 바꾸고, 재생은 GIF로 돌아간다.
기본 자세만 있는 과거 후보도 실제 그림을 표시하며 없는 동작은 명시한다.
Modify는 기본·스킬·상태이상의 18자세 후보를 다시 저작하고 사람 선택을 받는다.

인간형 6종: 산적 칼잡이·산채 창수·흑건 자객·방랑 검객·타락 도사·사교 술사.
기존 4종 추가본: 멧돼지·독두꺼비·장승귀·옹기귀. 기존 기본 9자세와 팔레트는 바이트 동일하다.
사용자가 Deny한 방아토끼는 이번 제작 웨이브에서 제외했다.

## 실제 제작과 확인

- 격리된 후보 폴더에서 실제 GPT 6.1 sol high 저작과 별도 세션의 독립 시각 검수를 실행했다.
- 10개 완성 후보, native64 원본 180자세, 실제 GIF 80개를 검사했다.
- `native-wave-proof.json`: 원본 크기/팔레트/알파/여백/접지/자세 중복과 현재 독립 검수,
  모델/effort/exitCode 및 모든 GIF 프레임의 원본 RGBA·노출 시간 재읽기.
- `live-proof.json`: 실제 대시보드에서 준비된 10후보, 각각 GIF 8개, 이미지 로드 및 JS 오류 0.
- `browser-proof.json`: 1440/1024/375/320px 가로 overflow 0, 전체 일시 정지/재생.
- `interaction-proof.json`: 브라우저에서 공격 GIF의 실제 프레임 변화, 정지 PNG의 정지,
  격리 root의 Allow 저장·재로드, 오래된 GIF 요청 거절.
- `suite-choice-proof.json`: 이전/추가본 GIF 비교의 1440/375/320px overflow 0,
  8개 GIF가 있는 suite 후보의 Allow 및 Modify 요청이 suite/poses/idle 모두에 묶여 저장됨.
  진단 서버는 워커를 정지했으므로 이 파일의 Modify는 요청 저장 확인이다.
  이번 추가 코드의 대시보드 Modify가 18자세를 다시 저작하는 전체 왕복은 별도로 실행하지 않았다.
  실제 complete 18자세 저작/독립 검수는 새 인간형 6종에서 확인했다.
- `portable-source-proof.json`: 저장소에 보관한 팔레트와 18격자를 별도 root로 ingest하여 동일 binding,
  검사 통과와 예전 사람 선택이 이관되지 않는 것을 확인했다.
- Python 구문 컴파일, JS 구문 확인, 하네스 CLI wave 진입, git diff 공백 확인.
- gates/Vitest/전체 typecheck는 실행하지 않았다.

## 저장과 선택

사용자 서비스 `oprn-battle-monster-dashboard.service`, http://100.73.251.77:18346/.
완성 후보는 `qa-runs/harnesses/battle-monster/<종>/motions-v1|v2/`에 게시했다.
원본·팔레트·시간표·저작 기록·독립 검수 출처는
`harness-data/battle-monster/authored/20261005/`에 보존했다.
별도 root의 브라우저 QA 선택은 운영 ledger에 쓰지 않았다.
원본 제작 웨이브는 사람 선택을 기록하지 않는다. 화면의 Allow/Modify/Deny가 실제 선택이다.
독립 검수의 수정 추천 역시 사용자 승인으로 바꾸지 않았다.

이 결과는 검토 후보와 자세/GIF다. 게임 정본·공용 적 DB에는 이번 후보를 설치하지 않았고
실제 전투에서 새 기술의 접촉·피해·상태 적용을 검사한 결과로 표현하지 않는다.
선택·패킹 이후 게임에 설치하는 작업은 별도다.
