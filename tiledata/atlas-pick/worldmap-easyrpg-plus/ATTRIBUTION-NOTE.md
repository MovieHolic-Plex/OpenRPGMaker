# ATTRIBUTION 문구 초안 (엔진에 넣을 때 `public/assets/ATTRIBUTION.md` 에 붙인다)

`public/assets/ATTRIBUTION.md` 에는 이미 `easyrpg-chipset-world.png` from `ChipSet/World.png` (EasyRPG RTP) 가 실려 있다.
개선판은 CC BY 4.0 의 파생물이므로 아래 한 줄(변경 표시)을 더한다.

- `easyrpg-chipset-world-plus.png`, `easyrpg-chipset-world-plus-ext.png`: `easyrpg-chipset-world.png`(EasyRPG RTP World, CC BY 4.0)의 수정본이다.
  변경: 팔레트를 약간 눌렀고(채도 x0.86, 명도 x0.95, 초록 색상 -6도), 산 킷의 명암과 흙·모래·늪·눈 킷의 가장자리를 다시 그렸으며,
  아이콘 2칸의 윤곽을 다듬었다(칸 배치 불변, 272/480칸). 확장 시트의 아이콘 7종은 원본 아이콘의 픽셀을 잘라 늘리고 재배치해 만들었다(원본 팔레트 그대로, 새 색 없음; 2026-09-30, OPRN Studio).
  변경 기록: `tiledata/atlas-pick/worldmap-easyrpg-plus/changes.json`.

- `world-plus-terrain.png`(+ `.json`): `easyrpg-chipset-world.png`(EasyRPG RTP World, CC BY 4.0)의 파생물이다. 317칸 = 원본 조각 재조립 4칸(좌우 뒤집은 몸통)
  + 원본 팔레트·질감·윤곽을 따라 손으로 찍은 도트 313칸(길 킷 96, 눈·모래·흙 녹은 가장자리 킷 144, 나무 다리 8, 장식 소품 27, 고지대 킷 38: 벽·모서리·계단·경사·그림자, 원본 World 팔레트만 사용). 생성 이미지·트레이싱 없음(2026-09-30, OPRN Studio).
    칸별 출처 구분: `tiledata/atlas-pick/worldmap-easyrpg-plus/world-plus-terrain.json`, 생성 스크립트: `design-map/make_terrain_sheet.py`.

- `design-map/terrain_v4.py`, `make_map_v4.py`(4단계, 배포 번들 아님, 설계 데모): `easyrpg-chipset-world.png`(EasyRPG RTP World, CC BY 4.0)의 팔레트·명암 단계·질감·외곽선 결을 따라
  코드 안에서 좌표로 찍은 손 도트(바닥 18종·고원·물·물체 색조 변형)이다. 원본 킷 조각을 색만 바꿔 쓰는 부분은 원본의 파생물이므로 같은 CC BY 4.0 표기를 따른다.
  크로노 트리거·파이널 판타지 VI는 지형 구성 방식을 관찰해 `design-map/ff6-ct-study.md` 에 문장으로만 정리했고, 그 게임의 그림·데이터·해상도별 픽셀은 쓰거나 베끼지 않았다.
  생성 이미지·트레이싱 없음.

- 5단계(2026-10-01): `design-map/boundary_v5.py`·`city_v5.py`·`make_cities_v5.py`·`make_pairkit_v5.py`·`anim_v5.py`·`make_design_page_v5.py` 와 그 산출물(`cities-v5/`, `anim-v5/`, `pairkit-v5.png`, `pairmatrix-v5.png`).
  지형 쌍 경계·성곽 도시 3종·월드맵 애니메이션(구름·화산 연기·물결 등)은 EasyRPG RTP(CC BY 4.0) 팔레트를 기준으로 코드 안에서 좌표로 찍은 손 도트이다.
  크로노 트리거·파이널 판타지 VI는 구성 방식만 관찰했고 그 게임의 그림·데이터는 쓰거나 베끼지 않았다. 생성 이미지·트레이싱 없음.

원본 출처·라이선스(CC BY 4.0)는 기존 EasyRPG RTP 항목을 그대로 따른다.
