// 메모리 PostgREST. sync 모듈이 실제로 보내는 요청 모양만 지원한다:
//   GET    /rest/v1/<table>?<col>=eq.<v>&<col>=in.(...)&select=&order=&limit=&offset=&title=ilike.*x*
//   POST   /rest/v1/<table>?on_conflict=a,b   (upsert; Prefer return=representation 이면 보낸 행을 돌려준다)
//   POST   /rest/v1/<table>                    (insert)
//   PATCH  /rest/v1/<table>?<filters>           (조건부 갱신; representation 이면 갱신된 행 배열, 없으면 [])
//   DELETE /rest/v1/<table>?<filters>
//   rpc/*  와 모르는 테이블은 404 PGRST205 — spatial 발행은 지원하지 않는다.
type Row = Record<string, unknown>;

const TABLES = ["projects", "maps", "tilesets", "project_commits", "project_changes", "ai_activity_logs", "ai_analysis_runs", "ai_conversations"] as const;
const CONTROL_PARAMS = new Set(["select", "order", "limit", "offset", "on_conflict"]);

export function createFakePostgrest(): { readonly fetch: typeof fetch; readonly tables: ReadonlyMap<string, Row[]> } {
  const tables = new Map<string, Row[]>(TABLES.map((name) => [name, []]));
  let clock = Date.parse("2026-09-15T00:00:00Z");
  const stamp = (): string => new Date((clock += 1000)).toISOString();

  const matches = (row: Row, params: URLSearchParams): boolean => {
    for (const [key, raw] of params) {
      if (CONTROL_PARAMS.has(key)) continue;
      if (raw.startsWith("eq.")) { if (String(row[key]) !== raw.slice(3)) return false; }
      else if (raw.startsWith("in.(") && raw.endsWith(")")) {
        const wanted = raw.slice(4, -1).split(",").map((value) => value.replace(/^"|"$/g, "").replaceAll("\\\"", "\"").replaceAll("\\\\", "\\"));
        if (!wanted.includes(String(row[key]))) return false;
      } else if (raw.startsWith("ilike.")) {
        const needle = raw.slice(6).replaceAll("*", "").toLowerCase();
        if (!String(row[key] ?? "").toLowerCase().includes(needle)) return false;
      } else throw new Error(`fake postgrest: unsupported filter ${key}=${raw}`);
    }
    return true;
  };

  const shape = (rows: Row[], params: URLSearchParams): Row[] => {
    let out = [...rows];
    const order = params.get("order");
    if (order) {
      const keys = order.split(",").map((part) => { const [col, dir] = part.split("."); return { col: col ?? "", desc: dir === "desc" }; });
      out.sort((a, b) => {
        for (const { col, desc } of keys) {
          const cmp = String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
          if (cmp !== 0) return desc ? -cmp : cmp;
        }
        return 0;
      });
    }
    const offset = Number(params.get("offset") ?? 0);
    const limit = params.get("limit");
    out = out.slice(offset, limit === null ? undefined : offset + Number(limit));
    const select = params.get("select");
    if (select && select !== "*") {
      const cols = select.split(",");
      out = out.map((row) => Object.fromEntries(cols.filter((col) => col in row).map((col) => [col, row[col]])));
    }
    return out;
  };

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const table = url.pathname.replace(/^\/rest\/v1\//, "");
    const rows = tables.get(table);
    if (!rows) {
      return Response.json({ code: "PGRST205", message: `Could not find the table 'rpg_zzu.${table}' in the schema cache` }, { status: 404 });
    }
    const prefer = new Headers(init?.headers).get("Prefer") ?? "";
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    if (method === "GET") return Response.json(shape(rows.filter((row) => matches(row, url.searchParams)), url.searchParams));
    if (method === "POST") {
      const incoming = (Array.isArray(body) ? body : body ? [body] : []) as Row[];
      const conflict = url.searchParams.get("on_conflict")?.split(",") ?? null;
      for (const raw of incoming) {
        const row: Row = { created_at: stamp(), ...raw };
        const index = conflict ? rows.findIndex((existing) => conflict.every((col) => existing[col] === row[col])) : -1;
        if (index >= 0) rows[index] = { ...rows[index], ...raw };
        else rows.push(row);
      }
      return prefer.includes("return=representation") ? Response.json(incoming, { status: 201 }) : new Response(null, { status: 201 });
    }
    if (method === "PATCH") {
      const updated: Row[] = [];
      rows.forEach((row, index) => {
        if (!matches(row, url.searchParams)) return;
        rows[index] = { ...row, ...(body as Row) };
        updated.push(rows[index]);
      });
      return Response.json(prefer.includes("return=representation") ? updated : []);
    }
    if (method === "DELETE") {
      const keep = rows.filter((row) => !matches(row, url.searchParams));
      rows.splice(0, rows.length, ...keep);
      return new Response(null, { status: 204 });
    }
    return new Response(`fake postgrest: ${method} not supported`, { status: 405 });
  };

  return { fetch: fetchImpl, tables };
}
