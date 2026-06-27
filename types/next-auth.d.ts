import type { DefaultSession } from "next-auth";

/**
 * Auth.js module augmentation — carry the actor's roles + hospital context through
 * the JWT session (server-side authorization happens in the service layer, 09 §6).
 */
declare module "next-auth" {
  interface User {
    roles: string[];
    hospitalIds: string[];
    hospitalId: string | null;
    hospitalCode: string | null;
    hospitalName: string | null;
  }

  interface Session {
    user: {
      id: string;
      roles: string[];
      hospitalIds: string[];
      hospitalId: string | null;
      hospitalCode: string | null;
      hospitalName: string | null;
    } & DefaultSession["user"];
  }
}

// JWT is declared in @auth/core/jwt and only re-exported by next-auth/jwt, so the
// augmentation must target the original module to merge.
declare module "@auth/core/jwt" {
  interface JWT {
    roles: string[];
    hospitalIds: string[];
    hospitalId: string | null;
    hospitalCode: string | null;
    hospitalName: string | null;
  }
}
