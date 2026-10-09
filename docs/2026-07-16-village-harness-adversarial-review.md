# 마을 건설 하네스 적대적 리뷰 (2026-07-16)

가설: **"마을 건설을 하는 하네싱이 부족하다."**

리뷰 방식: 4개 축(빌더 무결성 / 평가·감사 사각지대 / 세션 루프 vs 던전룸 / 테스트·스크립트) 병렬 적대 리뷰 → 교차 검증. 모든 발견은 코드 라인으로 확인했고, 추정은 별도 표기. 치명 2건(F1, F5)은 팀장이 원본 코드로 재확인.

## 판정

**부분 성립.** 부족한 것은 하네스의 "양"이 아니라 **심판의 독립성과 실패의 강제력**이다.

- **기각되는 부분**: 시공·세션 구조 자체는 리포 최상급이다. 레이어 순차 게이트, 턴 예산, 세션 영속·재개, 도달성 critique, 룩 게이트 + `feedbackForLlm`, 결정론(seed 주입, `Math.random`/`Date.now` 0건), Option B 준수(`paintHouseShellWalls`/257 재도입 없음), 07-08 도로-문 파괴 버그 계보 수리 완료. 비교 기준으로 삼았던 dungeon-room-v1은 오히려 게이트·검증·세션이 전무한 원샷 스탬프라서 "던전 대비 부족"은 성립하지 않는다.
- **성립하는 부분**: ① 심판(평가기·감사·테스트)이 전부 피고(빌더)의 자기신고 데이터를 믿는 공통모드 구조, ② 실패가 거의 전부 warning으로 강등되어 깨진 마을도 "성공"으로 반환, ③ 파이프라인 재시도가 프로젝트 전 맵을 삭제, ④ 오늘 네트워크 없이 돌릴 수 있는 정본 하네스 명령·agentic eval·Visual QA가 0.

---

## 치명

### F1. 파이프라인 재시도가 프로젝트 전 맵 삭제 (교차 확인 2회 + 직접 재확인)
- `src/editor/tools/villageBuilder.ts:1301` — `run_village_pipeline` attempt>1 시 `wipeProjectMaps(draft)`.
- `villageBuilder.ts:1385-1391` — mapId 필터 없이 `draft.maps = {}` + mapTree 리셋 + startMapId 초기화. **마을과 무관한 기존 던전·실내 맵 포함 전부 소실.**
- 시나리오: 기존 맵 5개 프로젝트에서 파이프라인 실행 → attempt 1 룩 실패 → attempt 2 진입 순간 전 맵 소실. 이후 "성공" 응답 가능.

### F2. 자연 품질 검사 전체가 빌더가 쓴 메타데이터 한 필드에 게이팅
- `src/editor/tools/villageEvaluate.ts:126` — `layoutPlan?.kind === "village-harness-natural-v2"`일 때만 고아 문·출구·집 형태·NPC 일정·도로 직선 run 등 10여 종 검사 실행. 수작업/구버전/외부 스크립트 맵은 전부 스킵하고 look 점수만으로 PASS.
- 같은 계열: `villageEvaluate.ts:128-131,585` — shape/kit/multistory 목표를 layoutPlan **태그(자기신고)** 에서 읽음. 타일에 지붕이 없어도 태그만 있으면 다층 집으로 집계.

### F3. 도달성 검사의 대상 좌표를 빌더가 공급 — 문 0개면 검사 자체가 안 돎
- `villageBuilder.ts:1324-1330` — doorFronts는 빌더가 믿는 문 앞 좌표. 실제 문 타일이 이후 파괴돼도 무관.
- `villageEvaluate.ts:106` + `villageSession.ts:854-856` — doorFronts 빈 배열이면 구조 게이트 스킵 / critique "start만 존재로 통과". **집 0채 맵이 구조 검사 무실행으로 PASS.**

### F4. 수역이 이미 지은 집을 침수시킬 수 있음 (시공 순서 + 마스크 불완전)
- `villageBuilder.ts:817-823` — 터레인 패스(물)가 집·길·울타리 **이후** 실행.
- `src/editor/tools/villageTerrainPass.ts:59-73` — 강+호수 테마에서 buildable이 강 스트립만 제외, lakeRect 미제외 → 집 후보가 호수 자리에 배치 가능 → `fill_region` 물이 집 벽·지붕을 덮음. `restoreHouseDoors`는 문 2타일만 복구 → 물 위에 문짝만 뜬 집. audit은 길 침범만 봐서 미검출, 툴은 성공 반환.

### F5. settlement 레이어만 무검증 done (직접 재확인)
- `src/editor/tools/villageSession.ts:504-508` — water/forest/critique/look은 전부 `verifyLayer` 게이트가 있는데 settlement만 build_village 호출 후 무조건 `status="done"`. `verifyLayer("settlement")`(1041-1044)는 선택적 read 툴로만 도달.
- F3과 연쇄: 빈 settlement → critique 트리비얼 통과 → look까지 직행.

### F6. CI 스위트에 라이브 LegacyDb 저작 스크립트가 테스트로 위장
- `test/lakeVillageRebuildFinal.test.ts:23-30,50-57,644-653` — `.env.local` 직독(없으면 즉사) + `saveProjectToLegacyDb` 라이브 업서트 assert + evidence 파일 쓰기. `vitest.config.ts:13` include에 포함 → 클린 체크아웃/CI 무조건 빨강, 로컬에선 **테스트 실행마다 원격 공유 프로젝트 덮어씀.**

---

## 높음

| # | 위치 | 결함 |
|---|---|---|
| H1 | `villageTerrainPass.ts:122-124,273-287` | 랜드마크 시공 실패 전부 warning 삼킴 — "강촌"인데 물 0칸이어도 성공. 실패해도 notes에는 물을 깐 것으로 기록(무조건 push). 성공 반환값도 실측 아닌 `w*h*0.7` 추정치 |
| H2 | `villageBuilder.ts:1892-1894,841-842` | 집 스탬프 전부 실패해도 houses=[] 성공 summary. "집 수 미달" warning뿐 — warning 안 읽는 에이전트에겐 침묵 저하 |
| H3 | `src/editor/tools/villagePlan.ts:309-312` | plan→build 인자 변환에서 `ownerName`/program 유실 — "어부의 집"이 "민재의 집"으로. 에러 없음 |
| H4 | `villageBuilder.ts:778-781` | 기존 mapId 재시공 시 이전 시공물 미정리 — 유령 마을 중첩, 옛 문을 새 길이 덮을 수 있음 |
| H5 | `villageEvaluate.ts:625-632` | 출구 검사 = 앵커 좌표 타일 1칸 존재 확인. 고립된 길 조각 4칸이면 4/4 통과. 문앞→맵 밖 연결은 어디서도 안 봄 |
| H6 | `src/project/lint/reachability.ts:2,54-62` | 도달성 BFS가 이벤트·소품 무시 + 인접 도달 허용 — NPC가 초크포인트 점유, NPC가 물 안에 갇힘, 문 앞 통행불가 소품 전부 통과 |
| H7 | villageEvaluate 전체 | 실내 맵/워프 타깃 검증 0건 — 문 8개 전부 허공 워프여도 만점. 오토타일 이음새·벽 파손 검사도 전무(07-15 벽 프레임 회귀류는 100% 통과) |
| H8 | `docs/knowledge/2026-07-08-village-loop-grading.md:12` | 채점 기록이 근거로 인용한 `audit-village.cjs`가 **리포에 존재하지 않음** — 감사 스크립트 유실/미커밋 |
| H9 | `test/villageBuilder.test.ts:162-196,258-272` | 테스트 게이트 대부분이 빌더 리턴값/평가기 출력 assert(자기 채점). 도달성·집 겹침 property 검사 부재 |
| H10 | evals/ + `src/evals/goldenTasks.ts` | agentic loop→build→grade eval 0건 — LLM이 마을 툴 시퀀스를 못 부르게 되는 프롬프트/스키마 회귀 무보호 |
| H11 | `scripts/force-save-large-village.mts:36-38` | QA 실패에도 저장 진행(`qa-failed-still-saving`) — 게이트를 스크립트가 스스로 무력화 |
| H12 | `src/editor/tools/toolRegistry.ts:184-201` | 실내 하네스 4툴만 tile 도메인 핀, 마을 세션 6툴 비핀 — 다도메인 노출 트림에서 `advance_village_build`가 잘릴 수 있음 (트림 결과는 추정) |

## 중간 (요약)

- **점수 게이밍**: 강촌 보너스 합산으로 이슈(-0.23) 상쇄 PASS 가능 (`villageEvaluate.ts:400`).
- **크기 하드코딩**: 수역 ≥30, 나무 ≥20 등 절대 카운트 — 80×80과 30×30에 동일 잣대. start 폴백이 맵 정중앙 BFS라 중앙이 물이면 멀쩡한 마을이 FAIL. 광장 밴드도 중앙 고정 8×6 (`villageEvaluate.ts:100,301,508`).
- **plan(12채) vs builder(32채) 상한 불일치** — 권장 경로(plan_village)가 오히려 대형 마을 저하 (`villagePlan.ts:102` vs `villageBuilder.ts:88`).
- **도로 wobble이 bounds 밖 누출** (`villageBuilder.ts:1689-1709` inMapBounds만 검사).
- **숲 마스크가 buildable 미제외** — 산골 마을 집이 숲 스트립 안에 지어짐 (`villageTerrainPass.ts:75-93`, roles 배열은 아무도 안 읽음).
- **광장 market 덱↔도로 루프 순서 충돌** — 덱 테두리 찢김, audit 항목 없음 (`villageBuilder.ts:1522-1577`).
- **doorHasRoad = 문 주변 3×3에 길 존재만** — 고립 성분이어도 통과; 집 몸통/창문 무결성 감사 부재; 모든 audit 실패는 warning (`villageBuilder.ts:2685-2730`).
- **테스트 타일 id 이중 유지** — road 집합 미스매치 시 검사가 공허 통과로 무력화 (`test/villageBuilder.test.ts:505-507`).
- **세션**: `run_village_session` 예외 미포획으로 로그 유실(`villageSession.ts:642`), 예산 소진 후 회복 경로 부재(422-427), forceLayer가 done 레이어 재실행 허용→중복 시공(429-435), buildOrder 오타 조용히 드롭(`villagePlan.ts:246-252`), `start_village_session` houses가 `items:{type:"object"}` 스키마 전무(127-131), placeProps 예외를 warnings로 삼켜 "성공+placed=0"(1163-1171).
- **07-08 통증 잔존**: `list_resources` query 여전히 필수 (`queryTools.ts:343`). place_npc graphic 별칭은 `list_npc_graphics` query 선택화로 부분 완화.

## 스크립트·재현성 실태

- 마을 스크립트 31개 중: 순수 재현 가능(네트워크 불요) **0개**, 조건부(a) 9개(전부 `.env.local`+LegacyDb 쓰기 결합), 일회성(b) 16개(그중 특정 런 GUID 맵 id 하드코딩으로 **재실행 자체 불가 2개**: `clean-and-save-village-dungeon.mts:21`, `complete-dew-30min-quest.mts:11`), 죽은/tmp(c) 4개(`_tmp_*` 커밋 2개 포함).
- project id 하드코딩 26개, localhost 포트 하드코딩 6개. wipe 계열 6종 중 4종의 기본 타깃이 공유 갤러리 프로젝트.
- **npm script 0개.** 실질 정본은 `test/villageBuilder.test.ts:323-354`의 `run_village_pipeline` 테스트 케이스 하나이며 CLI 미노출.
- 캡처/리포트 3종(`capture-natural-village-harness.mts` 등)은 특정 projectId·경로 하드코딩 일회성 저작 도구 — 픽셀 판정 0, Visual QA 자동화는 존재하지 않음.
- vitest 실측: `villageBuilder.test.ts` + `dungeonRoomPipeline.test.ts` 27/27 통과 (48s) — 기존 ~28건 실패군과 무관하게 건강.

## 루브릭 커버리지 (07-08 채점 기준 10점 대비 기계 검사)

| 축 | 배점 | 기계 커버 | 비고 |
|---|---|---|---|
| 하네싱·무결성 | 3 | 부분 | natural-v2 + builder doorFronts 전제(F2/F3). 인용된 audit-village.cjs 유실(H8) |
| 마을 구성 | 2 | 부분 | layoutPlan 태그 자기신고(F2) |
| 길 | 2 | 부분 | 직선 run 상한만. 채점서가 감점한 계단꺾임·연결성분은 미측정 |
| NPC·대화 | 2 | 거의 없음 | 일정/활동 카운트만. 대사 존재·내용·NPC 위치 유효성 미검사 |
| Visual QA | 1 | 전무 | 픽셀/스크린샷 자동 판정 0건. 창문 밀도(실제 감점 사유) 미측정 |

## 던전룸 v1 역발견 (참고)

비교 과정에서 던전 쪽이 더 심각한 것이 확인됨: 기존 맵 무경고 통째 교체 + 이벤트 전멸(`dungeonRoomSession.ts:74`), `ensureDungeonRoomHarness` 반환값 무시 → 타일셋 미시드 시 깨진 맵 무경고(`:61`), 검증·도달성·출입 transfer 전무, 시스템 프롬프트 라우팅·챗봇 스킬 부재(마을은 둘 다 있음). 메모리의 "던전 챗봇 스킬 미착수"와 일치.

## 권고 우선순위

1. **F1**: `wipeProjectMaps`를 파이프라인이 만든 mapId만 지우도록 축소 (한 줄 반경, 즉효).
2. **F5+F3**: `advance_village_build` settlement 케이스에 `verifyLayer("settlement")` 접속 + doorFronts 빈 배열을 통과가 아니라 실패로.
3. **F6**: `lakeVillageRebuildFinal.test.ts`를 vitest include에서 제외(scripts/로 이동 또는 env 가드).
4. **H1/H2**: mustExist 랜드마크·최소 집 수를 warning이 아닌 게이트로 승격 (`requirements` 기존 계약 재사용).
5. **F2**: 평가기 자연 검사에서 layoutPlan 게이팅 완화 — 타일 실측 가능한 검사(고아 문, 출구)는 무조건 실행.
6. **F4**: lakeRect·forest를 buildable 마스크에서 제외 (villageTerrainPass 마스크 계약 완성).
7. **정본 명령 1개**: `npm run village:harness` — 인메모리 build→evaluate→report, 네트워크 없이. agentic eval 1건(goldenTasks에 build_village 시퀀스) 추가.
8. H5/H6: 출구→도로망 연결성 + 이벤트 고려 도달성.
9. H12: 마을 세션 툴 도메인 핀.
10. Visual QA는 장기 과제로 별도 (verify 스킬의 Playwright 레시피 재사용 후보).
