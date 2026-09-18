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

    await page.goto(`/${business.slug}`)
    await page.getByRole("button", { name: "Agregar" }).click()
    await page.getByRole("link", { name: /Ver pedido/ }).click()
    await expect(page).toHaveURL(new RegExp(`/${business.slug}/cart`))

    const buyerName = "Buyer E2E"
    await page.getByLabel(`Cantidad de ${product.name}`).fill("2")
    await page.getByRole("button", { name: "Actualizar" }).click()
    await page.getByLabel("Tu nombre").fill(buyerName)
    await page.getByLabel("Teléfono").fill("88881111")
    await page.getByLabel("Entrega").selectOption("pickup")
    await page.getByRole("button", { name: /Hacer pedido/ }).click()

    await expect(page).toHaveURL(new RegExp(`/${business.slug}/order/`))
    await expect(
      page.getByRole("heading", { name: "Pedido recibido" })
    ).toBeVisible()
    await expect(page.getByText(`2 × ${product.name}`)).toBeVisible()
    await expect(page.getByText("Retiro")).toBeVisible()
    await expect(page.getByText(buyerName)).toBeVisible()

    await page.goto(`/admin/${business.slug}/sales`)
    await expect(page.getByRole("heading", { name: "En curso" })).toBeVisible()
    await expect(page.getByText(`2 × ${product.name}`).first()).toBeVisible()

    await page.getByRole("button", { name: "Completar" }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/${business.slug}/sales$`))
    await expect(page.getByText("Completada").first()).toBeVisible()
  })
})
