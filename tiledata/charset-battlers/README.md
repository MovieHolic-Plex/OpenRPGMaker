# 걷기 칩 기반 도트 전투 시트 (2026-09-28)

EasyRPG RTP 걷기 칩 `public/assets/easyrpg/charset/Actor1~4.png`(CC-BY, 작자는 public/assets/easyrpg/AUTHORS.md) 32명 각각의
전투 도트 24포즈. 폴더 하나 = 캐릭터 하나(`actor<시트>-<칸 0~7>`). 칸 번호는 걷기 칩의 characterIndex(4열×2행, 왼쪽 위부터).

- 포즈 파일: `<pose>.png` 48×48, 원본 1:1 도트, 발 마지막 행 y=44, 왼쪽을 본다. 포즈 표는 `scripts/asset-gen/charset-battler/cb_lib.py` 의 POSES.
- 기준선(걷기 칩을 밀고 기울이고 눕힌 것): `python3 scripts/asset-gen/charset-battler/baseline.py <id>`
- 시트 빌드 + 확인판: `python3 scripts/asset-gen/charset-battler/build.py <id>` → `public/assets/generated/charset-battlers/<id>.png`, `<id>/_board.png`


## r2w2 — 묶음 a3·p1 전투 도트 (2026-09-29)

- Actor 5명(광전사 actor4-2 · 총사 4-3 · 무희 4-4 · 연금술사 4-5 · 소환사 4-6): scripts/asset-gen/charset-battler/art5/a3_actor.py (엔진 lib_a3.py = r2w1 lib_a12 사본, 격자 weapons_a3.py: war_axe·musket_a3·fan_a3·flask_rod·summon_rod). 연금술사는 원본 손도트의 방패를 뺀다(no_shield). repaint_weapons.py 는 R2W2_A3 로 이 다섯 칩을 건너뛴다.
- People 11명(people1-0~1-7, people2-0~2-2): art5/people_r2w2.py (장치 rig_r2w2.py = r2w4 rig45 사본, 소품 props_r2w2.py). 대기 높이 = 칩 높이.
- 재생성: python3 scripts/asset-gen/charset-battler/art5/a3_actor.py && python3 scripts/asset-gen/charset-battler/art5/people_r2w2.py, 이어서 build.py·build_cast.py <칩 id…>(--manifest 없이). 확인판: .omo/r2w2/<batch>/battler/.
