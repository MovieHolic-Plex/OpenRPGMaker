# 초보자 자료집 UX 휴리스틱과 S x B 채점 루브릭

공유 판정 문서. 6개 adversarial audit spec, visual review, findings ledger, 최종 보고서가 이 파일만 인용한다. 발견을 여기서 채점하지 않는다.

한국어 UI를 있는 그대로 인용한다. 휴리스틱 이름과 testid는 영문 그대로 둔다.

## 채점 루브릭

`score = S x B`. 밴드는 아래 표를 따른다. 출처: `.omo/drafts/db-beginner-adversarial-qa-probe-matrix.md` Scoring rubric.

| 밴드 | 점수 | 처리 |
| --- | --- | --- |
| P0 | 9-12 | 재현 스펙 필수 |
| P1 | 6-8 | 우선 개선 |
| P2 | 3-4 | 백로그 앞쪽 |
| backlog | 0-2 | 기록만 |

### Severity S

| 코드 | 정의 |
| --- | --- |
| S4 | data loss/corruption |
| S3 | wrong behavior persisted |
| S2 | blocked workflow |
| S1 | confusing but recoverable |
| S0 | cosmetic |

시각만으로 잡은 `[VQA]` 발견은 기능 프로브가 같은 근인을 뒷받침하지 않으면 S2를 넘지 못한다.

### Beginner-impact B

| 코드 | 정의 |
| --- | --- |
| B3 | invisible/misattributed (silent loss, jargon-only error, no undo) |
| B2 | visible, no recovery hint |
| B1 | workaround discoverable in-modal |
| B0 | expert-only or unrealistic input |

한글/이모지 입력 결함은 B2 이상으로 둔다. 한국어 우선 제품에서 그 입력은 비정상이 아니다.

## 일관성 규칙

1. score worst DEMONSTRATED consequence, never hypothetical escalation.
2. finding needs deterministic Playwright repro (locators+assertion) else "unconfirmed [VQA]" capped P2.
3. one finding per root cause with tab list.
4. console errors alone = S1/B1 unless paired with observed misbehavior.
5. boundary-input findings default to B0/B1 UNLESS the input is realistic for this Korean-first product. CJK and emoji inputs ARE realistic here, so CJK/emoji defects score B2+.

## 제품이 이미 약속한 것

`src/editor/editorUiMode.ts`의 beginner chrome은 `databaseNav: "common"`, `jargonStyle: "plain"`이다. expert chrome은 `databaseNav: "grouped"`, `jargonStyle: "technical"`이다. 같은 파일 주석이 plain을 자료집/바닥/장식, technical을 데이터베이스/하위/상위로 고정한다. `src/editor/uiCopy.ts`는 `database`를 plain `자료집` / technical `데이터베이스`, `databaseShort`를 plain `자료` / technical `DB`로 나눈다. 초보자 레인 공통 탭은 개요, 주인공, 아이템, 몬스터, 적 그룹, 시스템이고 나머지는 `db-nav-all` (`모든 자료`) 안에 접혀 있다.

`src/editor/databaseFieldSupport.ts`의 `db-field-support-notice`는 휴리스틱 22의 부분 구현이다. 아이템과 장비 폼에만 붙고, 요약 문구는 `필드 적용 범위 안내 (N개 필드)`다. 스킬, 상태, 주인공 같은 다른 탭에는 같은 장치가 없다.

## 초보자 UX 휴리스틱 25

1. task-oriented entry point
(a) 사용자가 "자료를 고친다"는 일에서 자료집 문을 바로 찾을 수 있어야 한다. 숨은 메뉴나 전문가 단축키에만 기대면 안 된다.
(b) 초보 레인은 클래식 툴바를 끈다. 입구는 아이콘 레일의 `toolbar-database`와 그 라벨(`자료` / `DB`)뿐이다. 23개 탭 모달을 열지 못하면 나머지 휴리스틱은 전부 공허하다.
(c) Playwright. 초보 레인으로 부팅한 뒤 `toolbar-database`를 눌러 `database-modal`이 보이는지 본다. 같은 버튼을 전문가 레인과 비교해 라벨이 `자료`인지 `DB`인지도 읽는다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #2 Match between system and the real world. 레일 입구 자체는 `editorUiMode.ts` beginner chrome 계약.

2. progressive disclosure
(a) 자주 쓰는 면만 먼저 보여주고, 나머지 밀도는 펼친 뒤에 드러낸다.
(b) 초보 `databaseNav: "common"`은 6개 공통 탭만 꺼내고 속성, 직업, 스위치 같은 숨은 탭은 `db-nav-all`에 접는다. 23개를 한 줄에 깔면 첫 방문자가 고른다기보다 압도된다.
(c) Playwright. 초보 부팅 후 공통 탭 6개와 접힌 `db-nav-all`만 보이는지 센다. `db-nav-all`을 연 뒤에야 `db-tab-elements`가 클릭 가능한지 확인한다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #8 Aesthetic and minimalist design. 구현 계약은 `editorUiMode.ts` `databaseNav`.

3. useful+safe defaults
(a) 새로 만든 레코드는 바로 쓸 수 있는 값으로 시작해야 한다. 0 HP, 빈 이름, 음수 명중 같은 함정 기본값은 실패다.
(b) 초보자는 주인공/아이템을 하나 만들고 테스트 플레이로 확인한다. 기본값이 전투를 즉시 깨면 "내가 뭘 잘못 만졌지"로 오인한다.
(c) Playwright. `db-add-record`로 주인공과 아이템을 만든 뒤 `exportedProject`에서 이름, HP, 가격, 범위가 빈 값이나 음수가 아닌지 읽는다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #5 Error prevention.

4. role-based presets
(a) 역할(전사, 마법사, 회복)에 맞는 시작 묶음을 고를 수 있어야 한다. 능력치와 스킬을 칸마다 외우게 두면 안 된다.
(b) MZ도 주인공은 직업을 고르고, 직업이 배우는 스킬을 한곳에서 정한다. 이 제품의 직업 탭이 그 자리다. 초보자가 주인공만 만지고 직업을 비우면 성장과 명령이 빈 껍데기가 된다.
(c) Playwright. 새 주인공을 만든 뒤 직업 필드가 비어 있는지, 샘플 직업을 고르면 스킬/명령이 따라오는지 `exportedProject`로 본다.
인용: [RPG Maker MZ, Class Settings](https://rpgmakerofficial.com/product/MZ_help-en/01_08_02.html). 프리셋 칩을 더 두어야 한다는 요구는 판단이다.

5. plain-language tab descriptions
(a) 탭 이름 옆에, 또는 title/설명으로, 그 탭이 하는 일을 한 줄로 말해야 한다.
(b) `종족`과 `몬스터`, `캐릭터`와 `주인공`, `스탬프`와 `타일셋`은 초보자에게 겹쳐 보인다. 초보 레인은 공통 6개만 보여 주므로, 숨은 탭은 설명이 없으면 `모든 자료` 안에서 추측으로 고른다.
(c) Playwright와 스크린샷. 각 `db-tab-*`의 보이는 텍스트와 `title`을 모은다. 초보 1024x768 샷에서 `db-nav-all`을 연 뒤 설명 없는 아이콘/라벨만 있는지 판정한다.
인용: 판단. 제품은 `jargonStyle`로 단어만 갈고, 탭 설명 문장은 아직 없다.

6. user-facing labels over implementation jargon
(a) 화면 글자는 사용자가 쓰는 말이어야 한다. `elementRates`, `startActorIds`, `onDayEnd` 같은 구현 이름을 라벨로 올리면 안 된다.
(b) 초보 chrome의 `jargonStyle: "plain"`이 이 제품의 자체 약속이다. 모달 제목과 도움말 토스트가 여전히 `데이터베이스`이면 레일의 `자료`와 어긋난다.
(c) Playwright. 초보/전문가에서 레일 라벨, `db-nav-all` 요약(`모든 자료` vs `모든 DB`), 모달 `h2`, 도움말 토스트 문구를 모아 비교한다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #2 Match between system and the real world. 로컬 계약은 `editorUiMode.ts` `jargonStyle`과 `uiCopy.ts`.

7. preserve domain terms but define at first contact
(a) 주인공, 직업, 적 그룹처럼 장르 표준 용어는 버리지 않는다. 다만 처음 만나는 칸에서 한 줄로 뜻을 밝혀야 한다.
(b) MZ Database가 쓰는 Actor/Class/Troop 구조를 이 제품은 `주인공`/`직업`/`적 그룹`으로 옮겼다. 용어를 생활어로 전부 바꾸면 도움말과 커뮤니티 지식이 끊긴다. 정의를 안 주면 `종족`이 몬스터의 부모인지 별도 도감인지 모른다.
(c) 스크린샷. 초보가 처음 여는 주인공, 직업, 종족, 적 그룹 탭에서 필드 옆 정의/도움 문장이 있는지 본다. 구현 id만 보이면 실패다.
인용: [RPG Maker MZ, Database](https://rpgmakerofficial.com/product/MZ_help-en/01_08.html), [Actor Settings](https://rpgmakerofficial.com/product/MZ_help-en/01_08_01.html). 첫 만남 정의 문장은 판단이다.

8. related data navigable in context
(a) 지금 고치는 레코드가 가리키는 다른 레코드로, 모달을 닫지 않고 건너갈 수 있어야 한다.
(b) 몬스터는 종족을 먹고, 주인공은 직업과 장비를 먹으며, 적 그룹은 몬스터를 묶는다. 초보가 탭을 닫고 사이드바에서 다시 찾으면 더티 가드와 선택 상태를 잃기 쉽다.
(c) Playwright. 몬스터 탭에서 종족 점프가 같은 `.database-modal-window` 인스턴스를 유지하는지 `evaluateHandle`로 본다. 주인공의 직업 피커가 직업 탭으로 이어지는지도 같은 방식으로 본다.
인용: [RPG Maker MZ, Actor Settings](https://rpgmakerofficial.com/product/MZ_help-en/01_08_01.html) (class/equipment 연결). 모달 인스턴스 유지(G006)는 이 제품 계약이다.

9. inline previews of consequential edits
(a) 얼굴, 아이콘, 배틀 그래픽, 상성 배율처럼 결과가 눈에 보이는 값은 고치는 즉시 미리보기가 바뀌어야 한다.
(b) 초보자는 숫자를 저장한 뒤 테스트 플레이에서야 얼굴을 확인한다. 23개 탭을 오가며 "저장하고 플레이하고 다시 열기"를 반복하면 입력을 잃어버린다.
(c) 스크린샷. 주인공 얼굴, 아이템/장비 아이콘, 적 그룹 배치, 타입 상성 칩을 바꾼 직후 샷을 뜬다. 컨트롤 값과 미리보기가 어긋나면 실패다.
인용: [RPG Maker MZ, Actor Settings](https://rpgmakerofficial.com/product/MZ_help-en/01_08_01.html) (face/character/sv graphic). 인라인 즉시성이 필수라는 주장은 판단이다.

10. relationship/downstream-impact visibility
(a) 이 값을 바꾸면 누가 맞는지, 지우면 누가 깨지는지가 그 자리에서 보여야 한다.
(b) 스킬을 지울 때 직업이 그 스킬을 배우면 막아야 하고, 참조 목록을 이름으로 말해야 한다. 초보자는 `databaseReferences` 같은 내부 이름을 읽을 수 없다.
(c) Playwright. 직업이 쓰는 스킬을 지워 보고, 차단 메시지가 참조 레코드 이름을 쓰는지 읽는다. 시스템 `onDayEnd`가 가리키는 공용 이벤트를 지울 때도 같다.
인용: [RPG Maker MZ, Class Settings](https://rpgmakerofficial.com/product/MZ_help-en/01_08_02.html) (Skills to Learn). 메시지에 이름을 넣어야 한다는 채점 기준은 판단이다.

11. recognition over recall
(a) id를 외우게 하지 말고, 목록/칩/미리보기로 고르게 한다.
(b) 스위치 번호, 속성 id, 공통 이벤트 id를 외우는 일은 전문가 습관이다. 초보 레인에서 빈 칸에 `element_0050`을 적게 두면 입력을 포기한다.
(c) 스크린샷. 아이템 사용 가능 주인공, 장비 슬롯, 스위치 피커, 속성 등급 칸이 칩/목록인지 숫자 입력인지 본다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #6 Recognition rather than recall.

12. search/filter/favorites
(a) 긴 목록은 검색, 필터, 즐겨찾기로 줄일 수 있어야 한다. 0건일 때는 힌트가 있어야 한다.
(b) freshProject도 아이템/스위치가 이미 여러 줄이다. 가상화 임계(80행)를 넘기면 화면 밖 행은 스크롤만으로는 못 찾는다. 필터 칩이 켜진 채 하이라이트만 빠지면 "레코드가 지워졌다"로 오인한다.
(c) Playwright. 아이템 검색에 0건 질의를 넣고 빈 상태 힌트를 본다. `db-filter-chip-all`로 풀리는지, 새로고침 뒤 칩이 켜진 채로 보이는지 확인한다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #6 Recognition rather than recall.

13. visible location+state (selection, dirty, validation)
(a) 지금 탭, 고른 레코드, 더티 여부, 검증 실패가 항상 보여야 한다.
(b) 초보 `databaseNav: "common"`에서 숨은 탭을 연 채 닫으면, 다시 열 때 공통 6개만 보이며 선택이 사라진 것처럼 느껴진다. Escape 더티 3버튼(저장/폐기/계속 편집)이 안 뜨면 입력이 소리 없이 죽는다.
(c) Playwright. 이름을 고친 뒤 Escape로 3버튼이 뜨는지 본다. 활성 탭에 `.active`가 있는지, 목록 선택이 상세 헤더 `db-field-name`과 같은지 대조한다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #1 Visibility of system status.

14. immediate local validation
(a) 잘못된 값은 칸을 떠나는 즉시 막거나 고치고, 그 칸 옆에 이유를 단다. 저장 직후에야 터지면 늦다.
(b) 스테퍼/슬라이더 쌍(`-stepper`/`-slider`)이 갈라지거나 `-1` HP가 남으면 초보자는 전투가 이상한 뒤에야 알아챈다. 한글 100자와 이모지도 같은 즉시 검증 대상이다.
(c) Playwright. 숫자 칸에 `-1`, `9999999`, `abc`를 넣고 스테퍼와 슬라이더가 같은 클램핑 값을 가지는지 읽는다. 포커스를 옮긴 뒤 `exportedProject`에 NaN이 없는지도 본다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #5 Error prevention.

15. error prevention before error messages
(a) 깨진 상태를 만들 수 없게 막는 쪽이, 만들고 나서 빨간 글자를 띄우는 쪽보다 앞선다.
(b) 새 게임 메뉴 숨김, 참조 중인 레코드 삭제, 타입 32개 초과, 전투 명령 7행은 초보가 실수로 밟는 길이다. 막지 않으면 게임이 시작되지 않거나 이벤트가 침묵한다.
(c) Playwright. 시스템에서 New Game 체크를 끄려 하고 disabled인지 본다. 참조 스킬 삭제, 타입 33번째 추가, 직업 전투 명령 7행이 거절되는지 확인한다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #5 Error prevention.

16. actionable jargon-free errors
(a) 에러는 무엇을 고치면 되는지 사용자 말로 말해야 한다. 스택, 내부 id, 영어 코드만 남기면 실패다.
(b) 삭제 차단, 피커 비활성, 더티 가드는 초보가 실제로 읽는 문장이다. `databaseReferences.ts`나 raw id만 보이면 B3(jargon-only error)로 올릴 수 있다.
(c) Playwright와 스크린샷. 참조 삭제 차단문, 스위치 0개일 때 적 행동 피커, 더티 3버튼 문구를 수집한다. 고칠 대상의 한국어 이름이 있는지 판정한다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #9 Help users recognize, diagnose, and recover from errors.

17. undo/redo + reversible destructive operations
(a) 실수는 Ctrl+Z/Y로 되돌리고, 삭제는 가드와 폐기로 되돌릴 수 있어야 한다.
(b) 초보자는 탭을 훑다 값을 건드린다. 모달이 열려 있어도 전역 실행취소가 살아 있어야 하고, Discard는 스냅샷으로 돌아가야 한다. undo가 없으면 모든 실수가 B3에 가깝다.
(c) Playwright. 이름을 고친 뒤 Ctrl+Z로 `exportedProject`가 돌아가는지 본다. 더티 상태에서 Discard 후 재오픈해 값이 스냅샷인지 확인한다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #3 User control and freedom.

18. consequence-naming confirmations
(a) 파괴 확인은 동작 이름이 아니라 결과를 말해야 한다. "삭제"가 아니라 "직업 전사가 배우는 스킬 파이어가 사라집니다"여야 한다.
(b) 타입 차트 전체 삭제, 용어 칸 비우기, 레코드 삭제는 초보가 되돌리기 전에 한 번 더 읽어야 하는 문장이다. 결과가 없으면 습관적으로 확인을 누른다.
(c) Playwright. 레코드 삭제와 타입 비우기 확인 문구를 읽는다. 대상 이름과 "누가 깨지는지"가 있는지 검사한다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #5 Error prevention, #9 error recovery.

19. safe experimentation (duplicate/reset)
(a) 복제와 리셋이 있어야 초보자가 원본을 부수지 않고 시험할 수 있다.
(b) 샘플 주인공/아이템은 예제 모험의 뼈대다. 복사 없이 숫자를 만지다 저장하면 튜토리얼 전투가 깨진다. 얕은 복사는 원본까지 같이 바뀐다.
(c) Playwright. 주인공을 복사(`databaseCopy`)한 뒤 사본 이름만 고치고 `exportedProject`에서 원본이 그대로인지 본다. 리셋/기본값 복원 버튼이 있는 탭은 그 경로도 탄다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #3 User control and freedom. 복제/리셋이 초보 필수라는 주장은 판단이다.

20. consistent interaction patterns across tabs
(a) 이름 칸, 추가/삭제, 검색, 더티 가드, 피커 Escape는 탭마다 같은 손맛이어야 한다.
(b) 전투 그룹과 수집 그룹은 같은 리스트+인스펙터를 쓰지만 시스템 7섹션, 상성 그리드, 커맨드 리스트는 다른 셸이다. 초보가 아이템에서 익힌 `db-field-name` 습관이 용어 탭에서 배신하면 입력을 잃어버린다.
(c) Playwright. 주인공/아이템/몬스터/스위치에서 `db-add-record`, `db-field-name`, Escape 더티를 같은 순서로 탄다. 커맨드 피커 Escape가 모달까지 닫는지만 따로 본다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #4 Consistency and standards.

21. flexible layout without hiding essential controls
(a) 창을 줄이거나 도킹해도 저장, 닫기, 활성 탭, 검색은 화면 안에 남아야 한다.
(b) 초보 + `database-dock-toggle` + 1024x768에서 탭은 아이콘만 남고 `title`에 의존한다. 가로 스크롤이 생기거나 저장이 접히면 초보자는 모달을 강제 종료한다.
(c) 스크린샷과 Playwright. 초보 도크 1024x768에서 `.database-modal-window`의 `scrollWidth <= clientWidth+1`인지 재고, 보이는 탭 버튼마다 비어 있지 않은 `title`이 있는지 본다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #7 Flexibility and efficiency of use.

22. contextual help at the point of uncertainty
(a) 도움은 헷갈리는 칸 옆에 있어야 한다. 모달 바깥 위키나 일반 토스트만으로는 부족하다.
(b) 도움말 버튼은 `데이터베이스에서 레코드와 시스템 설정을 조정합니다.` 토스트다. `db-field-support-notice`는 아이템/장비에만 있고 접힌 `<details>`다. 스킬 성공률, 상태 부여, 종족 타입처럼 런타임 범위가 다른 칸에는 같은 장치가 없다.
(c) Playwright. 아이템/장비에서 `db-field-support-notice`가 보이는지 본다. 스킬, 상태, 주인공, 시스템에서는 같은 testid가 없는지 기록한다. 도움말 버튼 토스트 문구도 수집한다.
인용: [Nielsen Norman Group, Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) #10 Help and documentation. 로컬 부분 구현은 `databaseFieldSupport.ts`.

23. guided first successful outcome
(a) 첫 방문 초보자가 안내를 따라 의미 있는 결과(주인공 하나, 또는 아이템 하나)를 끝까지 만들 수 있어야 한다.
(b) beginner chrome은 맵 코치마크를 켜지만 자료집 안에는 코치마크가 없다. 공통 6개 탭과 plain 용어만으로는 "첫 주인공을 만들고 테스트한다"는 일이 스스로 닫히지 않는다.
(c) Playwright. 코치마크/웰컴 키를 지운 초보 부팅에서 레일 -> `database-modal` -> `db-tab-actors` -> 추가 -> 이름 입력 -> 저장까지 막히지 않는지 탄다. 중간에 막히면 그 지점을 발견으로 남긴다.
인용: 판단. NN/g #10이 도움의 필요를 말하지만, 첫 성공 한 건을 가이드해야 한다는 기준은 이 감사의 초보자 방향이다.

24. labeled starter/example content
(a) 샘플 레코드는 예제임을 이름이나 배지로 밝혀야 한다. raw id나 빈 이름이 목록을 채우면 안 된다.
(b) `/?freshProject=1`은 빈 프로젝트가 아니라 레거시 샘플 모험이다. 초보자는 그 주인공/아이템을 자기 작품으로 오해하거나, 빈 스위치 칸을 "고장난 줄"로 본다.
(c) 스크린샷. 개요 칩과 주인공/아이템/스위치 목록 첫 화면에서 샘플 표식, 빈 이름, raw id를 센다.
인용: 판단. [RPG Maker MZ, Database](https://rpgmakerofficial.com/product/MZ_help-en/01_08.html)는 샘플 데이터를 전제하지만, 예제 표식 의무는 이 제품 판단이다.

25. realistic novice-task validation
(a) 감사와 제품 검증은 초보가 실제로 하는 일로 통과해야 한다. 필드 단위 왕복만 초록이면 부족하다.
(b) 현실적인 첫 일: 주인공 이름을 바꾸고, 직업을 붙이고, 회복 아이템을 하나 만들고, 적 그룹을 열어 테스트 플레이까지 간다. 그 길이 23개 탭 중 어디서 끊기는지가 초보자 점수다.
(c) Playwright. 초보 레인에서 위 과업을 한 시나리오로 탄다. 각 단계에서 `exportedProject`와 모달 인스턴스를 확인하고, 막힌 칸을 휴리스틱 번호와 함께 기록한다.
인용: 판단. 과업 목록은 초보자 방향에서 정한 감사 기준이며, 외부 표준 문장이 아니다.
