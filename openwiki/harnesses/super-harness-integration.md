# 슈퍼하네싱 — 기물 공급과 공간 학습의 통합 입구

사용자 요청(2026-10-04): 기물·파생 제작 하네스를 **슈퍼하네싱**이라 부르고 기존 슈퍼하네스와 합친다.

## 현재 통합 범위

`http://mdc-server:18312/harness`의 한 화면에서 네 작업을 연다.

| 작업 | 실제 소유 실행기·저장소 |
|---|---|
| 기물·파생 | `interior-props`; `/harness/props`, 기존 선택 DB·하네스 DB |
| 공간·개념 | 기존 `super-harness`의 18315 `/`; 기존 개념 DB·독립 검수 |
| 재료 주문서 | 기존 `super-harness`의 18315 `/orders` |
| 공용 재료 | 실제 `shared-content.sqlite`의 `oprn-hand-interior-harness` 행 |

상위 화면은 `src/harnesses/interior-props/web/super.html`, 읽기 연결은 `super_bridge.py`다.
화면을 바꿔도 기물 iframe은 보존하여 작성 중인 선택·메모를 잃지 않는다.
공간 화면과 주문서는 처음 열 때만 기존 실행기를 연결한다. 연결 실패를 표시하고 재시도한다.
기존 공간 서비스의 `/api/list`만 10초 캐시로 읽는다. 무거운 `/api/state`를 통합 상태판에 쓰지 않는다.
조회 주소는 `SUPER_HARNESS_ORIGIN`(기본 `http://127.0.0.1:18315`), 브라우저는 같은 호스트의 해당 포트를 연다.
통합 상태판은 공용 게시 상태와 공간 개수·진행·일시정지를 보여준다.

서버·DB·작업 대기열 자체를 하나로 이관한 상태는 아니다. 기존 공간 화면은 해당 실행기의 API를 그대로 쓴다.
통합 입구의 상태/자료 API는 GET만 지원하며 작업 재개·재료 승인·후보 선택을 발생시키지 않는다.
기물 확정 → 공용 자동 등록은 기존 계약대로 이어진다.

## 다른 세션이 작업 중인 기존 슈퍼하네스

확인한 실제 워크트리: `/home/main/z-project/rpg-zzu-super-harness`,
브랜치 `codex/super-harness-material-gates`, 유닛 `super-harness.service`, 포트 18315.
이 연결을 작업하는 중에도 HEAD와 `gates.py`가 바뀌었다. 그 워크트리의 파일·서비스·DB는 수정하지 않는다.
확인 시 개념 90개, paused=true. 상위 화면을 열어도 재개하지 않는다.
통합 코드의 작업 브랜치는 `codex/interior-prop-derivations`이며 기존 세션의 병합 때 충돌을 따로 검토한다.
`interior-props`와 `super-harness`의 내부 id는 유지한다. 전문 하네스 배정·기존 DB 경로의 식별자이기 때문이다.

## 공용 재료 전달

- `GET /api/super-harness/status`: 가벼운 상태와 실제 공용 판본.
- `GET /api/super-harness/materials`: 공용 킷 사전·실제 `stamp_object` binding.
- `GET /api/super-harness/materials.zip`: 공용 DB의 한 판본을 고정한 파일 자료.

압축 안에는 `library.json`(실제 게시 행), `catalog.json`(킷 사전), `tileset.json`, `atlas.png`,
용도별 `references/*.md`·이미지·`references/index.json`, `receipt.json`(판본과 모든 파일 SHA-256)이 있다.
다운로드 전에 실제 행의 payload 해시와 revision을 대조한다. 미선택 후보나 현재 더러운 후보 폴더를 읽지 않는다.
공용 행은 읽기 전용 연결로 조회하고 한 라이브러리만 읽는다. 캐시는 최신 한 판본만 보존한다.

## 기존 공간 실행기의 다음 통합 지점

현재 공간 실행기의 재료 gate는 **그 워크트리 안의 파일 경로**·JSON pointer·해시를 검사한다.
HTTP 목록을 봤다는 이유만으로 available/승인을 통과시키면 안 된다.
현재 통합 입구는 자료 전달을 제공하며, 기존 공간 survey의 자동 수신·설치는 아직 연결하지 않았다.
기존 세션에서 아래 계약을 구현해 결합한다.

1. 공용 판본의 ZIP을 해당 작업의 독립 폴더로 받고 receipt 해시를 확인한다.
   그 판본을 실제 프로젝트의 공용 목록과도 대조한다. 시대별 `native` 허용 여부는 별도로 검토한다.
2. `catalog.json`의 `/kits/<id>` JSON pointer(슬래시는 `~1`, 물결은 `~0`),
   `atlas.png`, 실제 해당 용도의 참고 MD를 재료 근거로 등록한다.
3. binding은 `kit:shared_hand_interior_harness/<공용 킷 id>`인 `stamp_object.objectId`다.
   `build_hand_interior_room`의 고정 번들 번호와 혼용하지 않는다.
4. `recheck-materials` → survey → 기존 독립 material-review를 거친다.
   사용자 선택·공용 게시가 공간 기획/시대/지도/이벤트 검수의 PASS를 대신하지 않는다.
5. 작업 중인 후보를 대신 고르거나, 일시정지를 풀거나, 예전 대기 주문을 일괄 재실행하지 않는다.

새 타일셋 통합을 완료하려면 공간 예제 저작·렌더·검수에서도 해당 타일셋이 로드되는지 확인해야 한다.
기존 세션의 최신 기획/재료 gate를 먼저 읽고 이 계약을 적용한다.
