# Pixel Art World 연출 오브젝트

메타데이터 정본: `tiledata/pixel-art-world/eventprops.json`.
자세한 sourceRect/예외/권리/관찰: [EVENTPROPS.md](../tiledata/pixel-art-world/EVENTPROPS.md).

- `pixelArtWorldEventProps.ts`: 범용41·제한9 기하와 명시 프레임,12×10 진단 이벤트 배열/좌표 검사.
- `pixelArtWorldEventPropImport.ts`: 사용자SHA 확인 →4열 공통 프레임 atlas →실제 알파 좌표
  대조 →표준 asset adapter와 owner 참고문서 등록. lineage/저장 대상/owner변경 보호.
- `pixelArtWorldEventPropReferences.ts`: 전체 원본/crop/프레임, 실제 조립/누락 그림과 전체 이벤트 배열.
- `pixelArtWorldEventPropCatalog.ts`: 외부 카탈로그 전용 카드. 제한9는 파일입력/API 모두 비활성.
- 기존 `uploadedSpriteGeometry`/`uploadedEventSprites`/`toolImageEventSprites` 재사용. 엔진 변경 없음.

원본geometry와 atlasgeometry를 혼동하지 않는다. meta width는4*frameWidth, height는
ceil(frameCount/4)*frameHeight이다. 원본 큰 오브젝트를4×4 walking시트로 일괄 자르지 않는다.
폴사인은첫행만loop, 자판기는two-event x/x+1, Labo03하단장치는64×32이다.
loop는parallel 목록의재실행이며 모든대기120ms는예시다. 이벤트표시와출입/판매/충돌구현을구분한다.

RTP제한9는정확한geometry분석자료다. XP소유자확인으로OPRN엔진사용이허용되는것은아니며
기본sharedContent에자동등록하면안된다. 현재문43과기존AIcrop/loader파일은변경하지않는다.

## 로컬 공용 설치 (2026-09-24)

`prepare-pixel-art-world-eventprop-library.mjs`는 원본39개 SHA와 모든 프레임의 실제 픽셀을
확인한다. 브라우저 캔버스의 반투명 RGB는 PNG 재인코딩에서 달라질 수 있다(촛불 alpha1의
RGB 오차 최대125). 원본 alpha와 premultiplied 채널 일치, 브라우저 정규화 source와 atlas의
visible RGBA 일치를 각각 검사한다. 원본의 raw-RGBA 해시를 가공 PNG 해시로 주장하지 않는다.

`publish-pixel-art-world-eventprop-library.mjs --publish-local`은39스프라이트와2문서 전용
소유자를 별도 `pixel-art-world-eventprops-local`에 CAS 게시한다. native publisher가 이 별도
라이브러리를 다시 생성할 필요는 없다. 문서 소유자의 빈32px칸은 게임용 타일/객체가 아니다.
정본 revision40에서41자산 바이트 및2소유자 저장·재로드, 기존12맵 보존을 확인했다.
실제 AI 조회309MD/620페이지/618그림이 일치했다. 객체 스탬프·공간 배치·큰 그림 전체 충돌은
아직 제공하지 않으며, 이 상태를270개의 완성 장소나 타일 오브젝트로 세지 않는다.
통합 편집기 빌드 후 실제 호스트 자료집에서 자판기 다운로드·대상 선택 카드를 검색해
확인했다(브라우저 오류0). 개인 화면 근거는 `output/paw-eventprops-install/`에 있다.
SC-Water01/02는 [WATER-EVENTPROPS.md](../tiledata/pixel-art-world/WATER-EVENTPROPS.md)의
`frameComposites.parts`로 한 위상의 전체 물줄기를 먼저 합성한다. 작은 것은3/4/6칸별4프레임,
큰 것은96×160 실제4프레임만 사용한다. sourceRect 포함영역을 그대로 자르면 짧은/긴 물줄기가 깨진다.
`preparePixelArtWorldEventProp` 네 번째 / `importPixelArtWorldEventProp` 다섯 번째 인자의
`{supportFile?:File}`에 정확한 ST-Sewer 원본을 주면 `pixelArtWorldWaterSupportReferences.ts`가
실제 벽/수면 전체배열·정상오류·좌표검사를 같은 owned category에 추가한다.
별도 엔진 sprite타입이나 자동 map/event 삽입은 없다. 기존48pack ID/배열은 보존했다.
