# Behavior full · root 인계 보고

## 완료 산출물

- 일반12/보스3 전15종 enemyActions /37행동. 기본 공격 always/priority1/빈skillId는 모든 종에서 유지.
- 고정 계약의 예약 enemySkills12개만 참조·재사용. root가 data.enemyActions를 적 레코드에 병합한다.
- 실제 skills source: `/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content-jf-skills/content-packs/joseon-folklore/skills/data.json`
- 기술 source SHA-256: `cac9ce83c28ba6300c3933ff75d5327a08567c38586ad436b40800e8c8c6c70f`
- 실제15종 monsters source를 읽었으며 두 입력은 skills-source/monsters-source에 사본·해시로 보존(등록용 데이터 아님).
- 실제 src/battle/runtime.ts 집중 실행 124개, ok=true / normalized15 / skipped0.
- PNG3개(full-normals-1/2, full-bosses), 원본15도트 직접 열람 및 검토 PNG 직접 확인, 이미지/입력/결과 SHA-256 보존.
- status phase=full ready=true는 산출물 준비. userApproved=false, integrationReady=false. 사용자 승인/게임 저장/공용등록 아님.
- 기존 파일럿의 가짜기술 fixture 재생성기/검토판은 폐기, 첫 커밋83d096dc25에 과거 작업 보존. Full 검사는 실제 SkillRecords만 사용.

## 실제 조건·효과 검사

일반은 각기 다른 turn/hp/mp/status/allies 단일 조건. 복합and/새phase/새스위치/새기술/상태 없음. 산적의 낮은HP 독이빨도 별도 실제 선택 검사. 대숲귀는 도적의 실제 독칼로 얻는 state_poison에 걸리면 채찍을 멈추고 기본 공격, 무덤귀는 독에 걸리면 반대로 저주.

엄니돌진/한의울음/돌내리치기/청동강타의 실제 chargeTurns1 → 준비/다음 자기차례 발동. 한의울음은 support/전체귀봉50%, HP피해 없음. 무덤저주/여우홀림은 공격0.75배 상태(조종 없음). wing-flurry는 실제 allEnemies/hitSequence[.6,.6]. 모든 완료 행동의 실제 MP비용 일치를 검사했다.

보스: 청동HP40%, 혼례HP55%, 산군HP70/35%에서 실제 선택 변화. 산군 중간HP 독이빨을 따로 실행. 청동강타(allEnemies/MP0/chargeTurns1)는 실제 이름/효과/연출을 3보스가 재사용. 무효/변신/새능력치 같은 미구현연출 없음.

## strict/gauge 차이

실제 이벤트 시간배열이 다른 종: enemy_jf_wild_boar, enemy_jf_cave_bat, enemy_jf_drowned_ghost, enemy_jf_grave_ghoul, enemy_jf_fox_spirit.

strict는 라운드 시작 행동을 미리 정해 그 뒤 HP·상태 변경을 바로 반영하지 않을 수 있다. 초기 seed 전 정한 행동을 첫 워밍업 기록으로 보존했고 이후 조건 검사를 분리했다. gauge에서는 느린 동료가 있는 박쥐가 같은 전투차례에 자기 행동을 여러 번 했다. 개별 자기차례를 세는 모으기와 전투차례 조건을 혼동하지 않는다. 준비한 행동의 조건은 발동 시 다시 평가하지 않는다. 실제 귀봉은 두 번째 자기차례에서 풀리므로 영구봉인 가정 없음.

## root가 해결해야 할 통합 한계

**원본 monsters의 들쥐/멧돼지/박쥐/짚도깨비 maxMp=0**, 실제 비용3/3/4/3. 원본15종 능력치 strict/gauge 검사30개에 이 문제를 남겼다. 이 네 종은 기술을 사용하지 못하고 기본 공격만 한다. 행동표 병합만으로 해소되지 않는다. 공유질의 shared-queries.md의 기력표를 참고하여 root/monsters/skills가 최종 MP 또는 비용을 정합시켜야 한다.

양성 AI검사에서만 그 네 종에 MP12/12/16/12를 보충했고, **다른 능력치는 실제 monsters 레코드**다. 타 역할을 수정하지 않았다. 플레이어는 prototype 배우에 HP4000/MP250/공격20/민첩60/장비비움, 레벨은 설계1~18을 사용해 긴 실행을 관측했다. 최종 클래스/장비/게임 밸런스의 합격 판정은 아니다.

실제 source 초기 누락8기술 질의는 full source 제공으로 해소됐다. root 보고서와 공유질의는 현재 sandbox의 읽기전용 output/jf-workers에 쓸 수 없어 behavior 소유 폴더에 저장했다.

## 제한과 재생성

liveSQLite/Supabase/다른프로젝트 DB/공용코드/registry/타 역할 쓰기 없음. full gates/vitest/npm test/전체typecheck/stash/push/PR/checkout/추가작업자 없음. public의 소유 behavior PNG만 작성, 등록 없음. root가 enemy병합/등록/정본 저장·재로드/출하게임 QA를 수행한다.

```bash
python3 scripts/content/joseon-folklore/behavior/author-full.py
node scripts/content/joseon-folklore/behavior/run-smoke.mjs
python3 scripts/content/joseon-folklore/behavior/render-review.py
```

## Git 인계 제한과 전달 방식

현재 sandbox에서 `/home/main/z-project/rpg-zzu/.git/worktrees/.../index.lock` 생성이 읽기전용 파일시스템으로 거절됐다. 일반 git add/commit은 완료되지 않았다. 감독자 output/jf-workers에도 쓰기 권한이 없다.

실제 feat 커밋 객체를 /tmp의 별도 index/object 디렉토리에 만들고 `full-handoff.bundle`로 포장한다. 공유 저장소의 HEAD/refs/index는 수정하지 않는다. bundle은 원래 첫 샘플83d096dc25를 부모로 한 실제 Git 커밋을 포함한다. 해시와 운송파일 정보는 handoff.json 및 stdout에 기록된다. root는 bundle에서 커밋을 가져와 cherry-pick한다(현재 워크트리 HEAD가 여전히83d096dc25인 것은 이 읽기전용 제한 때문이다).

```bash
git fetch /absolute/path/content-packs/joseon-folklore/behavior/full-handoff.bundle refs/heads/behavior-full-handoff
git cherry-pick FETCH_HEAD
```

커밋에는 behavior 소유3경로만 포함한다. bundle/handoff.json은 재귀적 자기포함을 피하는 운송파일이며 커밋 트리/산출물 해시 목록에서 제외한다. status의 최종 바이트를 운송파일 생성 후 마지막으로 다시 저장한다. 사용자 승인이나 실제 게임 통합 완료를 의미하지 않는다.
