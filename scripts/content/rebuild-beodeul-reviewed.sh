#!/usr/bin/env bash
# 허용한 버들항 건물을 공용 번들로 다시 굽는다: 결정 로그 → 시트·카탈로그 → 참고문서·예제 → 정상/오류 그림.
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 src/harnesses/beodeul-building-review/node/install.py
echo '[]' > /tmp/rv-refs-empty.json   # 생성 중에는 옛 문서가 끼어들지 않게 한다
npx vite-node scripts/content/prepare-beodeul-reviewed-references.mts
python3 scripts/content/stitch-beodeul-reviewed-error.py
npx vite-node scripts/content/prepare-beodeul-reviewed-references.mts >/dev/null   # 이식된 city 사본의 문서까지 최신으로
