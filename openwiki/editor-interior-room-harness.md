> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# Interior Room Session Harness (villager-room-v1)

The LLM-harnessed interior pipeline: start session, advance build per layer, evaluate, and self-repair loop.

## 던전 천장과 단차의 구분 — 사용자 정정 (2026-09-13)

- 던전 칩셋의 **대각선 벽은 지면 사이의 고도차를 강조하는 단차**다. 천장(미굴착 어둠)과 연결하는 외곽 벽으로 쓰지 않는다.
- **천장과 연결 가능한 것은 정방향 벽**이다. 북쪽 일부 구간만 채우지 말고, 꺾인 외곽과 오목한 구간을 포함해 천장의 모든 남향 경계 아래에 벽면을 둔다. 벽은 상단·몸통·발치까지 이어져야 한다. 천장 하단의 윤곽이 바뀌면 직선 구간을 나누며 대각 벽으로 메우지 않는다.
- 적암 대각 조각 `16/17 → 46/47 → 76/77`은 동굴 내부 지면의 단차에만 배치한다. 위쪽 지면과 아래쪽 지면을 확보하고 천장 어둠과 접하지 않는지 확인한다.
- `dungeonRoomPipeline.ts`의 직선 천장 벽 계약은 유지한다. 과거 예제나 메타 설명의 “대각 절벽”이라는 이름만 보고 천장 연결까지 허용된 것으로 해석하지 않는다.
- 적용 콘텐츠: LegacyDb `rpg-zzu-ashen-vault-20260913` / `map_ashen_vault`. 엔진의 높이 시스템을 추가한 것이 아니라 칩셋 그림의 조립 규칙이다.
- 추가 사용자 정정: 내부 단차는 **대각면 → 직선면 → 가로 계단 → 직선면 → 대각면**으로 연결할 수 있다. 계단을 벽 앞에 장식처럼 붙이지 말고 벽면을 실제로 끊어 위쪽·아래쪽 지면을 잇는다. 벽면은 통행 불가, 계단은 통행 가능이며 양방향 이동을 확인한다. 같은 문법으로 두 단을 쌓아 다층 지형을 표현할 수 있다.
- **계단 조각은 시트에 그려진 모양 그대로 쓴다**(2026-09-25 사용자 지적 「1×3 으로 이상하게, 1×1 을 2×2 처럼」).
  - Tibo `141|111|171` 은 **가로** 조각(왼끝·몸통·오른끝)이다. 오르막은 세 칸을 한 줄로 놓고 세 줄 쌓아(첫 바닥 줄 + 북쪽 벽면 두 줄) 벽을 타고 오르게 한다. 한 열에 세로로 쌓으면 난간이 한 칸씩 튄 부러진 기둥이 된다.
  - Tibo `474|475` 는 틀 하나짜리 2×1 내리막이다. **한 줄만** 쓴다. 두 줄로 쌓으면 틀이 반복되어 창살 두 개로 보인다. `444|445` 는 따로 쓰는 2×1 오르막(부채꼴)이라 `474|475` 위에 붙이지 않는다.
  - 숲마을 계열 절벽 계단은 난간 있는 `111|112…|113` 을 절벽 면 한 줄마다 한 줄씩 깐다. 난간 없는 한 칸 디딤판 `2689`(옛 `bindings[374]`)을 두 칸씩 붙이면 회색 판을 절벽에 박은 것처럼 보인다. 생성기는 `scripts/content/lib/cliff-stairs.mjs`, 이미 그린 맵은 `fix-cliff-stairs.mjs`(JSON)·`save-cliff-stairs.mjs`(정본)로 고친다.
  - 계단 칸 위층에는 아무것도 놓지 않고 발치 줄도 비운다(`author-rpg-interiors.mjs` 가 검사한다).
- **계단을 벽의 밑동으로 쓰지 않는다.** 이 맵에서 `106`을 직선 벽의 마지막 행에 반복한 것은 저작 버그였다. 계단 `105/106/107`은 명시적으로 뚫은 계단 통로에만 놓고, 벽 몸통과 구분한다. 이동 테스트 통과만으로 이 시각 오류를 발견할 수 없으므로 계단 타일의 전체 배치 위치가 의도한 통로와 일치하는지도 확인한다.
- **대각선 4칸과 정방향 벽 3칸이 같은 높이**다(사용자 정정). 두 쪽을 모두 4칸으로 쌓으면 접합 높이가 어긋난다. 이 맵의 하향 대각 끝에 이어지는 직선 구간은 대각 상단의 지면 부분을 고려해 한 행 아래에서 시작하며 아래 경계를 유지한다. 연결 계단도 같은 3행 높이에 맞춘다. 대각 타일 배열과 천장 벽은 이 보정으로 바꾸지 않는다.

- 자연 동굴 저작에서 같은 크기 방의 격자와 U자 절벽·중앙 계단의 반복은 사용자에게 거절됐다. 장식 개수와 연결 검사 통과는 지형 다양성의 근거가 아니다. 큰 균열·용암호 같은 지형을 먼저 정하고, 외곽·굴길·단차·계단 위치를 구역별 좌표로 따로 저작한다.
- `map_ice_deep_cave` / `map_lava_deep_cave` 재저작은 비대칭 얼음 굴길과 중앙 용암호 회랑으로 구분한다. 절벽 시공 전 바닥을 기록하여 외곽 벽 침범을 검사하고, 웅덩이를 완성한 뒤 경로를 검증한다. 경로를 보존하려고 웅덩이를 사후 잘라내면 부자연스러운 일자 띠가 생긴다.

## 대형 광산 저작 접합 교정 (2026-09-13)

- 타일 인접만으로 철로 연결 방향을 추론하지 않는다. 경로에서 실제 사용한 양방향 간선을 기록하고, 그 간선의 방향으로 직선·곡선·분기를 선택한다. `57` 하나를 모든 T자/십자 분기에 반복하면 원본 다중 조각 그림이 잘려 가짜 분기처럼 보인다.
- 새 지선은 기존 선로와 접촉하면 합류를 끝낸다. 각 방 사이를 독립적으로 최단 경로 처리하면 같은 갱도에 나란한 중복 선로와 작은 고리가 생긴다.
- `432/433/462/463` V자 조각을 긴 단차로 반복하고 `19/49` 벽면을 계단으로 취급했던 대형 광산은 사용자에게 잘못된 조립으로 지적받았다. 이동 가능 판정만으로 시각적 계단·절벽 조립을 입증하지 못한다.
- `map_grand_labyrinth_mine` 보정은 원본 적암 절벽 실루엣의 대각 4행/직선 3행 계약을 사용하고, 바닥 부분은 갈색 지면으로 합성했다. 원본 계단 실루엣과 철로 방향별 조각도 전용 uploaded atlas에 포함한다. 엔진 변경이 아닌 프로젝트 저작 자산이다.
- uploaded atlas에는 기존 던전 전용 쿼터 렌더 가드가 적용되지 않는다. 이 맵은 기존 쿼터 조합을 고정 타일로 베이크해 천장 모서리를 보존한다. 검증에는 전체 연결 검사 외에 확대 접합 이미지, 출하 플레이어 확인, LegacyDb 저장 후 재로드가 필요하다.

## 사용자 광산 참고 이미지와 확장판 (2026-09-13)

- 수몰 성소의 회색 절벽을 길게 늘인 시도는 광산 참고 이미지와 닮지 않았다는 지적을 받았다. 참고를 그대로 따라 하라는 요청은 색·지형 윤곽·규모·철로·오브젝트 좌표까지 재현하는 작업이다. 추상적인 구불구불한 띠만 옮기지 않는다.
- 참고의 원본 칩셋은 갈색 바닥 `421`, 황갈색 절벽의 대각 `162/222`, `163/223`과 필요 시 몸통 `192/193`, 정면 지면 립 `196`과 벽 `226`이다. 적암 절벽을 회색으로 변환해서 대체하지 않는다. 통 `417`, 빈 통 `419`, 회암 덩어리 `322/323/352/353`, 석순 `261/291`도 직접 대조했다.
- 원격 프로젝트 `rpg-zzu-ashen-vault-20260913`의 `map_reference_winding_mine`은 18×15 참고 재현본이다. `map_winding_mine_expanded`는 이를 좌표 `(18,10)`에 그대로 보존한 54×38 확장판이며, 가운데 하위·상위 타일 배열을 원본과 대조한다. 각각 장소에도 저장한다.
- 황갈색 절벽 접합 교정: 프로파일 `y`에서 하향 대각은 `y > prev`, 상향 대각은 `next < y`인 칸에 둔다. 양쪽 조건에 이전·다음 기울기를 모두 섞으면 직선 끝과 사선 끝에 대각이 한 칸 더 들어가 윗선/밑선이 14px 어긋난다. 단면 끝이 다른 구역의 사선으로 이어지면 이웃 프로파일 한 칸도 판정에 포함한다. 확장부 98개 접합 경계의 픽셀 검사에서 최대 차이 16px → 3px를 확인했다.
- 확장은 높이가 같은 지면 경계를 이어 통로의 폭을 조절하고, 넓어진 작업 공간에 적재물을 모으는 방식으로 저작한다. 철로는 실제 간선으로 연결을 검증하고, 단차를 가로지르는 운반선에는 통행 가능한 연결부를 만든다.

## 광산 참고 문법의 얼음·용암 적용 (2026-09-13)

- `map_ice_deep_cave`(68×58)와 `map_lava_deep_cave`(72×58)를 각각 빙벽 굴길과 용암 분지로 다시 저작했다. 예전 112×96 판의 분리된 짧은 벽 대신 연속된 고도 경계 세 줄이 지면과 통로 폭을 정한다. 두 맵의 굴곡·웅덩이 좌표는 별도로 저작하며, 맵과 기존 `place_ice_deep_cave` / `place_lava_deep_cave` 단면을 함께 갱신한다.
- 접합 좌표를 **립이 들어가는 행** `y`로 통일하면 하향 `y > prev`, 상향 `next < y`, 나머지 직선이다. 얼음 직선은 `[343,373,403]`, 대각은 `[286,316,346]` 또는 `[287,317,347]`; 용암 직선은 `[301,103,133,133]`, 대각은 `[16,46,46,76]` 또는 `[17,47,47,77]`이다. 이 좌표의 `y+1`이 직선 벽의 상단이며, 기존 설산 문서의 벽상단 crest 좌표와 혼동하지 않는다. 얼음 2행·용암 3행 계단은 실제 벽면만 끊는다.
- 원본 아틀라스의 바닥 팔레트와 대조해 각 단면의 양 끝 픽셀에서 윗선·밑선을 측정했다. 계단을 제외한 얼음 173곳, 용암 181곳의 최대 차이는 모두 3px다. 다른 단면을 검출하지 않도록 각 열의 자체 높이 범위만 검사한다.
- 대각 조각에는 바닥 그림도 포함된다. 웅덩이를 그 조각 바로 옆에 칠하지 않으며, 8방향으로 한 칸의 발치 바닥을 남겨 사선 옆 통로가 대각으로만 접촉해 끊기지 않게 한다. 장식은 개별 굴곡·골에 배치하고, 키 큰 결정·석순의 상단은 발치 벽을 가릴 수 있지만 최하단 조각은 실제 바닥에 놓는다.
- 재현/증거: `output/build-element-contour-caves.mts`, `output/audit-element-cliff-seams.py`, `output/element-contour-qa.mjs`, `output/evidence/element-contour-caves/`. 출하 플레이어의 계단 15개 왕복과 두 맵의 연속 등반 경로를 검증한다. 저장 완료 판단은 동일 프로젝트의 LegacyDb 저장 후 맵·타일셋·장소 재로드 일치로 한다.

## 얼음·용암 절벽 굴곡과 소품 보강 (2026-09-14)

- 사용자는 연속 단차 판을 전보다 낫다고 평가했지만 복잡한 절벽과 소품 다양성이 부족하다고 지적했다. 같은 두 맵의 긴 대각면에 짧은 수평 턱·추가 굴곡을 넣고, 특정 골의 벽 밑선을 내려 두꺼운 면을 만들었다. 기존 계단 연결과 입구 좌표를 검증하며 장소를 함께 갱신한다.
- 변하는 벽 두께를 고정 높이 단면으로 조립하지 않는다. 윗선 `profile[x]`과 밑선 `base[x]`을 따로 저작하고 각각의 이전·다음 높이로 대각 캡과 대각 발치를 고른다. 두 선 모두 이웃 높이 차이는 최대 1칸이고, 상승 직후 바로 하강하는 한 칸짜리 꼭짓점은 허용하지 않는다. 중간은 해당 벽의 몸통으로 채운다. 계단은 세 열의 윗선·밑선이 각각 같아야 하며 그 구간의 실제 벽 높이만큼 놓는다. 이번 두꺼운 벽은 얼음 2–4행, 용암 3–6행이다. 354개 접합의 픽셀 차이는 최대 3px였으며, 이는 국소 이음새 검사이지 전체 공간 구성의 미적 평가가 아니다.
- 아틀라스를 직접 재검토한 소품: 쌍둥이 결정 `413`, 완전한 세로 수정 `119/149`, 둥근 바위 `290`, 갈색 바위 한 벌 `259/260`, 파편 `412`, 해골 `299`, 석주 `446/476`, 항아리 `418`, 통 `417`, 작은 통 `419`, 밧줄 `296`, 벽 횃불 `264`. 검색용 의미표의 일부 설명은 그림과 다르므로 그것만 믿지 않는다. `117`은 소형 수정이 아니라 선로 끝이다. `119` 단독은 수정 중간이 잘린 모습이므로 소품에는 `119/149`를 함께 쓴다. `476` 단독은 의도한 부서진 석주에 한해 사용한다.
- 소품은 결정 골·돌무더기·작은 석주 유적·탐사 잔해의 좌표 묶음으로 배치한다. 키 큰 소품의 상단은 벽을 가릴 수 있어도 바닥 조각은 지면을 지지해야 하고, 이동 경로와 계단 앞은 예약한다. 새 소품 때문에 기존 길이 막히지 않았는지 최종 장식 후 재검사한다.
- 재현/증거: `output/build-element-complex-caves.mts`, `output/audit-element-complex-seams.py`, `output/element-complex-qa.mjs`, `output/evidence/element-complex-caves/`. 원격 저장은 검토한 preview 자체를 `output/save-element-complex-caves.mts`로 저장하며, 검토 중 원격 프로젝트가 바뀌었으면 저장을 거절한다.

## 서로 합류하는 복합 절벽 — 실제 반영 (2026-09-14)

- 사용자의 추가 참고는 독립된 절벽을 구불구불하게 만들거나 벽 두께만 늘리는 예가 아니다. 두 단차 사이의 중간 지면이 쐐기로 좁아져 끝나고, 두 벽면이 합쳐지는 지형이다. 이전 두 번의 보강은 이 합류를 구현하지 못했다.
- `element-confluence-caves` 판은 위·아래 단면을 서로 향하게 저작한다. 한 열에서 다음 단면의 윗선이 앞 단면의 밑선+1 이하이면, 두 구간을 하나의 벽 구간으로 합친다. 캡은 가장 위 단면, 발치는 가장 아래 단면에서 선택하고 가운데는 벽 몸통만 채운다. 가려진 하단 단면의 캡이나 상단 단면의 발치를 남겨 눈/바닥의 일자 틈을 만들지 않는다.
- 얼음 x32–35의 4열, 용암 x36–40의 5열에서 실제 합류를 검사했다. 접합 내부에 바닥 셀이 없으며, 인접 단면의 일반 접합 315곳은 최대 픽셀 차이 3px다. 합류부는 분리된 두 단면이 한 구간으로 변하므로 일반 단면별 비교에서 제외하고 전용 내부 셀 검사와 확대 PNG로 검토한다.
- 윗선과 밑선 모두 인접 차이 ≤1과 한 칸짜리 꼭짓점 금지를 사전 검사한다. 수평 턱 없이 즉시 내려갔다 올라가는 꼭짓점은 대각 캡이 서로 맞지 않는다. 높이 보정이 기존 대각 방향과 겹쳐 두 칸씩 뛰는 밑선도 금지한다.
- 증거: `output/evidence/element-confluence-caves/{ice,lava}-junction.png`, `seam-audit.json`, `reports.json`. 시공 `output/build-element-confluence-caves.mts`; 플레이어 `output/element-confluence-qa.mjs`; 원격 저장 `output/save-element-confluence-caves.mts`. 맵과 장소를 같이 갱신하고 저장 후 재로드한다.
- 후속 `element-network-caves`는 합류부를 각 맵 네 곳으로 분산했다. 얼음 x15–17·19–25·33–35·51–54, 용암 x7–9·36–40·59–61·64–68이다. 용암 x67 계단은 합쳐진 벽의 최하단까지 내려가도록 착지 높이를 계산한다(top20, bottom28). 내부 벽 검사에서 저작된 계단 셀만 예외로 허용한다. 일반 접합 214곳 최대 차이 3px, 전용 플레이어 QA 27비트(계단 17곳 왕복과 이동 경로 8개 포함) 통과. 증거와 저장 스크립트는 동일한 `element-network-caves` 이름을 사용한다.

- 빈 바닥 장식 후속 `element-dressed-caves`: 기존 복합 절벽·계단의 lowerTiles와 기존 소품을 보존한 채, 칩셋의 완성된 결정/낙석/석상/기둥/탐사 물자 조합을 각각 24개 좌표 구역에 저작했다. 얼음 162개·용암 144개 추가. 같은 스탬프 반복 대신 구역마다 다른 상대 좌표를 사용하며, 계단 앞과 기존 실보행 경로·주요 지점 연결을 예약한다. 큰 소품의 모든 조각이 원래 바닥에 지지되는지 확인한다. 스크립트 `output/decorate-element-caves.mts`, 증거 `output/evidence/element-dressed-caves/`.

- 사용자는 위 `element-dressed-caves`의 장식 증가를 **맥락 없는 배치로 거절**했다. 소품 수와 구역 이름은 자연스러움의 근거가 아니다. 후속 `element-context-caves`는 상단 장식을 다시 저작하며 석상·기둥·내부 물자를 제거한다. 결정/낙석의 원점을 특정 절벽 밑선에 고정하고, 작은 파편은 그 아래에 배치한다. 호숫가 군락은 해안과 이어지며 탐사 물자는 입구의 바위 쉼터 한 곳에만 둔다. 통행과 빈 여백을 남긴다. 시공 `output/context-element-caves.mts`; 검증·저장·전체 PNG는 `element-context-caves` 증거를 참조한다.

## 기존 칩셋 던전 네 종류 (2026-09-14)

- `four-context-dungeons`는 기존 원격 맵을 보존하고 네 장소를 새로 저작한다: `map_old_waterworks` 48×40, `map_resonant_crystal_grotto` 54×38, `map_fallen_ossuary` 48×42, `map_creeper_haul_mine` 60×42. 대상 프로젝트는 `rpg-zzu-ashen-vault-20260913`이며 기본 env 프로젝트로 저장하지 않는다.
- 수로는 native 물 `151`과 석재 `187`, 벽 `49`(초판 오류, 아래 v2에서 `22/52`로 정정), 좁은 석재 통로 `110`, 물 위 철창으로 구성한다. 전용 수문이나 다리 자산이 있다고 가정하지 않는다. 묘지는 묘비 `148`·명판 `265`·석상·석주를 묘실/중앙 회랑에 배치하고 북동쪽에 무너진 우회로를 둔다.
- 수정굴과 폐광은 기존 참고 갱도의 native 조립 아틀라스를 재사용한다(기존 asset 수정 없음). 갈색 대각 절벽과 중간 지면이 합류하며, 통행 구간은 기존 판자 `959`로 잇는다. 수정은 절벽 밑선과 끝방 군락에 집중한다. 폐광은 거대 뿌리 전용 아트가 없으므로 깊은 북동쪽의 벽 덩굴과 바닥 이끼로 잠식을 표현한다.
- 철로에 최단 보행 BFS를 그대로 사용하면 절벽 곁에서 한 칸짜리 지그재그가 생긴다. 운반선은 긴 직선과 명시한 회전점을 저작하고, 인접 그래프로 코너/분기를 선택한다. 이번 철로 153칸은 연결 성분 1개와 양쪽 접속 방향을 검사했다. 보행 경로는 소품 배치 후 다시 계산한다.
- 시공 `output/build-four-context-dungeons.mts`; 검사 `output/audit-four-context-dungeons.py`; 플레이어 `output/four-context-dungeons-qa.mjs`; 원격 저장 `output/save-four-context-dungeons.mts`. 전체 맵 PNG, 리뷰용 preview, 기존 원격 before, 보고서는 `output/evidence/four-context-dungeons/`에 모은다. 저장 직전 원격이 before와 같은지 확인하고 저장 후 맵·타일셋·장소를 다시 로드한다.

- 네 종류의 초판은 사용자에게 허접한 공간 구성으로 거절됐다. 후속 `four-context-dungeons-v2`는 수로 외곽을 취수실·팔각 집수실·정비 회랑의 서로 다른 폭으로 다시 저작하고, 묘지의 같은 방 네 개를 비대칭 묘실과 순환 연결로 바꾼다. 회색 `49`는 계단 모양이므로 벽에 쓰지 않고 `22/52` 벽면으로 교체했다. 수정굴·폐광은 세 단의 절벽과 합류부, 바닥 함몰을 통해 넓은 빈 공간을 분할한다. 폐광 운반선은 꺾이는 하부 간선과 중간 순환 연결을 두며 171칸·연결 성분 1개다.
- 기존 참고 아틀라스처럼 uploaded 이미지에 전체 타일로 그릴 때 `251`은 완성된 구덩이 모서리가 아니라 quarter 합성용 소스여서 금색 점이 떠 보인다. 이번 whole-cell 함몰 구역의 이 내부 소스는 몸통 `310`으로 바꿔 검토했다. 원본 자산은 변경하지 않는다. 재현 `output/build-four-context-dungeons-v2.mts`, 동일 이름의 audit/QA/save 스크립트와 증거 디렉터리.

## 네 던전의 연결 구조 우선 재저작 (2026-09-14)

- 사용자는 v2도 작위적인 지형으로 거절했다. 전폭 물결 절벽 세 줄에 구멍/장식을 추가하는 방식은 자연스러움의 해결책이 아니었다. v3는 먼저 서로 다른 크기의 방과 굽은 연결선, 순환 길을 저작하고 그 마스크에서 천장/정방향 벽을 만든다. 자연 동굴만 낮은 공간 주파수의 경계 변형을 쓰며, 묘실과 수로 시설의 직선은 용도에 맞게 유지한다.
- 최신 참고는 [Muller의 2026-06 방 그래프 개발 사례](https://tinkernotes.io/blog/generating-dungeons-room-graph/)다. [2025 PCG Benchmark](https://arxiv.org/abs/2503.21474)의 품질·다양성·제어 구분도 검토했다. 이는 특정 알고리즘이 미관을 보장한다는 근거가 아니다. [Boris의 WFC 설명](https://www.boristhebrave.com/2020/02/08/wave-function-collapse-tips-and-tricks/)은 2020년 기반 자료이며, 전역 구조 없이 로컬 타일 일치만으로 해결하지 말라는 참고다. 이번 저작은 전체 WFC 솔버 구현이 아니다.
- 대각 절벽은 수정굴/광산의 큰 공동 안에서 합류시키며, 끝을 직선으로 연장해 주변 암반과 닿게 한다. 중간에 떠 있는 절벽 꼬리나 반복되는 전폭 능선을 만들지 않는다. 천장 아래는 계속 정방향 벽만 쓴다. 광산 운반선은 방향·직진 길이를 상태로 둔 경로 탐색으로 짧은 지그재그에 비용을 주고, native 코너와 분기를 접속 그래프로 고른다.
- 소품은 자연 방의 가장자리 거리와 군락별 크기 차이를 사용한다. 묘비/명판은 실제 매장 구획으로, 수로 물자는 정비 착지점으로, 붕괴 소품은 파손된 방으로 한정한다. 연결성·소품 개수·방 이름은 미관 점수가 아니다. 전체 PNG와 실제 플레이어 보행을 별도로 검토한다.
- v3 크기: 수로 56×50, 수정굴 56×50, 납골당 54×50, 광산 64×52. 기존 네 map/place id를 유지한다. 재현 스크립트 `output/build-four-context-dungeons-v3.mts`, `output/audit-four-context-dungeons-v3.py`, `output/four-context-dungeons-v3-qa.mjs`, `output/save-four-context-dungeons-v3.mts`. 원격 before와 preview/보고서/PNG/저장 후 재로드 receipt는 `output/evidence/four-context-dungeons-v3/`에 있다. 로컬 output은 gitignored 보조 자료이며 정본은 지정한 LegacyDb 프로젝트와 장소다.

## 설산 빙벽 조립 정정 (2026-09-13)

- 적암의 배열을 얼음 타일에 그대로 치환하지 않는다. 설산 수평 벽은 `373 → 403` 상하 한 벌이며, 밑동 `403`을 몸통처럼 반복하지 않는다. 윗 지면의 립은 `343`이다.
- 빙벽 3행(캡·몸통·밑동)에 대응하는 수평 벽은 2행이고, 대각 밑동 옆은 눈 지면이다. 좌면은 crest보다 한 행 위에서, 우면은 crest에서 시작한다. 근거는 `src/project/defaults/iceGrandPlain64.ts`의 `MEASURED_CLIFF_FACTS`와 시공 루프다.
- `408/409`는 눈 능선의 좌우 경사 윤곽이다. 두 칸짜리 봉우리 장식으로만 취급하지 않는다. `408`을 우상향 대각으로, `409`를 우하향 대각으로 연장해 넓은 봉우리와 골을 잇는다.
- `408/409`는 투명 삼각 부분이 있으므로 눈 바닥 `67` 위의 상위 레이어에 둔다. 하위 레이어 단독 배치는 외곽에 검은 계단형 빈칸을 만든다. 단차 확인 맵 `map_snow_height_study`는 뒤 모서리를 이 대각선으로, 앞 모서리를 빙벽 대각선으로 꺾고 두 계단의 왕복을 검증했다.
- 정방향 능선은 눈 윗변 `283`을 가로로 이어 만든다. `408` 상승 경사 → `283` 수평 마루 → `409` 하강 경사를 같은 윗선으로 연결하여, 전부 삼각 봉우리로만 만드는 배치를 피한다. revision 5에 적용했다.
- 추가 사용자 정정: 층 사이에 작은 봉우리를 얹으면 독립된 산 두 개처럼 보인다. 또한 `408/409` 바로 아래에 정방향 벽을 붙이는 것도 오답이다. 능선 아래에는 눈 사면을 확보하고, 절벽은 사면이 끝나 떨어지는 별도 위치에 둔다. revision 4는 능선 아래 최소 6칸의 눈 지면을 검사한다.
- revision 6은 큰 정상 하나와 비대칭 어깨, 두 단의 짧은 산자락으로 재구성했다. 맵을 가로지르는 반복 띠를 제거하고 얼음·바위를 양측 골과 사면 가장자리로 모았다. 타일 접합 검사와 별도로 전체 산 형태를 시각 검토한다.
- 적용: 프로젝트 `rpg-zzu-ashen-vault-20260913`, 맵 `map_snow_windcrest`, 장소 `place_snow_windcrest` revision 6. 맵과 장소 단면을 함께 갱신하고 저장 후 재로드로 확인한다. 이전 revision 2·3의 벽 위 작은 봉우리 배치는 폐기했다.


## Interior authoring/load consistency (2026-09-07)

- `project/tilesetHarness/interiorRoomGroups.ts` owns the supplemental room records
  and shared tile vocabulary. `ensureInteriorProjectGroups` composes the 26 pack
  records and 13 supplemental records for both room authoring and bundled load.
  Existing records win by their exact ID, including user-origin records that retain
  `source: bundled-default`; IDs, membership, rules, grammar and overrides are not
  replaced or renamed, except for the complete proven legacy table factory record
  described below. Suppressed IDs stay suppressed. A prefix is not ownership.
- Group composition is separate from per-tile runtime seeding. Only pack groups
  seed passage/priority/repeatability; supplemental room guidance must not overwrite
  those contracts. Existing unknown/retired-looking groups are preserved, not deleted.
- Default `cabinet` cells 148/178 are upper-layer; the floor beneath them remains.
  Saved kits still take precedence. `repairLegacyInteriorCabinetKit` upgrades only
  the complete known old catalog record on the exact bundled interior texture,
  with no tile/graft/layer override. A changed name, AI record, row, part, ID or
  provenance leaves it authored; `learnedFrom` alone is never sufficient.
- The former membership-based map repair is intentionally no longer permitted.
  A saved room plan and a matching kit do not prove per-cell authorship or recover
  the original floor. Ambiguous already-placed lower props remain exactly as saved;
  automatic repair is confined to proven legacy kit definitions. This preserves
  explicit lower-layer counterexamples rather than silently choosing a new floor.
- `test/interiorLoadConsistency.test.ts` runs the real room pipeline and editor
  load/flush/fresh-load paths, checks canonical identity, upper cabinets over default
  and nondefault floors, group preservation, strict legacy eligibility, and migration
  failure/concurrent-edit behavior. No shipped demo, live DB or model is involved.
  The archived Round8 result remains failed; these are engine regression contracts,
  not a retrospective success label for that run.
- Deferred migration/autosave callbacks belong to the content lineage and timer
  handle that scheduled them. A reload makes the old callback inert before it can
  change save state, consume a newer timer, or submit replacement content. Retry
  timers and their health probes enforce the same ownership, including after a
  pending probe response. `test/storeDeferredLineage.test.ts` invokes registered
  callbacks directly and checks clean replacement preservation, normal edit/flush,
  synchronous status-subscriber replacement, and same-lineage save catch-up.
- An explicit replacement flush also waits for any older in-flight transport to
  settle before saving under its own lineage. A alone never authorizes B, a queued
  B request cannot write C, and an A failure still rejects A's callers without
  cancelling a valid B request. `test/storeSaveOrdering.test.ts` covers this
  ordering with held real persistence transports and unchanged audio assertions.

## Closed expandable long tables (2026-09-07)

- The bundled interior table is `325 | 326* | 327`: left cap, zero or more
  repeatable middle tiles, right cap. `[325,327]` is closed; `[325,326]` is not.
  `table_long` and `counter` retain their upper-layer three-cell catalog assembly.
  The supplemental `harness-interior-house-v1-tavern-table` group includes all
  three tiles, with `leftCap`, `repeatBody`, `rightCap` and minimum width 2.
  The row painter honors that explicit minimum; its unspecified minimum remains 3.
- Cluster adjacency lint checks both directions. `bAlt` permits alternative
  neighbors of each `a`; `aAlt` permits alternative reverse neighbors of each `b`.
  Alternatives do not themselves become rule anchors or disable reverse checks.
  Without either array the original strict pair semantics remain unchanged.
  The table's original hard rule ID is retained with
  `{a:325,b:326,aAlt:[326],bAlt:[327],relation:"aLeftOfB"}`; a second hard rule uses
  `{a:326,b:327,aAlt:[325],bAlt:[326],relation:"aLeftOfB"}`. Together they check both
  caps and every middle tile. Room critique requires the same closed composition.
- `interiorLongTableLegacy.ts` migrates only a unique, complete frozen factory
  record, including `source:"bundled-default"`, on the exact bundled 16px/30-column/
  480-tile interior layout. Both room authoring and bundled load use it. Matching
  IDs or provenance alone are insufficient; customized/ambiguous records and
  suppressed IDs remain authored state, even when their retained rules report lint.
- Table-specific user/origin/lock metadata, grafts and lower-layer overrides block
  migration and runtime reseeding. This includes the legacy priority-only case:
  metadata still says `defaultLayer:"upper"`, but `tileset.priority[tile]` is
  `"lower"`. An override on any of 325/326/327 preserves the table override
  through authoring, load and serialized reload. No map cells or kits are migrated.
- `test/interiorLongTable.test.ts` covers closed/broken runs, both normalizers,
  priority-only and other overrides, painters, critique and canonical fixed points.
  The original demo integrity assertion remains in force; demo content is unchanged.

Canonical room compatibility (T17-AV-4-I1): `canonicalRoomAlias` keeps existing
`PLACE_ALIASES` shorthand among historical receipt-mapped originals, but includes
same-atlas native user/AI/builtin name/tag matches in the ID-deduplicated ambiguity
decision. A native `bedroom` plus converted default house/bedroom rejects with
`spatial-ambiguous`; shorthand alone still selects house. Exact IDs (including
layout contexts), deleted-original exclusion, and general ambiguity retain their
existing behavior. Real-binder regressions: `test/spatialRoomNativeDefault.test.ts`
and `test/spatialRoomQualifier.test.ts`; scoped RED/GREEN evidence:
`output/evidence/tile-to-world/task-17/native-default-room-fix/`. This is backend
compatibility evidence, not whole-task17 provider/UI/publication acceptance.

## 사용자 타일 정정: 항아리·돌계단·석조 화로

- 235는 주전자가 아니라 **항아리**다. 기존 저장물의 `kettle`/`VR.KETTLE` 식별자는 유지하지만 검색 라벨·태그·가구 이름·시설 물건 설명은 항아리로 쓴다. 141·111·171은 **돌계단**이며 목제라고 설명하지 않는다.
- `402 403 404 / 432 433 434 / 462 463 464`는 낱개 벽·창살이 아니라 **하나의 3×3 석조 화로**다. `stone_hearth_unlit`은 이 배열 그대로다. 아래 가운데 `(1,2)`의 463은 불이 꺼진 화구다.
- `stone_hearth_lit`은 나머지 여덟 셀을 유지하고 463만 124로 바꾼다. 기존 불 스트립 `124→154→184→214`, 4fps를 사용한다. 상태별 가구 정의를 고르는 기능이지 클릭으로 불을 켜는 게임 이벤트를 자동 저작하는 기능은 아니다.
- 9개 석재 셀은 실내 `wall-panel` 그룹에서 빠지고 fixed `stone-hearth` 그룹으로 이동한다. 다른 칩셋의 동일 번호는 다른 그림이므로 건드리지 않는다. 기존 `hearth`(373)와 `stove`(21/51)는 별도 물건이다.
- `InteriorObjectDef.description`은 가구 킷의 `ai.description`으로 저장되고 다시 로드된다. `get_concept_facility`의 vocabulary는 상태 설명과 `tileIds`를 전달한다. 모델은 `stone_hearth_unlit`/`stone_hearth_lit`을 선택해 온전한 화로를 시공할 수 있다.
- 실내 일반 타일 렌더 경로는 불을 정지 그림으로 처리하고 있었다. `supportsChipsetTileAnimation(tileset,tile)`은 실내의 불 스트립만 추가로 허용한다. 마을 전용 길/나무 판정인 `isDefaultTilesetTexture`를 확장하지 않는다. 편집기와 출하 플레이어 양쪽에서 같은 조건을 사용한다.
- `scripts/sync-stone-hearth.mts --apply`는 기존 `rpg-zzu-inn-exploration-v4`의 관련 타일 메타·가구 정의·계단 설명을 저장하고 재로드한다. 맵 타일 배열과 맵 목록은 보존한다. 로컬 `map_hearth_qa`는 실제 도구 시공/애니메이션 검증용이며 원격 콘텐츠로 저장하지 않는다.
- 회귀: `test/stoneHearth.test.ts`(AI 조회·3×3 셀·양 상태·직렬화·통행), `test/interiorFireRendering.test.ts`(실제 플레이어 렌더러의 lower/upper 불 재생). `scripts/qa/stone-hearth.mjs`는 player.html의 실제 Phaser Sprite `animationupdate`를 관찰하고 각 프레임에서 일시정지해 PNG를 남긴다.

## 여관 검수표와 숙박 검증

- `vite-node --script scripts/inspect-inn.mts`는 `rpg-zzu-inn-exploration-v4`를 **읽기만** 한다. 원본 480타일, 저장된 가구 정의(현재 55종)의 셀별 조립, 저장 맵에서 전체 셀이 일치하는 배치 확대 예시를 `output/evidence/inn-inspection-v5`에 생성한다. 사용하지 않은 가구에 임시 시공 예시를 만들어 붙이지 않는다. 같은 그림을 재사용하는 가구가 있어 구조적 일치 수와 저작 물건 수는 다르다.
- 201·408·409·410은 코드/원격 가구 정의·세 여관 맵에서 사용 0을 확인한다. 408·409·410은 시맨틱/하네스 그룹에서도 빠져 있다. 201은 기존 분류에 남아 있지만 조립 미확정이므로 보고서에서 별도로 표시한다. 기존 라벨은 육안 확인 완료를 뜻하지 않는다.
- `node scripts/qa/inn-lodging.mjs`는 같은 해시의 원격 저장본을 전용 `player.html?e2eVitals=1`에서 연다. 실제 접수대까지 걸어가 키보드로 숙박을 실행한다. QA 훅은 준비할 때 세션의 돈/HP/MP만 설정하며 원격 데이터는 수정하지 않는다.
- 20G 숙박의 실측: 100→80G, 20→0G이며 현재 파티의 HP 7→514, MP 3→43. 19G·0G는 돈·HP·MP 보존 및 부족 안내, 아니오·Esc는 상태 보존 후 필드 복귀를 확인했다. 소지품·스위치·변수도 검사한다. 휴식/기상/종료 및 부족 상태는 DOM 변경을 미리 구독하고 고정 sleep 없이 기다린다.
- `node scripts/report-inn-inspection.mjs`는 검수와 숙박 증거의 프로젝트 해시를 비교하고 이미지 내장 HTML `output/evidence/inn-inspection-v5/index.html`을 만든다. 가구/타일 검색, 사용 여부/미확정 필터, 좌표·레이어 보기, 키보드 확대가 있다. `node scripts/qa/inn-inspection-report.mjs`가 1440·900·390px에서 모든 가구 카드·숙박 시나리오·원본 색인을 캡처하고 검색·디코딩·확대·넘침을 확인한다.

## 여관 꾸러미 전면 재구성 (2026-09-06)

- **구조 검토 수정:** `stairs_horizontal`은 3×3 조립으로 벽면 2행과 바닥 1행을 연속해서 잇는다. 바닥에 가로 한 줄만 놓지 않는다. 창문 등 벽걸이의 시작점은 벽면 상단으로 제한하고, 한 칸 벽 장식의 조사 이벤트는 그 아래 행에 두어 바닥에서 닿게 한다.
- double-row는 줄에서 가장 큰 방 높이를 모든 방에 복사하지 않는다. 북쪽 방은 남쪽 문을 기준으로 하단 정렬, 남쪽 방은 북쪽 문을 기준으로 상단 정렬하며 각자의 높이를 보존한다. 독실은 5×8→5×3, 다인실은 9×7→7×4, 상인방은 9×7→7×6, 알코브 객실은 11×8→9×7이다. 맵 높이는 입구 방이 아니라 모든 방의 가장 아래 끝을 포함한다.
- **1×1 계단은 한 개만:** 474와 475는 좌우 조각이 아니라 각각 완성된 단일 타일이다. `stairs_down`은 474 하나만 쓰며 475를 옆에 붙이지 않는다. `convertEntranceToDescent`, 연결 집, 방 연습 프로젝트 스크립트도 같은 규칙이다. 2층 계단참·다락의 실제 계단 앞으로 도착하며, 입구 이벤트 id는 유지하되 위치는 계단으로 옮긴다.
- **입구:** 개념 실내의 176번 표식과 출입 이벤트는 홀 남쪽 행이 아니라, 그 아래 천장 띠를 뚫은 바닥 통로(door.y+1)에 둔다. 방 안에 두면 표식 남쪽에 바닥이 한 칸 더 남아 입구가 건너뛴 것처럼 보인다. 위층에서 닫는 가짜 출입구에는 이 표식도 지워 계단과 입구가 뒤섞이지 않게 한다.
- **연결 집도 같은 계약:** `author_house`/마을의 `createHouseInteriorMap`은 꾸러미의 올라가는 계단을 착지 보정으로 덮지 않는다. 위층의 저작된 `stairs_down`이 있으면 그 위치를 전이·착지점으로 사용하고, 가짜 입구를 닫아 중복 계단을 만들지 않는다. 저작 계단이 없는 옛 꾸러미만 기존 합성 계단을 사용한다. `test/interiorConceptRoutes.test.ts`가 기본 여관을 공개 facade로 만들고 전체 계단 셀·단일 하강 계단·176 입구·실제 왕복 명령을 확인한다.
- **오분류 제외:** 408·409·410은 시맨틱 검색과 실내 하네스 그룹에서 제외한다. 이전 bundled-default 메타는 재시드할 때 unknown으로 비워지고 사용자 메타는 보존한다. 카운터 자동 배치와 회복센터 생성에서는 이 타일을 더 이상 쓰지 않으며, 확인된 긴 탁자 325·326·327을 접수용으로 재사용한다.
- **209·239:** 현대식 보일러가 아니라 난로 연통의 위·아래로 분류한다. 검색 태그는 flue/stovepipe/chimney이며 `flue` 가구는 1×2 조립이다.
- 현재 기본 여관은 `scratchInnBundle.ts`의 **3층 double-row** 도면이다. 1층은 주방·짐 보관방·식당·난로가 있는 접수 홀, 2층은 다인실·L자 상인방·좁은 독실·알코브 객실과 복도·계단참, 3층은 작은 L자 다락이다. 11개 장소 정의와 1층 자동 복도가 실제 12공간으로 시공된다. 같은 객실을 count로 반복하지 않는다.
- 다인실은 세로 침대 2개, 독실은 세로 침대 1개, 상인방·넓은 객실은 가로 침대 각 1개다. 돗자리/널/나무 바닥, 장부·운송 상자·머리맡 편지·차탁으로 방의 용도를 구분한다. 다락은 여분 침구·옛 간판·주인의 여행 기록을 갖는다.
- 식당은 식사 세트 2석+추가 좌석 2석, 접수 홀은 작은 대기 탁자·두 의자·접수 장부·난로·벽 계단이다. 주방은 화덕·작업대·흰 손질대·선반·곡물·물통이 들어가도록 l 크기를 쓴다. m 크기의 독립 북쪽 주방에는 흰 작업대가 들어가지 않는다.
- `sleep`은 `front_desk` 한 곳에만 붙는다. 침대와 수납장은 조사만 한다. 기존 inn 명령의 유료 회복이며 개별 방 예약/열쇠/NPC 시스템이 추가된 것은 아니다.
- `test/innConceptRebuild.test.ts`는 5개 seed의 방별 침대 수·단일 숙박 거래·경고 0·직렬화 재로드를 검사한다. `test/innExploration.test.ts`는 3층 양방향 전이·비대칭 객실·작은 다락·내려가는 계단 그림을 검사한다. 전체 시설의 조립 가구 검사는 각 room.mapId의 맵을 사용해야 한다.
- 단독 공간만 있는 double-row 층은 불필요한 복도/복제 방을 만들지 않고 고유 크기를 유지한다. `convertEntranceToDescent`는 이벤트와 474 한 칸 계단을 연결한다. 중간층의 저작 transfer 물건은 위로, 생성된 entrance는 아래로 연결되므로 계단 보고서는 모든 이벤트의 명령을 읽어야 한다.
- 제작: `vite-node --script scripts/build-explorable-inn.mts`(미리보기), `--save`(공식 `saveProjectToLegacyDb`+재로드). **기존 `rpg-zzu-inn-exploration-v4`를 읽고 수정**한다. 저장 직전 동시 변경을 검사하며 수정 전 JSON·층별 이미지를 보존한다. 실내 기본 메타를 갱신하고 계단·접수 탁자·연통 정의와 세 여관 맵을 반영한다. 다른 프로젝트 데이터는 유지한다. `rpg-zzu-house-template-gallery`는 다른 탭의 자동 저장이 여관을 지운 전력이 있어 다시 쓰지 않는다.
- 플레이 검증: `node scripts/qa/inn-exploration.mjs --reloaded`. 편집기 셸 없이 player.html로 저장본을 열고, 충돌 판정을 따르는 이동 경로로 4객실 조사 및 1→2→3→2→1을 검증한다. 순간이동·고정 sleep 없이 runtime-state-json/대화 DOM 변경을 구독한다. 연속 방향 입력은 과부하 프레임에서 목표 칸을 지나칠 수 있으므로 한 칸 move route를 쓴다. Vite QA config는 runner로 읽고 캐시는 작업트리 output 안에 둔다. 이 호스트의 Chromium `ERR_NETWORK_CHANGED` 때문에 로컬 Vite 응답을 Node fetch로 그대로 전달한다.
- 이미지 내장 보고서: `node scripts/report-inn-exploration.mjs` → `output/evidence/inn-exploration-v4/index.html`. 원격 재로드와 실제 플레이 증거가 있어야 생성된다. 이전 단층 보고서 `inn-rebuild-v3`는 비교 자료로 보존한다.

## 실내 의미·형태 검토 반영 (2026-09-05)

- 새 보고서: `output/evidence/concept-v2/index.html`. 기존 `concept-semantic-audit/` 보고서는 **수정 전 감사**이며 보존한다.
- 사용자 정정 반영: 가로 계단 `141 | 111(반복) | 171`, 검 진열 박스 `263/293`, 쓰러진 의자 `384`, 목재 상판 `156~158/186~188/216~218` 및 하단 `198/199/200`, 흰 상판 `159~161/189~191/219~221` 및 하단 `228/229/230`. `201`은 정확한 역할 미확정으로 자동 배치하지 않는다. 종전 deck 그룹 id는 호환성을 위해 유지하되 탁자·통행 차단으로 정정했다.
- 한 칸 계단 `stairs_small`은 444, 가로 계단 `stairs_horizontal`은 141/111/171을 쓴다. `stairs` 465/466/467은 붉은 카펫 대계단이다. 단층 여관 기본 꾸러미에서 목적지 없는 계단을 제거했다. 실제 다층 도면은 명시한 계단 또는 연결기가 만든 소형 계단으로 잇는다.
- `124→154→184→214` 불 애니메이션은 기존 네 프레임 유지. `290/291/292`는 기본값·원격·앱 재로드에서 upper이며 하위 레이어 문제는 재현되지 않았다. `133`은 화장실·세면실용 반복 바닥 후보이고 전용 욕실 구성을 추가한 것은 아니다.
- 카탈로그 55종(단일 하강 계단·연통·화로 양 상태 포함). `interiorTableCells(width,depth,white)`는 lower 상판과 upper 하단을 만든다. 차탁·독서·식사·상담·제단·작업 탁자·교사용 책상은 소품을 upper로 얹은 **원자적 조립 가구**다. 기존 table_chairs의 의자는 서로 탁자를 향한다. 임의 물건 간 `on/near/facing` 관계 엔진은 아직 없다.
- `ConceptPlaceRecord.shape` / `RoomSpec.shape`: `rect|l|alcove`, 생략은 직사각형. `project/interiorRoomFootprint.ts`가 한 의미 공간을 여러 floor rectangle로 펼친다. 작은 직접 좌표 방(w<7 또는 h<5)은 직사각형으로 폴백한다. 도면기는 비직사각 장소에 여유 크기를 주고, row 방은 하단을 맞춘다. 형상 지정은 현재 AI plan/프로젝트 데이터 경로이며 DB 장소 카드에 형상 드롭다운은 없다.
- 벽걸이는 bbox 맨 위 두 행만 보지 않고 실제 북향 벽면을 찾는다. 시계 두 셀 모두 벽에 걸린다. 가구 후보는 배치 전후 도달성을 비교한다. 복도는 직선 통로를 보존하며 일반 방은 문 앞 한 칸과 실제 우회 경로를 확보한다.
- 통행 보정은 조립 가구 일부를 지우지 않는다. 방 재시공도 배치 셀을 보호하고 다른 방을 수리 대상으로 삼지 않는다. 비직사각 북벽 및 두 칸 시계 잔상도 비운다. 경로를 확보할 수 없으면 경고를 반환한다.
- 일반 조사 문구는 저작 물건 라벨을 사용한다. 은행 문서함이 침구장으로, 교회 제단이 맥주 묻은 탁자로 설명되던 고정 문구를 제거했다.
- 계약: `test/interiorConceptAssemblies.test.ts`의 19시설×3seed=57 생성, 상판·소품 전체 셀, 벽시계, shape 저장/로드, 사용자 수정 보존. 검토 미리보기는 별도 맵을 원격에 추가하지 않으며, 19꾸러미·51가구 정의는 `rpg-zzu-house-template-gallery`에 저장하고 raw 프로젝트·tileset mirror·앱 재로드로 확인한다.

## 모든 AI 실내의 개념 꾸러미 계약 (2026-09-05)

- 신규 독립 실내의 기본 경로는 `get_concept_facility` → 요청에 맞는 `plan` → `place_concept`다. 조회 이름이 미등록이거나 생략되면 `sources[]`에 **현재 프로젝트 꾸러미의 시설별 장소·물건 plan**을 반환한다. 모델은 이를 조합해 미등록 실내를 설계한다. 빈 꾸러미는 재시드하지 않는다. 다만 시공 해석은 번들 기본값 여관·민가(`FALLBACK_INTERIOR_BUNDLES`)로 푼다(2026-09-25, 초안 폐기 뒤 새 프로젝트에서 template·방 테마 호출이 전부 막히던 것).
- 기존 좌표형 도구도 우회하지 않는다. `RoomHarnessKit.preparePlan`을 공유 엔진의 start/run 양쪽에서 **플랜 저장 전에** 호출한다. 실내 킷의 `interiorConceptPlan.bindInteriorConceptPlan`은 rooms 또는 wings를 꾸러미 장소에 연결하고 `concept` 오버레이를 저장한다. 기본 7종 및 외관 용도(shop·workshop·dwelling·manor·inn) theme은 장소 별칭만 가지며 가구 목록은 코드에서 가져오지 않는다. 미등록 장소는 `concept-place-not-found`로 조회·설계 경로를 안내한다. 이미 모델이 설계한 concept 오버레이는 보존한다.
- `author_house`와 마을 하네스는 `createHouseInteriorMap({ project: draft, … })`를 호출한다. 시설은 용도에서 선택(dwelling/manor→민가, shop→상점, inn→여관, workshop→대장간, study→서재)하고 **도면도 꾸러미 장소·크기·개수·층에서** 만든다. 구조물 그림은 해당 프로젝트의 가구 어휘를 읽는다. 외관이 추가 층을 요구하면 같은 꾸러미의 장소를 재사용하고, 명시된 꾸러미 층이 있으면 우선한다. 안팎·층간 전이는 기존 연결기로 연결한다. 프로젝트 없는 저수준 도면/패리티 하네스만 종전 순수 파이프라인을 유지한다.
- 집 내부에도 `roomHarnessPlan`을 남기므로 저장·재로드 후 방 단위 수정이 가능하다. `furnish_interior_space`는 옛 도면을 꾸러미에 연결하고, theme 변경 시 대상 방의 오버레이만 교체한다. 재시공 방의 생성 이벤트만 걷고 칩 이벤트를 다시 붙이며 다른 방 이벤트는 보존한다. 개념 이벤트 id는 기존 맵 id 집합과 충돌하지 않는다.
- `generate_map`의 `rooms` 프로필은 `concept-interior-required`로 개념 경로를 안내한다. 현재 개념 시공의 그림·벽 문법은 `easyrpg_chipset_interior`와 `tibo_interior_expanded`(0~479칸이 픽셀 동일, 결과 타일 번호도 동일)만 지원하며 다른 칩셋을 무음 대체하지 않는다. Tibo 킷은 파이프라인 어휘에서 빼고 `stamp_object`(`kit:tibo_interior_expanded/<kitId>`)로 찍는다. 야외·던전 프로필은 기존 경로다.
- 계약: `test/interiorConceptRoutes.test.ts`(수정한 꾸러미의 독립 방/start/집/마을/위층 반영, 직렬화, 미등록 시설 조합, 삭제·우회 차단, 방 이벤트 재시공), `test/generateMap.test.ts`, 기존 `test/interiorRoomPipelineParity.test.ts`.

- **2026-09-05 시설 확장:** 기본 초안은 19시설·51장소 구성. 연결 집은 프로그램 id와 같은 시설을 먼저 찾고 기존 매핑으로 폴백하므로, `manor`는 등록된 귀족 저택을 쓰고 옛 프로젝트는 기존 민가를 계속 쓴다. `test/interiorConceptRoutes.test.ts`가 양쪽을 검증한다.

## Tileset-specific map generation contract

- `generate_map` resolves the requested `tilesetId` through `src/editor/tools/mapGenerationProfiles.ts`. Numeric tile IDs are local to that tileset and must never be reused through a global village/interior palette.
- Bundled tilesets have explicit profile keys and layout grammars (`settlement|dungeon|rooms|ship|world|city|wilds`). `rooms` profiles require concept construction; other generated maps retain the requested `GameMap.tilesetId`.
- **Palette authority (2026-09-07):** profiles select tiles; they do not author shared passage, priority, or metadata. `resolveMapGenerationPalette` replaces the old unconditional `applyMapGenerationPassage` writer. It verifies the bundled image and 16px / 30-column / 480-cell atlas, then lazily validates each consumed palette role against runtime rules and a private copy passed through the same `ensureTilesetHarnesses` authority as load. Incompatible or stale choices fail with `incompatible-generation-palette` before project mutation; no fallback search, label/style inference, or automatic rule repair occurs.
- Base and carved path require lower, four-direction-passable tiles. Boundary/scatter obstacles require solid passage, but may be lower terrain/trunks or upper props. Upper obstacles retain their ground backing; path carving clears their upper cell. World accent bands are not corridors and can remain solid on their authored layer. Settlement/dungeon/ship/city/wilds do not consume accent, and a zero-scatter, borderless layout without built-in obstacles does not consume obstacle. Unused palette entries remain untouched, including combined-town cave roof accent385 (upper/blocked).
- Native numeric selections now follow their atlas rules: dungeon forest uses the existing 240/270 floor pair rather than blocked water; ship path396 and wall222 are no longer reversed; World/retro-World use passable path241 and cave base243 instead of blocked forest360/mountain-or-tree423; Scarloxy wilds uses solid trunk175 rather than canopy145 and the existing 0/60 terrain pair rather than cave water20/80. Existing valid combined-town terrain423 and lower trunk290 are retained. These are explicit profile definitions, not runtime inference or replacement of an authored override.
- Modern's default obstacle30 has no authored solid rule, so a layout consuming it is rejected. An explicitly authored compatible solid rule permits generation; a borderless zero-obstacle city does not need it. Existing `rooms` concept routing and all passage/house/road protections are unchanged. Genuine layer/passage overrides are preserved, and incompatible ground/path overrides cause rejection rather than being silently overwritten.
- Regression coverage: `test/generateMapPaletteAuthority.test.ts` replays the captured cave/settlement tile arrays, checks no shared tileset diff, both kinds of authored overrides, lazy unused roles, invalid atlas/rules without even direct-module mutation, 27 native profile/theme combinations, and canonical round trips. `test/generateMapPaletteReload.test.ts` exercises real tool dispatch and real store save/fresh-load with only transport/cache mocked and network forbidden. `test/generateMap.test.ts` keeps dispatch, border, lint, and reachability assertions; its cross-profile fixture now enters through the normal loaded tileset state and explicitly authors Modern's otherwise missing obstacle rule.
- `villager-room-v1` and `dungeon-room-v1` remain the detailed layer/session pipelines for their respective authored workflows. The generic `generate_map` dispatcher does not force every tileset through the interior pipeline.
- Uploaded or unknown tilesets do not silently inherit bundled numeric IDs; generation rejects them until a dedicated profile is authored.

## Interior Room Session Harness (villager-room-v1)


- The interior pipeline is LLM-harnessed via `src/editor/tools/interiorRoomSession.ts`: `start_interior_room_session` (plan args: `wings|rooms(+per-room floorTile)`, `innerDoors`, `door`, `theme`, `seed`, `floorTile`, `wallMaterial: cream|gold-brick|stone-brick`) ??`advance_interior_room_build` per layer (`floor ??walls ??furniture ??entrance ??critique`) ??`evaluate_interior_room`.
- `evaluate_interior_room` mirrors the village harness contract (`villageEvaluate.VillageLookReport`): returns `{ ok, score, issues, metrics, attempt, maxAttempts, feedbackForLlm }`. Checks are theme furniture manifests, door-BFS walkability (furniture treated as obstacles), and quadrant fill balance. On failure the assistant should follow `feedbackForLlm`, patch via `advance_interior_room_build({ forceLayer: "furniture" })` or plan changes, and re-evaluate ??same self-repair loop as `villageSession`.
- The builder guarantees geometry invariants regardless of caller: hard multi-tile sets are never half-placed, room entry cells are reserved during placement (`ENTRY_SENTINEL`), and `enforceWalkability` melts removable single props to keep every open cell reachable from the door. `plan.seed` feeds a mulberry32 RNG (variant/rotation/jitter), so the same plan reproduces and a new seed rerolls furniture placement. After walkability, `fillSparseQuadrants` fills the sparsest quadrant with theme wall-snap goods using place-verify-revert (each placement is BFS-verified and reverted if it blocks a path).
- Space-role harnessing: "interior" is the parent concept; placement decisions are per space. Each `rooms[]` entry carries a role theme (`bedroom|study|dining|kitchen|storage|tavern|corridor`); `corridor` is a walkway role ??no floor-occupying furniture, only wall d챕cor and tall displays (bust/armor), and its cells are exempt from quadrant-density judgement and fillers. `furnish_interior_space({ sessionId, roomId, theme?, seed? })` demolishes and re-furnishes one space (furniture, wall d챕cor row, rugs) with the role grammar, then re-runs map-wide walkability ??the per-space repair/retheme loop for the assistant.
- Contextual prop anchoring: bedroom rugs anchor at the bed's foot (not under table sets), a nightstand (`VR.BOX`) lands beside the bed head via `placeBedsideProp`, and bedroom table sets are excluded from the bed zone (Chebyshev ??2) and rug cells. Kitchen cauldron/kettle anchor next to the stove.
- Editor chatbot integration: the harness tools are registered in `toolRegistry.ts` under the `tile` domain and survive the 40-tool exposure quota in tile mode (regression-fixed in `test/toolExposureQuota.test.ts`); `scripts/check-tool-exposure.mts` probes the live exposure set. The former `build-interior` assistant skill that injected the full playbook (plan grammar: partition spacing, innerDoors, corridor role, wallMaterial/floorTile rules; plus the session → evaluate → `furnish_interior_space` self-repair loop) was removed with the assistant-skill feature (2026-08-27) — the tools and their descriptions are now the only prompt-side source. Session-built maps are auto-registered in `mapTree` so they appear in the editor map list.
- End-to-end reference: `scripts/demo-assistant-interior-build.mts` drives the real tool handlers (requirement ??plan ??session ??per-space furnish ??evaluate ??deploy) against the live LegacyDb project; `scripts/build-room-practice-project.mts --reroll N` is the batch/script path that bypasses the LLM loop on purpose. The batch script gates `--save` behind per-map evaluation (seed-retry loop, up to 12 rerolls per plan).



## Safe detached draft and approval harness

- Room sessions now live in editor-only `detachedDraftMemory` through `roomHarness/sessionStore.ts`; they are transferred explicitly when assistant/region drafts are cloned and never become `Project` JSON or runtime/session state.
- `roomHarness/engine.ts` records an explicit checkpoint for every layer, including structured location-aware warning/error data. `roomHarness/facade.ts` is the low-level typed API for start/advance/evaluate, room lock/unlock, and seeded room-only reroll; it does not depend on LLM tool exposure or the 40-tool quota. `regionTask/runDirectRoomDraft.ts` is the connected editor coordinator: the region modal's **AI 없이 실내 초안** action offers home/inn/manor presets plus composable theme modifiers, selects an event-free doorway whose adjacent return cell is reachable from the authored start (following existing transfers), builds all layers in detached memory, and creates exterior→interior plus interior→exterior transfers.
- Room-only reroll restores every tile/stack outside the selected room byte-for-byte, preserves all events, uses an explicit integer seed, rejects locked rooms, re-evaluates the resulting room draft, and refreshes the ghost preview/review report.
- Region review runs bounded deterministic isolation repairs and a hard world-navigation preflight before approval. Unreachable auto-generated `ev_inspect_*` flavor events may be removed within the same repair budget; authored objectives, transfer sources/destinations, NPC schedule destinations, and living destinations remain blockers.
- `pendingRegionApply` always compares an authoritative live project fingerprint and always performs a fresh review (using `reviewRegionDraft` as the fallback) for full, replacement/partial, reroll, and NPC-resolution candidates. Structural room/map proposals do not expose tile-only partial apply because that would separate the door from its map/session. A successful approval records exactly one `{ kind: "project" }` history snapshot and performs one store replacement, so one undo removes both the exterior door and generated interior map.

## Interior object catalog is the shape source of truth (2026-08-28)

- 가구 형상은 `src/editor/interiorObjectCatalog.ts` 가 데이터로 선언한다: `INTERIOR_OBJECT_CATALOG` 항목마다 `id`, 한국어 `label`, `role`(`InteriorSemanticTileRole | null`), `width`/`height`, `layer`, `cells`(`{dx,dy,layer,tile}[]`), `themes`, `snap`. 조회는 `interiorObjectById` / `interiorObjectsForTheme`.
- **2026-08-31:** 실내 칩셋을 처음 열거나 하네스가 돌면 그 카탈로그가 `tileset.structureKits`(계보 `interior-catalog`, `ai.snap`/`ai.interiorRole`/`ai.themes`)와 `tileset.interiorRoomKinds` 로 시드된다. 이후 파이프라인은 타일셋 데이터를 읽고, 코드 카탈로그는 시드·폴백이다. 기본 7종(bedroom…) 배치는 여전히 코드 프로그램이고, **없는 방 종류 id** 는 역할·스냅으로 가구를 놓는 일반 배치기를 탄다. 벽·천장 문법은 아직 실내 칩셋 전용이다.
- 파이프라인이 그 데이터를 소비한다: `src/editor/interiorRoomPipeline.ts` 의 `objectCells(id)` + `paintObjectCells(map, cells, ox, oy)` 가 침대(가로/세로)·책장·화덕·긴 탁자·카운터·피아노를 카탈로그 셀로 찍는다. 정의가 없는 id 는 즉시 예외 — 오타가 반쪽 가구로 새지 않는다.
- 셀 모양이 `renderTileCellsToCanvas`(`kitRender.ts`)의 `{dx,dy,layer,tile}` 과 같으므로 에디터 UI(데이터베이스 '구조물' 탭)가 같은 데이터를 그대로 래스터로 그린다. 즉 사용자가 보는 그림과 AI 가 찍는 타일이 한 정본에서 나온다.
- **변경의 심판은 패리티 테스트다**: `test/interiorRoomPipelineParity.test.ts` 가 `test/fixtures/interiorRoomDemoRooms.baseline.json`(데모 방 7종의 `lowerTiles`/`upperTiles`, 변경 전 코드에서 박제)과 바이트 단위로 비교한다. 카탈로그 셀을 하나만 바꿔도 이 테스트가 깨진다 — 배치를 의도적으로 바꿀 때만 픽스처를 다시 박제하고, 그 이유를 커밋 메시지에 남긴다.
- 카탈로그 자체 불변식은 `test/interiorObjectCatalog.test.ts` (셀 경계, 중복 좌표, 역할 타일 포함 관계, 테마 필수 역할 충족, id 규칙).

- **2026-09-05 학습 책상:** `study_desk`는 사각 탁자와 남쪽 걸상을 하나의 1×2 카탈로그 물건으로 정의한다. 교실의 큰 책장은 자료실로 모아 두 세트와 통로 공간을 확보한다. `enforceWalkability`는 단일 소품 타일을 제거할 수 있으므로 「자리 없음」 경고만으로 복합 가구 보존을 판정하지 말고 최종 맵의 모든 구성 셀을 확인한다. 학교 계약은 세 가지 seed에서 책상·걸상 쌍을 직접 검사한다.

## 소품 표면 어휘가 `PlacementZone` 으로 통일됐다 (2026-08-30, PR #316)

`interiorRoomPipeline.ts` 의 `PROP_SURFACE` 표가 쓰던 자체 어휘가 공용 `PlacementZone`
(`src/project/types/base.ts:117-129`)으로 바뀌었다. **다른 세션 코드가 옛 값 이름을 참조하고 있으면
같이 고쳐야 한다** — 값 세 개가 이름을 바꿨고, 새 항목 `STOVE_BOT`/`STOVE_TOP`/`HEARTH` 가 들어왔다.

내장 `kitchen-stove` 그룹(타일 21/51)에는 하드코딩 규칙 `r_interior_stove_north_wall`
(`interiorRoomPipeline.ts:441-458`, `zone: "againstWall"`, `facing: "north"`, `strength: "hard"`)이
붙는다. 하드코딩은 **규칙 자체**뿐이고 벽·바닥 판정은 여전히 `passability` 에서 온다 — 타일 id
목록으로 벽을 정하지 않는다. 이 규칙이 만드는 lint 코드는 `cluster-rule:surface:*` 라서 커밋을
막지 않는다(`openwiki/editor-validation.md` 의 같은 날 항목 참조).


## 개념 시설 시공 — place_concept 경로가 파이프라인에서 다른 점 (2026-09-02)

`InteriorRoomPlan.concept` 가 있으면 파이프라인은 테마 프로그램 대신 나무를 따른다. 데모 방 패리티 픽스처(`test/interiorRoomPipelineParity.test.ts`)는 이 분기를 타지 않으므로 그대로다.

- **도면**은 `src/editor/conceptBundleResolve.ts` 의 `layoutConceptFacility` 가 장소 역할로 만든다: 방 줄(y=4, 가로 1열 파티션) → 3행 파티션 → 복도(3행) → 3행 파티션 → 홀(정문, 남쪽 행 중앙). 내부 문은 파티션 트림 행. 오버레이(`ConceptOverlay.rooms[roomId]`)는 방 인스턴스마다 장소·역할·물건·칩을 싣는다(`interiorKit.parseConceptOverlay`).
- **구성**은 `src/editor/interiorConceptCompose.ts` 의 `composeConceptRoom` 이 방 하나씩 한다. 슬롯 종류: 벽걸이(`wall-any` → 크림 벽면 윗줄, 상위 레이어), 키 큰 가구(시계·갑옷·흉상·거울·진열대·화덕 → 상단이 벽면 아랫줄), 북벽(침대·책장·카운터·피아노), 복도 끝(transfer 칩=계단), 바닥(탁자 — 방 중앙, 좌석군 사이 통로), 구석(1×1 block), 러그(침대 발치, 통로 위 허용). 문에서 방 안으로 곧게 이어지는 **통로**와 정문 좌우는 가구 금지. 벽 물건 사이 1칸 간격은 자리가 모자라면 양보한다. 못 앉힌 물건은 `concept: <물건> 자리 없음 (<장소>)` 경고 — 숨기지 않는다.
- **벽·천장**: 벽 문법은 그대로 쓰고, 그 뒤 `carveOutsideVoid` 가 바닥·벽면에 이웃한 한 겹만 천장으로 남기고 밖을 「암흑 공허」(116)로 비운다. 천장 정본 v2(검정 몸통)에서는 건물 밖과 천장이 같은 검정이라 「벽 위에 천장이 없다」고 읽혔기 때문이다.
- **칩 집행**은 `src/editor/interiorConceptEvents.ts` 의 `attachConceptEvents` 가 furniture 층 끝(통행 확보 뒤)에 한다: transfer > sleep > loot > event 우선순위로 물건마다 이벤트 하나(예외: 가로로 넓은 계단 transfer는 하단 행 2칸 이상이면 밟는 칸마다 전이를 따로 달고 중앙 앵커를 먼저 둔다), 앵커는 최하단 행 중앙, `ev_concept_<mapId>_<thing>_<n>`. 개념 시설은 `attachPropInspectEvents`·`fillSparseQuadrants` 를 타지 않는다(나무에 없는 것을 보태지 않는다). `evaluate_interior_room` 의 필수 가구 검사는 개념 필수 물건(`conceptManifestWarnings`)으로 바뀐다.
- **보고서 렌더러 (2026-09-08 정정)**: `scripts/lib/renderInteriorMapPng.mts` 는 에디터와 같은 칩셋 한정 `chipsetQuarterComposition` 을 쓴다. 실내 430 계열 천장은 저장 성형 변형을 유지하면서 전용 쿼터로 렌더한다(2026-09-18 수정). 별도 암벽 366도 자체 쿼터 합성을 사용한다. 실내에 Combined Town의 같은 번호 쿼터를 적용하면 탁자 등 다른 그림을 샘플링한다. `test/placeConceptRender.test.ts`는 천장 가장자리·바닥의 원시 픽셀과 366의 네 모서리·받침 합성을 실제 PNG와 출하 아틀라스로 대조한다.
- **교체 착지 계약 (2026-09-08)**: 방 bbox 안이어도 가구가 있으면 착지점이 아니다. `test/interiorPipelineMapReplacement.test.ts`는 명시적 seed로 완성한 가구 레이어에서 열린 칸과 막힌 칸을 구분하고, 열린 칸의 좌표 보존·막힌 칸의 최단 이동·실제 탈출 가능한 착지·커밋 검증을 함께 확인한다. seed 생략은 `Date.now()`를 쓰므로 테스트에서 생략하지 않는다.
- **시설 다양화 (2026-09-02):** 초안 묶음(`src/project/defaults/conceptFacilityTemplates.ts`, 2026-09-05에 19종으로 확장)이 같은 도면 규칙·같은 구성기로 선다. 그 과정에서 바뀐 규칙 — (1) **홀 넓힘**: 복도 없이 방 둘 이상이 홀 바로 위에 서면 홀을 좌우 1열씩 넓힌다(`BAND_SPREAD`). 방문 착지 열이 홀 북벽을 2칸 조각으로 쪼개 카운터·피아노 같은 3칸 가구가 설 자리가 없었다(술집·민가). (2) **구성 순서**: 벽 가구(필수 먼저) → 러그 → 바닥·구석(필수 먼저). 러그는 상위 레이어 가구 밑으로 들어가고(`freeFor` 가 러그 칸을 상위 레이어에만 허용, 하부 레이어 상자·책장은 러그를 덮어 구멍을 내므로 불허) 입구 표지(`ENTRY_SENTINEL`) 위에도 깔린다. 방 전체를 훑어 중앙에 가장 가까운 3×3 을 고른다. (3) **구석 소품**: 네 구석 → 둘레(남·북 행, 서·동 열) → 안쪽 순으로 앉아 창고의 상자·술통 7개가 다 선다. (4) **북벽 앵커 공유**: 북벽 가구·키 큰 가구·복도 끝 계단은 서로를 앵커로 보고 퍼진다 — 안 그러면 흉상 둘이 동쪽에만 나란히 선다(교회). (5) **재질**: 장소 `floor` → `RoomSpec.floorTile`(돌 12·널 102·돗자리 139), 시설 `wall` → `plan.wallMaterial`. 파이프라인이 원래 갖고 있던 리틴트를 그대로 쓴다. (6) 조사 문장은 2026-09-05부터 실제 저작 물건 라벨을 사용한다. 계약: `test/conceptFacilityTemplates.test.ts`(초안마다 plan/walkability 경고 0·자리 없음 0·필수 물건 존재·도면 다양성·재질 리틴트).
- **모델 설계 plan + 배치 seed (2026-09-03):** `place_concept` 이 `plan`(장소·물건 목록)을 받으면 `conceptPlan.parseConceptPlan` 이 합성 꾸러미로 바꿔 같은 도면기·구성기에 넘긴다 — 파이프라인은 템플릿과 설계를 구분하지 않는다. `InteriorRoomPlan.seed` 는 개념 분기에서 `composeConceptRoom({seed})` 로 소비된다(종전엔 테마 가구 RNG 에만 쓰여 개념 시설은 seed 와 무관했다). 도면 문법은 `plan.layout`: `row`(방 줄 → 복도 → 홀, 기본) 또는 `double-row`(북 방 줄 → 복도 → 홀+남쪽 날개, `places[].zone` north|south). 구현 `src/editor/conceptLayoutDoubleRow.ts`. 여관 품질은 `scoreConceptFacility` 가 도달·침대·카운터·계단·자리없음·종횡비·템플릿복사를 채점해 `place_concept` 결과 `review` 에 싣는다. `get_concept_facility(여관)` 은 `variants[]`(시골 단층 / 2층 객실 / 복도 양쪽)와 「수식어가 없어도 설계하라」 designHint 를 준다. 증거: `test/conceptDoubleRowLayout.test.ts` · `test/conceptFacilityScore.test.ts` · `reports/inn-freeform/index.html`.


## 도면 호환성과 외장 스탬프 후속 (2026-09-05)

- 두 줄 도면도 한 줄과 같은 legacy 복도 판정(라벨 복도·통로·corridor·hall 또는 id corridor)을 쓴다. 명시한 `role`이 우선하고, 한글 `홀`이나 id `hall`만으로 복도를 추정하지 않는다. theme은 방의 placeId를 그대로 전달하고 복도만 corridor다. 계약: `test/conceptDoubleRowLayout.test.ts`.
- 건물 팔레트 `stampHouse`는 문 이벤트 또는 실내 토글이 꺼지면 `author_house(kind: single, interior: exterior-only)`로 보낸다. `author_house`가 읽지 않는 `doorEvent` 인자는 보내지 않는다. 후대 시공 검증·시작점 복원 경로를 유지한다. 계약: `test/buildPalette.test.ts`.


## 입구 예약·멀티타일 통행 복원 (2026-09-05)

- lower 책장도 upper ENTRY_SENTINEL을 검사한다. 카운터·책장·화덕은 현재 objectCells 카탈로그를 쓰며, 배치 전 두 레이어 값을 세트 단위로 기록한다. 단일 소품 제거로 길이 안 열릴 때만 막은 세트를 통째로 복원한다.
- 저널은 맵 객체별 WeakMap이며 전체/방 가구 시공 시작 때 새로 만들고 통행 검사에 들어갈 때 소비·삭제한다. 개념 꾸러미 경로는 저널에 등록하지 않는다. 이전 맵/재시공의 기록을 다음 작업이 사용하지 않는다.
- 실제 ㄱ자 서재 기본 플랜은 동쪽 포켓 앞 2×3 책장 때문에 개방 셀 9개가 고립돼 있었다. 이제 책장 6칸을 바닥으로 통째로 복원해 0개가 된다. 후속 공백 보정이 소품을 더해 조사 이벤트는 11→12개. 그 방의 단위 테스트 parity fixture만 실측대로 갱신했다(나머지 6개 플랜은 동일).
- 계약: `test/interiorRoomWalkabilitySeal.test.ts`(입구 봉쇄, 실제 서재 세트 복원, 맵 간 독립), `test/interiorRoomPipelineParity.test.ts`, `test/interiorObjectCatalog.test.ts`.


## 공포 게임 제작 기능 (2026-09-05)

실내 평가 결과는 구조·통행 범위와 별도 시각 검토 필요를 명시한다. 데이터·런타임·저작·검증 계약은 [horror-authoring.md](horror-authoring.md) 참조.

## 여관 외 시설의 공간 구성 (2026-09-05)

- `interiorConceptCompose`는 `facilityId`가 `house|shop|tavern|library|smithy|church|warehouse|guild`인 경우에만 가구 묶음 선호를 적용한다. 방 크기·문 예약·가구 셀·레이어는 기존 계약을 유지한다. 여관과 알 수 없는 사용자 시설은 기존 배치 경로다.
- 침대가 없는 방의 러그는 탁자가 실제로 앉을 수 있는 자리를 먼저 고르고, 탁자는 러그 위를 선호한다. 조리·작업 소품은 화덕, 침실 상자는 침대, 스툴은 좌석군 가까이에 둔다. 같은 종류 재고는 흩어진 모서리 대신 묶어서 놓는다. 후보가 기존 충돌·문 예약 검사를 통과해야 한다.
- 창고 상자·술통은 가운데 반출 통로 양옆의 짧은 적재열을 선호한다. 1칸 소품 후보는 BFS로 기존·신규 `event|loot|sleep|transfer` 물건의 접근 가능한 인접 칸을 보존한다. 가운데 통로만 열려 있어도 3×3 상자의 중앙 노획 상자는 갇힐 수 있으므로 바닥 통행 검사만으로 대체하지 않는다. 한 줄 좌석군은 한 행씩 띄워 정렬해 특정 seed가 중간 행을 먼저 소비하고 후속 좌석을 탈락시키지 않게 한다.
- 기본 초안 8종의 좌석·상품·작업 공간을 보강했다. 길드는 비어 있던 복도 밴드 대신 회의실과 의뢰 기록실을 접수홀에 연결한다. `scratchInnBundle`은 수정하지 않는다.
- `get_concept_facility`는 `conceptFacilityVariants.ts`를 통해 여관 외 8종에도 시공 가능한 공간 구성 참고안을 제공한다. 현재 `template`은 계속 프로젝트의 저작 데이터다. 참고안을 자동 적용하거나 기존 `scratchConceptBundles` 배열·기존 맵을 기본값으로 교체하지 않는다. 기존 프로젝트에서도 배치 개선은 다음 시공에 적용되며, 새 초안의 추가 물건은 참고안 또는 명시적 초안 재삽입으로 선택한다.
- 재현: `node_modules/.bin/vite-node scripts/qa-facility-quality.mts verified`로 실제 `runTool(place_concept)` 결과와 무표식 전체 맵 PNG를 만든다. `npm run build:player` 후 `node scripts/qa-facility-player.mjs verified`로 같은 결과를 빌드된 `player.html`에서 검증한다. 출하 플레이어의 store shim을 그대로 쓰고 패키징할 번들 애셋만 `public/assets`에서 제공한다. 수백 개 Vite 개발 모듈을 반복 로딩하지 않는다. 산출물은 `output/evidence/facility-quality/verified/`, 런타임 판정은 `player/SUMMARY.md`부터 읽는다. 이는 게임으로 출하하거나 사용자 DB를 대체하는 콘텐츠가 아니라 생성기 회귀 QA fixture다.
- 회귀: `test/conceptFacilityComposition.test.ts`는 8종×3개 seed의 필수 가구 전체 셀, 사용자 가구 삭제 보존, 탁자·러그 묶음, 적재열·중앙 통로, 9개 상자 중 가운데 노획 상자의 실제 접근 가능성을 확인한다. 기존 여관·실내 패리티·실외 칩셋 거절 계약도 함께 돌린다.

## PR618 통합: 큰 탁자와 기존 시설 구성 (2026-09-06)

- 불투명 lower 셀을 가진 탁자 조립은 벽 가구 뒤, 러그 앞에 둔다. lower 가구가 러그를 덮어 구멍을 내지 않으며 러그는 upper 전용 좌석군에 맞춘다. 여러 탁자가 있는 홀의 큰 lower 탁자는 중앙을 차지해 나머지 좌석을 탈락시키지 않도록 옆자리를 선호한다. 정문 바로 북쪽의 실제 시작 칸도 예약한다.
- 기존 8시설의 러그·좌석·재고 묶음과 노획 접근 검사를 유지하며 PR618의 조립 단위 BFS를 함께 적용한다. 참고 도면은 새로 추가된 시설에도 제공하지만 프로젝트의 저작 꾸러미를 교체하지 않는다.
- 테마 파이프라인의 배치 저널 복원과 개념 경로의 멀티타일 보호·방 한정 수리를 함께 유지한다. 긴 탁자 검사는 `325 | 326* | 327` 반복 몸통을 허용하고 고립된 끝 조각은 계속 거절한다.
- `test/conceptFacilityComposition.test.ts`는 18개 비여관 시설의 시작 칸 통행성도 검사한다. 창고의 입구 타일 176은 빈 칸이 아니라 통행 가능한 표식이므로 실제 collision/reachability 계약으로 접근을 확인한다. 기존 UI의 방 id 편집 계약은 `test/fixtures/legacyConceptInn.ts`를 명시적으로 시드해 계속 검사한다.
- 안전한 로컬 플레이어 fixture: `node_modules/.bin/vite-node scripts/qa-pr618-fixtures.mts`. 원격 읽기·쓰기 없이 `output/evidence/pr618-fixtures/inn.json`, `hearth-unlit.json`, `hearth-lit.json`과 이동 단계 manifest를 만든다. 여관은 직렬화 후 1F→2F→3F→2F→1F walkthrough까지 검사한다. 이는 엔진 회귀 fixture이며 새 원격 콘텐츠 저작이 아니다. 실제 브라우저·빌드 검증은 별도다.

## 비직사각 실내 정본 재설계 (2026-09-13)

- `interiorRoomFootprint.ts` owns `rect/l/alcove/l-right/bay/notch/cross`. New variants expose mirrored elbows, a south bay, an inward side-wall pier, and a cross-shaped footprint. Small existing rooms keep the legacy rectangular fallback. Spatial guards, AI tool schemas, and inspector controls accept the same values.
- `SpatialInteriorLayout.rooms[]` optionally stores `shape` and `floor` per room; omitted values retain rectangular rooms and the space material. The existing wall grammar compiles the floor union, shared partitions and explicit doorways together. Shape `rect` on an envelope does not imply that its rooms fill that envelope.
- Floor materials now include `jade` (13), `gravel` (42), and `dark-stone` (43), alongside wood/plank/stone/mat. These are material selections, not new pixel art or runtime passage overrides.
- `HOUSE_SHELL_FACE_TILES` includes cream, stone-brick and gold-brick face cells. Since 2026-09-25 it also includes the climate faces `log` 1980~1985, `sandstone` 1986~1991 and `basalt` 1992~1997, which exist **only on `tibo_interior_expanded`** (row 66 baked by `scripts/content/bake-climate-interior-tiles.py`, registered by `register-climate-interior-tiles.mjs`). They are in `WALL_FACE_RETINT` for the authored climate interiors (`tiledata/rpg-interiors`, category `rpg-interiors-climate-v1`); the assistant tool enums still offer only cream|gold-brick|stone-brick because house interiors are built on the 480-cell `easyrpg_chipset_interior`, where those ids do not exist. Both fixed wall overlap and automatic wall furniture use it; the former cream-only check rejected cabinets after wall retint.
- `scripts/lib/diverseInteriorCatalog.mts` rebuilds the existing interior library with preserved IDs, restores program-specific furniture assemblies, and leaves user tile metadata intact. Publish uses `edit_spatial_occurrence(operation:refresh)` for the three saved house roots and validates LegacyDb reload; rendering evidence belongs in `output/evidence/interior-redesign`.
- Contract tests: `test/spatialInteriorLayout.test.ts` checks connected irregular floors, per-room materials and save/load, alongside existing spatial schema and object-placement contracts.

## 생활 구역 조합으로 실내 저작 (2026-09-14)

- `scripts/lib/interiorLifeCatalog.mts` authors 14 reusable `interior-life:*` objects/section kits: rug/table/seats/top props, hearth/bookcase/stone backing, compact cooking, washing counter/mirror/jar, sleeping/storage, twin beds, bookcase/stool, and a complete 2×3 curtain. These are project-owned assemblies, not new chipset pixels or global tile-metadata overrides. Each kit carries `ai.description` and `ai.placementRules`; object tags expose its use to spatial AI tools.
- The explicit list of 12 reviewed household floors is rebuilt from activity zones; all other spaces are preserved. Key ordering cannot select a different design after JSONB serialization. Floors retain 2/3/4-room programs with 14×11, 14×12 or 15×12 bounds. Upper floors use reading areas; the farmhouse uses a compact cooking area. The visually basin-like tiles 22/23/52/53 retain their existing counter semantics and are presented as a washing counter.
- A zone's floor backing and furniture are one frozen object. Do not put a stair on even a passable rug cell: raster ownership validation correctly rejects that overwrite. Candidate packing reserves port cells, checks the wall-face set for overlaps, and uses actual passability/reachability before accepting a fixed placement. Curtain upper two rows overlap the north wall; its last row hangs into the room. Native compiler validation remains the final authority.
- `scripts/publish-interior-life.mts [--apply]` loads the live project, checks idempotence and unchanged tile metadata, refreshes the three existing house roots, rejects concurrent edits, and saves/reloads with the official authority. No raw REST upsert. Authored source is `rpg-zzu-house-template-gallery`; output/evidence/interior-life contains local backups and proof.
- Focused rendering audit: `npx tsx scripts/audit-interior-catalog.mts output/evidence/interior-life/candidate.json life-verified 7 life`; final `life` limits the pass to these 12 tagged spaces. Omit it for the full catalog. Render with `node scripts/qa/render-interior-catalog.mjs life-verified`; gallery with `node scripts/qa/interior-life-gallery.mjs`. The comparison gallery also needs the previous `complete` renders.
- Player routing uses the existing `interior-catalog-routes.mts` and the dedicated runtime harness. Editor verification is `QA_BROWSER=firefox node scripts/qa/interior-life-editor.mjs`; it reads the saved map, verifies all six curtain chips plus hearth/stone floor, checks the space inspector, and blocks remote writes.

## 여관·잡화점의 시설별 실내 기준 (2026-09-14)

- `scripts/lib/specialInteriorCatalog.mts` stores two complete places, `special-interior:place:inn` and `special-interior:place:shop`, and three floor spaces. The inn combines reception/shared meals/kitchen/storage on 1F with a three-bed dormitory and a private room on 2F. The shop combines checkout, merchandise/food displays, a book shelf, stock and packing. Existing reviewed inn/shop yards supply exterior entry; exact ports connect the doors/stairs.
- Uniform household curtains are removed from ten of the twelve `interior-life` floors. Only the top-floor bedroom and reviewed inn suite retain them; the new inn uses one curtain in the private room. `registerInteriorLifeCatalog` honors the same allowlist so rerunning the preceding authoring script does not restore twelve curtains.
- `scripts/publish-special-interiors.mts [--apply]` uses registered spatial get/preview/apply/refresh tools, idempotent registration, official LegacyDb authority, concurrent-change checks and reload comparison. It preserves existing tile metadata and unrelated maps. Existing household examples are refreshed to remove their frozen curtains. This content establishes layout and navigation; it does not add merchant NPCs, shop transactions or lodging dialogue.
- `scripts/qa/interior-catalog-routes.mts <project> special` derives actual walking routes for both facilities. `qa:runtime -- --project <project> --scenario special-interiors --browser firefox` runs the inn; `QA_SPECIAL_FACILITY=shop` runs the shop in a fresh player session. `scripts/qa/special-interiors-editor.mjs` compares the saved maps, captures real editor screenshots and exports native map renders into `output/evidence/special-interiors/`.

## 연결 던전의 에디터 통합 (2026-09-14)

작업용 스크립트에서 프로덕션 도구로 옮긴 생성 경로·지원 인자·집 내부와의 경계·검증은 [connected-dungeon-generation.md](connected-dungeon-generation.md)를 참조한다. 기존 단일 방 저장 플랜은 유지하고 새 던전 요청에 연결 생성기를 사용한다.

## Compact interiors and automatic furnishing budgets (2026-09-14)

- `interiorFurnishingPolicy.ts` budgets optional automatic seating/table assemblies, work surfaces, heating and rugs by usable floor area (one per group below 120 cells, then one per 60 cells). A dining assembly already contains seats; an additional `table_chairs` is another table, not extra chairs. Required capacity, beds and storage repetitions remain authored. Unknown/custom graphic identities are not guessed from labels.
- `interiorConceptCompose` uses this selection before placement. Canonical `compileSpaces` passes the frozen graphic kit identity despite opaque adapter keys, counts already fixed furniture, and preserves mandatory port-bearing objects. Fixed objects and required quantities are not removed. No saved occurrence is automatically rebuilt.
- Corner props now use the same assembly connectivity preflight as larger furniture, so they cannot isolate the last walkable cell beside a table and trigger destructive after-the-fact cleanup.
- Eight gratuitous duplicate entries were removed from the new facility drafts (house, shop, tavern, library, smithy, guild). Existing project source edits remain explicit upserts; library objects and unrelated compiled maps are preserved.
- `compactHousePlan.ts` reflows only **new stock house plans**, including upper floors. It retains one-column side partitions and three-row horizontal walls. Bedrooms/kitchens start around 15 cells, domestic living rooms around 45; furniture minimums can require more. Explicit plans and saved authored layouts retain their dimensions. Large manor rooms are reduced more conservatively to fit their required furnishings.
- The two reviewed remote examples keep their IDs (`map_interior_logic_cottage`, `map_interior_logic_scholar`) and reduce total room-floor area from 149→75 and 162→88 cells. This is area reduction, not halving both dimensions. Evidence and source-upsert audit: `output/evidence/compact-interiors/`; remote project `rpg-zzu-ashen-vault-20260913`. Completion requires the save/reload receipt, not just the PNG.
- Contracts: `compactInteriorGeneration`, `houseKit`, `interiorSeedFallback`, `interiorConceptRoutes`, `spatialSpaceCompiler`. The existing `interiorConceptAssemblies` suite also fails on the parent commit due to the default entrance's same-map landing repair warning; compare actual placement warnings separately instead of relabeling that baseline green.
- Stock-house seed binding is now program-scoped: domestic dining selects `house/living`, shop dining selects `shop/salesfloor`, and compact storage selects `smithy/store` or `shop/stock`. Seed corridors carry no furniture or stairwell program. Previously the global `dining → inn/dining`, `storage → warehouse/hall`, and `corridor → inn/corridor` aliases imported public seating, warehouse stock and even inn stairs into ordinary houses. Explicit authored plans still keep their selected source. Public tavern capacity has a larger minimum than a domestic living room.

## Open domestic interiors: activity areas are not enclosed rooms (2026-09-14)

The user's chipset reference connects the hearth, bed nook and common table through one continuous floor. Floor material, rugs, furniture and the outer silhouette distinguish uses; a separate wall/door per use is not the default domestic grammar. A floor-material change alone does **not** establish elevation. Use an authored, verified stair assembly only when real elevation is intended.

- `InteriorRoomPlan.openPlan: true` makes the wall backend consume the union floor without the legacy gapless-edge partition pass. Adjacent `rooms` are activity masks. Real gaps still form walls, so a private bathroom/locked room can remain enclosed. Omission preserves existing saved plans and their partitions. `parseInteriorPlan` and both session/one-shot schemas expose the flag.
- `openHousePlan` opens eligible new small domestic seeds with a common dining area. Programs requiring a south wall for cooking/work, public lodging and mansions retain their compact partitioned layouts; explicitly authored geometry is never rewritten. Study-house stock plans now contain one study and a sleeping area instead of two duplicate studies.
- `interiorActivityEntries` leaves wide open boundaries (three or more cells) to whole-floor connectivity checks instead of reserving an arbitrary center lane; narrow doors keep all landing cells reserved. Both sentinel stamping and the concept composer use it. Whole-floor furniture connectivity preflight still applies. North-snapped furniture checks the physical full-floor boundary, not the semantic zone edge; a cabinet cannot treat the living area's north edge as an imaginary wall.
- Canonical spaces support `zones` and object-slot `zoneId`; see `spatial-place-compiler.md`. A zoned source must use the canonical build route. The legacy source adapter rejects it rather than silently flattening its furniture and materials.
- Reviewed examples: the existing cottage and scholar map IDs were rebuilt with connected floors, complementary hearth/book-corner sources and a common dining area. Evidence: `output/evidence/open-interiors/`; target `rpg-zzu-ashen-vault-20260913`. The source upserts intentionally omit wall decorations in the south dining area, where there is no north wall. Source definitions and maps require save/reload verification.

Small-home sizing follows usable functions, not a quota of rooms: the final reviewed shells are 13×14 and 14×14 (69/77 floor cells). New small open seed plans choose the existing compact table-and-chairs assembly; study and meals share it. No frozen canonical object is silently substituted. Public/explicit capacity keeps its authored assemblies.

### Follow-up: excess floor and furniture depth (2026-09-14)

A tiny table does not justify a full-width 9–10×4 south hall. New open domestic seeds start with a 6×3 shared dining/reading area and an offset entrance; its outline narrows to the furniture plus approach instead of retaining empty floor. The two reviewed maps now use 51/47 floor cells (previously 69/77), with 13×13 and 12×13 raster bounds. The saved open dining/book-corner source sizes are updated explicitly. Evidence: `output/evidence/dense-interiors/`.

User correction: hearths and bookshelves overlap the wall. For automatic `bookshelf` and 3×3 `stone_hearth_lit/unlit`, the top row occupies the lower wall-face row; the remaining two rows occupy floor. The complete original multi-layer assembly is kept. The composer uses frozen graphic identity for canonical opaque IDs, checks actual wall-face cells and whole-floor connectivity, and reserves this placement before unrelated props. Fixed authored coordinates are not moved. The older theme bookshelf-row path follows the same vertical offset. Wall-face retint values live in `interiorHouseWallTiles.ts` so cream, gold-brick and stone-brick surfaces share this rule. Tests in `openInteriorZones` cover each of the three objects against all three wall materials and frozen load/save.

Individual school `study_desk` units are capacity furniture and do not share the optional table-assembly budget. School classroom counts remain intact; only small stock homes explicitly choose a common table for multiple uses. `conceptFacilityTemplates` verifies two desk/stool units per classroom, while the domestic composition test now checks one complete dining assembly instead of requiring the removed extra table on a rug.

Later user correction: the 3×3 stone hearth must rise **one more row**. Its top two rows overlap the two wall-face rows and only its bottom row stands on floor; bookshelves retain one-row overlap. Tall furnishings reserve their wall footprint before wall-mounted decorations. The frozen-identity tests assert separate hearth/bookshelf offsets for all three wall materials.

### Small props require supports; short bathroom steps (2026-09-14)

- `interiorSurfaceProps` identifies small plants, flower vases and bottle/jar groups by frozen graphic identity. The composer places these **after** furniture, only on an empty upper cell over an opaque tabletop, cabinet top or bookshelf top. It never substitutes an empty floor cell, even for a required prop; missing supports produce a placement warning. Occupied tops, transparent upper-layer tables, table aprons and chairs are not supports. Larger floor vessels remain separate objects.
- Legacy theme pools also exclude these small props from floor/corner stock; the tile group exposes them as furniture-top props.
- The catalog now includes `plant_small`, the complete 2×2 `bathtub` (22/23, 52/53), and `bathroom_steps` (141/111/171, one row). Unlike the three-row wall-height stair assembly, the short step is explicitly requested at the south edge of a raised activity mask. Automatic placement requires different floor materials and clear landings north and south. A material change alone never adds a staircase.
- The reviewed cottage retains its hearth and sleeping nook and gains a small bathroom with a south stair and approach. Both reviewed houses move their existing plants/bottle groups onto furniture. These are explicit saved-map edits, not a migration of other projects. Evidence: `output/evidence/bathroom-support/`; remote project `rpg-zzu-ashen-vault-20260913`. The preview is not proof of persistence; use the save/reload receipt.
- Regression tests: `interiorSurfaceProps` covers no-support rejection, support-before-prop ordering, occupied-art preservation, serialization, and a short stair's two landing cells. `openInteriorZones` retains the hearth/bookshelf wall overlap contracts.

The legacy demo parity fixture was refreshed after inspecting the exact cell diff: floor bottle removal and the resulting stock positions, plus the previously approved bookshelf wall overlap in the study. This does not change the repository gate baseline.

### Reference-house correction: no shrub pots, cooking supports, inset cabinets (2026-09-14)

- The user's reference places the bed beside the kitchen/hearth, one table below it, and a raised bathroom to the right. The reviewed cottage follows that layout instead of retaining a separate northern bedroom plus a long bathroom approach.
- `plant` and `plant_small` are excluded from automatic interior composition, including opaque frozen identities. Required requests receive an explicit warning; existing fixed artwork is not silently rewritten. Both reviewed maps explicitly remove the shrub pots.
- `cauldron` is a supported cooking prop: automatic placement requires an empty upper cell over stove tile 21. A dining table or floor is not a substitute. The legacy kitchen program also places it on the stove rather than beside it on the floor.
- `cabinet` overlaps one north wall-face row, with its lower row on floor, like the two-row vanity. Legacy cabinet stocking now stamps the complete pair against a real wall rather than a loose upper-row fragment. Fixed canonical placements retain authored coordinates. Frozen-identity wall-material tests include the cabinet.
- Content and save/reload evidence: `output/evidence/reference-home/`, project `rpg-zzu-ashen-vault-20260913`. Unrelated maps and shared tilesets are preserved.

Stove tile 21 is fully opaque (256/256 pixels). Its automatic assembly now keeps both 21/51 in lower, leaving upper for the pot without erasing the stove top. The critic accepts both legacy upper-21 and the new lower-21 representation; shared saved tilesets are not migrated. Wall-shell tests inspect the wall stage before inset cabinets are painted.

### All-interior review (2026-09-15)

Stock house review covers six programs × four scales. Small dwelling/study plans use 42–46 floor cells with joined activity areas and a single `home_table` (5×2 assembly including chairs, supported book and candle). Public/private plans retain real partitions; the compact five-room layout uses 117 room-floor cells. This only reflows new stock geometry; authored layouts and required public capacity remain explicit.

Qualified canonical room aliases such as `house/living` resolve through the legacy import receipt, with atlas and ambiguity checks. Exact opaque source IDs remain authoritative. A missing original is not replaced by a layout-context copy.

Shop sales surfaces use an opaque `table_wood` support distinct from the counter; workshop recipes use `work_table`. Small optional prep benches are omitted below 24 floor cells. Clinic/warehouse bottles use their existing wall shelves; pantry/ingredient recipes use supported shelf assemblies, and the alchemy cauldron requires a stove. Source edits in active projects are explicit revision-checked upserts, including imported layout-context copies; changing code defaults alone does not edit those copies.

Generated furniture interaction chooses an accessible cell of the same complete assembly when the default bottom-center anchor cannot be approached (e.g. a display table against the south/east wall). The pipeline passes `reachableOpenCells`; fixed canonical anchors retain their stricter existing contract. `interiorEventApproach` covers this regression. Native render inspection is followed by room/event BFS and dedicated player-harness movement/exit checks. Evidence/report: `output/evidence/all-interiors/`; remote target `rpg-zzu-ashen-vault-20260913`. Final counts and persistence proof live in the receipt, not this procedural note.

#### Structural diversity follow-up (2026-09-15)

The user rejected repeated north-rooms/south-hall structures after furnishing cleanup. `houseTopology.ts` now samples connected room arrangements before rasterization: 96 bounded candidates, seeded parent/direction/offset choices, non-transit bedrooms, wall-depth constraints, actual exposed north-wall capacity, varied corridor dimensions and an exposed south entrance. It ranks compactness without always taking the single densest rectangle, then accepts a candidate only after the stock builder's wall/furniture/approach checks. Explicit authored and frozen canonical geometries bypass the stock search. `buildHouseInteriorPlan` accepts an optional project so candidate validation uses the active concept vocabulary; both editor stock-house call sites pass it.

This is a deterministic tile-constrained search inspired by topology-before-geometry and explicit diversity evaluation, not an implementation of a trained diffusion/GNN model. Sources: [GFLAN](https://arxiv.org/abs/2512.16275), [Boundary-Constrained Diffusion Models: realism and diversity](https://arxiv.org/abs/2602.01949). `houseTopology.test.ts` treats rotation/reflection as duplicates and checks same-program diversity across eight seeds, reproducibility, compact area and furnishing validity. The 24 reviewed program/scale combinations have 24 distinct union-floor silhouettes under that equivalence (previously 12); this does not claim all possible seeds are unique. Candidate search retains the original compact seed when no alternative passes.

Cauldron interaction belongs to the stove's accessible base when its graphic is supported on the wall-overlapping stove top. The generated event access mask selects this position without moving either graphic; fixed canonical events keep their own contract.

#### 생활 방식별 신규 실내 5종 (2026-09-24)

어부·재봉사·공동 임대주택·전당포·상인 조합 회관, 총 5맵/14방을 추가했다. 원격 보관본 `oprn-shared-daily-life-five-20260924`, 루트 SQLite 라이브러리 `tibo-daily-life-five-20260924`, 기본 장소 카탈로그에 같은 ID로 등록한다. 기존 사용자 맵을 덮어쓰지 않는다. 정확한 조립·좌표·엔진 도달 좌표·저장 영수증은 `docs/interior-daily-life-five-20260924/`에 있다. 작은 침대, 하위 북벽4행/연결 천장, 의자 동쪽 방향, 용도별 바닥1~2종, 마을 미연결 1칸 출구를 적용했다.
