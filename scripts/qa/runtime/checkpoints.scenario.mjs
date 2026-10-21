// 범용 체크포인트 시나리오 — 세트 파일이 부팅(데모 쿼리·픽스처)과 단계별 비트를 다 갖고 있을 때 쓴다.
//   npm run qa:runtime -- --scenario checkpoints --checkpoint-set fallen-star --checkpoint all
// 체크포인트 없이 돌리면 smoke 처럼 타이틀만 본다.
export default {
  id: "checkpoints",
  beats: [{ id: "title", note: "체크포인트 없이 실행됨 — --checkpoint-set 을 줘라", ops: [], shot: true }],
};
