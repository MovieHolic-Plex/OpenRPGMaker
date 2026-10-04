# monsters full 인계 보고

커밋 제목: `feat: expand Joseon folklore monsters to full fifteen species`. 최종 커밋 해시는 작업자 stdout/최종 응답을 참조한다.

## 저장 결과

- 일반12 + 보스3, 실제 native 시트15장·135포즈·초상15장.
- enemies15 + 고유 단독 troops15, 예약 재료12종을 드롭으로 모두 참조.
- 새11종은 각각 별도 해부/복식/무기/9포즈/쓰러짐 코드. 기존 멧돼지·처녀는 유지, 볏짚·청동은 오른쪽 얼굴을 보정했다. 고블린 복제·반복 재색칠·Actor1 적 아이콘은 없다.
- rare-elite는 여우요괴와 돌 도깨비, unique-boss는 청동/신부/산군으로 디자인과 이름에 표기.
- 배경은 실제 기존 forest/cave뿐. 전원 skill_attack fallback이며 behavior 담당이 교체한다. 다른 역할·고정계약·registry·runtime/editor core·실제 SQLite/Supabase 무수정.

## 근거

- 최종 원본 시트15장과 초상15장을 각각 view_image로 직접 열었다. 종별 관찰/최종 그림 해시: review/VISUAL-REVIEW.md, review/art-manifest.json.
- PNG 디코드/0·255 alpha/9~17색/원본 재현135포즈/종당9다른 픽셀/idle15다른 실루엣/바닥 y=cell−4 및 셀경계/초상 픽셀 확인: review/asset-smoke.json passed.
- 현재 normalizeEnemyRecord/normalizeTroopRecord로 15개씩 실제 정상화·ID/stats/rewards/actions/members 보존·JSON 왕복: review/normalize-smoke.json passed.
- 클래스4직업×1–20 곡선/장비4급/기존 공격을 읽기 전용 snapshot으로 저장했다. 실제 applySkillLike로 모든 적15종×4직업 기본공격 계산: review/balance-probe.json passed. 최대 분산 공격이 해당 레벨 무장 없는 직업 HP의35% 미만.
- source 전체와 PNG/프레임 SHA-256, 재생성 명령: README 및 review/art-manifest.json. 원본 포즈 재생 페이지 review/index.html은 실제 PNG 내장, JS 구문 확인 완료.

## 보스 곡선

| 보스 | 레벨 | HP | 경험치 / 금 | 적정 장비4인 기본공격만 라운드 | 무장 없는 직업 최대 HP 피해 |
|---|---|---|---|---|---|
| enemy_jf_bronze_dokkaebi | 6 | 680 | 210 / 120 | 7 | 16.6% |
| enemy_jf_bride_wraith | 12 | 1400 | 650 / 350 | 12 | 18.6% |
| enemy_jf_mountain_tiger | 19 | 2600 | 1400 / 800 | 18 | 17.5% |

라운드는 중립/전열/치명타0/기본공격만의 벤치마크다. 기술·회복·ATB·반격·상태·행동 전환이 들어간 실제 승리 시간/승률은 검증하지 않았다. 최종 behavior 및 skills 합류 후 root가 난도를 조정한다. 보스100% 드롭은 각각 bronze-shard / broken-jade / tiger-claw 1개다.

## 감독자 통합과 한계

1. sheets.json의 public 경로는 향후 복사 대상이며 원본은 이 역할 assets 안에 있다. root가 public 시트/초상, 공용 레지스트리/내보내기와 actual canonical을 연결한다.
2. full 소비품에 예약 드롭 재료가 모두 정의되고 behavior/skills의 실제 행동이 합류해야 한다. monsters는 skill_attack fallback만 제공한다.
3. 실제 runtime 무대와 전투, 내보내기, 정본 저장/재로드, full 사용자 그림 승인은 남았다. ready=true는 파일 인계 상태다. 첫4종 열람을 full 승인으로 꾸미지 않았다.
4. 현재 세션의 쓰기 루트가 이 체크아웃/임시폴더로 제한되어 보고서는 자기 역할 FULL-REPORT.md에 저장했다. 공유 steering과 다른 역할 데이터는 읽기만 했다.
5. gates/Vitest/npm test/전체typecheck/stash/push/PR/checkout/추가작업자 없음. 역할 개별 스모크만 실행했다.

모든 파일 저장 후 status.json의 phase=full/ready=true를 마지막으로 기록한다. 최종 확장은 여기서 종료한다.

## Git 인계 제약과 bundle

공유 Git의 `/home/main/z-project/rpg-zzu/.git/worktrees/…/index.lock`이 읽기 전용이라 마지막 git add가 EROFS로 거절됐다. 앞선 일부 stage는 남아 있으며 이 작업자가 shared index를 정리하지 않았다. 현재 역할 브랜치 HEAD는 파일럿 `4a3ad0bf22c138cd9d284e11a9d5caf0575c8414`다.

쓰기 가능한 임시 Git 저장소에서 이 HEAD를 부모로 삼아 monsters 변경만 담은 feat 커밋을 생성하고 bundle로 인계한다. 실제 워킹트리 브랜치에는 새 커밋을 쓰지 않았으며 checkout/push는 하지 않았다.

- bundle: `/tmp/jf-monsters-full-xcmewnny/monsters-full.bundle`
- 임시 저장소: `/tmp/jf-monsters-full-xcmewnny/git`
- bundle 참조: `refs/heads/jf-monsters-full`
- 최종 commit hash: stdout/최종 응답 참조.

감독자가 대상 체크아웃에서 확인/가져올 명령(작업자가 실행하는 명령 아님):

```bash
git bundle verify /tmp/jf-monsters-full-xcmewnny/monsters-full.bundle
git fetch /tmp/jf-monsters-full-xcmewnny/monsters-full.bundle refs/heads/jf-monsters-full
git cherry-pick FETCH_HEAD
```

/tmp 인계본은 임시 보존이므로 감독자가 작업 종료 후 보존 경로로 복사해야 한다. role 파일과 final status는 현재 워킹트리에 모두 저장되어 있다.
