"use client";

import { useSession } from "next-auth/react";

export function useCurrentRole() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  return {
    role,
    isAdmin: role === "ADMIN",
    isStaff: role === "STAFF",
  };
}
