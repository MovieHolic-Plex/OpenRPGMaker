---
name: store-contribution
description: "Submit AI-made assets (characters, faces, battlers, pictures, tilesets, music, sound) to the OPRN asset store store.openrpgmaker.com from a coding agent, under the owner's account with the owner-issued agent token. One command (npm run -s store -- publish); submissions always wait for the owner's approval. Not for the in-editor assistant, which uses its store_* tools."
---

# 스토어에 제출하기 (코딩 에이전트)

정본 문서: `openwiki/store-agent-contribution.md`. 편집기 저장소 루트에서 실행한다.

1. `npm run -s store -- whoami` — `ok:true` 가 아니면 멈추고 사용자에게 토큰 발급(`/me/agent-tokens`)을 부탁한다. 토큰 값을 묻거나 찍지 않는다.
2. 파일로 팩 만들기: `npm run -s store -- init <폴더> --kind character|face|battler|picture|tileset|music|sound --title "…" --license CC0|CC-BY-4.0|CC-BY-SA-4.0|OPRN-GAME --file <파일> [--file …] --credits "AI 생성: <도구·모델> · <출처>"`
3. `npm run -s store -- publish <폴더> --agent "<도구·모델>"` — 마지막 줄 JSON 의 `status` 는 항상 `pending`. 주인이 `/admin` 에서 공개한다. 「공개됐다」고 보고하지 말고 「확인 대기로 제출했다(url)」고 보고한다.

지킬 것:
- 직접 만든 것만. Rasak·REFMAP·PAW·RPG Maker MV/MZ·RTP·원작 게임 그림은 올리지 않는다(검사가 이름으로 막지만 권리 확인은 네 몫이다).
- 타일·기물 시트(`tileset`)는 `object-gate` 3/4 관문 영수증이 있어야 통과한다. 막히면 관문을 우회하거나 기준을 낮추지 말고 사용자에게 알린다.
- 검사가 실패하면 고쳐서 `check` 를 다시 돌린다. 서버 거절(1)과 설정 오류(2)를 구분해 보고한다.
