// 옛 환경 변수 이름(RPG_ZZU_* / RPGZZU_*) 호환 심 계약.
//
// 저장소 밖(사용자 systemd 유닛, .env.local, CI 시크릿)에서 아직 옛 이름으로 값을 주므로
// 한 릴리스 동안은 새 이름(OPRN_*)으로 옮겨 읽어 준다. 규칙 세 가지를 여기서 고정한다:
//   ① 새 이름이 이미 있으면 옛 이름은 손대지 않는다(새 이름이 이긴다).
//   ② 옛 이름만 있으면 새 이름으로 복사한다 — 옛 키는 지우지 않는다.
//   ③ 경고는 이름마다 한 프로세스에 한 번만 stderr 로 낸다.
import { describe, expect, it, vi } from "vitest";
import { applyLegacyEnvAliases } from "../scripts/lib/oprnEnv.mjs";
import { validateRemoteCertificateEnvironment } from "./e2e/remoteProjectCertificate";

describe("applyLegacyEnvAliases", () => {
  it("옛 이름만 있으면 새 이름으로 복사하고 옛 키는 남긴다", () => {
    const env: Record<string, string | undefined> = { RPG_ZZU_COPY_ONLY: "http://127.0.0.1:9999" };
    const applied = applyLegacyEnvAliases(env, () => {});
    expect(env.OPRN_COPY_ONLY).toBe("http://127.0.0.1:9999");
    expect(env.RPG_ZZU_COPY_ONLY).toBe("http://127.0.0.1:9999");
    expect(applied).toEqual([{ legacy: "RPG_ZZU_COPY_ONLY", next: "OPRN_COPY_ONLY" }]);
  });

  it("언더스코어 없는 옛 접두사(RPGZZU_*)도 같은 새 이름으로 간다", () => {
    const env: Record<string, string | undefined> = { RPGZZU_DEV_PORT_CASE: "9998" };
    applyLegacyEnvAliases(env, () => {});
    expect(env.OPRN_DEV_PORT_CASE).toBe("9998");
  });

  it("새 이름이 이미 있으면 옛 값으로 덮어쓰지 않는다", () => {
    const env: Record<string, string | undefined> = { OPRN_NEW_WINS: "new", RPG_ZZU_NEW_WINS: "old" };
    const applied = applyLegacyEnvAliases(env, () => {});
    expect(env.OPRN_NEW_WINS).toBe("new");
    expect(applied).toEqual([]);
  });

  it("빈 문자열로 준 새 이름도 '있는 값'이다 — 명시적으로 끈 것을 옛 값이 되살리면 안 된다", () => {
    const env: Record<string, string | undefined> = { OPRN_EMPTY_WINS: "", RPG_ZZU_EMPTY_WINS: "1" };
    applyLegacyEnvAliases(env, () => {});
    expect(env.OPRN_EMPTY_WINS).toBe("");
  });

  it("접두사만 있는 키·새 접두사 자체는 건드리지 않는다", () => {
    const env: Record<string, string | undefined> = { RPG_ZZU_: "x", OPRN_ALREADY: "y", UNRELATED: "z" };
    const applied = applyLegacyEnvAliases(env, () => {});
    expect(applied).toEqual([]);
    expect(Object.keys(env).sort()).toEqual(["OPRN_ALREADY", "RPG_ZZU_", "UNRELATED"]);
  });

  it("경고는 이름마다 한 번만 내고 새 이름을 알려 준다", () => {
    const warn = vi.fn();
    applyLegacyEnvAliases({ RPG_ZZU_WARN_ONCE: "a" }, warn);
    applyLegacyEnvAliases({ RPG_ZZU_WARN_ONCE: "b" }, warn);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("OPRN_WARN_ONCE");
    expect(warn.mock.calls[0]?.[0]).toContain("RPG_ZZU_WARN_ONCE");
  });

  it("기본 경고 통로는 stderr 다 — stdout 을 파싱하는 스크립트를 더럽히지 않는다", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      applyLegacyEnvAliases({ RPG_ZZU_STDERR_CASE: "1" });
      expect(stderr).toHaveBeenCalledTimes(1);
      expect(String(stderr.mock.calls[0]?.[0])).toContain("OPRN_STDERR_CASE");
      expect(stdout).not.toHaveBeenCalled();
    } finally {
      stderr.mockRestore();
      stdout.mockRestore();
    }
  });

  it("인자를 생략하면 process.env 를 고친다", () => {
    const previous = process.env.RPG_ZZU_PROCESS_ENV_CASE;
    process.env.RPG_ZZU_PROCESS_ENV_CASE = "from-legacy";
    try {
      applyLegacyEnvAliases(undefined, () => {});
      expect(process.env.OPRN_PROCESS_ENV_CASE).toBe("from-legacy");
    } finally {
      if (previous === undefined) delete process.env.RPG_ZZU_PROCESS_ENV_CASE;
      else process.env.RPG_ZZU_PROCESS_ENV_CASE = previous;
      delete process.env.OPRN_PROCESS_ENV_CASE;
    }
  });

  // CI 시크릿은 저장소 밖에 있다 — 옛 이름으로 주입된 원격 인증서 입력이 별칭을 거쳐 게이트를 통과해야 한다.
  it("옛 이름으로 온 원격 인증서 입력도 별칭을 거치면 게이트를 통과한다", () => {
    const ref = "abcdefghijklmnopqrst";
    const url = `https://${ref}.supabase.co`;
    const env: Record<string, string | undefined> = {
      RPGZZU_E2E_REMOTE_CERTIFICATE: "isolated-owned-fixture-v1",
      RPGZZU_E2E_REMOTE_URL: url,
      RPGZZU_E2E_REMOTE_ANON_KEY: "aaa.bbb.ccc",
      RPGZZU_E2E_REMOTE_ISOLATION_MARKER: "rpg-zzu-e2e-owned-only",
      RPGZZU_E2E_REMOTE_PROJECT_REF: ref,
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_ANON_KEY: "aaa.bbb.ccc",
    };
    expect(validateRemoteCertificateEnvironment(env).ok).toBe(false);
    applyLegacyEnvAliases(env, () => {});
    expect(validateRemoteCertificateEnvironment(env).ok).toBe(true);
  });
});
