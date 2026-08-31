# 스킬 탭 연출면 — 근거 기반 "이상적 상태" 정의

작성: 2026-08-30
범위: 데이터베이스 모달 **스킬 탭의 `연출` 카드**와 그 카드가 쓰는 애니메이션 재생 경로
성격: 목표 정의 + 실행 계약. 판정은 실측(테스트·게이트·브라우저 증거)으로만 한다.

---

## 1. 현재 상태 (실측)

| 사실 | 근거 |
|---|---|
| 스킬 탭 `연출` 카드의 애니메이션 미리보기는 **정지 이미지 1장**이다. 시트의 첫 칸을 `backgroundPosition: "0 0"` 으로 잘라 보여준다. | `src/editor/panels/databaseSkillRecordView.ts:568-601` (`skillAnimationPreview`, `animationFramePreviewBox`) |
| 그래서 프레임이 몇 장인지, 어떻게 움직이는지, 셀 배치가 어떤지 **편집기에서 볼 수 없다.** 픽커를 바꿀 때만 정지 이미지가 갱신된다. | `bindAnimationPreviewRefresh` — `databaseSkillRecordView.ts:603-606` |
| 반면 **같은 저장소에 이미 진짜 재생기가 있다.** 이벤트 커맨드 `showAnimation` 표시면은 열리는 순간 실제 프레임을 15fps 로 재생한다. | `src/editor/panels/eventEditor/showAnimationPlayback.ts:19,38,51,66,134` / 사용처 `commandPreview.ts:1552-1560` |
| 데이터베이스 애니메이션 탭에도 재생이 있지만 **수동 버튼**이며 1회만 돈다. | `src/editor/panels/databaseAnimationPreview.ts:79-85,211-246` |
| 즉 편집기 안에서 같은 애니메이션이 **세 가지 얼굴**을 가진다: 이벤트=자동재생, 애니메이션 탭=수동 1회, 스킬 탭=정지. 스킬 탭만 죽어 있다. | 위 3건 |

결론: 사용자의 "스킬 섹션은 애니메이션이 자동 재생되어야 함" 은 **누락된 구현**을 정확히 지목한 것이고,
고칠 자산(재생 엔진·셀 좌표 계산·크로마키)은 이미 저장소에 있다. 새 재생기를 만들 이유가 없다.

## 2. 제약 (근거 있는 하드룰)

| 제약 | 근거 |
|---|---|
| 데이터베이스 모달은 **중립 쿨 스튜디오**다. 다크 모달 전면 개편·RM2k3 복고 크롬은 이미 기각됐다. | `openwiki/editor-database.md:5`; 커밋 `62c18466` "Rejected: Full dark modal redesign"; `c052cc5c` |
| 색은 `.database-modal-backdrop` 아래 `--db-studio-*` 토큰만 쓴다. 하드코딩 hex/rgba 금지, `!important` 순증 금지, **새 CSS 파일 금지**(파일 수 래칫). | `src/styles/database/studio-theme.css:8-46`; `src/styles/TOKENS.md:136-143`; `scripts/check-css-budget.mjs` (hex 1697 / important 985 / cssFileCount 263 래칫) |
| 렌더된 클래스에서 **CSS 속성 차원을 지우면 게이트가 실패**한다(값 변경은 보고만). | `scripts/check-css-live-classes.mjs` (997 클래스 보호) |
| 모달 창 치수의 소유자는 `sidebar.css:69-76` 하나뿐. 탭 콘텐츠는 창·사이드바·푸터를 리사이즈할 수 없다. | `openwiki/editor-database.md:10-11`; `test/e2e/database-modal-size-invariant.spec.ts` |
| testid/DOM 구조를 이름 바꾸거나 없애지 않는다(`db-picker-animation`, `db-skill-animation-preview` 유지). | `TOKENS.md:137`; `test/databaseSkillItemForms.test.ts:99-101` |
| 재생 타이머는 **분리된 DOM 에서 살아남으면 안 된다.** 이건 이미 한 번 실측된 결함이다. | 커밋 `2ed96476` (showAnimationPlayback 마운트 전 유예 무한 → 2틱 상한); `test/e2e/zz-qa-dbmodal-attacks.spec.ts:168-231` (stray timer 0 단정) |
| 편집기 코드는 저작 데이터만 건드린다. 이 작업은 **스키마·영속 변경 0**. | `openwiki/editor-pre-edit-routing.md:66`; `openwiki/editor-database.md:174` |
| 진행 중인 `origin/데이터베이스-리디자인0000`(main 대비 18커밋, main 으로의 PR 없음)은 `studio-theme.css`·`modern-controls.css`·`overview-dashboard.css`·`sidebar.css`·`battle-studio.css`·`.omo/css-live-classes-baseline.json` 을 다시 쓴다. **그 파일들을 건드리면 충돌한다.** 반면 `skill-item-visuals.css`·`databaseSkillRecordView.ts`·`showAnimationPlayback.ts` 는 그 브랜치가 손대지 않는다. | `git diff --name-only origin/main...origin/데이터베이스-리디자인0000` 실측 |

이 마지막 줄이 "UI 를 게임 에디터답게" 의 범위를 결정한다. 모달 전역 재스킨은 (a) 이미 다른 브랜치가
진행 중이고 (b) 기각 이력이 있다. 따라서 **이번 작업의 UI 범위는 스킬 탭 연출면 자체**다 — 사용자가
자동재생을 요구한 바로 그 자리에서, 게임 에디터가 가진 스테이지 어포던스를 준다.

## 3. 이상적 상태

> 스킬을 선택하면 `연출` 카드가 **살아 있는 애니메이션 뷰포트**가 된다. 프레임이 즉시 자동
> 반복 재생되고, 몇 번째 프레임인지·시트 규격이 무엇인지·지금 재생 중인지 한눈에 보이며,
> 정지/재생을 한 번의 클릭으로 통제할 수 있다. 모달을 닫거나 다른 레코드로 넘어가면 타이머는
> 확정적으로 죽는다.

관측 가능한 목표:

1. **자동 반복 재생.** 프레임이 2장 이상인 애니메이션을 참조하는 스킬을 열면, 셀 레이어의
   `data-frame-index` 가 `SHOW_ANIMATION_FRAME_MS`(≈67ms) 간격으로 전진하고 마지막 프레임 뒤
   0으로 되돌아 **계속 돈다**(기존 1회 재생과 달리 loop).
2. **엔진은 하나.** 새 재생 루프를 만들지 않는다. `showAnimationPlayback.ts` 에 `loop`/`onFrame`
   옵션을 더해 이벤트 편집기·스킬 탭이 같은 규약(15fps, 시트 좌표, 크로마키)을 공유한다.
3. **게임 에디터 스테이지 크롬.** 인셋 스테이지 웰 + 픽셀 그리드 + 중심 십자선, 프레임 카운터
   (`3 / 12`), 시트 메타 칩(`96×96 · 5열 · 15fps`), 재생/정지 토글. 전부 `--db-studio-*` 토큰,
   기존 `skill-item-visuals.css` 안에서.
4. **정지 상태도 1급.** 애니메이션 미지정이면 기존 빈 상태 문구를 유지하고, 프레임이 1장뿐이면
   정지 렌더 + 토글 비활성. `prefers-reduced-motion: reduce` 면 자동재생하지 않고 첫 프레임에
   서서 토글로만 재생한다.
5. **타이머 수명 확정.** 픽커 변경·레코드 전환·탭 전환·모달 닫힘에서 인터벌이 정리된다.
   재열기 10회에도 stray timer 0.
6. **회귀 0.** 이벤트 편집기 표시면과 애니메이션 탭 재생은 그대로 동작하고, CSS 3게이트는
   기준선 대비 0 회귀, `typecheck:app` 0.

## 4. 판정 방법 (증거)

| 목표 | 판정 |
|---|---|
| 1,4,5 | vitest: 셀 레이어 `data-frame-index` 전진/랩어라운드, reduced-motion 정지, 언마운트 후 인터벌 정리 (fakeDom + `vi.useFakeTimers`) |
| 2 | `showAnimationPlayback.ts` 단일 모듈 재사용 — 새 `setInterval` 도입 0건(grep) |
| 3 | 편집기 브라우저 스크린샷(스킬 탭, 실제 dev 서버) + 200ms 간격 두 장에서 `data-frame-index` 변화 실측 |
| 6 | `npm run typecheck:app`, 관련 vitest, `npm run gates:css` |

"보기 좋아졌다" 는 판정 근거가 아니다 — 스크린샷은 프레임 전진 실측과 함께만 증거로 쓴다.
