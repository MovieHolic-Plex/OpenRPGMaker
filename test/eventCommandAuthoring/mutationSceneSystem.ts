import type { AuthoringReferenceFixture } from "./referenceFixture";
import {
  setControlChecked,
  setControlValue,
  type AuthoringCase,
} from "./mutationTypes";

export function sceneSystemCases(
  fixture: AuthoringReferenceFixture
): readonly AuthoringCase[] {
  return [
    {
      mode: "mutation",
      kind: "battleProcessing",
      expected: {
        kind: "battleProcessing",
        troopId: fixture.ids.troopId,
        canEscape: false,
        canLose: false,
        battleFlow: undefined,
        troopSource: "fixed",
        troopVariableId: undefined,
        branchOnResult: false,
        victoryBranch: undefined,
        defeatBranch: undefined,
        escapeBranch: undefined,
      },
      apply: (body) => setControlValue(body, "battle-processing-escape-select", "deny"),
    },
    {
      mode: "mutation",
      kind: "setLighting",
      expected: { kind: "setLighting", ambient: 0.5, color: "#000000" },
      apply: (body) => setControlValue(body, "set-lighting-ambient-input", "0.5"),
    },
    {
      mode: "mutation",
      kind: "addLight",
      expected: {
        kind: "addLight",
        source: { id: "light_1", at: "player", radius: 8, intensity: 1 },
      },
      apply: (body) => setControlValue(body, "add-light-radius-input", "8"),
    },
    {
      mode: "mutation",
      kind: "removeLight",
      expected: { kind: "removeLight", id: "" },
      apply: (body) => setControlValue(body, "remove-light-all-select", "false"),
    },
    {
      mode: "mutation",
      kind: "setWeather",
      expected: { kind: "setWeather", weather: "snow", intensity: 0.5 },
      apply: (body) => setControlValue(body, "set-weather-kind-select", "snow"),
    },
    {
      mode: "mutation",
      kind: "showAnimation",
      expected: {
        kind: "showAnimation",
        target: "player",
        animationId: fixture.ids.animationId,
        wait: true,
      },
      apply: (body) => setControlValue(body, "show-animation-wait-select", "true"),
    },
    {
      mode: "mutation",
      kind: "showPicture",
      expected: {
        kind: "showPicture",
        pictureId: "pic1",
        resourceId: fixture.ids.resourceId,
        x: 7,
        y: 0,
      },
      apply: (body) => setControlValue(body, "show-picture-x-input", "7"),
    },
    {
      mode: "mutation",
      kind: "erasePicture",
      expected: { kind: "erasePicture", pictureId: "pic_matrix" },
      apply: (body) => setControlValue(body, "erase-picture-id-input", "pic_matrix"),
    },
    {
      mode: "mutation",
      kind: "playAudio",
      expected: { kind: "playAudio", resourceId: "", loop: false },
      apply: (body) => setControlValue(body, "play-audio-resource-select", ""),
    },
    {
      mode: "boundary",
      kind: "stopAudio",
      testId: "stop-audio-editor",
      tagName: "SPAN",
    },
    {
      mode: "mutation",
      kind: "cutsceneControl",
      expected: { kind: "cutsceneControl", mode: "begin", skippable: true },
      apply: (body) => setControlChecked(body, "event-command-cutscene-skippable", true),
    },
    {
      mode: "mutation",
      kind: "shop",
      expected: {
        kind: "shop",
        itemIds: [fixture.ids.itemId],
        allowSell: true,
        quantityMode: "select",
        shopType: "normal",
        messageType: "welcome",
        merchantGold: 100,
        branchOnTransaction: false,
        transactionBranch: [],
      },
      apply: (body) => setControlValue(body, "shop-quantity-mode", "select"),
    },
    {
      mode: "mutation",
      kind: "inn",
      expected: {
        kind: "inn",
        price: 30,
        note: undefined,
        question: undefined,
        recoverMp: undefined,
        advanceToMorning: undefined,
        restDurationMs: undefined,
        wakeDurationMs: undefined,
        branchOnNotEnoughGold: undefined,
        notEnoughBranch: undefined,
      },
      apply: (body) => setControlValue(body, "inn-price-input", "30"),
    },
    {
      mode: "mutation",
      kind: "checkpointSave",
      expected: { kind: "checkpointSave", label: "Matrix Checkpoint" },
      apply: (body) =>
        setControlValue(body, "event-command-checkpoint-label", " Matrix Checkpoint "),
    },
    {
      mode: "mutation",
      kind: "killPlayer",
      expected: { kind: "killPlayer", message: "Matrix defeated" },
      apply: (body) =>
        setControlValue(body, "event-command-kill-player-message", " Matrix defeated "),
    },
    {
      mode: "mutation",
      kind: "triggerEnding",
      expected: { kind: "triggerEnding" },
      apply: (body) => setControlValue(body, "event-command-trigger-ending-id", ""),
    },
    {
      mode: "boundary",
      kind: "gameOver",
      testId: "game-over-editor",
      tagName: "SPAN",
    },
    {
      mode: "mutation",
      kind: "ending",
      expected: {
        kind: "ending",
        title: "Matrix End",
        message: "Thank you for playing.",
      },
      apply: (body) => setControlValue(body, "ending-title-input", "Matrix End"),
    },
    {
      mode: "boundary",
      kind: "returnToTitle",
      testId: "return-to-title-editor",
      tagName: "SPAN",
    },
    {
      mode: "mutation",
      kind: "m2Command",
      expected: {
        kind: "m2Command",
        commandId: "m2-088-comment",
        fields: { comment: "matrix comment", color: "green" },
      },
      apply: (body) =>
        setControlValue(body, "m2-command-comment-textarea", "matrix comment", "input"),
    },
  ];
}
