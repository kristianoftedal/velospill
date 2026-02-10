import type { Session as BetterAuthSession } from "better-auth/types"

declare module "better-auth" {
  interface Session extends BetterAuthSession {
    user: BetterAuthSession["user"] & {
      role: string
    }
  }
}
