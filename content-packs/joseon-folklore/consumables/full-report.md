# Consumables 전체팩 인계

## 전달 결과

- 소비품20+재료12, ids.json의 해당 예약ID 전부 사용; data.json.items32행.
- 전용 아이템 기술4개를 data.json.skills에 정의. 다른 담당의 예약36기술·실제 skills 파일·prototype 기술과 ID 충돌 없음.
- 원본 투명32px PNG32장, 서로 다른 SHA. 파일럿6장 그림 SHA 그대로 보존.
- 쑥단50HP/16전·산삼탕16MP/32전 유지.
- 전 항목 가격·실제효과·사용처·획득 제안·지역·권장레벨·아이콘 의도를 design.json에 기록.
- 순수 재료12종 모두 사용불가, 기본 판매2~20전, 적 드롭 획득 제안 기록.
- status.json은 모든 파일 저장·검토 후 finalize.py로 full/ready를 마지막 저장한다.

## 실제 효과 근거

명령: `node content-packs/joseon-folklore/consumables/run-smoke.mjs`, exit0, **161개 확인**.
아이템32·기술4 정규화/JSON 저장 재로드/예약ID/참조/충돌/그림/디자인 검증,
실제 useItemFromMenu85경우, 실제 createBattleRuntime(RM식 gauge)39경우, 약품 부활 제한1경우다.
39전투는 전체32종과 공격부 반감·면역6경우, 연막 상태면역1경우다.
정상 사용의 실제 수치·한 개 소비, 필드 전용품과 재료 전투 거절·수량 유지,
MP비용0, 상태 치료는 지정 상태만 제거, 메뉴 생사조건/소지0/최대치 등을 확인했다.

- 화염부: 중립HP32, 반감16, 면역0.
- 빙결부: 중립HP30, 반감15, 면역0.
- 뇌전부: 중립HP34, 반감17, 면역0.
- 연막가루: 민첩 하락 적용 후 실제 민첩배율0.5; 상태면역 대상은 부여실패. HP피해0.
- 환생부: 필드 maxHP120→HP31, 127→32, 1→1. MP·독을 보존하고 살아 있는 대상에 사용하면 거절.
- 꿀약과: 실제 HP35+MP8 동시회복; 생기탕: 최대치 기반 HP25%+50, MP20%+8 회복.

review/smoke.json에 실제 전후 수치, data/design/엔진 코드/검사 코드/읽기 전용 prototype 및 skills source SHA가 있다.
전체게이트·vitest·npm test·전체typecheck는 실행하지 않았다. 이것은 개별 데이터 효과 스모크이며 실제 게임 통합 화면 QA는 아니다.

## 그림·출처

원본 assets/*.png32장 각각과 full-sheet-1~4.png(native+nearest6x)를 view_image로 직접 열었다.
alpha0/255, native32×32, 5~12색, 캔버스 내부 경계, 그림SHA32개 고유.
원본은 draw_icons.py+extra_icons.py 정수 좌표 신규 저작; API생성·외부그림·기존PNG재색칠 없음.
art-manifest.json은 코드/PNG SHA와 배포 계약 경로, review/visual-review.json은 관찰·현재SHA를 기록한다.
저자 검토가 사용자 승인은 아니다. userApproval=null.
재생성·정상화·검토·최종 저장 명령은 README.md에 있다.

## 의존성과 한계

공격부는 skills 담당의 element_jf_fire/ice/lightning 정의가 필요하다. 이번 스모크는 실제 skills 담당 파일의 정의를 읽기 전용으로 가져와 메모리에 합쳤다.
소비품·아이템기술의 상태 참조는 prototype에 존재하는 독/수면/침묵/마비/민첩하락만 사용했다. states/elements 배열을 새로 소유하지 않는다.
환생부 약품은 현재엔진 필드 전용 한계를 유지한다. 공유 steering에 따른 도사 healing+state_death 기술 전투부활과 별개다.
연막가루는 민첩 하락만 약속한다. 암흑·명중저하·도주보장 없음.
공격 기본 피해는 속성/상태/엔진 보정을 거치므로 모든 대상에 고정 피해를 약속하지 않는다.
회복·치료는 단일 아군이며 최대치 제한. 환생부는 자동부활·전멸구제·다른상태정화·MP회복 없음.
승인된 전투 사용은 실패/면역/이미가득참에도 수량을 소비할 수 있다. 메뉴의 무효사용 수량보존을 전투전체에 확대하지 않았다.
현재 엔진의 복합 회복은 HP·MP 수치를 모두 갱신하지만 applyItemRecovery 타임라인 표기는 HP 증가를 우선해 단일 회복 항목으로 기록한다. 이 role은 표현 코드를 수정하지 않았다.
획득·상점·드롭은 미설치 제안. public등록·실제게임통합·오프라인 내보내기/화면QA·정본 저장/재로드는 감독자 담당이다.

## 소유권·커밋

자기 content-packs/joseon-folklore/consumables 폴더만 수정했다.
live SQLite/Supabase/다른프로젝트·runtime/editorcore/registry·CONTRACT.md/ids.json 수정 없음.
이 인계는 자기 role의 full 산출물이며 사용자 승인이나 현재게임 설치 완료를 나타내지 않는다.
커밋 메시지: `feat: expand joseon folklore consumables to full 20 plus 12 pack`.
최종 status 저장 뒤 공유 Git 메타데이터의 index.lock 쓰기가 읽기 전용 파일시스템으로 거절됐다.
따라서 원래 워크트리 브랜치 HEAD를 갱신했다고 주장하지 않는다. role의 모든 최종 파일을 허용된 /tmp 독립 Git 객체 저장소로 기록한 실제 feat 커밋을 인계용 bundle로 전달한다.
기존 저장소는 객체/기준 커밋을 읽기만 한다. 다른 브랜치를 checkout하지 않고 공유 Git 경로에 쓰지 않는다.
원래 워크트리에는 최종 파일이 저장되어 있고, 마지막 status 인덱스 갱신 이전의 staged 상태가 남을 수 있다.
감독자는 쓰기 가능한 저장소에서 bundle을 fetch하고 최종 응답의 실제 커밋 해시를 cherry-pick한다.

```bash
git fetch /tmp/jf-consumables-full.bundle refs/heads/jf-consumables-full
git cherry-pick FETCH_HEAD
```

bundle은 파일 검토용 산출물의 실제 커밋을 담으며 사용자 승인·public 배포를 뜻하지 않는다.
실제 커밋 해시·bundle 위치·원래 브랜치 미갱신 상태는 최종 stdout/응답에 보고한다.
