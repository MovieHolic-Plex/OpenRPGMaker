# 서비스 경계

OpenRPGMaker 저장소는 에디터·플레이어·저작 도구를 소유한다. 운영 서비스는
별도 체크아웃으로 분리한다.

| 서비스 | 저장소 | 상태 |
| --- | --- | --- |
| 에셋 스토어 API·Postgres·R2·운영자 화면 | [OpenRPGMaker-store](https://github.com/MovieHolic-Plex/OpenRPGMaker-store) | 비공개, 운영 서비스 분리 완료 |
| 커뮤니티·게임 공유 Next.js 앱 | [OpenRPGMaker-community](https://github.com/MovieHolic-Plex/OpenRPGMaker-community) | 비공개, DNS·배포 확인 대기 |

## 에디터와 스토어

`src/assetStore/`의 순수 팩 계약은 에디터와 스토어가 각각 소유한 동일한
계약 스냅샷이다. 에디터가 팩을 만들고 HTTPS API로 게시한다. 스토어의 DB,
업로드 blob, OAuth/R2 비밀값, 운영자 CLI는 이 저장소에 두지 않는다.

건물 검수 하네스의 게시 단계는 `OPRN_STORE_PUBLISHER` 환경 변수로 외부
비공개 게시기를 받아 실행한다. 환경 변수가 없으면 게시를 거부한다.

## 에디터와 커뮤니티

에디터는 `npm run build:player`로 플레이어 산출물을 만든다. 커뮤니티 앱은
릴리스 산출물과 런타임 자산을 명시적인 경로로 받아 고정한다. 에디터 빌드가
커뮤니티 소스나 DB를 import하지 않으며, 커뮤니티 배포도 에디터 체크아웃의
상위 디렉터리를 암묵적으로 읽지 않는다.

커뮤니티 운영을 활성화하기 전에는 실제 DNS, 데이터베이스, object storage,
플레이어 artifact lock의 `sourceRevision`을 확인한다.
