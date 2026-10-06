import { expect, test } from "../fixtures"

const SCROLL_STOPS = [0, 40, 90, 140, 400, 90, 40, 0] as const

// The sticky header condenses while scrolling. Changing its height moved the
// page under the reader, so the browser kept shifting the scroll position and
// reaching the top again took far more scrolling than expected.
test.describe("web site header", () => {
  test("condensing on scroll keeps its height and the scroll position", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    const header = page.locator("header.site-header")
    const initialHeight = await header.evaluate((node) => node.offsetHeight)

    for (const top of SCROLL_STOPS) {
      await page.evaluate(
        (y) => window.scrollTo({ top: y, behavior: "instant" }),
        top
      )
      await page.waitForTimeout(150)

      expect(await page.evaluate(() => window.scrollY)).toBe(top)
      expect(await header.evaluate((node) => node.offsetHeight)).toBe(
        initialHeight
      )
    }
  })
})
