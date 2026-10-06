/**
 * 운영자 일회용 로그인 링크 발급(서버 셸 전용, 15분·한 번).
 *   set -a; . /etc/oprn-store/store.env; set +a; node dist/admin-link.mjs admin@openrpgmaker.com
 * STORE_ADMIN_EMAILS 에 든 이메일만 발급한다.
 */
import { createLoginLink, upsertUser } from "../src/auth";
import { loadConfig } from "../src/config";
import { createDb, migrate } from "../src/db";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const config = loadConfig();
if (!config.adminEmails.has(email)) {
  console.error(`운영자 이메일이 아닙니다: ${email || "(없음)"} — STORE_ADMIN_EMAILS 를 확인하세요.`);
  process.exit(2);
}
const db = createDb(config.databaseUrl);
try {
  if (process.env.STORE_MIGRATIONS_DIR) await migrate(db, process.env.STORE_MIGRATIONS_DIR);
  const user = await upsertUser(db, config, { email, displayName: "OPRN 운영" });
  const token = await createLoginLink(db, user.id);
  console.log(`${config.publicUrl}/auth/link?token=${encodeURIComponent(token)}`);
} finally {
  await db.end();
}
