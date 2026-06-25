// Supabase REST 클라이언트 (SDK 없이 fetch).
// dev에선 vite proxy(/db → /rest/v1, /fn → /functions/v1)로 동일 출처 우회.
// 부모 리포의 supabaseProjectSync.ts 패턴과 동일 (REST 직접 + apikey 헤더).

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "http://192.168.100.121:8000";
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

// dev에선 proxy 경로(/db, /fn) 사용, 프로덕션에선 직접 URL.
const IS_DEV = import.meta.env.DEV;
const REST_BASE = IS_DEV ? "/db" : `${SUPABASE_URL}/rest/v1`;
const FN_BASE = IS_DEV ? "/fn" : `${SUPABASE_URL}/functions/v1`;

function headers(): HeadersInit {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

/** 단일 테이블 SELECT. */
export async function selectAll<T>(
  table: string,
  columns = "*"
): Promise<T[]> {
  const res = await fetch(`${REST_BASE}/${table}?select=${encodeURIComponent(columns)}`, {
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(`selectAll ${table} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T[];
}

/** Edge Function 호출 (POST). */
export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(`${FN_BASE}/${name}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`invoke ${name} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}
