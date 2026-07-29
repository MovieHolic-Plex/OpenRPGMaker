#!/usr/bin/env bash
# 인증서가 없으면 vite 는 평문 http 로 뜨고, 그때 https 로 열면 핸드셰이크에서 끊긴다(curl 코드 000).
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p .certs

# MSYS(Git Bash)는 -subj "/CN=..." 을 Windows 경로로 바꿔 버린다 — 변환을 끈다.
export MSYS_NO_PATHCONV=1

# 접속에 쓰는 이름을 모두 넣는다. 빠진 이름으로 열면 브라우저가 경고를 띄운다.
SAN="DNS:localhost,DNS:dbserver,IP:127.0.0.1,IP:192.168.100.116,IP:100.107.34.119"

openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
  -keyout .certs/localhost-key.pem \
  -out .certs/localhost-cert.pem \
  -subj "/CN=localhost" \
  -addext "subjectAltName=${SAN}" 2>/dev/null

openssl x509 -in .certs/localhost-cert.pem -noout -subject -ext subjectAltName
echo "npm run dev 재시작 후 https://localhost:9999 로 열린다."

# 자기서명이라 그대로면 브라우저가 ERR_CERT_AUTHORITY_INVALID 로 차단한다(흰 화면).
# 신뢰 루트에 넣어야 경고 없이 열린다. 사용자 저장소라 관리자 권한이 필요 없다.
certutil -addstore -user -f Root "$(pwd -W 2>/dev/null || pwd)/.certs/localhost-cert.pem"
