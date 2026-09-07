import { z } from "zod"

const emailField = z
  .email("El correo no es válido")
  .trim()
  .toLowerCase()
  .min(1, "El correo es obligatorio")

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
})

export const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
})

export type AuthFieldErrors = Partial<
  Record<"email" | "password" | "name", string>
>

export function fieldErrorsFromZod(error: z.ZodError): AuthFieldErrors {
  const fieldErrors: AuthFieldErrors = {}

  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key !== "string" || key in fieldErrors) {
      continue
    }
    fieldErrors[key as keyof AuthFieldErrors] = issue.message
  }

  return fieldErrors
}

export async function authErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json()
    if (
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string" &&
      payload.message.length > 0
    ) {
      return payload.message
    }
  } catch {
    // Fall through to the generic message.
  }
  return "No se pudo completar la acción. Revisa los datos."
}
