// engine_dump.mts 가 도구 레지스트리를 불러올 때 딸려 오는 .css import 를 빈 모듈로 바꾼다(tsx 는 css 를 못 읽는다).
export async function load(url, context, next) {
  if (url.endsWith('.css')) return { format: 'module', source: 'export default {};', shortCircuit: true };
  return next(url, context);
}
