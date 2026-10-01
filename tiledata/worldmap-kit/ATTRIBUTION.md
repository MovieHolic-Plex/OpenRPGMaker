# 월드맵 키트 출처 표기 (기존 `tiledata/atlas-pick/worldmap-easyrpg-plus/ATTRIBUTION-NOTE.md` 규약을 따른다)

`public/assets/ATTRIBUTION.md` 의 「EasyRPG RTP bundled map and object assets」 항목이 `easyrpg-chipset-world.png`(`ChipSet/World.png`,
EasyRPG RTP, CC BY 4.0 — 원작 JasonPerry, CC0)를 이미 싣고 있다. 이 폴더의 그림은 전부 그 파일의 팔레트·결을 따라 코드 안에서 좌표로 찍은 손 도트이거나 그 파생물이므로
같은 **CC BY 4.0 파생물** 표기를 따른다. 월드맵은 EasyRPG 월드 칩셋을 쓰는 예외 영역이다(다른 장소의 EasyRPG 칩셋은 폐기됨).

- 월드맵 키트(2026-10-01): `tiledata/worldmap-kit/` — 지형(공용) · 팔레트 · 아이콘 세트 · 여정 템플릿 4층으로 나눈 설계 데모 키트. 배포 번들이 아니다(`docs/README.md` 의 「제품 번들 등록」 참조).
  - `kit/lib/` : `tiledata/atlas-pick/worldmap-easyrpg-plus/` 의 지형 파이프라인(`terrain_v4.py`·`make_map_v4.py`·`boundary_v5.py`·`coast_v6.py`·`cliff_v8.py`·`terrain_extra.py`·`terrain_lib.py`·`terrain_render.py` 와
    v9-final 의 `fix3_patches.py`·`fix4_patches.py`·`swamp_final.py`·`terrain_f1.py`·`journey_*_v9.py`·`make_map_icons_v9.py`, `scripts/content/atlas-pick/worldmap_easyrpg_plus.py`)의 사본이다.
    경로 상수·`sys.path` 삽입만 키트 안으로 바꿨고 지형 동작은 바꾸지 않았다(`kit/selftest.py` 가 v9-final3 와 화소 단위로 같음을 확인한다). 지형의 모든 도트는 EasyRPG RTP World(CC BY 4.0)의 팔레트·명암 단계·질감·외곽선 결을 따라
    코드 안에서 좌표로 찍은 손 도트이며, 원본 킷 조각을 색만 바꿔 쓰는 부분은 원본의 파생물이다. 크로노 트리거·파이널 판타지 VI는 지형 구성 방식을 관찰했을 뿐 그 게임의 그림·데이터·색값은 쓰거나 베끼지 않았다.
  - `kit/assets/world-plus.png` : `easyrpg-chipset-world.png`(EasyRPG RTP World, CC BY 4.0)의 수정본(기존 `world-plus.png`, 변경 기록은 `tiledata/atlas-pick/worldmap-easyrpg-plus/changes.json`).
  - `iconsets/fantasy/sheet.png` : v9 최종3 시트(`design-map/v9-final/ext-v9-final3.png`, 커밋 cbdab2d47)의 사본. 아이콘 38종은 각 묶음(d2721b83f · d9c412be4 · 65cbdabfd · 0d48383ed · e61cee6ee · 40d6fc987)이
    `easyrpg-chipset-world.png` 의 팔레트 안에서 손으로 찍은 도트를 골라 합친 것이다. 원본 칩셋에 없는 색은 `manifest.json` 의 `extra_colors`(24색)에 적었다. 생성 이미지·트레이싱 없음.
  - `palettes/*.json` : 재배색 실험(`design-map/recolor_v9.py`, 커밋 4e54b4030)의 OKLab 변환을 가져와 색 표(JSON)로 옮기고, 한겨울·황혼·화산 재 팔레트는 지형 종류별 램프로 다시 손으로 적었다.
    색은 전부 코드 안에서 손으로 적은 값이며 다른 게임의 색값을 쓰지 않았다.
  - `journeys/fantasy-5act.json` : v9 여정 설계(`journey_plan_v9.py`, 커밋 b212f8609)의 장소·막·수단 서술을 아이콘 id 없이 역할 id 로 옮긴 것.
  생성 이미지·트레이싱 없음(2026-10-01, OPRN Studio).
