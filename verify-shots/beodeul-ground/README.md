# 버들항 접지·잔디 꾸밈 — 공용 등록과 실제 조수 적용

2026-10-04. 승인받은 밝은 잔디 시안을 공용 손 도트 소재와 조수 도구로 연결했다.
기본 잔디를 다시 칠하거나 집/나무의 원래 칸을 교체하지 않는다.

## 공용 배포

- `beodeul_ground` / `tex_beodeul_ground`: 16px, 8열, 48칸(실제 조각 41칸, 15레시피).
- `bundled.ts`, `bundledChipsetGeometry.ts`, `defaults/defaultAssets.ts`에 등록.
- `beodeul_city`와 새 팩 모두 참고문서 용도 `beodeul-ground-dressing`을 갖고 태어난다.
- `ensureBeodeulGroundReferences`로 기존 프로젝트에도 넣는다. 저자가 추가한 문서는 보존한다.
- source `tiledata/beodeul-ground/`, 생성 `build-beodeul-ground.py`, `prepare-beodeul-ground-references.mjs`.
- 도구 `dress_beodeul_ground`: 밝은 잔디의 빈 칸에 2/4층을 덧그린다.
- 채팅/Pi 공통 정책 `promptPolicies.ts`. `author_beodeul_town`의 river/coast/city 마감에도 연결했다.
  desert/snow/swamp에는 강제하지 않는다. 전체 재시공은 이 팩의 이전 덧그림만 제거한다.

## 실제 조수 호출

에디터의 실제 평문 경로(classifyPlainPiTurn → composePiTask → runPiAgent), 모델 opencodex/gpt-6-astra.
현재 야외 맵의 밝은 잔디/집/나무/길/문/실내 왕복을 유지하며 꾸미도록 요청했다.
도구를 수동 적용해 결과를 조수가 한 것이라고 하지 않았다.

원본 로그: `../assistant-beodeul-village/ground-dressing/existing/trace.json`.
조수는 현재 맵을 읽고, 공용 지침 1쪽 + 사전 2쪽 + 시트와 오류 그림을 읽은 뒤
`dress_beodeul_ground`를 1회 호출했다. `referencePurpose`를 지정했고 19곳을 배치했다.
실제 도구 호출 16회, 실패 0회. 새 맵 생성/재시공/자유 타일 칠하기는 호출하지 않았다.
미리보기와 출입 도달성도 조회했다. `assistant-result.png`는 저장 후 재로드된 맵의 3배 확대다.

## SQLite 정본

- project id: `3dd2427f-38dc-46e5-925b-a717dbe5bb03`
- 저장 대상: `/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004/project.sqlite`
- revision: **6**
- SHA-256: `ecd86bb4f7c9f5156a7f0cfdda5c88a5e8b2e133768c9dacb0f3f633cf3ffbb0`
- 조수 실행기가 revision 5를 저장 후 닫고 재오픈했다. 공용 키트의 출처·반복 메타데이터를 보충해 revision 6으로 저장했다.
  이 보충 전후 맵 전체와 도시/문 이식 표가 동일함을 확인했다. 별도 근거 스크립트가 같은 저장소를 2회 재오픈하고
  문서 전체 동등성과 SHA 동등성을 확인했다. 임시 JSON만 저장한 결과가 아니다.
- `canonical-proof.json`: 원래 1/3층, 출입 이벤트, 실내 전체, 시작점 유지. 기존 차단 62칸 유지.
- 공용 꾸밈 graft 41칸; 실제 조수 결과를 그대로 내보내 전용 플레이어에 넣었다.

## 실제 게임 화면

`runtime/SUMMARY.md`를 먼저 읽는다. 플레이 화면은 revision 5의 실제 조수 결과이며 revision 6과 모든 맵·도시/문 이식 표가 동일하다. 전용 `player.html` + Firefox, 편집기 play 경유 없음.
시작 → 실제 걸어서 입장 → 실내 이동 → 실제 걸어서 귀환: 5비트 통과, 런타임 에러 없음.

`rendered-stages.json`: 실제 postrender로 문 그림을 관찰했다.
`0,1,2,3,4,5,6,7,6,5,4,3,2,1,0`: 열림 8상태, 귀환 닫힘까지 실제 렌더.

시각 검토: 밝은 잔디 유지, 얇은 기초와 풀 경계, 두 나무의 밑동, 풀/꽃 군락·잔돌·낙엽·화단·통을 확인.
문 앞 포석과 이동 착지는 노출되어 있다. 문 4단계와 최종 닫힘 프레임에서 문이 덧그림에 가리지 않는다.
귀환 비트 샷은 닫기 애니메이션 중이므로 최종 닫힘은 `frames/14-stage-0.png`로 확인한다.

## 확인 범위와 반복 명령

`scoped-checks.json`: 새/기존 공용 등록, 저자 문서/기존 덧그림 보존, 원래 벽 통행,
문 앞 접근, 중복 방지, bundle ensure 후 graft 보존, river 마감, snow 전환 시 이전 꾸밈 제거.
생성기는 문 열의 완전 투명과 실제 예제에서 밑동을 지운 오류 `missing-root(1,3)`를 확인한다.
전용 기초는 h101, 밑동은 수관 2종, 그림자는 줄기 1종에 한정한다. 다른 집/나무의 미적 합격은 주장하지 않는다.
전체 gates/vitest/typecheck는 AGENTS의 세션 제한에 따라 실행하지 않았다.

```sh
python3 scripts/content/build-beodeul-ground.py
node scripts/content/prepare-beodeul-ground-references.mjs
bun scripts/qa/beodeul-ground-check.mts
bun scripts/qa/beodeul-ground-canonical-proof.mts
node scripts/qa/runtime/beodeul-ground-observe.mjs
```

위 근거 스크립트는 기존 프로젝트를 읽는다. 실제 조수 실행기를 다시 돌리는 명령은 정본을 다시 저장하므로,
필요한 새 요청에서만 `scripts/qa/beodeul-village-plain.mts --round <새 근거 폴더> --max-turns 30 ...`을 쓴다.
