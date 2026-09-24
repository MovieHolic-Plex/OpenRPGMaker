# Pixel Art World 욕실·체육관 native 지원

사용자가 받은 ST-Bath-I01/ST-Schl-Gym의 정확한 SHA/치수를 확인한 후, 25개 검토 완전체와
작은 건식/습식 욕실 및 활동 공간을 보존한 체육관 장면을 실제 원본으로 준비한다.
등록·좌표·레이어·받침·범위·재생성 명령은 [BATH-GYM.md](../tiledata/pixel-art-world/BATH-GYM.md).

`bath-gym.json` → `prepare-pixel-art-world-bath-gym.mjs` → `pixelArtWorldBathGymCatalog.json`.
`externalTilesetCatalog.ts`의 카탈로그에 연결된다. `exampleWallRows`는 optional이며
새 벽걸이 부품의 단독 정상 예제에 원본 벽 받침을 그린다. 기존 recipe의 동작은 유지한다.
`externalTilesetImport.ts`는 현재 원본 픽셀의 접지를 확인하고 실제 MD/PNG를 만든 뒤
`pixelArtWorldBathGym.ts`로 이 두 팩의 객체 structureKit에도 문서와 비교 그림을 붙인다.
참고문서가 tileset에만 있고 object AI 조회에는 없는 상태로 끝내지 않는다.

prepared/install 산출에는 사용자 원본 PNG가 포함된다. Git/public에 넣거나 배포 번들로 가져오지 않는다.
정본 및 공용 SQLite 저장은 별도 감독자 단계이며, prepare 성공을 저장 완료로 보고하지 않는다.
장소 참고문서는 scene 전체 배열·doorways·approachCells를 보존해 기존 local publisher에서 등록한다.
DB writer는 동시에 하나만 사용한다. 순수 준비 스크립트는 DB에 쓰지 않는다.
