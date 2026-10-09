# 커뮤니티 서비스 연동

커뮤니티 앱은 [OpenRPGMaker-community](https://github.com/MovieHolic-Plex/OpenRPGMaker-community)에서 관리한다.
현재 저장소는 플레이어를 빌드하고, 커뮤니티는 서명된 artifact를 설치해
게임을 제공한다.

커뮤니티 저장소의 `public/player-static/`은 고정 입력이며, 설치 시에는
플레이어 산출물 경로와 에디터 런타임 자산 경로를 명시해야 한다. 운영 DNS와
실제 배포가 확인되기 전까지 커뮤니티 저장소는 비공개로 유지한다.

에디터 릴리스 QA는 이 저장소의 export·runtime 하네스에서 수행하고,
커뮤니티 DB·업로드·플레이 라우트 테스트는 커뮤니티 저장소에서 수행한다.
