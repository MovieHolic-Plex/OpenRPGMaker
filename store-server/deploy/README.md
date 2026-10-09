# 운영 배포 — store.openrpgmaker.com (2026-10-06 가동)

seogo(HostHatch 서울, 85.155.177.241, `ssh seogo`, root)에 떠 있다. 이 서버는 여러 사이트가 함께 쓰는 공용 서버다.
openrpgmaker.com 소개 페이지와 api.openrpgmaker.com(텔레메트리, 포트 8787)은 건드리지 않는다.

## 지금 상태

- **DNS**: Cloudflare 영역 `openrpgmaker.com`(zone `07dc91b128e27be2fc1cbf27281bfd7b`, 2026-10-06 Namecheap 에서 이관).
  - 등록 기관은 그대로 Namecheap 이고 네임서버만 `arya`/`odin.ns.cloudflare.com` 으로 바꿨다. 레코드는 이관 전과 같다(A 넷, MX 다섯, SPF).
  - **`store` 만 프록시(주황)**. `@`·`www`·`api` 와 메일 레코드는 DNS 만(회색)이다.
  - SSL 모드 `strict` — 오리진 Let's Encrypt 인증서를 검사한다. `always_use_https` 는 끈다(오리진이 80→443 을 직접 돌린다, certbot HTTP-01 도 그대로 통과).
  - 오리진 nginx 는 `include /etc/nginx/cloudflare-real-ip.conf` 로 진짜 사용자 IP 를 받는다(`nginx-store.conf`). 오리진 잠금(엣지 대역만 허용)은 아직 걸지 않았다.
  - DNS API 는 Cloudflare 글로벌 키(`X-Auth-Email`+`X-Auth-Key`)로만 된다. R2 토큰(`cfat_`)은 DNS 를 못 만진다. 키 위치는 Notion 「murim.chat — Cloudflare 프록시 적용법」.
  - 프록시를 처음 켤 때는 엣지 인증서가 `active` 인지 먼저 본다(`/zones/<id>/ssl/verification`). 발급 전에 켜면 TLS handshake failure 다.
- **실행**: systemd `oprn-store.service`, User `oprn-store`, 127.0.0.1:**8794**.
  - Node 는 서버 공용 node(22)와 분리했다. 앱 전용으로 `/opt/oprn-store/node`(v24.11.1)를 쓴다.
- **파일 위치**:
  - 실행본 `/opt/oprn-store/{dist,migrations,public,node_modules}`
  - 설정 `/etc/oprn-store/store.env` (oprn-store 그룹만 읽음)
  - 데이터 `/var/lib/oprn-store/blobs` (원본·백업. 내보내기는 R2 가 한다 — 아래)
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

## 파일 내보내기 — Cloudflare R2 (2026-10-06)

- 그림·소리 파일(`/api/v1/blobs/:sha`)은 서버가 「내줘도 되는가」만 확인하고 R2 서명 주소로 **303** 돌려보낸다. 받는 전송량은 R2 몫이라 무료다.
- 버킷: 운영 `oprn-store`, 스테이징 `oprn-store-staging` (Cloudflare 계정 `1de02586…`, APAC, 비공개).
- 설정: `/etc/oprn-store/store.env` 의 `STORE_R2_ACCOUNT_ID`, `STORE_R2_ACCESS_KEY_ID`, `STORE_R2_SECRET_ACCESS_KEY`, `STORE_R2_BUCKET`.
  넷 다 없으면 R2 없이 예전처럼 디스크에서 내준다. 일부만 있으면 서버가 켜지지 않는다.
- 자격 증명은 전용 API 토큰 `oprn-store-prod` 다(스테이징은 `oprn-store-staging`). 권한은 그 버킷 객체 읽기·쓰기뿐이다.
  - S3 키 ID = 토큰 id, 비밀 = 토큰 값의 sha256. 토큰 값은 어디에도 남기지 않았다. 잃어버리면 토큰을 지우고 새로 만든다.
  - **토큰에 요청 IP 제한을 걸지 않는다.** R2 는 서명 주소로 받는 방문자에게도 그 IP 조건을 적용한다.
    seogo IP 로 묶었더니 방문자 전원이 403 이었다(2026-10-06, 약 5분). 계정의 `master` 토큰은 mdc-server IP 로 묶여 있어 seogo 에서 못 쓴다.
  - R2 가 거절하면 로그에 `[store] r2 put … 403` 이 남고, `r2_at` 이 비어 있는 파일은 계속 디스크에서 나간다.
- 서버 디스크 사본은 그대로 둔다(검증·원본). `store_blobs.r2_at` 이 비어 있는 파일은 켜질 때와 매시간 뒤에서 R2 로 올린다.
- 상품을 내려도 이미 나간 서명 주소는 최대 약 2시간 유효하다(한 시간 단위 고정 주소 + 유효 2시간). 고아 blob 정리 때 R2 에서도 지운다.
- 영역은 이제 Cloudflare 에 있으므로 R2 사용자 도메인(`files.` 등)·엣지 캐시를 붙일 수 있다. 붙이면 공개 주소가 되므로, 상품을 내릴 때 R2 삭제와 캐시 비우기를 함께 해야 한다(아직 안 함 — 지금은 서명 주소).

## 백업

- `sudo -u postgres pg_dump -Fc oprn_store` 를 매일 실행한다.
- `/var/lib/oprn-store/blobs` 는 덧붙이기만 하므로 rsync 증분 백업으로 충분하다. R2 버킷도 같은 파일을 갖는다.
- 판본은 DB 트리거로 고칠 수 없게 막혀 있다.
