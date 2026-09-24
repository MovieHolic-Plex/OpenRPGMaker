# Pixel Art World 연출 오브젝트

메타데이터 정본: `tiledata/pixel-art-world/eventprops.json`.
자세한 sourceRect/예외/권리/관찰: [EVENTPROPS.md](../tiledata/pixel-art-world/EVENTPROPS.md).

- `pixelArtWorldEventProps.ts`: 범용39·제한9 기하와 명시 프레임,12×10 진단 이벤트 배열/좌표 검사.
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
