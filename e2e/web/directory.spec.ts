import { expect, test } from "../fixtures"

type DirectoryBusinessJson = {
  id: string
  slug: string
  name: string
  kind: string
  description: string
  advantages: string
  scope: string
  productPitch: string
  logoUrl: string | null
  createdAt: string
}

const DIRECTORY_FIELDS: Array<keyof DirectoryBusinessJson> = [
  "id",
  "slug",
  "name",
  "kind",
  "description",
  "advantages",
  "scope",
  "productPitch",
  "logoUrl",
  "createdAt",
]

// The shared dev deployment already contains businesses, and every suite run adds
// more, so the directory is expected to be non-empty.
test.describe("web directory", () => {
  test("renders business cards that link to the business app", async ({
    page,
    request,
    baseURL,
  }) => {
    const response = await request.get("/api/businesses")
    expect(response.status()).toBe(200)
    const payload = (await response.json()) as {
      businesses: DirectoryBusinessJson[]
    }
    expect(Array.isArray(payload.businesses)).toBe(true)
    expect(payload.businesses.length).toBeGreaterThan(0)

    const listed = payload.businesses[0]

    await page.goto("/")
    await expect(
      page.getByRole("heading", { name: "Negocios", level: 2 })
    ).toBeVisible()

    const card = page.locator(`a[href$="/${listed.slug}"]`).first()
    await expect(card).toBeVisible()

    const href = await card.getAttribute("href")
    expect(href).toBeTruthy()
    const cardUrl = new URL(String(href))
    expect(cardUrl.pathname).toBe(`/${listed.slug}`)
    // Cards point at the separate business app, not back at the directory.
    expect(cardUrl.origin).not.toBe(new URL(String(baseURL)).origin)
  })

  test("GET /api/businesses returns the documented JSON shape", async ({
    request,
  }) => {
    const response = await request.get("/api/businesses")
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("application/json")

    const payload = (await response.json()) as {
      businesses: DirectoryBusinessJson[]
    }
    expect(payload.businesses.length).toBeGreaterThan(0)

    const business = payload.businesses[0]
    for (const field of DIRECTORY_FIELDS) {
      expect(business, `missing field: ${field}`).toHaveProperty(field)
    }
    expect(["food", "pharmacy"]).toContain(business.kind)
    expect(Number.isNaN(Date.parse(business.createdAt))).toBe(false)
  })

  test("GET /api/businesses/[slug] returns 200 for a known slug", async ({
    request,
  }) => {
    const list = await request.get("/api/businesses")
    const { businesses } = (await list.json()) as {
      businesses: DirectoryBusinessJson[]
    }
    const known = businesses[0]

    const response = await request.get(`/api/businesses/${known.slug}`)
    expect(response.status()).toBe(200)
    const body = (await response.json()) as { business: DirectoryBusinessJson }
    expect(body.business.slug).toBe(known.slug)
  })

  test("GET /api/businesses/[slug] returns 404 for an unknown slug", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/businesses/e2e-slug-that-does-not-exist"
    )
    expect(response.status()).toBe(404)
    expect(await response.json()).toEqual({ error: "Business not found" })
  })
})
