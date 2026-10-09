import { describe, expect, it } from "vitest"

import {
  ACTION_CLASSIFICATIONS,
  ACTION_REGISTRY,
  ACTION_REGISTRY_VERSION,
  resolveAction,
} from "../src/action-registry.js"

const AUTOMATIC_ACTION_IDS = [
  "notion.page.read",
  "notion.page.create_allowed_child",
  "notion.block.append_allowed",
  "github.repo.read",
  "github.branch.commit_allowed_path",
  "vps.service.status",
  "vps.service.restart_allowed",
  "deploy.rollout_existing_artifact",
  "dns.update_existing_allowed_record",
  "message.send_template",
] as const

const APPROVAL_REQUIRED_ACTION_IDS = [
  "notion.page.archive_allowed",
  "github.branch.delete_ephemeral",
  "vps.service.stop_allowed",
  "deploy.promote_fixed_recipe",
  "dns.update_restricted_record",
  "resource.provision_fixed_sku",
  "access.change_predeclared_binding",
  "tailnet.apply_pre_reviewed_policy_revision",
  "authority.apply_pre_reviewed_config_release",
] as const

const PERMANENTLY_DENIED_ACTION_IDS = [
  "shell.execute",
  "ssh.execute",
  "http.proxy",
  "secret.read_plaintext",
  "secret.export",
  "provider.owner_mutate",
  "provider.admin_mutate",
  "github.force_push",
  "database.migrate_destructive",
  "github.workflow.mutate",
  "github.actions.mutate",
  "github.secrets.mutate",
  "github.webhook.mutate",
  "github.settings.mutate",
] as const

describe("action registry", () => {
  it("has a stable version and exactly one classification per unique action", () => {
    expect(ACTION_REGISTRY_VERSION).toBe("ai-authority-actions/v1")
    expect(new Set(ACTION_REGISTRY.map(({ id }) => id)).size).toBe(ACTION_REGISTRY.length)
    expect(ACTION_CLASSIFICATIONS).toEqual([
      "automatic",
      "approval-required",
      "permanently-denied",
    ])

    for (const action of ACTION_REGISTRY) {
      expect(ACTION_CLASSIFICATIONS).toContain(action.classification)
      expect(action.providerCredential).not.toHaveLength(0)
      expect(action.targetSelector).not.toHaveLength(0)
      expect(action.inputLimits).not.toHaveLength(0)
      expect(action.fixedCostInvariant).not.toHaveLength(0)
      expect(action.idempotencyKey).not.toHaveLength(0)
      expect(action.auditEvent).toBe(`authority.action.${action.id}`)
    }
  })

  it.each(AUTOMATIC_ACTION_IDS)("classifies %s as automatic", (id) => {
    expect(resolveAction(id)).toMatchObject({ kind: "registered", action: { classification: "automatic" } })
  })

  it.each(APPROVAL_REQUIRED_ACTION_IDS)("classifies %s as approval-required", (id) => {
    expect(resolveAction(id)).toMatchObject({
      kind: "registered",
      action: { classification: "approval-required" },
    })
  })

  it.each(PERMANENTLY_DENIED_ACTION_IDS)("classifies %s as permanently-denied", (id) => {
    expect(resolveAction(id)).toMatchObject({
      kind: "registered",
      action: { classification: "permanently-denied" },
    })
  })

  it.each(["unknown.action", "", " notion.page.read", "notion.page.read "])(
    "denies an unregistered action without an execution path: %j",
    (id) => {
      expect(resolveAction(id)).toEqual({ kind: "denied", reason: "unregistered-action" })
    },
  )
})
