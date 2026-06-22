import { expect, test } from "@playwright/test";

test("resource manager imports RM2K3-shaped image profiles", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByTestId("toolbar-resource-manager").click();
  await expect(page.getByTestId("resource-modal")).toBeVisible();

  await page.getByTestId("resource-kind-select").selectOption("chipset");
  await page.getByTestId("resource-file-input").setInputFiles("test/fixtures/resources/chipset-valid-480x256.png");
  await expect(page.getByTestId("resource-profile-chipset").last()).toContainText("480x256");
  await expect(page.getByTestId("resource-tile-0").last()).toBeVisible();

  await page.getByTestId("resource-kind-select").selectOption("charset");
  await page.getByTestId("resource-file-input").setInputFiles("test/fixtures/resources/charset-valid-288x256.png");
  await expect(page.getByTestId("resource-profile-charset").last()).toContainText("288x256");
  await expect(page.locator(".rm-asset-kind").last()).toContainText("캐릭터셋");

  await page.getByTestId("resource-kind-select").selectOption("chipset");
  await page.getByTestId("resource-file-input").evaluate((node) => {
    const input = node as HTMLInputElement;
    const transfer = new DataTransfer();
    transfer.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="480" height="256"></svg>'], "renamed-svg.png", {
      type: "image/svg+xml",
    }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByTestId("toast")).toContainText("PNG/JPEG image MIME only.");

  await page.getByTestId("resource-kind-select").selectOption("chipset");
  await page.getByTestId("resource-file-input").setInputFiles("test/fixtures/resources/chipset-invalid-320x240.png");
  await expect(page.getByTestId("toast")).toContainText("칩셋: 480x256 크기가 필요합니다. 현재 320x240입니다.");
  await page.screenshot({ path: testInfo.outputPath("resource-manager.png"), fullPage: true });
});
