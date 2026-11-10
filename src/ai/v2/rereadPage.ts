// 다시 읽기 쪽 — 단서를 집어 간 뒤 같은 이벤트를 다시 조사하면 원래 글을 한 번 더 보여 주는 쪽(puzzle.ts pickupDoneLines).
// 이 쪽은 맨 앞 줄이 아래 표식 줄이고, 나머지는 일부러 같은 글이다. 장면 검사(sceneCraft «scene repeat»)는 이 쪽을 반복으로 세지 않는다 —
// 2026-11-10 Terra 두 판(jrpg-w1·fun-w1): 함수가 지은 다시 읽기 쪽마다 «같은 대사가 두 번» 할 일이 생겨 조수가 get_event·patch_event_page 로 하나씩 고쳤다
// (단서를 다시 읽게 하라는 2026-10-30 판정 major 와 반복을 없애라는 검사가 서로 반대로 당겼다).

/** 사물을 다시 조사할 때의 표식 줄. */
export const REREAD_THING = "다시 살펴본다.";
/** 사람에게 다시 말을 걸 때의 표식 줄(서술). */
export const REREAD_PERSON = "(다시 묻는다.)";

export const isRereadMarker = (body: string | undefined): boolean => body?.trim() === REREAD_THING || body?.trim() === REREAD_PERSON;
