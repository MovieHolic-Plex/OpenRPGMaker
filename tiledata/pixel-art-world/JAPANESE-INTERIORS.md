# 이자카야·일본식 방 — 사용자 로컬 native 지원

원본 픽셀은 Git/public에 포함하지 않는다. 23개 원본 완전체, 2개 파생 완전체,
2개 장소 도안을 지원한다. 원본 400칸 전체의 용도를 검토했다는 선언이 아니다.

| 팩 | 실제 원본 | 규격 | SHA256 |
|---|---|---|---|
| paw-izakaya | ST-Izakaya-I01.png | 256×1600, native32, 8×50 | 6c5488583371c4efbbb47c53f2f40402780b834ebee80385eeae7e3340b0f18a |
| paw-washitu | ST-Washitu-I01.png | 256×1600, native32, 8×50 | 8667246423284808bf5047c2bd0b1f4750a5d555da0ce09b243c24f4e399751b |

`japanese-interiors.json`의 sourceRect는 **32px 칸**이고 `japanese-interiors-layout.json`의
composites.parts.sourceRect/offset은 **픽셀**이다. 컴파일된 composites.sourceRect는 파생
아틀라스의 32px 칸이다. 원본에서 파생 행50 이후를 자르지 않는다. 원본 PNG SHA와
파생 PNG SHA는 다르다. 실제 importer는 원본 SHA/치수 확인 후 원본400칸을 보존하고 뒤에만 붙인다.

## 공식 실제 조립과 원본 경계

[이자카야 공식 페이지](https://yms.main.jp/dotartworld/page2/tile-izakaya01.html)는 부스와
좌식석의 3레이어 조립을 설명한다. 부스 [전체 예시](https://yms.main.jp/dotartworld/sozai/tileset/smp_shop01/smp-shop05.jpg)
및 [레이어 복구 예시](https://yms.main.jp/dotartworld/sozai/tileset/smp_shop01/smp-shop13.jpg)의
북쪽 격자창→목재등판→벤치, 테이블, 남쪽 격자창/목재 칸막이를 실제 원본과 비교했다.
**북쪽 높이는 키 큰 가구 조각의 혼입이 아니라 부스의 등칸막이 전체다. 낮추기 위해 자르지 않는다.**
위 URL의 실제 파일명은 서버 기준 `smp-shop*.jpg`이며 다운로드 근거는 private output에 보존한다.

- 부스: 원본 `(0,41)3×2` 좌석, `(0,11)3×3` 전체 테이블, `(0,49)3×1` 상단 복구,
  `(4,15)3×2` 앞 칸막이를 순서대로 96×192 캔버스에 합성한다. 정확한 오프셋은 JSON에 있다.
- 좌식석: 원본 x160..255, y1120..1198의 상판·다리·그림자 전체를 취한다.
  **y1199부터 별도 파란 방석, y1216부터 반복 탁자 전면 보정**이므로 무조건 3×3/3×4 칸으로 잡으면 다른 물체가 섞인다.
  원본 `(2,40)1×1` 방석 6개를 먼저 그리고 전체 탁자를 위에 그린다. source-over 외 가공 없음.
- 두 합성은 고정 upper+solid다. 원본 source-over 배치를 두 게임 레이어에서 반복해
  같은 upper 칸의 테이블/방석을 서로 지우지 않는다. 내부 플레이어 착석 기능은 없다.
- 원본 의자 4방향은 각각 원래 그림이며 반전하지 않는다. 식탁의 다리, 조리대의 하부장,
  가스레인지 하단, 냉장고 전체 문을 보존한다. 음식 카탈로그와 중복되는 작은 음식은 제외했다.

[일본식 방 공식 페이지](https://yms.main.jp/dotartworld/page2/tile-wasitu01.html)의
쇼지 앞뒤·침구·코타츠 실제 샘플과 원본을 확인했다. 원본명은 **ST-Washitu-I01.png**다.
쇼지 앞 `(0,11)4×2`와 뒤 `(0,13)4×2`는 별도 원본이며 단순 뒤집기가 아니다.
코타츠 `(0,26)4×4`는 덮개까지 전체, 붉은/파란 이불 `(5/6,40)1×3`은 북쪽 베개부터
남쪽 발끝까지 전체다. 그림 속 수면·쇼지 개폐·착석은 자동 이벤트가 아니다.

## 실제 장소와 받침

이자카야 **11×14**: 남문 `(5,13)`에서 x5 한 줄을 따라 북쪽으로 간다.
북동 조리대/레인지 밑동 y3은 붉은 바닥, 직원 접근 y4는 카운터 뒤이고 고객 접근은 y7이다.
북서 급차기 앞 `(1,4)`는 고객 셀프 서비스 공간이다. 부스 `(1,5)`는 동쪽 x4에서,
좌식석 `(6,9)`는 서쪽 x5와 북쪽 y8에서 접근한다. 세로 다다미는 원본 가장자리를
보존하고 내부 한 행을 반복해 4행으로 잇는다. 북벽/남벽은 같은 흰벽·목재판 계열이다.

와시츠 **8×10**: 남문 `(5,9)`부터 x5 한 칸 통로로 장롱 앞 y4, 코타츠 북쪽/동쪽,
침구 옆과 발치 `(6,8)`를 잇는다. 코타츠 `(1,5)` 4×4, 장롱 `(1,1)` 2×3,
침구 `(6,5)` 1×3을 자르지 않고 방을 줄였다. 완성 다다미4×2 세 장과 동쪽 목재바닥을 사용한다.
쇼지는 북벽, 장롱 밑동 y3은 실제 바닥이다. 좌식 방의 칸 수를 실측 다다미 첩수로 주장하지 않는다.

standing 물체는 실제 불투명 최하단 픽셀의 바닥 받침을 importer가 확인한다.
wall-mounted는 생성기의 wallTileIds/supportCells와 비교 예제의 exampleWallRows를 사용한다.
각 장소 하위 모든 픽셀은 불투명이다. 위/아래 레이어와 통행은 별개이며 가구 전체 사각은 막는다.
원본 벽면 컷어웨이 도안이며 XP 천장·실제 문·전이·주문/수면 이벤트는 별도다.

## 재생성 및 공용 인계

```bash
node scripts/content/prepare-pixel-art-world-japanese-interiors.mjs
node scripts/content/prepare-pixel-art-world-japanese-browser.mjs http://127.0.0.1:PORT src/assets/pixelArtWorldJapaneseInteriorsCatalog.json /absolute/user-png-directory output/paw-japanese-interiors/prepared
node scripts/content/prepare-pixel-art-world-native-install.mjs src/assets/pixelArtWorldJapaneseInteriorsCatalog.json output/paw-japanese-interiors/prepared output/paw-japanese-interiors/install
```

첫 명령은 메타데이터만 만든다. 브라우저 준비는 실제 importer/shape 검증, 원본400칸 RGBA 보존,
실제 접지/하위 불투명, 25개 structureKit 문서, 최종 장소 배열 동일성을 확인한다.
prepared와 install/library.json에는 사용자 그림이 들어 있으므로 로컬 공용에만 등록한다.
외부 타일셋 가져오기 UI에 두 pack이 등록되고 원본을 가져올 때 생성한다. 별도 네트워크 다운로드 없음.

공용 publisher는 Catalog의 raw23 및 Layout의 최종 recipes25/scenes2를 사용한다.
파생 객체2개는 importer가 생성한 structureKits에서 가져와야 한다. 원본400칸만 있는 Catalog로
파생 조각을 원본에서 다시 자르지 않는다. 장소에는 scene MD/이미지와 전체 배열/접근칸을 함께 옮긴다.
각 structureKit에도 자기 전체배열/방향/받침/정상·오류 이미지 문서가 있다.
정본 저장·재로드와 공용 DB 등록은 감독자만 수행한다. 준비 산출은 저장 완료가 아니다.

## 관찰 범위

revision41 정본 paw-home/paw-fastfood-interior 참고문서와 실제 원본/공식 이미지를 읽고 조립했다.
원본 부품23개, 합성2개, 장소2개 및 실제 importer의 정상/오류 그림을 직접 열었다.
부모 검토자가 수정 후 두 장소를 다시 열어 추가 시각 반려 없음으로 확인했다.
엔진 collision.canMove로 이자카야12/와시츠8 접근점과 필수 통로의 양방향 연결을 확인했다.
이자카야50칸·142방향 간선, 와시츠16칸·36방향 간선이다. 실제 플레이어 이벤트 관찰은 아니다.
테스트 스위트/gates/typecheck는 실행하지 않았다.
