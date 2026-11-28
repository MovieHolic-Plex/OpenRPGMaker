# easyrpg-charset — EasyRPG 24×32 캐릭터 배치·2단계 관문 하네스 (`Carbon` · `Fable` 전용)

공식 EasyRPG RTP 2등신(`24×32`, 1인 `72×128`, 시트 `288×256` 8인) 보행 골격 위에 **`Carbon` (`gemini-4-carbon`)** 또는 **`Fable` (`fable` 계열)** 도트 저작과 **2단계 SHA-256 잠금 관문**을 결합해 고품질 판타지·마을·직업 캐릭터칩을 양산하고 에디터 기본 세트(`FantasyPeople1~25`, 200종)를 유지보수하는 정식 하네스다.

- 하네스 매니페스트: `src/harnesses/easyrpg-charset/harness.ts` (`RECOMMENDED_CHARSET_LLMS`, `isRecommendedCharsetLlm`, `charsetLlmWarning`)
- CLI 실행기: `src/harnesses/easyrpg-charset/node/cli.ts` (`npm run harness -- easyrpg-charset <단계>`)
- 내부 스킬 정본: `assistant-skills/easyrpg-charset-batch/SKILL.md` (`.agents/skills/easyrpg-charset-batch` 심링크 및 에디터 조수 `src/assets/assistantSkills.json` 공용)
- 시드·정책 정의: `harness-data/easyrpg-charset/seed.json`
- 에디터 기본 세트 정본(200종): `harness-data/charset-actor/fantasy-people-picks/` + `harness-data/charset-actor/fantasy-people-install.json` → `public/assets/generated/charsets/FantasyPeople{1..25}.png` + `src/assets/fantasyPeopleCharsets.json`

## 1. 권장 LLM 제한 및 비권장 모델 경고 (필수 계약)

> **권장 LLM은 `Carbon`(`gemini-4-carbon` 계열)과 `Fable`(`fable` 계열) 단 두 계열뿐이다. 이외의 LLM에서는 잘 작동하지 않는다!**

`24×32` 격자에서 눈은 `1×2px`, 목 수축 줄(`ey+3`)은 `1px` 높이에 불과하다. 실측 결과 일반 범용/경량 LLM은 아래 결함을 반복 발생시켜 관문을 통과하지 못한다:
1. 정면/뒷모습 보행 `0·1·2`에서 뒤로 빠진 손을 진갈색으로 칠하거나 좌우 소매 색을 걸음마다 뒤바꾸는 **소매·손 점멸 오류**
2. 옆모습(`RIGHT`·`LEFT`)에서 귀·볼살(`C` 구역)을 머리카락으로 덮어 눈알만 돌출되거나 등 뒤로 `3~4px` 대왕주먹이 튀어나오는 **비례 붕괴**
3. `y=18`(`ey+3`) 목/옷깃 줄에 `14px` 이상 코트·갑옷 어깨를 바로 붙여 목이 사라지는 **거북목(목 실종) 실루엣**
4. `x=11.5` 중심축에서 몸통·치마가 `1~2px` 한쪽으로 쏠리는 **비대칭 왜곡**

따라서 하네스 CLI(`charsetLlmWarning`)와 `easyrpg_batch.py`(`check_and_warn_llm`), 내부 스킬(`SKILL.md`) 모두 `Carbon`·`Fable` 이외의 모델이 지정되면 즉시 경고를 출력하며(`--strict` 옵션 시 종료 코드 `2`로 차단), 에이전트·조수는 다른 모델 환경에서 반드시 사용자에게 이 경고를 먼저 고지해야 한다.

```bash
# 권장 LLM 여부 사전 점검 (--strict 시 비권장 모델이면 exit 2)
npm run harness -- easyrpg-charset check-model gemini-4-carbon
npm run harness -- easyrpg-charset check-model fable-5-2
npm run harness -- easyrpg-charset check-model gpt-4o --strict   # 경고 출력 + exit 2
```

## 2. 표준 실행 단계 (`seed → 저작 → verify → qa-prep → 독립 검수 → qa-verdict → pack → install`)

```bash
# 1) batch.json 시드에서 슬롯별 격리 작업장 + RTP 교본 + prompt.md 생성
npm run harness -- easyrpg-charset seed --spec <out_dir>/batch.json --out <out_dir> --model gemini-4-carbon

# 2) Carbon 또는 Fable 병렬 서브에이전트가 각 <slot>/out.chr.txt 저작 후 단일 슬롯 자가검증
npm run harness -- easyrpg-charset doll-check --dir <out_dir>/<NN>_<id>

# 3) 배치 전체 1단계 기계 관문 일괄 확인 (views/gate.json 에 chr_sha256 기록)
npm run harness -- easyrpg-charset verify --out <out_dir>

# 4) 2단계 독립 적대적 시각 QA용 5배 12프레임 전수 + 1x/2x 보드 및 검수관 프롬프트 생성
npm run harness -- easyrpg-charset qa-prep --out <out_dir>

# 5) 저작 워커가 아닌 읽기 전용 독립 검수 에이전트(research/review) 판정을 SHA-256으로 잠금 기록
npm run harness -- easyrpg-charset qa-verdict --dir <out_dir>/<NN>_<id> --verdict PASS --by <critic_id> --notes "..."

# 6) 1·2단계 해시가 모두 일치하는 슬롯만 RM2000 288×256 시트 + 잔디 보행 GIF로 패킹
npm run harness -- easyrpg-charset pack --out <out_dir>

# 7) 에디터 기본 세트(FantasyPeople1~25, 200종) 바이트 일치 확인 또는 사용자 승인분 증설 굽기
npm run harness -- easyrpg-charset install --check
```

## 3. 에디터 기본 세트 (`FantasyPeople1~25`, 200종) 편입 구조

- **기본 세트 우선 배치**: `src/assets/charsetCatalog.ts` 의 `CHARSET_ASSETS` 에서 `EASYRPG_CHARSET_ASSETS` 바로 다음에 `FANTASY_PEOPLE_CHARSET_ASSETS`(25시트 × 8칸 = 200명)가 위치한다.
- **새 프로젝트 & 기존 프로젝트 자동 동기화**: `src/project/defaults/defaultAssets.ts` 의 `defaultResourceProfiles()` 와 `ensureBundledResourceProfiles()` 가 모든 새 프로젝트와 기존 프로젝트에 `FantasyPeople1~25` 리소스 프로필을 기본 등록하며, 은퇴한 `RefmapDoll` 리소스 프로필(`isRetiredResourceId`)은 로드 시 자동 정리한다.
- **슬롯 번호 불변(덧붙이기 전용)**: 이미 설치된 `FantasyPeople1#0` … `FantasyPeople25#7`(200명)의 시트·칸 번호는 절대 당기거나 재배열하지 않는다. 추가분은 `FantasyPeople26#0` 부터 덧붙인다.
- **내부 조수 스킬 동기화**: `assistant-skills/easyrpg-charset-batch/SKILL.md` 또는 `references/base-catalog.md` 를 수정한 뒤에는 반드시 `node scripts/content/bundle-assistant-skills.mjs` 로 `src/assets/assistantSkills.json` · `src/assets/assistantSkillParts.json` 을 다시 굽는다 (`--check` 로 일치 검증).
