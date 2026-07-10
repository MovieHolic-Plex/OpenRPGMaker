// "이름 Copy" 하드코딩 대신 "이름 사본"(+ 이름 충돌 시 번호 증가: "사본 2", "사본 3"...).
// 이미 "…사본"/"…사본 N" 접미사가 붙은 레코드를 다시 복제해도 루트 이름 기준으로 계산하므로
// "…사본 사본" 같은 접미사 중첩이 생기지 않는다.
const COPY_SUFFIX_PATTERN = /^(.*) 사본(?: (\d+))?$/;

export function duplicateInto<T extends { id: string; name: string }>(records: T[], id: string, copyId: string): void {
  const source = records.find((entry) => entry.id === id);
  if (!source) return;
  const copy = structuredClone(source);
  copy.id = copyId;
  copy.name = nextCopyName(records, source.name);
  records.push(copy);
}

function nextCopyName(records: readonly { readonly name: string }[], baseName: string): string {
  const match = baseName.match(COPY_SUFFIX_PATTERN);
  const root = match ? match[1]! : baseName;
  const existingNames = new Set(records.map((entry) => entry.name));
  let candidate = `${root} 사본`;
  let suffix = 2;
  while (existingNames.has(candidate)) {
    candidate = `${root} 사본 ${suffix}`;
    suffix += 1;
  }
  return candidate;
}
