import { expect, test as base } from "@playwright/test"

// The Astro dev toolbar floats above the page and intercepts clicks on elements
// near the bottom (for example the long "Nuevo negocio" submit button). It is a
// development-only overlay, so hide it with a stylesheet injected on every
// navigation instead of changing application code.
const hideDevToolbar = () => {
  document.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style")
    style.textContent = "astro-dev-toolbar{display:none !important;}"
    document.head.append(style)
  })
}

export const test = base.extend<{ hideAstroDevToolbar: void }>({
  hideAstroDevToolbar: [
    async ({ page }, use) => {
      await page.addInitScript(hideDevToolbar)
      await use()
    },
    { auto: true },
  ],
})

export { expect }
