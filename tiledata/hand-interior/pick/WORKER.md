# 16px 실내 기물 후보 찍기 — 작업자 절차서

너는 작업자 `wN` 이다(감독자가 번호를 준다). `jobs.json` 의 `rounds[-1].workers.wN` 에 있는 기물마다 **후보 셋 이상**을 찍어 제출한다.
사용자가 브라우저에서 v5 현재판과 후보들을 나란히 보고 하나를 고른다(「v5 유지」도 고를 수 있다). 네 일은 **고를 거리를 서로 다르게** 만드는 것이다.

저장소 루트 = 이 워크트리. 명령은 전부 루트에서 돈다. 정본 v5(`tiledata/hand-interior/v5/`)는 **읽기만** 한다.

## 0. 먼저 읽을 것 (10분)
1. 이 문서 전체.
2. `scripts/content/pixel-harness/pxgrid/README.md` — 격자 형식(`@block` `@def` `@stamp` `@mirror` `@px` `@layer`, 램프 격자 `@mat` `@mblock` `@tblock` `@tadj`), 단계형 작도, 자기 점검표.
3. `tiledata/hand-interior/v6-objects/LESSONS.md` — 지난 재작도에서 배운 10가지(자동 윤곽이 2px 부재를 먹는다, 잎 윤곽은 한 단만 어둡게, 바구니 엮음은 2칸 엇갈림 블록 …).
4. `tiledata/px48/STYLE.md` 2·5·6절(윤곽·그림자·시점). 48px 용이지만 원칙은 같다. 16px 에서는 단 수를 줄인다(재료 하나 3~5단).
5. 네 기물의 `candidates/<slug>/info.json`·`v5-x4.png`, 그리고 그 기물이 놓인 v5 방 그림 `tiledata/hand-interior/v5-maps/render/*.png`.

## 1. 사용자 판정 (지켜야 할 방향)
- **벽·바닥은 v5 그대로.** 기물만 바꾼다. 후보는 v5 바닥·벽 위에서 어울려야 한다.
- **낮은 가구(탁자·침대·상자·깔개)는 윗면이 높이의 약 ¾.** **키 큰 가구(책장·옷장·찬장)는 앞면이 주인공**, 윗판은 1~2px.
- **세부가 많다고 이기지 않는다.** 16px 에서 읽히는 덩이 몇 개가 잔 점 스무 개보다 낫다. 식탁은 사용자가 v6 재작도보다 v5 가 낫다고 했다 — 조용하고 또렷한 면.
- 빛은 왼쪽 위. 윤곽은 검정이 아니라 그 재료의 어두운 단, 오른쪽·아래 테가 한 단 더 어둡다. 베개 명암(사방을 어둡게) 금지.
- REFMAP(`~/.local/share/oprn/refmap-downloads/_packs/refmap-interior/`)은 상용 제3자 자료: **봐도 되지만 화소를 옮기지 마라.** 검사가 95% 이상 닮은 칸을 불합격시킨다.

## 1-b. 1판 사용자 선택에서 나온 교훈 (2026-09-30, 112개)
- 고른 방향: **C 35 · B 31 · v5 유지 20 · A 11** (13개는 전부 거절). 「v5 를 조금 다듬기(A)」는 거의 안 고른다 → A 도 눈에 띄게 나아져야 한다.
- 거절 사유 1위는 **입체감·공간감 없음**(제단·설교대·고해실·긴의자·욕조): 윗면·옆면·앞면이 다른 명도로 나뉘어야 하고, 상자형 가구(고해실)는 **지붕(천장판)** 이 보여야 한다. 시점은 방과 같은 위에서 약간 내려다보는 각 — 욕조는 「시야각이 이상」했다.
- **색감**: 탁하거나 튀는 색 거절(욕조·긴의자). v5 방 바닥·벽과 명도를 분리하되 채도는 낮게.
- **질감**: 짚 침대 「짚 질감이 안 든다」 — 재료가 16px 에서 읽혀야 한다(짚 = 가는 노란 결 여러 방향 + 어두운 틈).
- **알아볼 수 있어야**: 안장걸이 「잘 안 보인다」, 마도 갑옷 「이게 어케 갑옷?」 — 실루엣만으로 무엇인지 읽혀야 한다. 이상하면 칸을 키워라.
- **크기**: 사용자가 여러 기물을 더 크게 원했다(다트판·박제 사슴·벽 지도 2×2, 광석 더미 2×2, 성도 1×2, 옥좌 3×2 「좀 더 화려하게」, 발깔개 2×1). 크기 변경은 `candidates/<slug>/resize.json` (다트판 선례).
- **어울림**: 둥근 아치 「주변 타일과 너무 안 어울림」 — 벽·바닥 v5 재질·명도와 이어져야 한다. 반복 소재(광맥·무대 배경판)는 **변형 여러 개**가 필요하다.

## 2. 후보 방향 (기물 하나에 최소 A·B·C 셋)
| 글자 | 방향 | 하는 일 |
|---|---|---|
| **A** | v5 결을 살려 다듬기 | `v5.pxg` 를 복사해 시작. 실루엣·색은 거의 그대로, 외톨이 화소·들쭉날쭉 계단·흐린 윤곽·베개 명암만 고친다. 「v5 가 조금 깔끔해진 판」 |
| **B** | 명암·그림자 강화 | 같은 모양에 빛 구조를 세게: 윗면·빛 쪽 한 단 밝게, 그늘 쪽·앞면 한두 단 어둡게, 발 칸 안 오른쪽 아래 반투명 접지 그림자(`~` `-`, 2~3줄). 바닥에서 떨어져 보이게 |
| **C** | 실루엣·비율 재해석 | 같은 칸 수·같은 접지선 안에서 모양을 다시 생각한다: 윗면 ¾ 규칙, 다리·부재 굵기, 무엇이 16px 에서 읽히는지. 새로 그린 판 |
| D… | 자유 | 셋 말고 더 좋은 생각이 있으면 D, E … 로 더 낸다(선택) |

방향마다 **서로 달라야** 한다. 사용자는 「같은 방향만 모아 보기」로 A 끼리·B 끼리 비교해 어느 방향을 좋아하는지 본다 — 방향 글자를 뜻대로 지켜라.

## 3. 파일 규약 (여러 작업자가 동시에 쓴다 — 자기 파일만)
기물 폴더 `tiledata/hand-interior/pick/candidates/<slug>/` (slug 는 `jobs.json` queue 또는 폴더 이름. 예: `dining 2x1` → `dining_2x1`).

| 파일 | 누가 | 내용 |
|---|---|---|
| `info.json` `v5.png` `v5-x4.png` `v5.pxg` `palette.pal` | make_jobs.py (고치지 마라) | 기물 규격, v5 현재판, v5 를 격자로 옮긴 판, 팔레트 |
| `wN-A.pxg` `wN-B.pxg` `wN-C.pxg` … | **너** | 후보 격자. 첫 줄들: `@size W H` `@cell 16` `@palette palette.pal` |
| `wN-A.note` … | **너** | 한 줄 메모: 무엇을 바꿨고 왜(예: 「윗면을 ¾ 로 늘리고 다리를 2px→3px, 앞 두께 한 단 어둡게」) |
| `wN-A.png` `-x4.png` `.txt` `.check.json` | check_candidate.py 가 만든다 | 렌더·평탄화 격자·검사 결과 |

- 다른 작업자(`w3-*`)의 파일, `picks.json`, 공통 팔레트는 절대 건드리지 않는다. 필요한 판단 재료는 읽기만.
- 한 단계씩 따로 남기고 싶으면 `candidates/<slug>/work/wN-*` 아래에 둔다(화면은 `wN-X.pxg` 만 읽는다).
- **git 커밋·stash·npm test·vitest·gates 금지.** 감독자가 모아 커밋한다.

## 4. 캔버스·색 규칙 (검사가 기계로 본다)
- **캔버스 = v5 칸 자리 그대로** (`info.json` `canvas`). 16의 배수이고, 위 `padTop` 줄은 투명 여백이다(그림 높이 = `image.h`). 패딩 줄에 그리면 불합격.
- **바닥 접지선**: 불투명 화소 맨 아래 줄이 v5 (`v5_bbox[3]`) 와 ±1px(걸이는 ±2). 가구는 같은 칸에 서 있어야 방에 놓인다.
- 폭은 v5 불투명 폭 ±3px 안을 권한다(넘으면 경고). 발 칸(footprint) 밖으로 나가지 않는다.
- `surface.rect_px` 가 있는 가구(탁자·카운터)는 **그 사각형을 전부 불투명하게** — 탁상 물건이 그 위에 놓인다(좌표는 그림 기준, 캔버스로는 y + padTop).
- **색은 `palette.pal` 안에서만.** 두 가지를 쓸 수 있다.
  1. 이 기물의 v5 색 — 한 글자(`A` `B` …, 파일 아래쪽 목록. `// = wood:6` 은 그 색이 어느 램프 몇 단인지).
  2. v5 공통 램프 29개(`@rampc wood …` `iron` `linen` `red` …) — `@mat w wood 6` 으로 재료 글자를 정하고 `@mblock`·`@tblock X Y 램프`·`@tadj` 로 단을 놓는다.
  반투명은 그림자 `~`(110) `-`(58)과 v5 가 이미 쓰는 빛·유리 색만. 검사는 v5 기물 381개가 쓰는 색 ∪ 공통 램프 밖의 색을 불합격시킨다. `palette.pal` 에 색을 더하지 마라.
- 실루엣 단계 표시색 `#` 는 최종본에 남기면 불합격.
- 배경은 투명(`.`). 깔개(flat)만 칸을 꽉 채워도 된다.

## 5. 기물 하나 절차
```bash
S=tiledata/hand-interior/pick/candidates/<slug>
cat $S/info.json                    # 크기·padTop·접지선·surface·재료 힌트
cp $S/v5.pxg $S/wN-A.pxg            # A 는 v5 에서 시작 (B·C 는 새 파일로 써도 된다)
#   … 격자를 고친다. 단계 파일은 $S/work/ 에 …
echo "한 줄 메모" > $S/wN-A.note
python3 scripts/content/hand-interior-pick/check_candidate.py $S/wN-A.pxg   # 렌더 + 검사 (2~3초)
python3 scripts/content/hand-interior-pick/context.py $S/wN-A.pxg           # 방 안 맥락 그림 → $S/wN-A.ctx.png (4배)
```
- 검사 뒤 **반드시 `wN-A-x4.png` 와 `wN-A.ctx.png` 를 열어 눈으로 본다.** 숫자가 합격이어도 눈으로 이상하면 고친다.
- `pxlint16` 는 참고 표시다(불합격이어도 제출 가능, 화면에 표시된다). v5 현재판 자체도 여러 기물이 pxlint 불합격이다. 걸린 항목이 네 변경 탓이면 고쳐라.
- hard 불합격(✗)은 고쳐서 합격시킨 뒤 제출한다. 도저히 안 되면 메모에 이유를 적고 남겨 둔다(화면에 빨갛게 뜬다).
- 한 기물에 20분을 넘기지 마라. 셋을 다 낸 뒤 시간이 남으면 좋은 방향을 하나 더(D) 낸다.

## 6. 끝나면
```bash
python3 scripts/content/hand-interior-pick/check_candidate.py --worker wN      # 네 후보 전부 다시 검사
```
감독자에게 짧게 보고: 기물 수·후보 수·hard 불합격 목록, 방향별로 네가 가장 자신 있는 후보 한두 개와 이유. 파일 경로는 절대 경로로.

사용자가 고르는 화면: http://mdc-server:18302/ (새 후보는 새로고침만으로 보인다).

## 7. 감독자용 (작업자는 읽지 않아도 된다)
- 다시 나누기: `python3 scripts/content/hand-interior-pick/make_jobs.py --workers 10 --per 11` (1판을 새로 나눈다) · 다음 판 `--round 2` (앞 판 배정·선택된 것 건너뜀) · 기물 하나 폴더만 `--prep "<id>"`.
- 공통 팔레트 다시 뽑기: `python3 scripts/content/hand-interior-pick/make_palette.py` (v5/mat.py 램프 → `palette/v5.pal`).
- 화면 서버: `systemctl --user {status,restart} hand-interior-pick` (`~/.config/systemd/user/hand-interior-pick.service`, 포트 18302). 먼저 `export XDG_RUNTIME_DIR=/run/user/$(id -u) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus`.
- 선택은 `picks.json` 에 쌓인다(`{id: {choice: "v5"|"w3-B", note, at}}`). 적용: `python3 scripts/content/hand-interior-pick/apply_picks.py` → `out/interior-atlas.png`·`out/interior-meta.json`(v5 사본) + `out/rooms/<방>-compare.png`(화면 「적용 결과」 탭). 정본 v5 는 덮지 않는다.
- 커밋은 감독자가 한다: 작업자 후보 `candidates/*/w*-*.{pxg,note,png,txt}`·`-x4.png`·`.check.json`. `*.ctx.png` 와 `.cache/` 는 무시된다.
