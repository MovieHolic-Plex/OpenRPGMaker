import { r2ConfigFromEnv, type R2Config } from "./r2";
import { randomBytes } from "node:crypto";

/** 환경 변수 → 설정. 비밀값은 환경에서만 읽고 어디에도 쓰지 않는다. */
export interface StoreConfig {
  readonly port: number;
  readonly host: string;
  /** 사용자에게 보이는 공개 주소(끝 / 없음). 기기 코드 확인 주소·쿠키 Secure 판정에 쓴다. */
  readonly publicUrl: string;
  readonly databaseUrl: string;
  readonly blobDir: string;
  readonly adminEmails: ReadonlySet<string>;
  /** 스테이징·테스트 전용 개발 로그인. 운영에서는 켜지 않는다. */
  readonly devLogin: boolean;
  readonly google: { readonly clientId: string; readonly clientSecret: string; readonly authUrl: string; readonly tokenUrl: string; readonly userinfoUrl: string } | null;
  readonly contactEmail: string;
  /** 승인된 공개 상품이 이 수 미만인 작가의 새 상품은 사전 확인(pending)을 거친다. */
  readonly trustThreshold: number;
  /** 서로 다른 신고자 수가 이 값에 닿으면 자동으로 숨긴다. */
  readonly reportHideThreshold: number;
  /** 한 사람이 한 시간에 올릴 수 있는 blob 바이트. 디스크를 채우는 공격을 막는다. */
  readonly uploadBytesPerHour: number;
  readonly trustProxy: boolean;
  /** 익명 양식(신고) 토큰 서명 키. 없으면 실행마다 새로 만든다(재시작 뒤 열린 양식만 다시 받게 된다). */
  readonly secret: string;
  /** 파일을 내보낼 Cloudflare R2. 없으면 서버가 디스크에서 직접 보낸다. */
  readonly r2?: R2Config | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): StoreConfig {
  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`환경 변수 ${name} 가 필요합니다.`);
    return value;
  };
  const port = Number(env.STORE_PORT ?? 8787);
  const host = env.STORE_HOST ?? "127.0.0.1";
  const publicUrl = (env.STORE_PUBLIC_URL ?? `http://${host}:${port}`).replace(/\/+$/, "");
  const googleId = env.STORE_GOOGLE_CLIENT_ID?.trim();
  const googleSecret = env.STORE_GOOGLE_CLIENT_SECRET?.trim();
  // 개발 로그인은 아무 이메일로나 들어간다(운영자 이메일 포함). https 공개 주소에서는 켜지 못하게 막는다.
  if (env.STORE_DEV_LOGIN === "1" && publicUrl.startsWith("https://")) throw new Error("STORE_DEV_LOGIN=1 은 https 공개 주소에서 쓸 수 없습니다(스테이징·테스트 전용).");
  return {
    port,
    host,
    publicUrl,
    databaseUrl: required("STORE_DATABASE_URL"),
    blobDir: required("STORE_BLOB_DIR"),
    r2: r2ConfigFromEnv(env),
    adminEmails: new Set((env.STORE_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)),
    devLogin: env.STORE_DEV_LOGIN === "1",
    google: googleId && googleSecret ? {
      clientId: googleId,
      clientSecret: googleSecret,
      authUrl: env.STORE_GOOGLE_AUTH_URL ?? "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: env.STORE_GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token",
      userinfoUrl: env.STORE_GOOGLE_USERINFO_URL ?? "https://openidconnect.googleapis.com/v1/userinfo",
    } : null,
    contactEmail: env.STORE_CONTACT_EMAIL ?? "admin@openrpgmaker.com",
    trustThreshold: Number(env.STORE_TRUST_THRESHOLD ?? 3),
    reportHideThreshold: Number(env.STORE_REPORT_HIDE_THRESHOLD ?? 3),
    uploadBytesPerHour: Number(env.STORE_UPLOAD_BYTES_PER_HOUR ?? 1024 * 1024 * 1024),
    trustProxy: env.STORE_TRUST_PROXY === "1",
    secret: env.STORE_SECRET?.trim() || randomBytes(32).toString("hex"),
  };
}
