/// <reference types="astro/client" />

import type { SignedInUser } from "@entregado/types"

declare global {
  namespace App {
    interface Locals {
      convexToken: string | null
      user: SignedInUser | null
    }
  }
}

export {}
