import { expect, type Page } from "@playwright/test"

export const E2E_PREFIX = "E2E"

// Shared credentials for the throwaway accounts the suite creates.
export const E2E_PASSWORD = "e2e-password-123"

/** Short, unique, slug-safe token so every run writes distinguishable data. */
export function uniqueId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export type TestOwner = { name: string; email: string; password: string }

export function makeOwner(): TestOwner {
  const id = uniqueId()
  return {
    name: `${E2E_PREFIX} Owner ${id}`,
    email: `e2e.${id}@entregado.test`,
    password: E2E_PASSWORD,
  }
}

/** Registers a fresh owner and waits for the admin landing page. */
export async function registerOwner(
  page: Page,
  owner: TestOwner
): Promise<void> {
  await page.goto("/register")
  await page.getByLabel("Nombre").fill(owner.name)
  await page.getByLabel("Correo").fill(owner.email)
  await page.getByLabel("Contraseña").fill(owner.password)
  await page.getByRole("button", { name: "Crear cuenta" }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

/** Signs in through the login form and waits for the admin landing page. */
export async function signIn(
  page: Page,
  credentials: { email: string; password: string }
): Promise<void> {
  await page.goto("/login")
  await page.getByLabel("Correo").fill(credentials.email)
  await page.getByLabel("Contraseña").fill(credentials.password)
  await page.getByRole("button", { name: "Entrar" }).click()
}

export type TestBusiness = { slug: string; name: string }

/** Creates a business from the admin panel and returns its unique slug/name. */
export async function createBusiness(page: Page): Promise<TestBusiness> {
  const id = uniqueId()
  const slug = `e2e-${id}`
  const name = `${E2E_PREFIX} Business ${id}`

  await page.goto("/admin")
  await page.getByLabel("Nombre").fill(name)
  await page.getByLabel("Slug").fill(slug)
  await page.getByLabel("Tipo").selectOption("food")
  await page.getByLabel("WhatsApp").fill("88887777")
  await page.getByLabel("Descripción").fill("Negocio de prueba E2E.")
  await page.getByLabel("Ventajas").fill("Pedido rápido.")
  await page.getByLabel("Alcance").fill("Managua.")
  await page.getByLabel("Qué vende").fill("Productos de prueba.")
  await page.getByRole("button", { name: "Guardar" }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/${slug}$`))

  return { slug, name }
}

export type TestRider = { name: string; email: string; password: string }

export function makeRider(): TestRider {
  const id = uniqueId()
  return {
    name: `${E2E_PREFIX} Rider ${id}`,
    email: `e2e.rider.${id}@entregado.test`,
    password: E2E_PASSWORD,
  }
}

/** Creates a rider account for a business from the admin panel. */
export async function createRider(
  page: Page,
  slug: string,
  rider: TestRider
): Promise<void> {
  await page.goto(`/admin/${slug}/riders`)
  await page.getByLabel("Nombre").fill(rider.name)
  await page.getByLabel("Correo").fill(rider.email)
  await page.getByLabel("Contraseña").fill(rider.password)
  await page.getByRole("button", { name: "Crear cuenta" }).click()
  await expect(page.getByText(rider.email)).toBeVisible()
}

export type TestProduct = { name: string; price: number }

/** Creates a product in the given business and returns its unique name. */
export async function createProduct(
  page: Page,
  slug: string,
  options: { supportsDelivery?: boolean } = {}
): Promise<TestProduct> {
  const name = `${E2E_PREFIX} Product ${uniqueId()}`
  const price = 100

  await page.goto(`/admin/${slug}/products`)
  await page.getByLabel("Nombre").fill(name)
  await page.getByLabel("Descripción").fill("Producto de prueba E2E.")
  await page.getByLabel("Precio (C$)").fill(String(price))

  const available = page.getByLabel("Visible en la tienda")
  if (!(await available.isChecked())) {
    await available.check()
  }

  const supportsDelivery = page.getByLabel("Se puede entregar a domicilio")
  const shouldSupportDelivery = options.supportsDelivery ?? true
  if (shouldSupportDelivery !== (await supportsDelivery.isChecked())) {
    await supportsDelivery.setChecked(shouldSupportDelivery)
  }

  await page.getByRole("button", { name: "Añadir" }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/${slug}/products$`))
  await expect(page.getByText(name)).toBeVisible()

  return { name, price }
}
