# 코딩 에이전트의 스토어 제출

코딩 에이전트(Claude Code 서브에이전트·omp·Codex 등)가 만든 그림·소리를 **주인 계정 이름으로**
`store.openrpgmaker.com` 에 제출하는 길이다. 명령 하나, 토큰 파일 하나, 승인은 사람이 한다.
서버 쪽 구현은 비공개 저장소 `OpenRPGMaker-store` PR #6(`scope='agent'` 토큰, `migrations/008_agent_tokens.sql`).
편집기 안 AI 조수는 이 길이 아니라 `store_*` 도구를 쓴다(`openwiki/asset-store.md`).

## 한 줄 요약

```bash
npm run -s store -- whoami                                  # 토큰·계정 확인
npm run -s store -- init /tmp/my-pack --kind character --title "숲 사냥꾼 4인" --license CC-BY-4.0 \
  --file hunters.png --tags 숲,사냥꾼 --credits "AI 생성: claude-code opus-5.5 · 손 도트"
npm run -s store -- publish /tmp/my-pack --agent "claude-code opus-5.5"   # 검사 → 올리기 → 확인 대기
```

마지막 줄은 한 줄 JSON(`{"ok":true,"slug":…,"status":"pending","url":…}`)이다. 종료 코드 0 성공 · 1 검사/서버 거절 · 2 사용법/설정.

## 명령 (`scripts/store/agentStore.mts`)

| 명령 | 하는 일 |
|---|---|
| `whoami` | 토큰 파일(권한 600 확인)·계정·토큰 라벨을 보여 준다. 토큰 값은 찍지 않는다. |
| `init <폴더> --kind K --title T --license L --method M --engine E [--model X] --file F [--file F2…] [--summary --description --tags a,b --credits]` | 파일로 팩 폴더(`manifest.json` + `blobs/<sha256>`)를 만들고 바로 `check` 한다. K = `character`(288×256 캐릭터 시트)·`face`·`battler`(144×384)·`picture`·`tileset`(16px 배수)·`music`·`sound`. 여러 종류를 섞은 팩은 `manifest.json` 을 직접 쓴다(형식 `src/assetStore/format.ts`). |
| `check <폴더>` | 올리기 전 검사만. 아래 「검사」 전부. |
| `publish <폴더> [--draft]` | 검사 → 없는 파일만 올리기 → 새 상품 제출. `--draft` 는 써도 되고 안 써도 같다(제출은 항상 확인 대기). |
| `version <slug> <폴더>` | **에이전트가 제출한** 내 상품에 새 판본. 사람이 올린 상품에는 못 올린다(서버 403). |
| `mine` | 내 계정 상품과 상태, 제출한 에이전트. |
| `preview <폴더> [--scene out.png]` | **제출 전 일회용 미리보기.** 내용 검사(3/4 관문은 빼고) → 파일 올리기 → 스토어 비공개 미리보기. 결과 `previewUrl`(상품 화면 모습, 주인이 브라우저에서도 연다)·`sceneUrl`(480×270 게임 장면, 크기 비교 캐릭터 옆). `--scene` 이면 장면 PNG(×2)를 받아 저장한다. 미리보기 id 는 팩 폴더 `.scratch.json`(권한 600). 나만 보고, 24시간 뒤 지워지며, 목록·운영 대기열에 안 나온다. |
| `submit <폴더> [--slug <내 상품>]` | 그 미리보기를 제출. 미리보기 뒤 `manifest.json` 이 바뀌었으면 거절(다시 preview). **3/4 관문을 포함한 검사를 다시 하고** 통과해야 보낸다. `--slug` 면 그 상품의 새 판본. |
| `discard <폴더>` | 미리보기 버리기. |

공통: `--base <주소>`(또는 `OPRN_STORE_URL`, 기본 운영), `--agent "<도구·모델>"`(또는 `OPRN_AGENT`) — 서버에 `x-oprn-agent` 로 가서 토큰 라벨 뒤에 붙는다.

## 검사 (보내기 전에 로컬에서, 하나라도 걸리면 아무것도 보내지 않는다)

- 형식: `validateManifest`(서버와 같은 계약 파일), blob 해시·크기·실제 형식(시그니처)이 매니페스트와 같은가.
- 그림 규격: `storeImageSizeProblem` — 캐릭터 288×256, 전투 144×384, 타일셋 16의 배수.
- **만든 방법(2026-10-20 감독 결정, AI 표시는 정확해야 한다):** 에셋마다 `content.assets[id].generation = {method, engine, model?}`, 캐릭터마다 `content.characters[i].generation`(칩+초상이면 `mixed`) — 실제로 돌린 것 그대로.
  `generative-model`(생성 모델이 만듦, `model` 필수) · `procedural`(스크립트 색 바꾸기·조각 합성뿐, `model` 없음) · `mixed`(둘 다, `model` 필수). `engine` = 돌린 도구.
  상품 표시(`storePackGeneration`): 생성 모델·섞음이 하나라도 있거나 방법을 안 밝힌 에셋이 있으면 「AI 생성」, 전부 procedural 이면 「스크립트 생성」. `aiGenerated` 는 그 표시와 같아야 한다(다르면 형식 오류).
  아무 데도 방법을 밝히지 않으면 예전처럼 에이전트 제출은 `aiGenerated: true` 여야 한다(서버 422 `agent_ai_required`). 에이전트 제출은 방법과 상관없이 「만든 에이전트」 표시와 주인 승인이 붙는다. `init` 은 `--method`·`--engine` 이 필수다.
- **크레딧:** 비면 거절 — 만든 에이전트·모델과 출처를 적는다. 맨 낱말 「RTP」는 계속 거절한다 — EasyRPG 출처는 「EasyRPG project contributors, CC BY 4.0」 로 적는다.
- **타사 소재:** Rasak·REFMAP·PAW·RPG Maker MV/MZ·RTP 이름이 제목·태그·크레딧·에셋/타일셋 id·이름·이식 원본에 있으면 거절(`storeThirdPartyName`, 서버도 누구에게서나 거절).
- **3/4 관문(AGENTS.md hard rule):** `chipset`·`tileset` 그림은 시트의 비지 않은 16px 칸이 전부 `object-gate` 의 **store 출구를 통과한 영수증 칸**(또는 기준선)이어야 한다(`src/harnesses/object-gate/node/cells.ts`).
  2026-10-20 현재 판정 프로필이 보정되지 않아(`npm run harness -- object-gate status`) **새 타일·기물 시트는 모두 막힌다.** 이것은 정상이다 — 관문을 건너뛰거나 기준을 낮추지 말고, 사용자에게 알린다.
  캐릭터·얼굴·전투 그림·그림(picture)·소리는 맵 기물이 아니므로 이 관문 대상이 아니다(맵에 놓일 기물이면 `tileset` 으로 올려 관문을 받는다).

서버는 그 위에 보류 낱말(검열 1단계), 다른 작가 파일 재사용 거절, 그림 규격을 한 번 더 본다.

## 승인 흐름

1. 에이전트 제출은 작가(주인)가 운영자여도 **항상 `pending`** 이다. 목록·검색에 보이지 않고 주인·운영자만 열 수 있다.
2. 주인은 스토어 「내 에이전트 제출」(`/me/agent`)에서 후보 묶음이면 하나를 고르고(에이전트가 고른 것만 담은 최종 판본을 다시 낸다), 최종 판본을 승인하거나 버린다.
   운영자는 주인 승인 전의 에이전트 제출물을 공개할 수 없다(409). 3/4 관문 보정 전에는 주인 승인 뒤에도 운영자가 `/admin` 에서 한 번 더 공개한다(스토어 `STORE_AGENT_OWNER_APPROVAL_ONLY` 꺼짐).
   확인 전 초안도 주인 자신의 에디터에서는 「에디터에서 초안으로 열기」(`oprn://store/install`)로 받아 쓸 수 있다 — 남에게는 안 보인다.
3. 공개된 상품 화면에는 「만든 에이전트」 칸과 「AI 생성」 표시가 남는다.
4. 에이전트가 새 판본을 올리면 그 상품은 다시 확인 대기로 돌아간다.

사람(주인)이 브라우저·기기 코드 로그인으로 올린 상품은 예전처럼 운영자면 바로 공개다 — 이 규칙은 에이전트 토큰에만 걸린다.

## 토큰과 보안

- 발급·끊기: 주인이 스토어에 로그인 → 「내 상품」 → 「에이전트 토큰」(`/me/agent-tokens`). 라벨 = 에이전트 이름(예 `claude-code/opus-5.5`), 1~365일(기본 90). 비밀값은 만든 직후 **한 번만** 보인다.
  서버 셸 발급(비밀값을 화면에 찍지 않고 파일로)은 스토어 저장소 `deploy/README.md` 「에이전트 제출 토큰」.
- 저장 위치(이 기계의 에이전트가 읽는 곳): `~/.config/oprn-store/agent-token`(운영), 다른 주소는 `~/.config/oprn-store/agent-token.<호스트>_<포트>`
  (스테이징 `agent-token.mdc-server_18320`), 또는 `OPRN_STORE_AGENT_TOKEN_FILE`. **권한 600 이 아니면 명령이 거절한다.**
  `umask 077; mkdir -p ~/.config/oprn-store; cat > ~/.config/oprn-store/agent-token` 으로 붙여 넣는다.
- 기기 코드 발급: 스토어 `/make` 의 `tile-gen login`(또는 `POST /api/v1/device/code {scope:"agent"}`) → 주인이 브라우저에서 허락 → 90일 에이전트 토큰.
- 토큰이 할 수 있는 것: `GET /api/v1/me`, 파일 확인·올리기, 상품 만들기, 에이전트가 제출한 상품의 판본, 일회용 미리보기(만들기·보기·제출·버리기, 계정마다 살아 있는 것 10개·시간당 30개). **못 하는 것:** 공개·숨기기·운영 화면·기기 코드 허락·낱장 올리기·토큰 발급.
- 한도: 토큰마다 시간당 제출 20·업로드 256MB, 계정마다 확인 안 된 에이전트 제출 30개(넘으면 429 — 주인이 확인해야 더 받는다).
- 토큰 값을 출력·로그·커밋·채팅에 넣지 않는다. 의심되면 `/me/agent-tokens` 에서 끊는다(즉시 401).

## 2026-10-20 현황

- 운영·스테이징 모두 서버 `09b7fc9993` 배포, 운영 `/healthz` 200.
- 이 기계(mdc-server)에 운영 토큰 `mdc-server coding agents`(90일)와 스테이징 시험 토큰(7일)이 설치돼 있다.
- 스테이징에서 `init → publish → pending → 에이전트 승인 시도 403 → 주인 공개 → 「만든 에이전트」 표시` 를 확인했고 시험 상품은 지웠다.
- 스토어 #8(`141618c883`, 스테이징만): `/make`·기기 코드 에이전트 토큰·`/me/agent` 고르기/승인·일회용 미리보기. 이 저장소의 `preview`·`submit`·`discard` 를 로컬 스토어에서 확인했다(타일 팩은 submit 에서 3/4 관문에 막힘 = 정상, 캐릭터 팩은 pending 제출, discard 후 `.scratch.json` 삭제).
