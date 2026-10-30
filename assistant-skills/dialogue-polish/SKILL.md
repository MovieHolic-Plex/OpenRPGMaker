---
name: dialogue-polish
description: OPRN 공식 윤문 스킬. Use when writing or polishing any player-facing game text in an OPRN game (dialogue, captions, choices, item/skill descriptions, quest log, ending text), Korean or English — the general-good-writing rules by code-yeongyu (코드 연규) applied to game text, plus the lint_dialogue linter. 대사·자막·선택지·아이템 설명을 쓰거나 고칠 때, 번역투·AI 티를 걷어낼 때.
---

# 윤문 (dialogue polish): general-good-writing 을 게임 글에

OPRN 에디터의 공식 윤문 스킬이다. 규칙과 린터는 **general-good-writing**(코드 연규 code-yeongyu, https://github.com/code-yeongyu/general-good-writing, 커밋 eeb868e)에서 왔다.
원본 규칙 문서는 이 스킬의 `references/` 에 고치지 않고 그대로 실었다(아래 「원본 규칙 읽기」). 이 쪽은 그 규칙을 게임 글에 적용하는 지침이고, OPRN 이 「폴른 스타」 1막 대사 전면 개고에서 실제로 쓴 방식을 옮겼다.

원본: 저장소 `assistant-skills/dialogue-polish/SKILL.md`. 편집기 조수는 `read_assistant_skill({id:"dialogue-polish"})` 로 같은 글을 읽는다.
린터는 `src/vendor/general-good-writing/`(출처·수정 내역 README) 에 있고, 조수는 `lint_dialogue` 도구로, 코딩 에이전트는 `node scripts/content/lint-game-text.mts <파일>` 로 돌린다.

## 1. 무엇에 쓰나

플레이어가 읽는 글 전부: 대사, 독백, 자막(오프닝·엔딩·장면 전환 글), 선택지와 질문, 아이템·장비·스킬 설명, 퀘스트 일지 제목·요약·단계, 엔딩 제목·머리말·크레딧, 표지판·책·단말 글.
빼는 것: 개발자 글(로그·경고·`[태그` 로 시작하는 문자열), id, 이벤트·페이지·스위치·변수 이름, 타일 이름표처럼 플레이어가 보지 않는 문자열.

## 2. 프로필과 적용 범위

- 린터 프로필은 **fiction** 이다. 게임 대사·자막·아이템 설명 모두 fiction 으로 돌린다.
- 원본의 블로그·리포트 전용 규칙은 **쓰지 않는다**: 레지스터 표(registers.md), 마크업 허용 범위, 문단 길이, 뼈대(skeleton), 리드(lede), 리듬 지표(sentence_length_cv · short_sentence_share · mid_band_share · long_sentence_share · top_ending_share 같은 「전개/리듬 지표」). 대사 한 상자는 산문 문단이 아니다.
- 대사에 **적용하는** 규칙:
  1. 어휘: 번역투·한자어를 우리말로(`~을 통해`, `~에 있어서`, `~라는 점`, `활용하다`, `구축하다`, `제공하다`…). 원본 `ko/lexical-tells.md` §9 대체표.
  2. 모델 틱: 정리하면, 핵심은 ~다, 즉, 사실상, 애초에, 정직하게, 동조 마커(「정확히 맞습니다」), 청유형 「~해 보죠」. 원본 `ko/README.md` 「보내기 전에 걸리는 다섯 가지」, `ko/lexical-tells.md` §12.
  3. 추상명사 주어: 「침묵이 방을 채웠다」「운명이 그를 불렀다」처럼 추상명사가 동사를 부리면 누가 무엇을 했는지로 쓴다. 원본 `ko/README.md` 「문장은 사건을 말한다」.
  4. 「A가 아니라 B」(부정재정의)와 변형(「~라기보다」「단순한 X를 넘어」): B만 쓴다. 사실 정정만 예외다. `ko/lexical-tells.md` §1.
  5. 서사체 종결 「~였던 겁니다/~는 거죠/~던 거예요」: 「~였습니다」「~였어」로. `ko/lexical-tells.md` §12 `tic-narrative-geobnida`.
  6. 기호: em dash(—)는 쉼표·마침표·말줄임으로, 가운뎃점(·) 나열은 「와/과」나 쉼표로. 콜론 라벨·화살표도 문장으로. `ko/lexical-tells.md` §11.
  7. 은유 명사(축·지점·층·결·경계·자리·뼈대)와 억지 비유, 격언 착지(「X는 바뀐다. Y는 남는다」). `ko/lexical-tells.md` §3·§15·§16.
  8. 설명조: 인물이 상대도 아는 사실을 플레이어에게 들려주려고 늘어놓는 말, 장면 끝 한 줄 요약(「결국 중요한 건…」). `ko/lexical-tells.md` §6.
- 영어 글은 같은 기준을 `en/README.md`·`en/lexical-tells.md`·`en/discourse-tells.md` 로 적용한다.

## 3. 인물 말투가 먼저다

- 규칙보다 인물 말투(화자 말투 메모 `set_speaker_voice`, 프로젝트 문체 규칙 `styleRules`, 사람이 준 말투표)가 이긴다. 해요체 인물의 「~예요」, 아이 말투, 사투리, 일부러 딱딱한 군인·관리 말투는 린터가 걸어도 남긴다.
- 남긴 적중은 **이유를 적는다**(보고나 `rewrite_dialogue` 의 reason 에). 예: 「이리스 해요체 — 『~예요』 유지」, 「집사 서술 말투 — 『~것입니다』 한 번 유지」.
- 원본이 「사람 고유어, 함부로 지우지 말 것」으로 묶은 말(꽤·물론·결국·당연히·생각보다·어쩌면…, `ko/lexical-tells.md` §10)은 밀도를 보고 판단한다. 한 줄에 한 번이면 둔다.

## 4. 바꾸지 않는 것

- **대화창 줄 수.** 한 대사 안의 `\n` 개수(상자 안 줄 수)를 유지한다. 상자당 3줄, 줄당 24자 안팎. 넘치면 `list_dialogue{overflowOnly}` 로 보이는 줄을 다시 맞춘다.
- **검색 키 문자열.** 다른 코드·이벤트가 이 글을 찾아 바꾸는 열쇠로 쓰면 그대로 둔다(빌드 스크립트의 문자열 치환, `replaceLine`·`findLine` 같은 함수 인자, 퀴즈 정답·암호처럼 조건이 비교하는 글). 코딩 에이전트는 바꾸기 전에 `grep -rn` 으로 그 문자열이 다른 곳에서 쓰이는지 확인한다. 조수는 `find_events` 로 같은 글을 쓰는 조건·스크립트가 있는지 본다.
- **자리표시자·제어 코드.** `\C[n]` `\N[n]` `\.` `[흔들]…[/]` `{name}` 은 바이트 그대로.
- **숫자·단서·고유명사.** 수수께끼 단서, 아이템 이름, 지명, 인물 이름, 호칭.
- **화자 이름과 이벤트 구조.** 줄 앞에 「이름: 」을 붙이지 않는다(화자 칸이 따로 있다).

## 5. 흐름

### 편집기 조수만

1. 이 스킬을 한 번 읽는다(`read_assistant_skill({id:"dialogue-polish"})`). 원본 규칙 표가 필요하면 `part` 로 그 문서만 읽는다(6절).
2. 고칠 글을 읽는다: 장면이면 `get_story_outline` → `read_story_script`, 한 인물·넘치는 줄이면 `list_dialogue`.
3. 고치기 전 줄을 `lint_dialogue({lineIds:[…]})` 또는 `lint_dialogue({mapId})` 로 검사해 적중 수를 본다.
4. 고친 글을 `lint_dialogue({texts:[…]})` 로 다시 검사한다. 번역투·모델틱·부정재정의·은유명사·기호·서사체 종결 적중을 0 으로 만든다. 3절 예외로 남긴 것은 이유를 적는다.
5. `rewrite_dialogue` 로 낸다(기본 제안, 사용자가 「대사」 탭에서 받는다). 보고에 전/후 적중 수와 남긴 적중의 이유를 쓴다.
6. 새로 쓰는 대사(`place_npc`·`script_cutscene`·`upsert_event` 의 글)도 쓰기 전에 문장을 이 규칙으로 쓰고, 쓴 뒤 `lint_dialogue({texts})` 로 확인한다.

### 코딩 에이전트만

1. 바꿀 줄 묶음과 바꾼 줄 묶음을 한 줄에 한 대사(`\n` 은 공백)로 `.txt` 두 개에 쓴다.
2. `node scripts/content/lint-game-text.mts <파일> [fiction]` 로 돌린다(판정 모델 없이 로컬 규칙만, 키·네트워크 없음).
3. 「문장 단위 목록」에서 번역투·모델틱·은유명사·기호·서사체 종결 적중을 0 으로 만든다. 리듬·문단 지표는 무시한다. 전/후 적중 수를 보고에 적는다.
4. 소스 문자열을 바꿀 때는 검색 키를 `grep -rn` 으로 먼저 확인한다(4절).

## 6. 원본 규칙 읽기

`read_assistant_skill({id:"dialogue-polish", part:"<이름>"})` 로 한 문서씩 읽는다(6000자 쪽, nextOffset 으로 이어 읽는다). 원본 문장 그대로다.

| part | 원본 경로 | 언제 |
|---|---|---|
| `ko/README` | references/ko/README.md | 한국어로 **쓸 때** 구속력. 먼저 읽는다 |
| `ko/guide` | references/ko/guide.md | 한국어 초안을 **고칠 때** 구속력 |
| `ko/lexical-tells` | references/ko/lexical-tells.md | 번역투·모델 틱 어휘 목록과 근거 수치 |
| `ko/discourse-tells` | references/ko/discourse-tells.md | 전개 단위 티(장면 끝 요약, 같은 말 반복) |
| `en/README` | references/en/README.md | 영어로 쓸 때 |
| `en/lexical-tells` | references/en/lexical-tells.md | 영어 어휘 티 |
| `en/discourse-tells` | references/en/discourse-tells.md | 영어 전개 티 |

원본은 블로그·에세이·리포트·메시지용으로 쓰였다. 거기서 말하는 레지스터·마크업·문단·뼈대·리듬 규칙은 2절대로 게임 글에는 쓰지 않는다. 원본 문서가 가리키는 다른 파일(`../registers.md`, `skeleton.md`, `per-model.md`)과 `scripts/polish-lint.ts` 명령은 이 저장소에 없다. 린터는 위 두 경로로 부른다.

## 7. 크레딧

general-good-writing: 코드 연규(code-yeongyu), https://github.com/code-yeongyu/general-good-writing. 규칙 문서와 polish-lint 린터(정규식 규칙)를 가져왔다. 판정 모델(Jev, TypeSafe API) 층은 쓰지 않는다.
