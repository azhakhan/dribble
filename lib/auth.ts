import NextAuth from "next-auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { authConfig } from "@/auth.config";
import { HttpError } from "@/lib/api";

/** Fixed owner for all data in local mode (no Google OAuth configured). */
export const SENTINEL_USER_ID = "00000000-0000-0000-0000-000000000000";

/** Hosted (multi-user) mode is enabled purely by configuring Google OAuth. */
export const authEnabled = !!process.env.AUTH_GOOGLE_ID;

/** Insert or update the user row for a signed-in Google account; return its id. */
async function upsertUser(profile: {
  email?: string | null;
  name?: string | null;
  image?: string | null;
}): Promise<string> {
  const conn = await db();
  const email = profile.email!.toLowerCase();
  const [row] = await conn
    .insert(users)
    .values({ email, name: profile.name ?? null, image: profile.image ?? null })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: profile.name ?? null, image: profile.image ?? null },
    })
    .returning({ id: users.id });
  return row.id;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // `user` is only set on initial sign-in (Node runtime). Upsert then and
      // stamp our internal id onto the token; later requests reuse it (no DB hit).
      if (user?.email) {
        token.uid = await upsertUser(user);
      }
      return token;
    },
  },
});

/**
 * Resolve the current user's id for a route handler.
 * Local mode → the sentinel user. Hosted mode → the signed-in user, else 401.
 */
export async function getCurrentUserId(): Promise<string> {
  if (!authEnabled) return SENTINEL_USER_ID;
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new HttpError(401, "Unauthorized");
  return id;
}
