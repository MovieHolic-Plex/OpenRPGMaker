# 운영 배포 — store.openrpgmaker.com (2026-10-06 가동)

seogo(HostHatch 서울, 85.155.177.241, `ssh seogo`, root)에 떠 있다. 이 서버는 여러 사이트가 함께 쓰는 공용 서버다.
openrpgmaker.com 소개 페이지와 api.openrpgmaker.com(텔레메트리, 포트 8787)은 건드리지 않는다.

## 지금 상태

- **DNS**: Namecheap `store` A → 85.155.177.241.
  - API 키는 Notion 「【AI 필독】 z-project 인프라 완성 가이드」에 있다. 호출 출발 IP 는 221.155.3.135(화이트리스트).
  - `setHosts` 는 레코드 전체를 갈아 끼운다. 반드시 `getHosts` 결과에 덧붙여 보내고 `EmailType` 도 그대로 보낸다.
- **실행**: systemd `oprn-store.service`, User `oprn-store`, 127.0.0.1:**8794**.
  - Node 는 서버 공용 node(22)와 분리했다. 앱 전용으로 `/opt/oprn-store/node`(v24.11.1)를 쓴다.
- **파일 위치**:
  - 실행본 `/opt/oprn-store/{dist,migrations,public,node_modules}`
  - 설정 `/etc/oprn-store/store.env` (oprn-store 그룹만 읽음)
  - 데이터 `/var/lib/oprn-store/blobs`
- **DB**: 서버 Postgres 16, DB `oprn_store`, 소유자 `oprn-store`(peer 인증). 마이그레이션은 서버가 켜질 때 스스로 적용한다.
- **nginx**: `/etc/nginx/sites-available/store.openrpgmaker.com` (이 폴더의 `nginx-store.conf`).
  - 인증서는 certbot webroot(`/var/www/html`)로 받고 자동 갱신된다.
- **로그인**:
  - Google 로그인이 켜져 있다(2026-10-06). OAuth 클라이언트는 Google Cloud 프로젝트 `nlp-project-295820` 의 웹 클라이언트다.
    - 외부 공개(Production) 상태이고, 승인된 리디렉션 URI 는 `https://store.openrpgmaker.com/auth/google/callback` 하나다.
    - state 쿠키 확인 + PKCE(S256) + 확인된 이메일(`email_verified`)만 받는다.
  - 운영자는 Google 로 들어와도 되고, 일회용 링크로도 들어올 수 있다(아래).
  - 개발 로그인은 https 주소에서 서버가 거부한다.
- **첫 진열**: 스테이징의 4종(blob + `store_*` 행)을 그대로 옮겼다. slug 도 같다.

## 운영자 로그인 링크 (15분·한 번)

```bash
ssh seogo 'set -a; . /etc/oprn-store/store.env; set +a; sudo -E -u oprn-store /opt/oprn-store/node/bin/node /opt/oprn-store/dist/admin-link.mjs admin@openrpgmaker.com'
```

## 새 판 올리기

```bash
npm --prefix store-server run build
rsync -a --delete store-server/{dist,migrations,public,package.json} seogo:/opt/oprn-store/
rsync -a --delete --exclude esbuild --exclude @esbuild --exclude typescript --exclude @types store-server/node_modules/ seogo:/opt/oprn-store/node_modules/
ssh seogo 'chown -R root:root /opt/oprn-store && systemctl restart oprn-store && sleep 2 && curl -fs http://127.0.0.1:8794/healthz'
```

## Google 로그인 자격 증명

- 비밀 정본은 seogo `/etc/oprn-store/store.env` 의 `STORE_GOOGLE_CLIENT_ID`, `STORE_GOOGLE_CLIENT_SECRET` 뿐이다.
  - 전달용 JSON(mdc-server `~/.local/share/oprn-secrets/google-oauth.json`)은 서버에 넣은 뒤 지웠다.
  - 잃어버리면 Google Cloud 콘솔에서 비밀을 새로 발급한다.
- 바꿀 때는 값을 화면·로그에 찍지 않는다. 프로그램으로 읽어 ssh 표준입력으로 넘기고,
  서버 쪽에서 파일을 원자적으로 다시 쓴다(소유 root:oprn-store, 640). 그다음 `systemctl restart oprn-store` 만 한다.
- 비밀이 맞는지는 실제 계정 없이도 확인할 수 있다. 서버 env 로 가짜 code 를 토큰 주소에 보낸다:
  - 비밀이 맞으면 400 `invalid_grant`
  - 틀리면 401 `invalid_client`

## 백업

- `sudo -u postgres pg_dump -Fc oprn_store` 를 매일 실행한다.
- `/var/lib/oprn-store/blobs` 는 덧붙이기만 하므로 rsync 증분 백업으로 충분하다.
- 판본은 DB 트리거로 고칠 수 없게 막혀 있다.
