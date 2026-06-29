import type { DefaultSession } from "next-auth";

// Augment the session/token to carry our internal dbide_users.id.
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
  }
}
