// 청사진 단계·이벤트 이름에서 «번호 자물쇠» 를 알아보는 낱말 — story/blueprint(단계 종류)와 place/exitDress(잠긴 출구)가 같이 읽는다.

/** 번호·암호를 맞히는 행동 낱말. */
export const CODE_STEP_WORDS = /비밀\s*번호|암호|패스\s*워드|숫자\s*자물쇠|번호\s*자물쇠|다이얼|키\s*패드|번호를?\s*(맞|입력|누르|돌리)|password|passcode|pin\s*code|combination|keypad/iu;
