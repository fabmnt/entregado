import { expect, test } from "../fixtures"
import { makeOwner, registerOwner } from "../helpers"

test.describe("owner auth", () => {
  test("registers a new owner, signs out and signs back in", async ({
    page,
  }) => {
    const owner = makeOwner()

    await registerOwner(page, owner)
    await expect(page.getByRole("heading", { name: "Negocios" })).toBeVisible()
    await expect(page.getByText(owner.email)).toBeVisible()

    await page.getByRole("button", { name: "Salir" }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible()

    await page.getByLabel("Correo").fill(owner.email)
    await page.getByLabel("Contraseña").fill(owner.password)
    await page.getByRole("button", { name: "Entrar" }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByText(owner.email)).toBeVisible()
  })
})
