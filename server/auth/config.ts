import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authenticateCredentials } from "@/server/services";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/account-security";
import { z } from "@/lib/validation";

/**
 * Auth.js configuration (D-005, 09 §3). Auth.js answers "who is this?"; business
 * authorization stays in the service layer. Sessions are stateless JWTs (no Session
 * table in the model). The Credentials provider delegates to the auth service, which
 * verifies the bcrypt hash and writes the `auth.login` audit entry.
 */
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  trustHost: true,
  pages: { signIn: "/connexion" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Identifiant", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const actor = await authenticateCredentials(
          parsed.data.email,
          parsed.data.password,
        );
        if (!actor) return null;

        return {
          id: actor.id,
          name: actor.displayName,
          email: actor.email,
          roles: actor.roles,
          hospitalIds: actor.hospitalIds,
          hospitalId: actor.hospitalId,
          hospitalCode: actor.hospitalCode,
          hospitalName: actor.hospitalName,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.roles = user.roles;
        token.hospitalIds = user.hospitalIds;
        token.hospitalId = user.hospitalId;
        token.hospitalCode = user.hospitalCode;
        token.hospitalName = user.hospitalName;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.roles = token.roles ?? [];
      session.user.hospitalIds = token.hospitalIds ?? [];
      session.user.hospitalId = token.hospitalId ?? null;
      session.user.hospitalCode = token.hospitalCode ?? null;
      session.user.hospitalName = token.hospitalName ?? null;
      return session;
    },
  },
});
