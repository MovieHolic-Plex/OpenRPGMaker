# art4 — 새 주인공 6명 전투 도트 (2026-09-28)

`heroes6.py` 가 사무라이(actor3-0)·닌자(actor3-2)·무도가(actor3-5)·음유시인(actor3-6)·드루이드(actor3-4)·마녀(actor4-7)의
24포즈 + 시전 21칸 원본(`tiledata/charset-battlers/<id>/*.png`)의 정본이다. 이 여섯 명에게는 `repaint_weapons.py` 를 돌리지 않는다(옛 공용 무기로 되돌아간다).

```
python3 scripts/asset-gen/charset-battler/art4/heroes6.py            # --dry 는 .omo/hero6/dry 에만 쓴다
python3 scripts/asset-gen/charset-battler/build.py actor3-0 actor3-2 actor3-5 actor3-6 actor3-4 actor4-7
python3 scripts/asset-gen/charset-battler/build_cast.py actor3-0 actor3-2 actor3-5 actor3-6 actor3-4 actor4-7
```

- 몸: 기존 손도트 원본(art2/art3)을 `repaint_weapons.equipment_pass('clean')` 로 재생해 옛 장비만 뺀다. 핵심 포즈는 팔 관절 좌표만 옮긴다(`design()` 의 moves).
- 장비: `weapons.py` 에 추가한 격자 katana·kunai·lute·druid_staff·witch_staff(기존 격자는 그대로). 칼집·빈 칼집·수리검·음표·잎·섬광은 이 파일에서 좌표로 찍는다.
- 직업 규칙: 사무라이 대기·걷기는 허리 칼집 자루에 손(발도 자세), attack_strike 는 수평 일섬 + 빈 칼집. 닌자는 곧게 서서 한 손으로 쿠나이를 앞으로, 공격 칸은 역수 쿠나이 쌍, skill 은 수리검 투척.
  무도가는 무기 없음(정권 섬광·앞차기·기공). 음유시인은 류트를 들고, 시전 3단계는 가슴 앞 튕김 → 치켜들고 손 뿌림 → 앞으로 눕혀 쓸어내림(손 위치가 모두 다르다), 음표 색이 마법 종류.
  드루이드는 잎이 돋은 나무 지팡이, 마녀는 보라 구슬 검은 지팡이 + 고깔 모자(칩 그대로).
- 대기 높이 = 걷기 칩 높이(무릎 굽힘 없음). AI 그림·축소·트레이스 없음. 검토 판: `.omo/hero6/board.png`.

