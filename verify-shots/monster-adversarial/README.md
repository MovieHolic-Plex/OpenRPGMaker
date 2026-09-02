# 데이터베이스 「몬스터」 그룹 적대적 UI/UX 리뷰 — 증거 (2026-09-01)

대상은 `src/editor/panels/database.ts:127` 의 그룹 정의가 정본이다:

```
{ label: "몬스터", slug: "monster", tabs: ["enemies", "monsterSpecies", "troops", "factions"] }
```

즉 **4탭**: 몬스터(`enemies`) · 몬스터 종족(`monsterSpecies`) · 적 그룹(`troops`) · 진영(`factions`).

## 파일

| 경로 | 내용 |
|---|---|
| `before/*.png` | 수정 전 4탭 (1680×1050, expert 모드) |
| `after/*.png` | 수정 후 같은 조건 |
| `after/conformance.json` | `scripts/audit-db-conformance.mjs` 결과 (factions 포함 — 이번에 처음 게이트에 들어왔다) |
| `after/states-probe.json` | 목록 무결과 상태·진영 행렬 ARIA·포커스 보존·좁은 뷰포트 계측 |

## 수치 (전 → 후)

| 지표 | 전 | 후 |
|---|---|---|
| WCAG AA 미달 텍스트 (4탭 합) | 118건 (38/20/40/20) | **0건** |
| 무결과 안내가 있는 탭 | 2/4 | **4/4** |
| 무결과 시 목록 창 높이 (적 그룹) | 4px (붕괴) | 162px |
| 필터 시 카운트 배지 | 필터 전 개수 (0행에 "29개") | `0/29개` |
| 진영 행렬 `role="row"` | 0개 (무효 ARIA) | 있음 |
| 진영 행렬 Tab 정거장 | N²개 (6진영이면 36) | 1개 (roving tabindex) |
| 셀 활성화 후 포커스 | `body` 로 유실 | 같은 셀 유지 |
| 24px 미만 조작 대상 | 3~5개/탭 | 0개 |
| 중복 접근명 | `삭제`×3, `보상 흐름 템플릿`×2 | 0건 |
| 적합성 게이트 clipped | enemies 1 / species 1 / troops 0 | 동일 (회귀 없음) |
| 적합성 게이트에 든 탭 | 3/4 (`factions` 누락) | 4/4 |

## 알려진 함정 (같은 실수를 반복하지 않도록)

리뷰에서 잡혀 되돌린 것들. 전부 실측으로 확인했다.

- **`hidden` 속성은 author `display` 를 못 이긴다.** 페이지 0 개일 때 탭 줄·조건 줄을
  `hidden` 으로 숨기려 했지만 두 클래스가 `display:flex` 를 선언해 5px 구분선과 16px 빈
  알약이 남았다. 결론: 숨기지 말고 **만들지 않는다**.
- **`db-ws-btn` 토큰은 `.database-modal-body` 하위로만 스코프돼 있다.** 대화상자는
  `document.body` 에 붙으므로 이 클래스로 갈아치우면 스타일이 통째로 사라진다.
  전역 `.btn.small{flex:1}` 인플레이션은 `.db-enemy-dialog footer` 로 한정해 되돌린다.
- **`--db-studio-text-3` 는 텍스트 전용이 아니다.** 바 채움·플레이스홀더 칠에도 쓰여서,
  텍스트 대비 때문에 내린 값이 검증하지 않은 탭의 그림 무게까지 바꿨다.
  칠 용도는 `--db-studio-muted-paint` 로 분리해 예전 값에 고정했다.
- **포커스 복원은 첫 성공에서 멈추면 안 된다.** 한 조작이 리렌더를 두 번 유발해서,
  프레임 1 에서 복원한 포커스를 약 20ms 뒤 두 번째 교체가 다시 빼앗는다.
- **라벨 글자를 늘리면 좁은 행에서 잘린다.** "1 /" → "확률 1/N" 로 바꿨더니 30px 넘쳐
  게이트 clipped 가 1→2 로 늘었다. 뜻은 카드 힌트/툴팁으로 옮기고 라벨은 짧게 둔다.

## 재현

```bash
# 이 워크트리에서 dev 서버를 띄우고(포트는 남의 워크트리와 겹치지 않게)
npx vite --configLoader runner --host 127.0.0.1 --port 9473 --strictPort

SHOOT_BASE=http://127.0.0.1:9473/ SHOOT_OUT=verify-shots/monster-adversarial/after \
  SHOOT_ONLY=enemies,monster-species,troops,factions node scripts/shoot-db-tabs.mjs

AUDIT_BASE=http://127.0.0.1:9473/ AUDIT_ONLY=enemies,monster-species,troops,factions \
  node scripts/audit-db-conformance.mjs
```

리뷰에 쓴 일회성 계측 하네스는 `scripts/probe-monster-db-*.mjs` 로 두었고
`.gitignore` 의 `/scripts/probe-*` 규칙에 따라 추적되지 않는다.
