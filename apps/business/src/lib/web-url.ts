const LOCAL_WEB_URL = "http://localhost:4321"

/** Public URL of the general Entregado web (the business directory). */
export function getWebAppUrl(): string {
  const url = import.meta.env.PUBLIC_WEB_URL
  if (typeof url === "string" && url.length > 0) {
    return url.replace(/\/$/, "")
  }
  if (import.meta.env.DEV) {
    return LOCAL_WEB_URL
  }
  throw new Error("PUBLIC_WEB_URL is required outside local development")
}
