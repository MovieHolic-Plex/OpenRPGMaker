# 저택 내부 5원본 — whole 객체와 구획 있는 작은 장소

사용자 원본 그림은 Git/public에 포함하지 않는다. 5원본에서 **원본128개 + 합성2개** 객체를
각 판본의 픽셀로 준비한다. 원본440칸 전체에 의미를 붙인 지원이 아니다.

| 팩 | 원본 | 실제 규격 | SHA256 |
|---|---|---|---|
| paw-mansion-b | ST-MsionB-I01.png | 256×1760, 8×55 native32 | 8338e8ebef716a86c687cb0f24683398efe2dadb9303f9c97772509e3ea8de9c |
| paw-mansion-p | ST-MsionP-I01.png | 동일 규격 | 2e3f22af16fd5de5de6b9d58543c31979e34b494be2c20fde7ca7de4eddc4c96 |
| paw-mansion-y | ST-MsionY-I01.png | 동일 규격 | ab203ceeaf8beed0ea9bf4741e4f52e09f33086dcabb1e1e05b524ae6739e1d1 |
| paw-mansion-w | ST-MsionW-I01.png | 동일 규격 | 61343c5c30906b9d45a4aeeca7584129b2a5c0784aba910d9f01e86b19122092 |
| paw-mansion-r | ST-MsionR-I01.png | 동일 규격 | e85c9fd260f1a3645ea017a76f5175fbd6e68683b251233b52369a99d66351fa |

## 같은 좌표와 다른 픽셀

[공식 설명](https://yms.main.jp/dotartworld/page2/tile-mansion02.html)과 실제 5개 시트를 비교했다.
P의 파란 인형, Y의 녹색 소파, W/R의 별도 침구·그림, R의 보석상 부품은 각각 실제 원본이다.
색만 일괄 치환하지 않는다. `mansion-interiors-comparison.json`은 각 whole sourceRect의
원본 RGBA SHA와 B 대비 RGBA/alpha 일치 여부를 기록한다. 원본 PNG SHA와 rawRGBA SHA는 서로 다른 값이다.

같은 좌표의 공통25종 중 B와 완전히 같은 RGBA인 객체는 P11/Y5/W3/R0이다.
같은 alpha인 객체는 P24/Y24/W23/R23이다. 투명 픽셀 RGB 차이도 RGBA 비교에 포함되므로
이 개수를 눈에 보이는 다른 객체 개수로 해석하지 않는다. 좌표 재사용은 각 원본 그림 검토에 근거하며
"같은 색만 바꾼 시트" 가정에 근거하지 않는다. 객체 ID도 색별로 따로 둔다.

공통25종: 아치창, 청색커튼창, 풍경화, 괘종시계, 목재 상판·전면 패널 가구, 서가, 꽃꽂이+받침, 벽난로,
유리수납장, 서랍장, 소파 앞/뒤, 거실탁자, 안락의자 앞/뒤, 천개침대, 2인침대,
화장대+거울+스툴, 그랜드피아노, 하프, 큰화분, 인형, 식탁, 동향/서향 식탁의자.
R 전용3종: 가로 유리진열장, 세로 유리진열장, 왕관+진열받침.

## whole 경계와 방향

모든 raw recipe.sourceRect는 0기준 **32px 칸**이다. 전체 배열은 `tile=(y+dy)*8+x+dx`.
원본의 다리/밑동/머리판/덮개/거울을 끝까지 보존하며 다른 이웃 변형을 섞지 않는다.

- 천개침대 `(0,41)2×4`: 천개·커튼·침구 전부. 일반2인침대 `(2,42)2×3`과 구별한다.
- 그랜드피아노 `(3,37)3×4`: 37행 위쪽 뚜껑부터40행 다리까지. 남쪽 건반 접근을 남긴다.
- 화장대 `(7,42)1×3`: 거울+하부+스툴까지 실제 원본 전체. 스툴만 상위로 덮어 다른부분을 지우지 않는다.
- 소파 **정면 `(0,32)3×2`/뒷면 `(0,35)3×2`**: 공식
  [분홍](https://yms.main.jp/dotartworld/sozai/tileset/smp_fantasy01/smp-msionI02.JPG)/
  [황색](https://yms.main.jp/dotartworld/sozai/tileset/smp_fantasy01/smp-msionI03.JPG)
  응접실의 위/아래 소파와 같다. 뒷면에는 좌면/앞다리가 보이지 않는다. 탁자 남쪽 소파는35행 북향 등판이며
  32행 정면을 뒤집지 않는다. importer가 직접 만든 `sofa-facing-proof` 도해를 타일과 관련 object 문서에 붙인다.
- **`(0,16)3×2` 목재 상판·전면 패널 가구**와 **`(0,13)3×3` 다리 있는 탁자**를 구분한다.
  기존 writing-desk ID는 호환성을 위해 유지한다. 정확한 가구 용도는 제작자 명명 근거가 없으며
  러그라는 판정도 확인되지 않았다. 옆 `(3,16)1×2` 문서 변형을 연장판이라고 단정하지 않는다.
  `table-panel-proof` 실제 비교 그림을 타일과 두 객체의 소유 문서에 함께 제공한다.
- R 세로진열장 `(6,46)1×4`: 거울/문이 아닌 유리 상판 아래 목재받침 전체.
  [공식 보석상](https://yms.main.jp/dotartworld/sozai/tileset/smp_fantasy01/smp-msionI04.JPG)의
  좌측 세로 케이스와 동일하다. 가로 `(3,45)3×2`와 함께 `display-shape-proof` 도해에 넣었다.

## 상판 합성2종

`mansion-interiors-layout.json`의 composites.parts.sourceRect/offset은 **픽셀**, 컴파일된
composite.sourceRect와 recipes.tiles는 **파생 atlas 칸**이다. 원본440칸은 한 픽셀도 바꾸지 않고 뒤에 붙인다.
W/R atlas는 456칸, B/P/Y는440칸이다. 원본과 파생 PNG SHA가 같다고 주장하지 않는다.

- W 목재 상판 가구: base `(0,512,96,64)` 먼저, 원본 문서·깃펜 `(128,320,32,32)`을 offset `(32,0)`에 올린다.
- R 계산대: base `(96,1440,96,64)` 전체 가로케이스, 남향 계산기 `(0,1440,32,32)`을 `(32,0)`에 올린다.
  직원은 남쪽 키패드에서 접근하며 북쪽을 조작면으로 지정하지 않는다.
- source-over만 사용한다. 반전·회전·리사이즈·다리 삭제 없음. 실제 overlay 최하단2픽셀행은
  원본 base의 불투명 상판 y16..32 안에 있어야 한다. importer가 매번 검사한다.
- 별도 소품을 같은 upper 칸에 찍어 base를 지우지 않는다. 합성 whole 사각은 상위·solid다.

## 다섯 실제 작은 장소

| 색 | 크기 | 구획·기능 | 핵심 접근 |
|---|---|---|---|
| B | 11×12 | 서쪽 마주보는 응접석/동쪽 별도 침실 | 남문4,11→벽문5,7→침대발치8,7/서랍장8,10 |
| P | 12×12 | 서쪽 피아노·하프와 응접석/동쪽 천개침실 | 남문6,11→악기앞 y5/벽문7,7→침대앞9,6 |
| Y | 12×12 | 서쪽 식탁·맞은편 의자/동쪽 녹색소파 응접실 | 남문10,11→소파사이 y7→벽문6,7→식탁남쪽y6 |
| W | 11×11 | 서쪽 상판 가구·서가/동쪽 무늬침구·화장대 | 남문4,10→책상옆x4→벽문5,7→침대발치7,6/화장대8,9 |
| R | 10×11 | 북서 계산직원실/동쪽 유리케이스/남서 왕관전시 | 남문5,10→동쪽진열로→벽문5,4→계산기남쪽2,4 |

각 도안은 원본별 대표 사용례이며 색만 바꾼 같은 방이 아니다. 실제 벽과 한칸 문틈으로 구획한다.
B/Y 응접석은 정면/뒷면을 마주놓고 사이 통로를 둔다. Y 식탁 의자는 동/서 원본이며
남쪽 빈 칸에서 접근한다. R 직원실은 전시 구역과 벽으로 분리된다.

standing 실제 불투명 밑동은 하위 바닥에 닿아야 한다. wall-mounted는 원본 벽행에 둔다.
각 raw/derived 객체는 전체 lower=-1/upper 배열, 방향, 지지칸, 정상/오류 그림을 소유한다.
장소 lower 전체 픽셀의 불투명성, upper 겹침, wall/supportCells, 경로를 따로 확인한다.
전체 가구 사각형은 막고 투명 여백을 통로로 계산하지 않는다.

미지원: 공식 난간/계단 3레이어 교차, 보행 발코니·복층, 천장 샹들리에,
그림 속 개폐문/수면/착석/연주/보석 구매·도난 시스템. 원본 벽면 컷어웨이이며 XP 천장자동연결은 별도다.
이 미지원 영역을 빈 sourceRect나 통행 kit로 등록하지 않는다.

## 재생성과 공용 등록

```bash
node scripts/content/prepare-pixel-art-world-mansion-interiors.mjs
node scripts/content/prepare-pixel-art-world-mansion-browser.mjs http://127.0.0.1:PORT src/assets/pixelArtWorldMansionInteriorsCatalog.json /absolute/user-png-directory output/paw-mansion-interiors/prepared
node scripts/content/prepare-pixel-art-world-native-install.mjs src/assets/pixelArtWorldMansionInteriorsCatalog.json output/paw-mansion-interiors/prepared output/paw-mansion-interiors/install
```

Catalog는 원본128개만, Layout.recipes는 최종130개/scene5개다. 파생객체를 원본440칸에서 다시 자르지 않는다.
Publisher는 prepared.structureKits의 객체 소유 문서와 scene 카테고리의 장소 문서/이미지/전체 배열을 사용한다.
외부 가져오기 UI에5팩이 등록되며 원본 SHA/치수가 일치할 때 사용자 로컬에서 생성한다.
Git에는 코드/좌표/MD만 넣는다. 원본/가공그림/준비JSON은 사용자 로컬 공용으로만 보낸다.
정본 저장·재로드와 공용 DB의 실제 등록은 감독자 단계이며 prepare 성공과 구분한다.

## 관찰 근거

정본 project `6ae74f7a-23a2-449b-8171-5afb5dff532b`, revision45의 현재 paw-home/paw-library 문서를
read-only SQLite에서 추출하고 조립 MD와 실제 장소/부품 그림을 확인했다. AI 대화 테이블은0건이었다.
공식샘플5개, 원본5개와 whole128개 contact, 실제합성2개와5장소를 직접 열었다.
이전 검토에서 W 가구를3×2형으로 교체하고 의자를 당겼다. 후속 원본 대조에서 해당3×2형의 명칭/연장판 단정은 근거가 부족함을 확인해 상판·전면 패널 형태로 정정했다. 픽셀과 배열은 유지하며 소파/진열장 및 두 상판 가구의 직접 비교 그림을 제공한다.

브라우저 실제 importer: 원본440칸 RGBA 전체 보존, schema shape, 상판/바닥 접지, 하위 불투명,
정확한 장면배열과130개 owned structureKit를 확인했다. tile MD145/image146,
object MD260/image142(재사용 포함). 관련소파/진열장 객체는 비교도해를 추가로 소유한다.
실제 `project/collision.canMove`의49접근점 모두 양방향 연결: B37칸/80간선, P45/106,
Y40/94, W39/92, R34/84. 이 수치는 엔진 데이터 관찰이며 플레이어 이동/이벤트 QA가 아니다.
게이트·vitest·typecheck·DB쓰기는 실행하지 않았다.

W 최종 의자: 북향 원본 안락의자를 (1,7)로 당겨 책상 바로 앞에 배치했다. 옆 (2,7)과 x4 통로를 통해 접근한다.
