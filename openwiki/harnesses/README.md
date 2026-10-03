# 하네스 구조 규칙

하네스 = 사람이 손으로 하던 생성 작업(그림·맵·데이터)을 **시드 → 단계 → 후보 → 사람 선택 → 검사 → 결과물**로 고정한 것.
에디터에 하네스를 계속 늘릴 것이므로 **하네스 하나 = 폴더 하나**로 둔다. 목록은 `src/harnesses/INDEX.md`(생성 파일).

## 위치 (저장소 루트 기준)

| 용도 | 경로 | 커밋 |
|---|---|---|
| 공통 골격 (매니페스트 형식·레지스트리·목록 생성) | `src/harnesses/_core/` | 예 |
| 하네스 코드 | `src/harnesses/<id>/` | 예 |
| 하네스 정의 (가벼움, 레지스트리가 읽음) | `src/harnesses/<id>/harness.ts` | 예 |
| 노드 전용 코드 (파일·이미지 서버·CLI) | `src/harnesses/<id>/node/` | 예 |
| 시드·진행 기록·출처 | `harness-data/<id>/` | 예 |
| 번들 결과물 (런타임이 읽음) | `public/assets/harnesses/<id>/` | 예 |
| 실행 산출물 (후보 원본·비교 시트) | `qa-runs/harnesses/<id>/` | 아니오 (gitignore) |
| 문서 | `openwiki/harnesses/<id>.md` | 예 |

실행은 하나로 통일한다.

```bash
npm run harness -- list                 # src/harnesses/INDEX.md 다시 쓰기 (--check 로 낡았는지 검사)
npm run harness -- <id> <단계> [옵션]    # src/harnesses/<id>/node/cli.ts 로 넘긴다
```

## 규칙

1. **새 하네스는 레지스트리 한 줄 + INDEX 재생성 + AGENTS.md 「하네스」 절 한 줄.** `src/harnesses/_core/registry.ts` 의 `HARNESSES` 에 더하고 `npm run harness -- list` 를 돌린다.
2. **범위는 매니페스트에 선언한다.** `scope.genre` 가 있으면 그 장르 프로젝트에서만 쓰인다(`harnessesForGenre`). 장르 전용 하네스를 일반 경로와 섞지 않는다 — 예: 몬스터 수집 종 스프라이트는 JRPG 적 그림 생성(`src/editor/aiDatabaseGeneration.ts`)과 별개다.
3. **브라우저·노드 공용 코드는 `node/` 밖에, 노드 전용은 `node/` 안에.** 앱 tsconfig(`tsconfig.json`, `tsconfig.app.json`)는 `src/harnesses/*/node` 를 뺀다. 노드 쪽 타입 검사는 `npx tsc -p src/harnesses/tsconfig.node.json`. 에디터·조수 쪽 입구는 같은 공용 코드를 부른다.
4. **에디터 코어는 하네스 폴더를 직접 import 하지 않는다.** 레지스트리로 찾는다.
5. **시드는 사람이 쓰고, 진행 기록(ledger)은 하네스가 쓴다.** 둘 다 `harness-data/<id>/` 에 커밋한다. 고른 결과의 출처(원본 해시·프롬프트·가공 전 중간물)를 남겨, 다른 에이전트가 같은 지점에서 이어받게 한다. 큰 생성 원본은 커밋하지 않고 해시만 남긴다.
6. **공용으로 올리는 건 두 번째 사용자가 생길 때.** 처음엔 하네스 안에 둔다. 다른 하네스가 같은 걸 쓰게 되면 `_core` 로 올린다.
7. **매니페스트의 `entrypoints` 는 정직하게.** 아직 없는 에디터 화면·조수 도구를 true 로 적지 않는다. INDEX 에 그대로 나간다.

## 기존 것과의 관계 (2026-10-01 실측)

새 규칙 이전의 생성 하네스는 `src/editor/roomHarness/`(실내·던전 방 세션, 자체 레지스트리)뿐이다. 이름만 하네스인
`src/editor/harnessSuggestion/`(구조 키트 제안 UI), `src/project/tilesetHarness/`(타일셋 그룹 데이터)는 생성 하네스가 아니다.
`scripts/content/` 244개는 공용 장소를 만든 작업 기록이다. 지금은 옮기지 않는다 — 그 영역을 고칠 때 이 구조로 옮긴다.

## 하네스 목록

- [monster-collect-species](monster-collect-species.md) — 몬스터 수집(포켓몬류) 종 앞·뒤 전투 스프라이트
- [jp-city](jp-city.md) — 일본 도시 칩셋(jp_city · modern3) 주택가·역·공원·신사 그림 후보
- [joseon-baram](joseon-baram.md) — 조선(바람의나라풍) 칩셋 joseon_baram 조각 관문·판정·지도 관문·재굽기·16구역 적대 검수 (기존 도구를 한 입구로)
