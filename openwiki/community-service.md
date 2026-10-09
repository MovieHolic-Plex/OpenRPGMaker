# 커뮤니티 서비스 연동

커뮤니티 앱의 보관본은 [OpenRPGMaker-community](https://github.com/MovieHolic-Plex/OpenRPGMaker-community)에
비공개 아카이브되어 있다. `openrpgmaker.com`은 현재 랜딩 페이지와 개발 블로그만
운영하며, 커뮤니티 앱의 DNS·배포는 없다.

향후 커뮤니티를 재개할 때 커뮤니티 저장소의 `public/player-static/`은 고정 입력이며, 설치 시에는
플레이어 산출물 경로와 에디터 런타임 자산 경로를 명시해야 한다. 운영 DNS와
실제 배포가 확인되기 전까지 커뮤니티 저장소는 비공개·아카이브 상태로 유지한다.

에디터 릴리스 QA는 이 저장소의 export·runtime 하네스에서 수행하고,
커뮤니티 DB·업로드·플레이 라우트 테스트는 커뮤니티 저장소에서 수행한다.
