# 아이콘 도트화 원본 백업 (2026-09-21)

16px 도트 변환 이전의 원본 파일들. 복구가 필요하면 이 폴더의 파일을
원래 경로로 복사하면 된다 (git 이 있어도 여기엔 변환 전 시점이 보존됨).

- jetrel-icons-128/ — public/assets/cc0/jetrel/icons/ 의 128px AI 생성 아이콘 234종
  (제트렐 정품 16px 아이콘 48종은 변환하지 않았으므로 백업 불필요)
- starter-battle-icons-64/ — public/assets/generated/starter/battle-icon-*.png 11종 (64px)
- starter-item-icons/ — potion/bronze-sword/ether-blue 의 icon·image 6종 (32/64px)

변환 파이프라인: convert -alpha set -scale 16x16 -dither None -colors 24
-channel A -threshold 50% +channel

## 2차 작업: AI 픽셀아트 재생성 (2026-09-21)

220개 128px 아이콘을 16비트 JRPG 픽셀아트 스타일 32x32로 AI 재생성했다.
이 폴더의 jetrel-icons-128/ 이 재생성 이전 원본이며, 최종 갤러리 증거는
verify-shots/pixelate-monsters/regen-gallery.png 에 있다.
