# 16px 실내 기물 고르기 — 저장소

고르는 화면: `http://mdc-server:18302/` (`systemctl --user … hand-interior-pick`, 서버 `scripts/content/hand-interior-pick/pick_server.py`).

## 정본은 SQLite 다

선택·메모·함께 쓰기·「메모 반영」의 **정본은** `~/.local/share/oprn/hand-interior-pick/picks.sqlite` 이다
(저장소 밖 — 워크트리를 지워도 남는다. WAL · `synchronous=FULL`).

| 표 | 내용 |
|---|---|
| `events` | **추가만 하는 이력.** 저장 한 번 = 한 줄(시각·기물·종류 pick/note/variants/clear/import·그 뒤의 선택·메모·함께 쓰기·client). 트리거가 UPDATE/DELETE 를 막는다. |
| `current` | 지금 상태. `events` 와 **같은 트랜잭션**에서 갱신된다. |
| `addressed` / `addressed_log` | 감독자·에이전트의 「메모 반영」 기록(옛 `addressed.json`). |

- 화면의 POST 는 DB 커밋이 끝난 뒤에만 200 을 받는다. 메모는 치는 동안 0.8초 디바운스로 자동 저장되고,
  다른 기물로 넘어가거나 창을 닫을 때(sendBeacon) 바로 보낸다. 실패하면 빨간 알림 + 브라우저 localStorage 에 임시 보관 →
  다음에 열 때 복구를 제안한다.
- 기물 화면 아래 「이력」에서 그 기물의 모든 저장을 보고, 「되돌리기」로 과거 상태를 **새 이벤트로** 다시 적용한다(이력은 지우지 않는다).

## `picks.json`·`addressed.json` 은 내보내기다

`picks.json`·`addressed.json` 은 서버가 쓰기마다 DB 에서 원자적으로 다시 쓰는 **내보내기**다
(`apply_picks.py`·`make_jobs.py` 호환, 커밋용). 모양은 예전과 같다: `{id: {at, choice, note, noteAt?, variants?}}`.

- **`picks.json` 을 손으로 고쳐도 DB 에는 들어가지 않는다.** 다음 저장 때 덮인다
  (덮기 전 지난 내보내기와 내용이 다르면 `~/.local/share/oprn/hand-interior-pick/backups/divergent-*` 에 사본을 남긴다).
- 「메모 반영」은 CLI 로 적는다(옛 습관대로 `addressed.json` 을 고치면 다음 화면 로드 때 달라진 항목만 DB 로 들어온다):

```bash
python3 scripts/content/hand-interior-pick/picks_db.py address "<기물 id>" "<반영 요약>"
python3 scripts/content/hand-interior-pick/picks_db.py history "<기물 id>"   # 이력
python3 scripts/content/hand-interior-pick/picks_db.py show ["<기물 id>"]    # 현재 상태
python3 scripts/content/hand-interior-pick/picks_db.py verify                # picks.json ↔ DB 대조
python3 scripts/content/hand-interior-pick/picks_db.py export                # 내보내기 다시 쓰기
python3 scripts/content/hand-interior-pick/picks_db.py backup                # 지금 백업
```

## 백업

서버가 시작할 때 + 하루 한 번 sqlite `.backup` 으로 `~/.local/share/oprn/hand-interior-pick/backups/picks-*.sqlite` 를 만들고
최근 14개를 남긴다. 복원: 서버를 멈추고 백업 파일을 `picks.sqlite` 로 복사한 뒤(`-wal`·`-shm` 은 지운다) 다시 띄운다.

## 이전(2026-09-30)

빈 DB 로 서버가 처음 뜨면 그때의 `picks.json`·`addressed.json` 을 `kind='import'` 이벤트(시각 = 레코드의 `at`)로 넣고
건수·내용·바이트를 대조해 로그에 찍는다. 이전 직전 사본: `~/backups/hand-interior-pick/<시각>/`.

## 시트에 굽기

고른 결과는 `scripts/content/hand-interior/build_tileset.py` 가 기본으로 넣는다(`install_picks.py`, 자세한 규칙은 `openwiki/atlas-biome-interior.md` 「고른 후보 반영」).
`apply_picks.py` 는 전후 비교 그림용 사본이고 번들을 바꾸지 않는다. 새로 고른 뒤: `build_tileset.py` → `bun scripts/content/hand-interior/prepare-references.mts`.


## 3/4 시점 재작도 2판 (2026-10-01)

#1796 으로 구운 뒤 3/4(윗면+앞면)를 안 지킨 50종을 다시 찍었다. 목록·배정은 `v34-redo.json`, 절차는 `WORKER-V34-REDO.md`,
감독 눈 판정은 `v34-redo-verdicts.json`. 후보 파일은 `candidates/<slug>/w40-*`~`w50-*`(w47~w50 은 1차 불합격 8종의 2차).
비교 페이지: `python3 scripts/content/hand-interior-pick/v34_compare.py <out.html> v34-redo-verdicts.json`.
움직이는 기물 7종은 몸통만 새로 그리고 `anim-mask.png` 자리는 v5 프레임을 그대로 쓴다(`install_picks._animated`).
아직 아무것도 시트에 들어가지 않았다 — 사용자가 고른 뒤 「시트에 굽기」 순서를 따른다.
2판(w51~w53, 같은 날): 「애매」 11종(기둥 6·빵 화덕·왕좌·돌 왕좌·갑옷 거치대·갱도 버팀목) + 마법서 독서대 메모(「2x1 이 나을듯」 → resize.json 32x32).
판정 `v34-redo2-verdicts.json`, 비교 `v34_compare.py <out> v34-redo2-verdicts.json w51,w52,w53`. 움직이는 기물 마스크는 `anim_mask.py`.
극장 좌석 메모(「위를 보는 느낌」)는 2판·3판 후보가 이미 있었는데 사용자가 원래 판을 골라서 건너뛰었다.
빵 화덕 4차(w56): 「실내인데 굴뚝」 — resize.json 32x48 로 굴뚝이 벽면(2줄)을 타고 천장선까지. 위로 키운 움직이는 기물은 install_picks 가 v5 프레임을 아래 맞춤으로 겹친다(폭이 같고 키만 늘린 경우만).
