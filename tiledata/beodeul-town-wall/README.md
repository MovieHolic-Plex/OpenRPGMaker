# 버들항 마을 성벽 — 성벽 통로·흉벽·앞면·성문루·망루·계단 (beodeul_town_wall, 2026-10-22)

타일셋 `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`) · **16px 칸, 한 줄 128칸**.
번호 n 의 칸 = 행 ⌊n/128⌋, 열 n mod 128. 성벽 칸은 시트 꼬리 **28544~28631**(행 223, 열 0~87)이다. 다른 칩셋 번호를 섞지 않는다.
그림은 코드 손 도트(scripts/content/beodeul-wall/wall_art.py, 행 문자열 글리프), 3/4 탑뷰: 성벽 위 통로(판석)는 위에서 본 면, 그 아래 마름돌 앞면 두 칸.
색은 모두 버들항 시트에 있는 값(돌은 따뜻한 회색 램프, 윤곽 #2b203f = 버들항 지붕 윤곽, 망루 기와는 민가 h101 지붕 램프).

## 1. 정확한 사전

층: **3층(upperTiles)** = 성벽 조각, **2층(lowerOverlayTiles)** = 성문 통로 바닥·어둠(아래층 조각), 1층 = 땅(풀 737·길). ★ = 사람 위에 그려지는 걸음 칸(priority upper).
걸음 방향은 tileset passability 그대로(U 북·D 남·L 서·R 동). 막힘 = 네 방향 모두 막힘.

| 무엇 | 조각 `이름` 칸 번호 | 층 | 통행 | 반복 |
|---|---|---|---|---|
| 남쪽 성벽 통로(앞 흉벽, 바깥 앞면이 보인다) | `hs` 28544 · `hs_shL` 28545 · `hs_endW` 28546 · `hs_endE` 28547 | 3 | 동서(LR), 끝은 한쪽 | 반복(hs), 고정(끝·그늘) |
| 북쪽 성벽 통로(뒤 흉벽, 마을 쪽 앞면이 보인다) | `hn` 28548 · `hn_shL` 28549 · `hn_endW` 28550 · `hn_endE` 28551 · `hn_stair` 28552 | 3 | 동서, hn_stair 는 동서+남 | 반복(hn) |
| 둘레 모서리(볼록) | `c_nw` 28553 · `c_ne` 28554 · `c_sw` 28555 · `c_se` 28556 | 3 | 이어지는 두 방향 | 고정 |
| 오목 모서리 | `cc_se` 28557 · `cc_sw` 28558 · `cc_ne` 28559 · `cc_nw` 28560 | 3 | 이어지는 두 방향 | 고정 |
| 갈림목 ┬ ┴ ├ ┤ | `t_n` 28561 · `t_s` 28562 · `t_w` 28563 · `t_e` 28564 | 3 | 세 방향 | 고정 |
| 서·동 성벽, 가름벽(위만 보인다) | `vw` 28565 · `ve` 28566 · `v2` 28567 | 3 | 남북(UD) | 반복 |
| 세로 성벽 끝 마감 | `vw_endN` 28568 · `ve_endN` 28569 · `v2_endN` 28570 · `vw_endS` 28571 · `ve_endS` 28572 · `v2_endS` 28573 | 3 | 한 방향 | 고정 |
| 앞면(u = 위 칸, l = 아래 칸 굽도리) | `f_u_a` 28574 · `f_u_b` 28575 · `f_u_c` 28576 · `f_u_endL` 28580 · `f_u_endR` 28582 · `f_u_shL` 28584 · `f_u_abR` 28586 · `f_u_col` 28588 · `f_l_a` 28577 · `f_l_b` 28578 · `f_l_c` 28579 · `f_l_endL` 28581 · `f_l_endR` 28583 · `f_l_shL` 28585 · `f_l_abR` 28587 · `f_l_col` 28589 | 3 | 막힘 | 반복(a·b·c 섞기), 끝·그늘·기둥(col) 고정 |
| 계단(북쪽 성벽 안쪽 앞면 자리) | `stair_u` 28590 · `stair_l` 28591 | 3 | 남북 | 고정(키트 bd-wall-stairs) |
| 성문루 4×4 (열림) | `gate_cx_cy` 28592~28607 (cx 0~3, cy 0~3; 아래층 조각은 cy 2·3 의 cx 1·2) · 통로 바닥 `gate_floor_1` 28608 · `gate_floor_2` 28610 · 통로 어둠 `gate_dark_1` 28609 · `gate_dark_2` 28611 | 3 + 2 | cx 1·2 = 남북(cy 0·1 은 ★), cx 0·3 막힘 | 고정(키트 bd-wall-gatehouse) |
| 성문루 닫힘 | `gatec_cx_cy` (cx 1·2, cy 1~3) 28612~28617 | 3(cy1)·2(cy2·3) | 막힘 | 고정(키트 bd-wall-gatehouse-closed) |
| 망루 2×7(기와 모임지붕, 성벽 앞으로 6px 내민다) | `tower_cx_cy` 28618~28631 | 3 | 막힘 | 고정(키트 bd-wall-tower) |

- 통로 바닥(1층 땅) 위에 성문 통로 칸(2층)은 **바닥이 투명**하다 — 아치 밑으로 맵의 길이 그대로 보인다. 성문 통로 아래 칸 1층은 반드시 길로 깐다.
- 앞면 `f_*_shL` 은 왼쪽(서쪽)에 세로 성벽·성문루·망루가 있어 그늘이 드는 칸, `f_*_abR` 은 오른쪽 끝이 세로 성벽에 붙는 칸, `f_*_endL/endR` 은 성벽 끝 앞면, `f_*_col` 은 세로 성벽 끝 마감 밑 앞면(양쪽 끝).

## 2. 실행 순서(맵에 성벽을 두를 때)

**먼저: 마을 둘레 성벽은 손으로 줄을 긋지 말고 `author_beodeul_town` 에 `walls:true` 를 준다** — 같은 규칙으로 맵 크기에 맞춰 짓는다(평지·강 없는 마을, theme river·desert·snow). 아래는 손으로 고칠 때·작은 성채를 지을 때의 규칙이다.

1. 통로 사각형을 정한다: 북 y0 · 남 y1 · 서 x0 · 동 x1. 성벽 마을 도구는 x0=1, y0=3, x1=W−2, y1=H−4(바깥 띠는 풀).
2. 가로 성벽: y0 줄에 `c_nw, hn…, c_ne`, 그 아래 두 줄에 북쪽 안쪽 앞면(`f_u_*` · `f_l_*`, 맨 왼쪽 칸은 `_shL`, 맨 오른쪽 칸은 `_abR`). y1 줄에 `c_sw, hs…, c_se`, 그 아래 두 줄에 바깥 앞면(맨 왼쪽 `_endL`, 맨 오른쪽 `_endR`).
3. 세로 성벽: x0 열 y0+1~y1−1 은 `vw`, x1 열은 `ve`. 앞면 없음(3/4 에서 위만 보인다).
4. 길이 가로 성벽을 지나는 곳 = 성문루 4×4: 왼쪽 위 = (gx−1, y−1), y = 그 성벽 통로 줄. 통로 = gx·gx+1 두 열. 성문루 오른쪽 성벽 칸은 그늘 판(`hs_shL`/`hn_shL` + `f_*_shL`).
5. 길이 세로 성벽을 지나는 곳 = 틈: 길 줄 위로 `vw_endS`(또는 `ve_endS`) + `f_u_col` + `f_l_col`, 길 줄 아래로 `vw_endN`. 틈은 끝 마감 사이 길 줄 수만큼.
6. 망루 2×7: 왼쪽 위 = (tx, y−3), y = 가로 성벽 통로 줄. 성문루와 한 칸 이상 떨어뜨린다. 모서리에는 두지 않는다. 남쪽 성벽 망루는 성벽 안쪽 세 줄(지붕)을 비워 둔다.
7. 계단은 북쪽 성벽에만: (sx, y0) = `hn_stair`, (sx, y0+1) = `stair_u`, (sx, y0+2) = `stair_l`. 그 아래 땅 칸(sx, y0+3)은 걸을 수 있어야 한다.
8. 성벽 칸의 2·4층(풀꽃·그림자 덧그림)은 비운다. 성벽 안팎 한 칸에는 나무·집을 붙이지 않는다(성벽 마을 도구는 띠를 비워 둔다).

금지: 바닥 칸(1층)에 돌 줄을 칠해 성벽 흉내 내기(3/4 가 깨진 납작한 선), 앞면 없이 통로만 깔기(face-missing), 끝 마감 없이 통로 끊기(wall-gap), 성문 통로 칸을 위층에 놓기(wrong-layer), 열린 성문 통로에 막힌 조각(gate-blocked).
없는 것: 강·운하가 성벽을 지나는 수문, 성벽 위 경사로, 비스듬한 성벽, 성벽 위 사람(병사는 Actor1 캐릭터 이벤트로).

## 3. 완전 조립 예제
- **둘레 18×16**(키트 `bd-wall-ring-sample`과 같다): 남쪽 열린 성문루(통로 x 7·8), 북쪽 닫힌 성문루(x 11·12), 망루 셋(남 3·12, 북 4), 북쪽 계단 둘(x 2·8), 서쪽 틈(줄 7·8). 전체 1·2·3층 배열은 문서 「성벽 조립 예제 배열」과 tiledata/beodeul-town-wall/example.json, 원본 그림 `/assets/beodeul-town-wall/ring.png`.
- **부품 조립**(오목 모서리·갈림목·끝 마감): `/assets/beodeul-town-wall/parts.png`.
- 키트: `bd-wall-gatehouse` 4×4 · `bd-wall-gatehouse-closed` 4×4 · `bd-wall-tower` 2×7 · `bd-wall-stairs` 1×3 · `bd-wall-run-south-4` 4×3 · `bd-wall-run-north-4` 4×3 · `bd-wall-run-west-4` 1×4 · `bd-wall-run-east-4` 1×4 · `bd-wall-ring-sample` 18×16.

## 4. 자동 검사 범위
scripts/content/beodeul-wall/wall_refs.py 의 `check`: wrong-layer · face-missing · wall-gap · gate-blocked. **구조·통행만** 본다 — 미적 품질·밀도·이벤트는 보지 않는다(그림은 사람과 판정자가 본다).
정상/오류 그림 넷은 이 검사가 실제로 변조를 잡는지 보인다(tiledata/beodeul-town-wall/errors.json). 3/4 관문(object-gate)·적대적 VQA 영수증: harness-data/object-gate/vqa/beodeul-town-wall-r*/receipt.json.
