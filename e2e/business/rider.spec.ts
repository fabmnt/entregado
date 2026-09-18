import { expect, test } from "../fixtures"
import {
  createBusiness,
  createProduct,
  createRider,
  makeOwner,
  makeRider,
  registerOwner,
} from "../helpers"

test.describe("rider delivery", () => {
  test("owner's rider accepts a delivery order and marks it delivered", async ({
    page,
  }) => {
    const owner = makeOwner()
    await registerOwner(page, owner)

    const business = await createBusiness(page)
    const product = await createProduct(page, business.slug)

    const rider = makeRider()
    await createRider(page, business.slug, rider)

    await page.goto(`/${business.slug}`)
    await page.getByRole("button", { name: "Agregar" }).click()
    await page.getByRole("link", { name: /Ver pedido/ }).click()
    await page.getByLabel("Tu nombre").fill("Buyer Rider E2E")
    await page.getByLabel("Teléfono").fill("88882222")
    await page.getByLabel("Ubicación").fill("Rotonda E2E, Managua")
    await page.getByRole("button", { name: /Hacer pedido/ }).click()
    await expect(page).toHaveURL(new RegExp(`/${business.slug}/order/`))

    await page.goto("/admin")
    await page.getByRole("button", { name: "Salir" }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.getByLabel("Correo").fill(rider.email)
    await page.getByLabel("Contraseña").fill(rider.password)
    await page.getByRole("button", { name: "Entrar" }).click()

    await expect(page).toHaveURL(/\/rider$/)
    await expect(page.getByRole("heading", { name: "Entregas" })).toBeVisible()
    await expect(page.getByText(`1 × ${product.name}`)).toBeVisible()

    await page.getByRole("button", { name: "Aceptar" }).click()
    await expect(page).toHaveURL(/\/rider$/)
    await expect(
      page.getByRole("button", { name: "Marcar entregado" })
    ).toBeVisible()
    await page.getByRole("button", { name: "Marcar entregado" }).click()
    await expect(page).toHaveURL(/\/rider$/)

    await page.getByRole("button", { name: "Salir" }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.getByLabel("Correo").fill(owner.email)
    await page.getByLabel("Contraseña").fill(owner.password)
    await page.getByRole("button", { name: "Entrar" }).click()

    await page.goto(`/admin/${business.slug}/sales`)
    await expect(page.getByText("Completada").first()).toBeVisible()
  })
})
