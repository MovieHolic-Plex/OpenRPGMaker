# 걷기 칩 기반 도트 전투 시트 (2026-09-28)

EasyRPG RTP 걷기 칩 `public/assets/easyrpg/charset/Actor1~4.png`(CC-BY, 작자는 public/assets/easyrpg/AUTHORS.md) 32명 각각의
전투 도트 24포즈. 폴더 하나 = 캐릭터 하나(`actor<시트>-<칸 0~7>`). 칸 번호는 걷기 칩의 characterIndex(4열×2행, 왼쪽 위부터).

- 포즈 파일: `<pose>.png` 48×48, 원본 1:1 도트, 발 마지막 행 y=44, 왼쪽을 본다. 포즈 표는 `scripts/asset-gen/charset-battler/cb_lib.py` 의 POSES.
- 기준선(걷기 칩을 밀고 기울이고 눕힌 것): `python3 scripts/asset-gen/charset-battler/baseline.py <id>`
- 시트 빌드 + 확인판: `python3 scripts/asset-gen/charset-battler/build.py <id>` → `public/assets/generated/charset-battlers/<id>.png`, `<id>/_board.png`

