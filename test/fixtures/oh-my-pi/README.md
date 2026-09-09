# Round4 tool-schema receipt

`round4-tools.json` is the complete 48-element `tools` array from the real
execution request captured at base `08c60dc68625c66ac2b7aa61799b27eaa4cf25aa`.
It is not a toy schema or a reconstruction from selected tools. JSON value
identity with the original `tools` array was checked. User/system messages,
images, authentication, project state and unrelated request fields are omitted.

Original receipt directory:
`/home/main/z-project/rpg-zzu-ai-playable-adversarial-0906/output/evidence/ai-playable-final/round4/`

SHA256 receipts:

- `llm-request-0.json`: `6155a6cc26ea4271c7559b9f553e058ec79e8f787a1cc696583756d0a400d46f`
- `llm-response-0.txt`: `d80c31e6f99520133cadd28dcf66abc6dde90feacf65ffd83c098eb7833342a5`
- `offending-schema-enums.json`: `d430fb7c1b21d71b85f8f13d5176f8e91d9020eea21f8ac6b199954d9f6fbec9`
- This fixture: `1642322ee3d73698498de55a40b9d914466f3fedaa6ddff06125fd49c2bd279e`

`test/ohMyPiNumericEnum.bun.test.ts` sends these tools with neutral `READY`
through the real completion adapter and SDK, with a controlled outbound fetch.
The wire assertions retain numeric types and exact string-encoded membership;
the test also exercises the live corpus and sparse [4,8]. No tool calls execute.
The initial red regression is now green under the reviewed post-normalization
`onPayload` repair; the original red output remains in the evidence archive.

Diagnosis, review contract, exact validator outputs and the implemented-path
read-only HTTP200 Opus proof are versioned in `evidence/ai-provider-enum-0907/`.
These tests and the live READY probe prove transport, not game acceptance.
