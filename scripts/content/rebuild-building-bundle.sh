#!/usr/bin/env bash
# 허용한 건물을 공용 번들로 다시 굽는다: 결정 로그 → 시트·카탈로그 → 참고문서·예제 → 정상/오류 그림.
# 사용: scripts/content/rebuild-building-bundle.sh [프로필 id, 기본 beodeul]
set -euo pipefail
cd "$(dirname "$0")/../.."
P="${1:-beodeul}"
python3 src/harnesses/beodeul-building-review/node/install.py --profile "$P"
npx vite-node scripts/content/prepare-building-references.mts "$P"
python3 scripts/content/stitch-building-error.py "$P"
npx vite-node scripts/content/prepare-building-references.mts "$P" >/dev/null   # 이식된 city 사본의 문서까지 최신으로
