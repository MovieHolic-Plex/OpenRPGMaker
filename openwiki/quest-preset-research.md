# 퀘스트 프리셋: 7개 게임 조사와 실행 가능한 구성

2026-10-01. 목표는 게임 이름만 붙인 프롬프트 목록이 아니라, 반복해서 쓰이는 의뢰 구조를
실제 이벤트·목표·보상·재도전으로 컴파일하는 것이다. 특정 작품의 시나리오나 그림을 복제하지 않는다.

## 조사 근거와 설계 해석

아래의 「프리셋 연결」은 공개 설명에서 도출한 **이 프로젝트의 설계 해석**이다.
작품 전체 퀘스트를 전수 조사했거나 원작의 모든 시스템을 재현했다는 뜻은 아니다.

| 게임 | 공식 자료가 확인하는 특징 | 프리셋 연결 |
|---|---|---|
| [Chrono Trigger — Square Enix의 Steam 소개](https://store.steampowered.com/app/613830/CHRONO_TRIGGER/) | 현재·중세·미래·선사·고대의 시대를 오가는 모험과 미래를 구하는 이야기 | 과거와 미래, 연속 이야기, 현상금 보스, 완료 뒤 세계 변화 |
| [Octopath Traveler II — 공식 상품 소개](https://eu.store.square-enix-games.com/octopath-traveler-ii), [Osvald·Partitio 공식 설명](https://www.square-enix-games.com/ko_KR/news/octopath-traveler-ii-partitio-osvald) | Path Action으로 주민과 싸우거나 물건을 얻고 사람을 데려가는 구조, 정보 수집·전투 후 획득 | 사건 조사, 증언 맞추기, 물품 배달, 동행, 결투, 비용과 전투의 대안 |
| [Stardew Valley — 개발사 1.5 변경 기록](https://www.stardewvalley.net/stardew-valley-1-5-update-full-changelog/) | 다양한 목표와 보상의 Special Orders, 완료 후 영구·일시 세계 변화, 연결된 NPC 퀘스트, 탐험·퍼즐 | 재료 모으기, 제작 의뢰, 반복 의뢰, 교환 사슬, 마을의 변화 |
| [CrossCode — Radical Fish 개발 기록](https://www.radicalfishgames.com/?p=5862) | 주변 환경을 사용하는 퍼즐, 독특한 장치가 있는 퀘스트, 특별한 보스 전투 | 장치 작동, 단서와 수수께끼, 유적 탐사, 연속 전투 |
| [Sea of Stars: Throes of the Watchmaker — Sabotage 공식 자료](https://sabotagestudio.com/presskits/sea-of-stars-throes-of-the-watchmaker/) | 별도의 모험, 새 지역과 던전, 적·보스·퍼즐·미니게임 | 보물 추적, 유적 탐사, 보스 목표, 연속 이야기 |
| [Chained Echoes — 공식 소개](https://www.chainedechoes.com/) | 선택이 주민과 세계의 운명에 영향을 주며, 연결된 세계의 숨은 동굴·마을·던전·부가 퀘스트 탐험 | 선택과 결과, 탐사, 마을의 변화, 선행 의뢰를 요구하는 연속 이야기 |
| [Undertale — 공식 소개](https://undertale.com/about/) | 적을 폭력 없이 해결할 수 있고 대화와 플레이어 선택이 핵심 | 여러 해결 방법, 선택과 결과, 오답·거절 뒤 재시도 |

## 제공 범위

고정 프리셋 27종 + 직접 조합 1종. 목표 원형은 9종이며 최대 12단계를 연결한다.

| 분류 | 구성 |
|---|---|
| 인물과 조사 | 심부름, 사건 조사, 증언 맞추기 |
| 수집과 거래 | 분실물 찾기, 물품 배달, 재료 모으기, 교환 사슬, 제작 의뢰, 반복 의뢰 |
| 탐험과 퍼즐 | 보물 추적, 유적 탐사, 순찰과 답사, 단서와 수수께끼, 장치 작동 |
| 전투와 구조 | 위협 제거, 안전한 동행, 구출과 귀환, 현상금 보스, 연속 전투, 도전과 결투 |
| 선택과 관계 | 여러 해결 방법, 선택과 결과, 동료 영입 |
| 세계와 이야기 | 마을의 변화, 과거와 미래, 시간대 약속, 연속 이야기, 직접 조합 |

코드 정본: `src/project/quest/questPresetIds.ts`(저장 ID), `questPresets.ts`(구조·예시·요청),
`questDef.ts`(DSL), `questValidation.ts`(사전 참조 검사), `questCompiler.ts`(실제 이벤트).
목표는 `talk/collect/kill/reach/inspect/deliver/choice/escort/craft`.

## AI 저작 계약

- `presetId`와 실제 단계 종류·순서가 일치해야 한다. 여러 단계 프리셋은 `order:"sequence"`.
- 직접 조합/수정은 `presetId:"custom"` + `blueprint:[목표 종류,...]`. UI의 단계 편집과 실제 요청이 일치한다.
- `step.label`은 게임의 목표 문구다. 내부 아이템 ID를 사람에게 보이는 목표 이름으로 대신하지 않는다.
- 실제 맵·기존 이벤트·아이템·부대·배우·제작법을 조회한다. 없는 참조, 불가능한 수집 수량, 잘못된 구조는 적용 전에 거절한다.
- `onAcceptItems`는 수락 때 필요한 배달품/제작 재료 지급. 재료 조달이 필요하면 앞에 collect를 직접 조합한다.
- `deliver`는 실제 소지 **수량** 확인 후 소비. `gives`는 교환으로 받을 물품.
- `choice.options`는 오답(`completes:false`), 비용(`cost.gold/items`), 실제 전투(`troopId`), 결과(`effects`)를 지원한다.
  오답은 비용·결과·진행을 변경하지 않는다. 전투는 승리만 완료; 도주·패배는 재도전 가능.
- `escort`는 이름 있는 네이티브 follower를 추가하고 목적지에서 그 동행자만 제거한다.
  이름 기반 followerPresent 조회로 실제 합류와 도착을 확인한다. 동행 상한·이탈 시 완료되지 않고 재합류할 수 있다. NPC는 도착 지점에 남는다. 전투 배우 영입과 동행을 혼동하지 않는다.
- `craft`는 실제 `system.craftRecipes` 제작 명령과 결과 변수를 사용. 재료 부족/잠김/실패는 목표 미완료.
- `repeatable`은 완료 대화에서 다시 수락. 단계·수집원·수집량을 초기화하고 회차별 보상은 보고 때 한 번.
- `requiresQuestKeys`는 이미 존재하는 단계형 퀘스트의 보고 완료를 요구한다.
- `worldChanges`는 보고 뒤 기존 NPC/소품의 조건 페이지를 추가한다. 이동하는 시대는 실제 맵 전환 이벤트도 저작해야 한다.
- `timePhase`는 실제 시간 조건이다. 약속 프리셋은 시간 시스템 활성화 필요; 기다리기/시간 변경 경로도 저작한다.

## 한계와 완료 근거의 구분

「대부분」의 수치를 임의로 붙이지 않는다. 기본 의뢰 구조는 원형을 조합하여 표현하지만,
CrossCode의 물리 공 퍼즐, Sea of Stars의 별도 미니게임, Undertale ACT 전투,
복잡한 생활 시뮬레이션·NPC 일과·여러 동행자의 생존 판정은 해당 게임 규칙을 추가 구현해야 한다.
과거와 미래는 기존 맵 사이 이동과 조건 페이지이며, 엔진에 시간 여행 시뮬레이션을 새로 넣은 것이 아니다.

UI는 AI 작성칸에 요청을 넘긴다. 임의로 전송하지 않는다. 실제 LLM의 응답 품질이나 자동 완주를
도구 실행·인터프리터 확인과 혼동하지 않는다. 증거 정본은 `verify-shots/quest-library/SUMMARY.md`.
SQLite 확인 대상은 작업 전용 QA 저장소이며 사용자 프로젝트를 변경하지 않는다.

실제 플레이 추가 증거는 `verify-shots/quest-play-proof/SUMMARY.md`.
`npm run qa:runtime -- --scenario quest-play-proof`는 기존 생성 이벤트를 출하 플레이어에서
수락·이동·납품·동행·오답/정답 선택·보고하고, 실제 메뉴의 300G와 각 의뢰 완료 목록을 확인한다.
최종 22단계 통과이며 결정 키로 타자기를 완료해 읽을 수 있는 원본 PNG를 남긴다.
이 물리 완주 범위는 배달·동행·수수께끼 세 프리셋이다.

## 재현

워크트리의 `npm run dev:worktree` 서버 주소를 아래 두 스크립트에 전달한다.

```bash
node scripts/qa/quest-library.mjs http://127.0.0.1:9898
node scripts/qa/quest-library-ui.mjs http://127.0.0.1:9898
node scripts/qa/quest-library-persistence.mjs
npm run qa:runtime -- --scenario quest-library
```

전체 gates/vitest/typecheck와 별개인 한정된 화면·저장·출하 플레이어 증거 경로다.
