# 전투 적대 리뷰 14건 수정 — 2026-09-30

기준 HEAD `0e0db9b5818814e9f27400c8fb2b54b619d59e8d`의 [원본 리뷰](2026-09-30-battle-adversarial-review.md) 후속. GPT 6.1 Sol/high 수정 에이전트 둘은 격리 워크트리에서 엔진 규칙과 데이터/내보내기를 맡았다. root는 생명주기·입력·메뉴·연출을 수정하고 직접 재현 프로브/출하 플레이어 QA를 수행했다. 데이터 담당은 합친 코드도 읽기 전용 적대 리뷰했다.

## 수정과 직접 확인

| ID | 수정 | 수정 후 관찰 |
|---|---|---|
| R1 | strict 양쪽 실행 직전 행동불가 재검사 | 스톱 뒤 예약 공격 피해 67→0; 해당 공격 엔트리 없음 |
| R2 | 전원 frozen일 때 고정 시뮬레이션 시계로 upkeep·사이클 진행 | turn1 정지→turn2 회복 후 배우 명령; 영구 스톱은 turn200 escape |
| R3 | 무작위 후보를 대상 loop 밖에서 시전당 한 번 선택 | 적2명 피해 기록 4→2; 각 피해20→10 |
| R4 | HP 비용·매 타격 흡수를 예측 클론에도 공유 | 비용 사례 예측/실제250/250; 흡수 사례250/250 |
| R5 | 상태 속성·계열 방어·감정과 hit 후 전이 공유 | 속성·감정 각각300/300, 공격/마법 방어75/75, 방어 공식50/50 |
| F1 | 포획 획득을 결과 커밋으로 이동 | 취소: 몬스터1/볼8 유지; 정상 완료: 몬스터2/볼7 |
| F2 | 입력 프롬프트 중 AUTO·명령·ATB tick 차단, 완료 소유권 검사 | strict/Active 모두 F를 켜도 prompt 유지/busy=false/MP 유지; Active 적 게이지9% 유지, 입력 완료 후 prompt 제거 |
| F3 | 결과 단계 retro2003 메시지 숨김의 CSS 구체성 수정 | 일반/감소 모션 모두 48px 겹침→0, display:none |
| F4 | 준비 경계와 자원/상태 변화로 열린 명령 목록 갱신 | 동료 ATB100에서 연계기 즉시 활성; 재개방 상태와 같음 |
| D1 | cast 동반 자산 수집 및 공용 -cast resolver 등록 | 기본/시전 시트 모두 포함; nested URL·inline URL 확인 |
| D2 | 계약 종류와 실제 시전자 편 분리 | 배우→산성 몬스터 계약/FX; 적→총사 계약/FX, 적 scan 특수기 계약/FX 확인 |
| D3 | timeline/action에 정확한 skillId 전달, ID 우선 조회 | 장비 총사 저격→skill_gunner_snipe/gunner_scope; 레인저 저격 연출 없음 |
| D4 | 반복 공격 기본 데이터에 hit 배열 명시 | 삼연격/삼단 찌르기 각1→3타, [38,38,38]/[34,34,34] |
| D5 | 새로 보충한 행의 참조 의존성을 큐로 폐쇄 | 빈 커스텀 DB 보충 후 참조0, 이중 serialize/deserialize 성공, 재보충false |

D2 추가 리뷰에서 자체 class 계약과 borrowed monster 계약이 동시에 선택되는 경로도 발견했다. 모든 계약 종류에 대해 자기 ID를 먼저 선택하도록 resolver를 고쳤다. 적의 special 성공 fact에는 ID/commandKind를 전달하고, 컷인 그림도 적 시트에서 가져온다. 적 scan 확인 중 드러난 상태 속성 helper import 누락도 복구하고 해당 브라우저 사례를 재실행했다.

## 근거

`verify-shots/battle-fix-2026-09-30/`:

- `rules-probe.json`: R1–R5, D1/D4/D5 결정적 엔진/데이터 수치.
- `extra-rules.json`: 계열 방어·공식·감정·영구 스톱·계약 우선순위·nested/inline·저자 보존.
- `interactions/interactions.json` 및 `SUMMARY.md`: **9개 조건 fixed=true/page errors=0**. 포획 취소/정상 완료, 입력, 연계 메뉴, 양방향 계약과 적 특수기. 페이지 오류도 기록.
- `matrix.json`, `MATRIX.md`: 1024/1280/1440, Wait/Active/strict, 감소 모션, rm2000 대조 **7개**. 모든 시나리오 비트 실패0/런타임 오류0.
- `retro-1024-settled/result-settled.png`, `retro-reduced/result-settled.png`: 결과창 직접 시각 확인. `retro-1280-menus/target.png`: 대상 창/필드 배치 확인. `interactions/combo-menu-ready.png`: 준비 후 목록 확인.
- `repro/`: 실행 스크립트. 저장소 root의 `.omo/battle-fix-3852/`로 복사하면 상대 import/fixture 경로가 맞는다.

엔진/fixture 실행은 `node node_modules/vite-node/vite-node.mjs --script .omo/battle-fix-3852/<name>.mts`, 브라우저는 `node .omo/battle-fix-3852/interaction-probe.mjs` / `visual-matrix.mjs`. `AUDIT_CASES`로 해당 사례만 지정할 수 있다. 엔진 프로브는 직접 재현이며 vitest 실행이 아니다.

## 범위와 남는 제한

- 신규/빠진 기본 로스터의 반복 타격 38개를 명시했다. 일반 3타 [.4,.4,.4], 2타 [.6,.6], 러시4타 [.25,.25,.25,.5]는 저작/밸런스 선택이다. 모든 스킬의 연타 횟수를 검증했다는 뜻은 아니다. 기존 동일 ID 레코드는 저자의 값일 수 있으므로 덮어쓰지 않는다. 기존 저작 기술 [0.2,0.3]과 이름 보존을 이중 재로드로 확인했다.
- D1은 자산 수집과 URL 라우팅을 직접 확인했다. 실제 ZIP을 별도 호스트에 배포한 전체 흐름까지 확인한 것은 아니다.
- transient fixture로 실제 출하 `player.html`/exportProjectStoreShim을 통과했다. 정본 SQLite/원격 프로젝트에 쓰지 않았다. 사용자 프로젝트의 실제 저장/재로드나 전체 몬스터·직업 조합의 완료를 주장하지 않는다.
- 회귀 테스트 파일 3개를 작성했으나 AGENTS.md의 실행 제한에 따라 **vitest/gates/전체 typecheck는 실행하지 않았다**. 현재 직접 확인 결과를 전체 게이트 통과로 해석하지 않는다.
- 원본 motion 프로브의 party-left/전체 walk-frame 기대는 현재 아군 오른쪽 배치·기술 모션과 다른 낡은 기대여서 원본 리뷰에서도 제품 실패에서 제외했다. 이 수정에서는 해당 하네스를 바꾸거나 통과했다고 보고하지 않는다.
