import { expect, test } from "../fixtures"
import {
  createBusiness,
  createProduct,
  makeOwner,
  registerOwner,
} from "../helpers"

test.describe("owner catalog", () => {
  test("creates a business and a product, then shows it on the storefront", async ({
    page,
  }) => {
    const owner = makeOwner()
    await registerOwner(page, owner)

    const business = await createBusiness(page)
    const product = await createProduct(page, business.slug)

    await page.goto(`/${business.slug}`)
    await expect(
      page.getByRole("heading", { name: business.name })
    ).toBeVisible()
    await expect(page.getByText(product.name)).toBeVisible()
    await expect(page.getByRole("link", { name: "Comprar" })).toBeVisible()
  })
})
