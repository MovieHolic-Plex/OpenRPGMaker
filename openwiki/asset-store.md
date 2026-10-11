# 에셋 스토어 연동

스토어 서버는 [별도 비공개 저장소](https://github.com/MovieHolic-Plex/OpenRPGMaker-store)에서 운영한다.
이 저장소에는 에디터 창과 순수 팩 계약만 남긴다.

- 팩 형식: `src/assetStore/format.ts` (`oprn-store-pack/1`)
- 팩 생성·적용 순수 로직: `src/assetStore/pack.ts`
- 업로드 시그니처 검사: `src/assetStore/sniff.ts`
- 운영 서버: `OpenRPGMaker-store/src/`, Postgres migrations, R2 adapter

새 필드를 추가하면 양쪽 저장소의 계약 스냅샷을 같은 변경으로 갱신하고,
스토어 서버를 먼저 배포한 뒤 에디터 게시기를 갱신한다. 운영 URL과 토큰은
문서나 저장소에 기록하지 않고 배포 secret manager에서만 주입한다.

건물 검수 게시기는 `OPRN_STORE_PUBLISHER`에 비공개 저장소의 게시기 명령을
설정한다. 설정하지 않은 로컬·CI에서는 업로드가 실행되지 않는다.

## 에디터 첫 진입 화면 (2026-10-12)

왼쪽 활동 막대의 「스토어」는 받은 목록이나 프로젝트별 개수를 보여 주는 화면이 아니다.
「인기 에셋 둘러보기」를 누르면 에셋 스토어가 `browse`·`sort: "popular"`로 열리고,
큰 화면의 제목도 「인기 에셋」으로 시작한다. 최신 목록·받은 것·프로젝트·올리기는 큰 화면의
탭에서 필요할 때 연다. 데스크톱 브리지가 없으면 기존 안내만 보여 준다.
