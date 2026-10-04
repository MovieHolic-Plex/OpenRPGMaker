# 변형 몸통 맞추기 — 작업자 절차서 (2026-10-01)

같은 몸통에 담긴 물건만 다른 「변형」 묶음(바구니·선반·탁자·걸이·꽃병·화분·깃발·진열대·식탁·자루)에서, 사용자가 한두 개만
새 그림으로 골라서 나머지가 옛 v5 몸통으로 남았다. 그림으로 본 목록: http://mdc-server:18301/interior-variant-bodies.html
배정: `variant-bodies.json` 의 묶음 `<g>` → `refs`(새 몸통으로 고른 것 [id, 후보]) · `todo`(맞출 형제 id).

## 할 일
- `todo` 의 기물마다 `candidates/<slug>/<너>-A.pxg` 하나: **몸통 = refs 의 새 그림, 담긴 물건 = 그 기물의 v5 그림(v5.pxg) 그대로.**
  물건 화소는 v5 에서 옮긴다(새로 그리지 않는다). 몸통이 바뀌어 물건 자리가 1~2px 어긋나면 새 몸통의 입구·선반판에 맞춰 앉힌다.
- refs 가 둘이고 몸통이 서로 다르면(선반: coins·cheese) 더 3/4 다운 쪽 하나를 고르고 메모에 이유를 적는다. 색만 다른 형제(꽃병·깃발)는 ref 를 그 색으로 다시 칠한다(재질 6단을 그대로 대응).
- 크기가 다른 형제(식탁 1×1~4×2, 진열대)는 ref 의 짜임(상판 윗면 두께·앞 모서리·다리·그림자)을 그 크기로 늘이거나 줄인다. 상판 이음·다리 개수는 v5 형제를 따른다.
- **3/4 계약을 지킨다**(`tiledata/atlas-pick/modern-style-bible.md` §10·§11): 윗면이 보이고(상자·통 4~8px, 탁자 상판 깊이 0.5~1.0), 앞면이 있다. ref 가 이미 3/4 이므로 ref 짜임을 지키면 된다.
- 캔버스는 각 기물의 v5 칸 자리 그대로(info.json). 팔레트는 폴더의 palette.pal.

## 도구 (WORKER-V34-REDO.md §3 과 같다)
```bash
S=tiledata/hand-interior/pick/candidates/<slug>
python3 scripts/content/hand-interior-pick/check_candidate.py $S/<너>-A.pxg       # hard 0
python3 scripts/content/atlas-pick/interior_view34_audit.py --object $S/<너>-A.png  # 3/4 관문(걸이·깃발은 hang 이라 생략 가능)
python3 scripts/content/hand-interior-pick/context.py $S/<너>-A.pxg              # 방 안 그림
```
- 많은 형제를 같은 방식으로 옮기므로 **스크립트로 합성해도 된다**(`$S/work/` 나 `candidates/<ref slug>/work/<너>-*.py` 에 두고 메모에 적는다). 그래도 결과 그림은 묶음 전체를 한 장에 모아 눈으로 본다 — 물건이 몸통 밖으로 새거나 반쯤 잘린 것, 색이 몸통과 섞여 안 읽히는 것을 잡는다.
- 한 줄 메모 `<너>-A.note`.

## 금지
다른 작업자 파일·v5.*·info.json·palette.pal·picks.json 수정, git add/commit/stash, npm test, vitest, gates.

## 끝나면
`python3 scripts/content/hand-interior-pick/check_candidate.py --worker <너>` 후 한국어로 짧게: 묶음별 몇 개, 어떤 ref 를 몸통으로, 눈 검수 결과, 불합격·애매한 것. 묶음 전체를 모은 확인 그림 경로(절대 경로).
