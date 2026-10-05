# battle-monster 하네스 실행 근거 · 2026-10-05

## 즉시 확인

- `review-736.png`: 실제 하네스 후보 검토, 9자세/검수/선택 현황.
- `author-checker.png`: 실제 GPT 6.1 sol high가 새로 직접 찍은 64px 독두꺼비 기본 자세.
  저작 경로 확인용 후보이며 게임 설치/그림 승인 결과가 아니다.
- `review-320.png`: 좁은 화면의 실제 줄바꿈, overflow 없음.

## 범위

`src/harnesses/battle-monster/`를 공통 레지스트리에 등록했다. 시드 5종(멧돼지·독두꺼비·
방아토끼·장승귀·옹기귀), 기본 자세 선택 후 나머지 8자세 저작, 리터럴 격자→PNG 패킹,
독립 검수, 현재 원본 해시의 사용자 선택, 선택 팩, 자체 포함 읽기 전용 검토 화면을 제공한다.
에디터 공방/조수 도구는 false다. 기존 게임/도트/숲/배우/데이터는 변경하지 않았다.

## 실제 실행

- `npm run harness -- list`: 10번째 하네스 등록과 INDEX 재생성.
- `npm run harness -- list --check`: 매니페스트와 목록 일치.
- `battle-monster pilot`: 5종/45자세를 원본 ASCII에서 굽고 실제 PNG를 다시 디코드했다.
  `pilot-proof.json`: 모두 기술 통과, 기존 게임 시트와 **RGBA byte 동일**.
- `battle-monster author ... --phase idle --root output/battle-monster-author-check`:
  실제 GPT 6.1 sol high 별도 세션 성공. `author-proof.json`, `author-idle_a.pxgrid`,
  `author-palette.json`, `AUTHORING.md`에 원본/직접 수정 기록 보존. 64×64, 16불투명색,
  bboxExclusive `[1,21,62,61]`, PNG 다시 읽기 일치. 사용자 선택 기록 없음.
- `battle-monster critique --monster wild-boar --phase idle/poses`:
  두 별도 GPT 6.1 sol high 세션에 원본 초상과 실제 1×/3× 세 배경 보드를 첨부해 완료했다.
  `critique-idle.json`/`critique-poses.json`에 실제 좌표별 재작업 의견과 첨부 해시를 보존한다.
  모델 추천은 사람 선택을 대신하지 않는다.
- `battle-monster review`: 실제 5후보를 133KB 자체 포함 fragment로 생성/게시.
  `browser-proof.json`: 5후보×1/2/3배, 개별 자세, 공격 순서, 픽셀·독립 검수·선택 표면과 실제 브라우저
  736/320px에서 JavaScript 오류/가로 overflow 없음. 자세 재생은 실제 전투 영상이 아니다.

## 선택·변경 방지 근거

- `guard-proof.json`: 선택 전 poses 저작, 미선택 팩, 오래된 요청 binding 모두 거절.
- `binding-proof.json`: **별도 output fixture**에서 도트 한 픽셀 변경 후 선택 stale,
  기존 시각 검수 무효. 실제 사용자 ledger는 계속 빈 목록이다.
- `pack-proof.json`: **별도 output fixture**에서 실제 두 단계 검수와 진단용 선택을 사용해
  ZIP 47항목 재읽기, 192×192 시트/64×64 초상 및 9개 칸의 원본 RGBA 일치를 확인했다.
  공격 한 픽셀 변경 후 재패킹 거절. 진단용 keep는 사용자 승인이나 실제 후보 선택이 아니다.

## 한계

실제 새 저작 호출은 기본 자세 한 장을 확인했고 9자세 새 저작 호출은 아직 하지 않았다.
9자세 원본 45장은 기존 후보로 패킹/검수했다. 96px 일반 계약은 지원하지만 이번 시범은64px다.
격자/색/중복 검사는 직접 저작·미감·자연스러운 동작을 증명하지 않는다. 설치 후 돌격·스킬·
피해/상태·보상과 SQLite 저장/재로드는 별도 실제 플레이어에서 확인해야 한다.
gates/Vitest/전체 typecheck는 실행하지 않았다.
