# 주택 욕실·체육관 — 사용자 다운로드 native 2팩

메타데이터 정본은 `bath-gym.json`, 배포 카탈로그는 `src/assets/pixelArtWorldBathGymCatalog.json`이다.
원본 PNG 및 원본으로 생성한 그림은 사용자 로컬에만 둔다. Git/public/assets에 넣지 않는다.
전체 원본 시트의 의미를 검토했다는 선언이 아니다. 아래 25개 완전체와 2개 장면을 지원한다.

| 팩 | 원본 | 실제 규격 | SHA256 |
|---|---|---|---|
| paw-home-bath | ST-Bath-I01.png | 256×768, native32, 8×24 | e66dd50e1782d9c39013a04b9d96899c1e0b75ae0e08e0c6ea32ec29fa6db00d |
| paw-school-gym | ST-Schl-Gym.png | 256×1600, native32, 8×50 | 88ea5da312fecf15098a3a0239b278d23f365ce978d4bbee727584ca24775b81 |

모든 `sourceRect`는 0기준 **32px 칸**이다. 픽셀 좌표는 네 값을 각각 32배 한다.
`tiles[y][x] = (sourceRect.y+y)*8 + sourceRect.x+x`. 캔버스 회전/반전/리사이즈를 하지 않는다.
정상/오류 그림과 객체별 전체 lower/upper 배열은 실제 사용자 원본의 browser importer에서 생성한다.

## 원본과 실제 샘플

[주택·욕실](https://yms.main.jp/dotartworld/page2/tile-townI01.html)의 욕실/세면실/화장실 실제 샘플,
[체육관](https://yms.main.jp/dotartworld/page2/tile-school02.html)의 전체 실제 샘플을 확인했다.
욕실은 벽에 설치한 샤워기와 거울, 바닥에 닿는 세면대·욕조·세탁기의 관계를 따른다.
체육관 공식 그림의 중심 운동 공간과 가장자리 보관 영역을 참고했다.
그림을 그대로 복제하거나 타 제품의 RTP 배경까지 포함하지 않는다.
공식 6단까지의 뜀틀 설명과 원본 가로 2×2 형태를 함께 확인했다.

## 검토한 전체 객체

욕실 13개: 닫힌/열린 양변기, 아이보리/파란 4열 세면대·중앙 수납장 전체,
정면 세탁기, 가로/세로 욕조, 벽 샤워기 전체, 작은 창, 목욕 의자, 대야, 수건 바구니, 세탁물 바구니.
체육관 12개: 벽걸이 골대, 2열 창, 농구공/배구공 보관함, 가로 6단 뜀틀,
펼친/접은 매트, 정면/뒷면 접이 의자, 콘, 탁구대, 그랜드피아노.

- 가로 욕조 `(4,19)2×2` 아래 `(4,21)2×1`은 떨어진 변형 조각이다. 무조건 3행으로 묶지 않는다.
- 세면대 `(4,11)4×3`은 왼쪽/오른쪽 세면대와 중앙 두 열의 수납장 전체를 보존한다.
- 샤워기 `(6,22)2×2`의 양쪽 호스/수전을 함께 보존한다. 바닥 물건처럼 설치하지 않는다.
- 탁구대 `(0,47)4×3`은 47행 위쪽에 걸친 네트와 49행 다리를 모두 포함한다. 48행부터 자르면 네트 머리가 잘린다.
- 피아노 `(0,43)3×4`는 열린 뚜껑·건반·다리 전체이며 옆 열의 탁구 라켓을 섞지 않는다.
- 벽 골대 `(6,38)2×2`는 백보드/림/그물 전체다. 다른 방향 지주형 골대로 뒤집어 쓰지 않는다.
- 경기선, 네트·기둥, 대형 무대·계단·난간, 별도 SPT-Gym01 간판, SC문, XP천장/교단은 미검토/별도다.

`placementKind`는 standing/wall-mounted, `supportCells`는 부품 내부 받침 좌표다.
`exampleWallRows`는 벽걸이 부품의 비교 그림 뒤에 놓을 실제 원본 벽행이다. 다른 팩은 필드가 없으면 기존 출력 그대로다.
서 있는 물체는 원본의 불투명 최하단 행을 actual browser importer가 검사한다.
벽 부착물의 scene 지지칸은 생성기가 wallTileIds로 확인한다. 검증된 가구는 upper+solid,
바닥은 lower+passable, 미검토 조각은 기본 차단이다. 매트 그림도 이번 고정객체 계약에서는 전체 solid다.

## 실제 조립 장면

`bath-wash-and-bathe`는 11×9. 건식 세면실(서쪽)과 타일 욕실(동쪽)을 x=5 벽으로 분리하고
아래 `(5,7)`의 한 칸으로 연결한다. 남쪽 `(3,8)`→`(3,7)`에서 들어온다.
샤워기 아래 의자 `(9,2)`와 대야 `(9,4)`를 모으고 앞 접근 `(9,3)/(9,5)` 및 욕조 옆 `(8,3)`을 비운다.
변기를 같은 작은 욕실에 밀어넣지 않았다. 변기 2종은 별도 완전체로 재사용한다.

`gym-practice-and-storage`는 14×14. 남쪽 `(8,13)`→`(8,12)`에서 들어온다.
골대 앞 x=1..8,y=3..10의 **8×8칸**은 의도한 활동 공간이다. 밀도를 위해 가구를 추가하지 않는다.
기구는 동쪽 x=10..11에 두고 y=5/y=8 또는 x=9에서 접근한다. 남서 의자와 출구를 연결한다.
정규 농구 코트의 치수·득점 판정·스포츠 시스템은 제공하지 않는다.

두 장면은 원본 벽면 컷어웨이 조립이다. XP 천장 연결, 실제 문/잠금/출입·입욕/세탁/착석 이벤트는 별도다.
출입구 `doorways`는 빈 통행 좌표이지 닫히는 문 그림이나 프라이버시 이벤트가 아니다.
방·벽·전체 배열·접근점·원본 해시와 현재 조립 그림은 가져오기 후 scene 참고문서가 소유한다.

## 재생성·사용자 로컬 준비

```bash
node scripts/content/prepare-pixel-art-world-bath-gym.mjs
node scripts/content/render-pixel-art-world-bath-gym.mjs /absolute/user-png-directory
node scripts/content/prepare-pixel-art-world-native-browser.mjs http://127.0.0.1:PORT src/assets/pixelArtWorldBathGymCatalog.json /absolute/user-png-directory output/paw-bath-gym/prepared
node scripts/content/prepare-pixel-art-world-native-install.mjs src/assets/pixelArtWorldBathGymCatalog.json output/paw-bath-gym/prepared output/paw-bath-gym/install
```

첫 명령은 이미지 없는 metadata만 만든다. 나머지는 사용자 로컬 그림·JSON 산출만 하며 DB에 쓰지 않는다.
외부 타일셋 UI는 SHA와 실제 치수를 맞춘 뒤 원본 자료/객체별 정상·오류/scene MD·이미지를 만든다.
두 팩은 `attachPixelArtWorldBathGymObjects`에서 object structureKit마다 전체 배열 MD와 동일 원본 근거 MD·그림을 붙인다.
장소 공용 등록은 감독자의 canonical save/reload→local publisher가 담당한다. 이 준비 파일이 저장 완료 증거는 아니다.

## 관찰 근거와 한계

정본 revision39의 paw-home/paw-school-interior 참고문서를 추출한 뒤 관련 MD·실제 그림을 읽었다.
공식 샘플 4장과 원본의 32px 확대격자를 직접 확인했다. 2개 실제 scene 및 25개 부품 그림을 열었다.
actual browser importer 결과: 욕실 tile MD16/image15, object13개(각 MD2/image1);
체육관 tile MD15/image14, object12개(각 MD2/image1). 이미지 수는 객체 문서에서 원본 근거를 재사용한다.
구조 생성기의 경계/겹침/받침/접근 연결 및 하위 모든 픽셀 불투명 확인을 통과했다.
실제 `src/project/collision.ts`의 canMove로 접근점23곳과 활동/통로 모든 필수 칸을 확인했다.
욕실31칸/78방향 간선, 체육관104칸/342방향 간선이 양방향 연결이다.
이는 엔진 데이터 경로 판정이며 실제 플레이어 이동·이벤트 관찰/정본 저장·재로드 검증이 아니다.
게이트/테스트 스위트/typecheck는 실행하지 않았다.
