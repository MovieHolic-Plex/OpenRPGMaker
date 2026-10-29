#!/bin/bash
# 손으로 짠 방 견본 한 장을 Sonnet 5.5 high 적대 검수에 보낸다(2026-10-29 감독 지시: 검수자는 Sonnet).
#   scripts/content/interior-authored/review.sh <check.mts 출력 폴더> <방 id> "<용도 설명(누가 무엇을 하는 방인지)>"
# 출력: <폴더>/<id>.review.txt — 마지막 줄 VERDICT: PASS|FAIL. PASS 는 major 이상 0 일 때만.
set -u
DIR=$1; ID=$2; USE=$3
PNG=$DIR/$ID.png
[ -f "$PNG" ] || { echo "no $PNG (check.mts --out $DIR --ids $ID 먼저)"; exit 1; }
python3 -c "
from PIL import Image;im=Image.open('$PNG');im.resize((im.size[0]*4,im.size[1]*4),Image.NEAREST).save('$DIR/$ID.x4.png')"
PROMPT="너는 16px 도트 RPG(RPG Maker 2000 풍, 3/4 탑뷰) 실내 방 견본의 적대적 검수자다. 첨부 그림은 방 하나를 4배로 키운 것이다(바깥 테두리 한 칸은 벽 밖, 맨 위 두 줄은 북쪽 벽면, 남쪽 벽 가운데 초록/발깔개 칸이 출입문).
용도: $USE
이 방이 게임에 그대로 쓰일 견본으로 합격인지 깐깐하게 본다. 칭찬은 쓰지 말고 결함만 찾는다. 기준:
- 용도가 한눈에 읽히는가(그 용도의 핵심 가구가 있고, 엉뚱한 가구가 섞이지 않았는가)
- 가구가 겹치거나 잘리거나 벽 그림(창·액자·지도)을 키 큰 가구가 가리는가
- 앉는 자리·책상·침대의 방향이 말이 되는가(의자가 책상을 등지거나, 침대가 문을 막는 등)
- 문 앞과 통로가 막히지 않았는가, 모든 가구에 사람이 다가갈 수 있는가
- 맨바닥이 넓게 휑하거나(2×2 넘는 빈 덩이가 여럿) 반대로 꽉 막혀 답답한가
- 같은 가구를 의미 없이 줄 세워 복사한 티가 나는가, 배치가 대칭·균형이 맞는가
- 실제 작가가 만든 RPG 방처럼 보이는가
이 칩셋의 그림 약속(결함으로 치지 않는다): 북쪽(책상·칠판 쪽)을 보는 의자는 등받이가 화면 아래쪽(보는 사람 쪽)으로 그려진다. 발깔개는 문 칸과 그 오른쪽 한 칸, 두 칸 폭이다. 북쪽 벽면의 나무 판벽·기둥 무늬는 벽 그림이다. 가구마다 외곽선 색이 조금씩 다른 것은 원래 칩셋 그림이다. 용도에 적힌 단서 물건(금고 등)은 게임이 나중에 이벤트로 놓으므로 견본에 없어도 된다.
결함마다 한 줄: [blocker|major|minor] 무엇이 어디에(그림 좌표 대략) 왜.
마지막 줄은 반드시 VERDICT: PASS 또는 VERDICT: FAIL. major 나 blocker 가 하나라도 있으면 FAIL."
cd "$DIR" && timeout 600 omp -p --no-session --model teamclaude/claude-sonnet-5-5 --thinking high "@$DIR/$ID.x4.png" "$PROMPT" < /dev/null > "$DIR/$ID.review.txt" 2>&1
tail -1 "$DIR/$ID.review.txt"
