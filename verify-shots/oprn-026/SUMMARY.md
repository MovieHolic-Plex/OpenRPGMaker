# OPRN-OUT-026 — 타일 레이어·배경 정책 (브라우저 증거)

실행: `http://127.0.0.1:9865/?blankProject=1` → 데이터베이스 → 맵/타일 → 합본 마을 칩셋 → 「통행·지형」 탭.
1440x900, 실제 Chromium. 모든 변경은 로컬 세션에만 남는다(원격 지속성 꺼짐을 단언으로 확인).
결과: 6/6 PASS · 페이지 오류 0건.

먼저 열 파일: `01-trunk-policy.png`(정책 부류·근거·다중 조각) →
`03-backing-none-warning.png`(경고가 켜지는 정확한 순간) → `04-review-appears.png`(검토 목록) →
`RESULTS.json`(화면 문구와 저작 데이터를 나란히 담은 실측값).

| PNG | 무엇을 증명하나 |
|---|---|
| `01-trunk-policy.png` | 나무 밑동 290 을 고르면 정책 부류 「받침 있는 하위」 + 근거 문장 + 다중 조각 제약(수관 260~263)이 함께 보인다. |
| `02-backing-auto.png` | 받침 기본값 「자동」 — 잔디 240 을 함께 그린다고 알려 주고, 경고는 없다. |
| `03-backing-none-warning.png` | 받침을 「없음」으로 바꾸면 부류가 「투명 하위(받침 없음)」로 뒤집히고 **바로 그때** 경고가 뜬다. 형제 밑동 291 은 그대로다. |
| `04-review-appears.png` | 그 타일이 생긴 뒤에야 「배경 없는 하위 타일 검토」 목록이 나타나고, 항목은 290 하나 · 선택지는 네 개다. |
| `05-backing-grass.png` | 받침을 「잔디 받침」으로 되돌리면 경고와 검토 목록이 함께 사라진다 — 경고는 정확히 조건에만 붙는다. |
| `06-review-overlay-one-before.png` → `06-review-overlay-one.png` | 검토 항목의 「상위 오버레이」는 그 타일만 상위로 옮긴다. 291·292·293 의 홈 레이어와 받침은 불변. |

## 이 촬영이 드러낸 결함 (같은 변경에서 고쳤다)

받침을 「없음」으로 확정하면 부류는 「투명 하위(받침 없음)」로 바뀌는데, 근거 문장만
"받침 타일로 투명 픽셀을 채웁니다" 로 굳어 있었다. 즉 규칙 탭이 바로 위 경고
(「받침 없이 하위에 깔면 투명 부분이 검게 보일 수 있습니다」)와 정면으로 모순되는 설명을
같은 화면에 띄웠고, 그 문장은 검토 목록 항목에도 그대로 복사된다.
고침: `src/editor/tileLayerPolicy.ts` 의 `trunkReason()` 이 실제 받침 결과를 말한다.
회귀: `test/tileLayerPolicy.test.ts` 2건(없음일 때 모순 문구 금지 / 받침이 살아 있을 때는 그대로).

## 페이지 오류

없음. Vite HMR 웹소켓 실패(GET 중계는 웹소켓을 프록시하지 못한다)와 `?blankProject=1` 의 의도적 자동저장 비활성 알림만 환경 소음으로 걸렀다.

## 재현

```
DEV_SERVER_PORT=9865 npm run dev:worktree
TILE_POLICY_QA_URL=http://127.0.0.1:9865 node scripts/qa/tile-layer-backing-policy.mjs
```

- **01-trunk-policy** — PASS
- **02-backing-auto** — PASS
- **03-backing-none-warning** — PASS
- **04-review-appears** — PASS
- **05-backing-grass** — PASS
- **06-review-overlay-one** — PASS
