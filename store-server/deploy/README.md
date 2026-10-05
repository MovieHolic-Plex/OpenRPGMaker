# 운영 배포 절차 (아직 실행하지 않음)

대상은 seogo(HostHatch 서울, 85.155.177.241)다. 이 서버에는 이미 openrpgmaker.com 소개 페이지가 정적 nginx로 떠 있다.
스토어는 그 옆에 하위 도메인 `store.openrpgmaker.com` 으로 띄운다. 소개 페이지는 건드리지 않는다.
지금은 스테이징만 테일스케일 안에서 돈다(`../scripts/install-staging.sh`, http://mdc-server:18320). 아래는 공개 배포를 할 때의 순서다.

## 0. 공개 전에 결정할 것

- **저장소가 비공개다.** 스토어 서버 코드는 공개하지 않아도 된다. 다만 편집기 앱 배포본에는 스토어 기본 주소
  `https://store.openrpgmaker.com` 이 들어 있다(`electron/main/assetStoreClient.ts` `DEFAULT_STORE_URL`).
- **Google 로그인 자격 증명이 필요하다.** 없으면 운영 서버에는 로그인 수단이 없다(개발 로그인은 운영에서 끈다).
  이 경우 둘러보기와 받기만 된다.

## 1. DNS (Namecheap)

`store` A 레코드 → `85.155.177.241`(TTL 자동). AAAA 레코드는 서버에 IPv6 가 있을 때만 넣는다.

## 2. 서버 준비 (seogo, root)

```bash
apt install -y postgresql nodejs nginx certbot python3-certbot-nginx   # node 24 이상
useradd --system --home /var/lib/oprn-store --shell /usr/sbin/nologin oprn-store
install -d -o oprn-store -g oprn-store /var/lib/oprn-store/blobs /opt/oprn-store
install -d -m 750 /etc/oprn-store
sudo -u postgres createuser oprn_store
sudo -u postgres createdb -O oprn_store oprn_store
```

`pg_hba.conf` 의 `local all all peer` 로 유닉스 소켓 peer 인증을 쓴다. DB 사용자 이름(`oprn_store`)과
OS 사용자 이름(`oprn-store`)이 다르므로 `pg_ident.conf` 에 매핑을 하나 넣거나 OS 사용자를 `oprn_store` 로 만든다.

## 3. 올리기 (개발 머신에서)

```bash
npm --prefix store-server ci && npm --prefix store-server run build
rsync -a store-server/{dist,migrations,public,package.json,package-lock.json} seogo:/opt/oprn-store/
ssh seogo 'cd /opt/oprn-store && npm ci --omit=dev && chown -R oprn-store: /opt/oprn-store'
```

마이그레이션은 서버가 켜질 때 advisory lock 을 잡고 스스로 적용한다.

## 4. 설정과 서비스

```bash
cp store.env.example /etc/oprn-store/store.env   # 값 채우기, chmod 600, chown oprn-store
cp oprn-store.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now oprn-store
curl -fs http://127.0.0.1:8787/healthz
```

## 5. nginx + 인증서

```bash
cp nginx-store.conf /etc/nginx/sites-available/store.openrpgmaker.com
ln -s ../sites-available/store.openrpgmaker.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d store.openrpgmaker.com
```

## 6. Google 로그인

Google Cloud 콘솔 → API 및 서비스 → OAuth 동의 화면(외부, 범위 `openid email profile`) → 사용자 인증 정보 →
OAuth 클라이언트 ID(웹 애플리케이션).

- 승인된 리디렉션 URI: `https://store.openrpgmaker.com/auth/google/callback`
- 받은 ID·보안 비밀을 `store.env` 에 넣고 `systemctl restart oprn-store` 를 실행한다.
- `admin@openrpgmaker.com` 으로 로그인하면 운영자 권한이 생긴다(`STORE_ADMIN_EMAILS`).

## 7. 첫 진열 팩

공식 팩 4종은 운영자 세션으로 올린다. 스테이징의 `seedBundles` 는 개발 로그인을 쓰므로 운영에서는 쓰지 않는다.
대신 편집기의 「올리기」 탭에서 운영자 계정으로 올리거나, 스테이징 DB 의 팩을 운영으로 옮긴다
(blob 디렉터리와 `store_*` 테이블을 함께 덤프하고 복원한다. blob 은 sha256 이름이라 그대로 복사하면 된다).

## 8. 백업

- `pg_dump -Fc oprn_store` 를 매일 실행한다.
- `/var/lib/oprn-store/blobs` 는 덧붙이기만 하므로 rsync 증분 백업으로 충분하다.
- 판본은 DB 트리거로 고칠 수 없게 막혀 있다. 내리기(removed)를 해도 blob 은 남는다.
