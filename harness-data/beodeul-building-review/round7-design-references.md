# 주택 25종 · round 7 형태 연구

2026-10-06 요청: 크로노 트리거·FF6·JRPG의 집 모양을 실제 그림으로 살펴보고 주택 후보 25종을 추가한다. 기존 30종의 그림과 인간 결정은 보존한다. 연구 그림은 관찰용이며 후보의 픽셀 입력으로 사용하지 않는다.

## 실제로 확인한 자료

아래 이미지와 브라우저 관찰 기록은 `output/beodeul-building-review/round7-research/`에만 있다. 저작권 게임 이미지 원본을 공용 게임 소재로 배포하지 않는다. 자료에 보이는 특징과 아래 신규 설계로의 해석을 구분한다.

| 자료 | 화면에서 확인한 특징 | 이번 설계에 반영한 해석 |
|---|---|---|
| [Chrono Trigger 1000 AD 월드맵](https://www.snesmaps.com/maps/ChronoTrigger/ChronoTriggerOverworldPresent.html) · [이미지](https://www.snesmaps.com/maps/ChronoTrigger/ChronoTriggerOverworldPresent.png) | 작은 주택 아이콘의 낮은 단동, 불균등한 부속동, 메디나의 둥근 지붕 군집 | 낮고 긴 농가, 높낮이가 다른 부엌채, 둥근 탑과 살림채. **월드맵 아이콘이므로 일반 건물 시점이나 도트를 복제하지 않는다.** |
| [FF6 Zozo · Square Enix](https://eu.finalfantasy.com/topics/274) · [이미지](https://cache-eu.finalfantasy.com/uploads/content/file/2021/03/30/4330/210401_ddoff_1.jpg) | 높은 좁은 다층 건물, 층 사이 수평 구조와 발코니, 비대칭 돌출부 | 삼층 주택, 낮은 블록과 높은 돌집, 창 뒤 목재 발코니 |
| [FF6 지도 모음](https://fantasyanime.com/finalfantasy/ff6/ff6maps.htm) · [Narshe GBA](https://fantasyanime.com/finalfantasy/ff6/images/maps/ff6gba_map01-Narshe1.png) | 큰 경사지붕과 크기·높이가 다른 박공의 조합 | 중심 박공, 서로 엇갈린 박공, 세 박공의 연속. 확인한 자료는 GBA판이다. |
| [Jidoor GBA](https://fantasyanime.com/finalfantasy/ff6/images/maps/ff6gba_map25-Jidoor.png) | 넓은 주택과 대칭적인 전면 구성·날개 | 양쪽 박공 날개, 중앙 다락, 앞으로 나온 현관을 가진 저택 |
| [South Figaro GBA](https://fantasyanime.com/finalfantasy/ff6/images/maps/ff6gba_map07-SouthFigaro.png) | 연결된 여러 지붕과 높낮이가 다른 부피 | 십자 박공과 연결동. 비슷한 색의 지붕만 반복하지 않고 윤곽과 층수를 바꾼다. |
| [Secret of Mana Potos](https://www.thonky.com/secret-of-mana/back-in-potos) · [게임 화면](https://www.thonky.com/secret-of-mana/_IMG/back-in-potos.png) | 가파른 붉은 박공, 원형 창, 아치형 유리창과 출입문 | 작은 돌집, 둥근 창, 세로 아치창, 돌출 현관 |
| [Breath of Fire II · Capcom](https://news.capcomusa.com/lets/browse/breath-of-fire-ii-heats-up-the-new-nintendo-3ds-virtual-console) · [게임 화면](https://cdn.capcom-unity.com/capcom-unity.com/user/nukacola/breath_of_fire/03053b50bb5f32a207375e5484dc2aac.gif?v=222000) | 큰 박공, 높은 쌍동 주택과 층 위 연결 구조 | 쌍박공 연결 주택, 다층의 큰 주택과 저택. 문은 지상 한 곳으로 유지한다. |

접속이 막힌 SNES Narshe 원본 시트와 일부 VGMaps 요청은 관찰 근거에 포함하지 않는다. 실제 열람 성공·실패는 `actual-browser-sources.json`, `additional-browser-sources.json`, `ct-bof-browser-sources.json`에 기록했다.

## 25종 설계와 실제 좌표

각 주택의 형태·층 순서·벽 격자·원본 부품 사각형·창 좌표는 `src/harnesses/beodeul-building-review/node/author_round7.py`의 `PLANS`에 명시했다. 01 작은 돌집, 02 긴 농가, 03 높은 본채/부엌, 04 중앙 박공, 05 낮은 옆지붕, 06 발코니 삼층, 07 높은 돌집/살림채, 08 쌍박공, 09 긴 맨사드, 10 두 전면 날개, 11 낮은 박공 전면, 12 십자 박공, 13 엇갈린 석조 박공, 14 깊은 현관, 15 세 박공, 16 둥근 탑/살림채, 17 종 지붕 탑/살림채, 18 쌍탑, 19 구근 지붕/낮은 양날개, 20 둥근 본채/긴 현관, 21 맨사드 다락/옆채, 22 꺾인 너와/낮은 기와채, 23 통지붕 삼층, 24 종 지붕 다락, 25 양박공/중앙 현관 저택이다.

창은 원본 직사각 창·석조 둥근 창과 명시한 12×24 아치창, 16×16 덧문 유리창, 원형 창을 조합한다. 발코니는 64×12 직접 쓴 격자이며 뒤쪽은 유리창이다. 원본 회벽·석재 부품은 1:1 픽셀로 읽고, 현재 허용된 round 6의 맨사드·꺾인 너와·통지붕·종 지붕·구근 지붕을 정확한 크기의 부품으로 쓴다. 원본 구리 기와 박공은 그대로 보존하며, 일부 우진각 면은 기록한 재질 색상표로 청회색·올리브·금갈색을 맞춘다. 지붕 재질을 생성 이미지·노이즈·축소로 대체하지 않는다.

`round7-detail-sources.json`은 모든 부품의 출처와 좌표, 창/발코니 격자, 최종 RGBA 팔레트와 픽셀 배열, 원본 PNG SHA를 보존한다. `bake_round7.py`는 25종을 전체 격자에서 다시 굽고 각각의 SHA를 대조한다. 탑 몸체에 예배당 옆지붕이 따라오지 않도록 원형 제분소 몸체와 안전한 둥근 지붕·문 제거 부품만 읽는다.

## 공개 조건

활성 시드 전체 55종은 변경하지 않은 출처 계약, 독립 질감/구조 Visual QA, 숨긴 부정 표본 검증과 증거 봉인을 모두 만족해야 공개한다. 반려는 실제 그림을 수정하고 새 해시로 재검수한다. 인간의 이전 SHA 결정은 보존하며 신규 25종은 자동 허용하지 않는다. `?ui=7&round=7`에서 이번 회차만 검수한다. 허용 전 번들·지도에는 설치하지 않는다.

첫 질감 검사에서16~20의 곡면 기와/명암과17의 남은 지붕 조각이 반려되어, `round7_curved.py`의 명시적4px 셀·기존 곡선 줄·왼쪽→오른쪽 전체 명암 색상표로 보정한다. 종 지붕은 전체 사각형을 투명 픽셀까지 교체한다. 실제 반려 결과와 원래 전체 격자는 보존하며 다른20종은 같은PNG SHA를 유지한다.

두 번째 검사에서17은 통과하고16·18·19·20의 긴 사선 강조 띠가 반려됐다. 세 번째 보정은 손 셀 덧칠을 제거하고 `arch:brick`의 미세한4px 기와 실제RGBA를 직접 읽으며, 명시한 열 깊이 오프셋과 원본 면 명암 색상표만 적용한다. 이4종만 새SHA로 바꾸고 통과21종은 유지한다.
