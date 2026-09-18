import { expect, test } from "../fixtures"
import {
  createBusiness,
  createProduct,
  makeOwner,
  registerOwner,
} from "../helpers"

test.describe("buyer checkout", () => {
  test("places a pickup order and the owner completes it", async ({ page }) => {
    const owner = makeOwner()
    await registerOwner(page, owner)

    const business = await createBusiness(page)
    const product = await createProduct(page, business.slug)

    // Buyer side: open the storefront and add the product to the checkout form.
    await page.goto(`/${business.slug}`)
    await page.getByRole("link", { name: "Comprar" }).click()
    await expect(page).toHaveURL(new RegExp(`/${business.slug}/buy/`))

    const buyerName = "Buyer E2E"
    await page.getByLabel("Cantidad").fill("2")
    await page.getByLabel("Tu nombre").fill(buyerName)
    await page.getByLabel("Teléfono").fill("88881111")
    await page.getByLabel("Entrega").selectOption("pickup")
    await page.getByRole("button", { name: "Hacer pedido" }).click()

    // Receipt page shows the created order.
    await expect(page).toHaveURL(new RegExp(`/${business.slug}/sale/`))
    await expect(
      page.getByRole("heading", { name: "Pedido recibido" })
    ).toBeVisible()
    await expect(page.getByText(`2 × ${product.name}`)).toBeVisible()
    await expect(page.getByText("Pendiente")).toBeVisible()
    await expect(page.getByText("Retiro")).toBeVisible()
    await expect(page.getByText(buyerName)).toBeVisible()

    // Owner side: the sales board lists the order and can complete it.
    await page.goto(`/admin/${business.slug}/sales`)
    await expect(page.getByRole("heading", { name: "En curso" })).toBeVisible()
    await expect(page.getByText(`2 × ${product.name}`).first()).toBeVisible()

    await page.getByRole("button", { name: "Completar" }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/${business.slug}/sales$`))
    await expect(page.getByText("Completada").first()).toBeVisible()
  })
})
