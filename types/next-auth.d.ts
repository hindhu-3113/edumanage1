import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    sessionId?: string;
    role?: UserRole;
    authInvalid?: boolean;
  }
}
