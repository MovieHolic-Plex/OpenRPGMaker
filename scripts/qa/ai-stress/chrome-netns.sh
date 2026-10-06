#!/usr/bin/env bash
# 크롬만 격리 netns(루프백 하나)에서 띄운다. 이 박스는 도커 브리지·veth 가 계속 생겼다 사라져
# 크롬 NetworkChangeNotifier 가 진행 중인 요청을 ERR_NETWORK_CHANGED 로 끊는다(플래그로 안 막힘).
# 안쪽 127.0.0.1:$STRESS_HOST_PORT → unix 소켓 $STRESS_SOCK → (바깥 socat) → 실제 호스트.
exec unshare -rn bash -c '
  ip link set lo up
  socat TCP-LISTEN:"$STRESS_HOST_PORT",bind=127.0.0.1,fork,reuseaddr UNIX-CONNECT:"$STRESS_SOCK" &
  for i in $(seq 50); do (exec 3<>/dev/tcp/127.0.0.1/"$STRESS_HOST_PORT") 2>/dev/null && break; sleep 0.05; done
  exec /usr/bin/google-chrome "$@"' chrome-netns "$@"
