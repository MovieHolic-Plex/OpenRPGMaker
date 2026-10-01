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

- 6단계 성곽 도시 재작업(2026-10-01): `design-map/city_v6.py`·`make_cities_v6.py`·`make_design_page_v6.py` 와 산출물(`cities-v6/`, `design-1x-v6.png`, `ext-v6.*`, `anim-v6/`, `castle-study.md`). `easyrpg-chipset-world.png`(EasyRPG RTP World, CC BY 4.0)의 어두운 성 모듈(탑·벽·성문·안쪽 성)과 마을 집 픽셀을 잘라 재배열하고 집 지붕 색만 원본 팔레트 안에서 바꿨다(CC BY 4.0 파생물). 부두·배·풀 디더는 원본 팔레트로 손으로 찍었다. 생성 이미지·트레이싱 없음.
- 6단계(2026-10-01): `design-map/city_v7.py`·`make_cities_v7.py`(팔각 성벽 성곽 도시, `cities-v7/`), `coast_v6.py`(해안선 재성형·모래/거품선·3띠 바다·숲 가장자리 수관 덩이), `landmarks_v6.py`(랜드마크 7종: 천공섬·거대 탑·폐허 도시·거목·분화구 호수·사막 신전·고대 돌원), `make_design_page_v7.py` 와 산출물(`design-1x-v7.png`, `ext-v7.*`, `anim-v7/`). 성곽 도시는 원본 World.png 어두운 성 모듈을 재배열한 CC BY 4.0 파생물이고, 해안·바다·랜드마크 7종은 원본 팔레트 색을 좌표로 적어 Pillow 로 손수 찍은 도트다. 생성 이미지·트레이싱 없음.

- 7단계(2026-10-01): `design-map/landmarks_v7.py`(랜드마크 7종 3/4 재작도), `cliff_v7.py`·`cliff_crops.py`(고원·협곡 절벽 외곽선: 둥근 모서리·V자 지층·턱·그림자), `anim_v5.py` 감속(구름 60~90초 횡단, 연기 200~300ms 6프레임), `make_design_page_v7.py`(속도 슬라이더·절벽 전후 비교), 산출물(`design-1x-v7.png`, `design-1x-v7-precliff.png`, `ext-v7.*`, `cities-v7/`, `anim-v7/`).
  모두 EasyRPG RTP World(CC BY 4.0)의 성·절벽·산 문법을 8배로 재어 코드 안에서 좌표로 찍은 손 도트(Pillow/numpy)이다. 생성 이미지·트레이싱 없음.

- 8단계(2026-10-01): `design-map/landmarks_v8.py`(천공섬·거목·사막 신전·폐허 도시 재작도), `cliff_v8.py`(절벽 벽 돌 덩이 결·고원 윗면 재포장·턱·부스러기·그림자, 협곡 구덩이 깊이, 메사 탁상 뷰트, 흙 바닥 그루터기 장식), `make_map_v5.py`(CITY_TAG=v8: 랜드마크 길 6개, 천공섬 그림자), `make_design_page_v8.py`, 산출물(`design-1x-v8.png`, `ext-v8.*`, `anim-v8/`).
  천공섬 위 나무는 `easyrpg-chipset-world.png`(EasyRPG RTP World, CC BY 4.0) 숲 칸(0,12)의 나무 한 그루를 풀색만 빼고 옮겨 심었고, 폐허 도시의 탑·성벽은 원본 어두운 성 모듈을 잘라 부순 것이다(CC BY 4.0 파생물).
  그 밖의 도트는 원본 World.png 의 큰 나무·절벽·성·신전 칸을 8배로 재어 그 색만 좌표로 적어 찍은 손 도트(Pillow/numpy)이다. 크로노 트리거·FF6는 관찰만 했다. 생성 이미지·트레이싱 없음.
