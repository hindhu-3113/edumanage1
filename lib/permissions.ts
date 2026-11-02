export type UserRole = "ADMIN" | "STAFF";

const adminOnlyPaths = ["/settings", "/users", "/api/users"];
const staffMutationMethods: Record<string, readonly string[]> = {
  "/api/students": ["POST"],
  "/api/attendance": ["POST"],
  "/api/attendance/qr": ["POST"],
  "/api/performance": ["POST"],
};

function isWithinPath(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function canAccessPath(
  role: UserRole,
  pathname: string,
): boolean {
  if (role === "ADMIN") return true;
  if (adminOnlyPaths.some((path) => isWithinPath(pathname, path))) return false;
  return true;
}

export function canAccessApi(role: UserRole, pathname: string, method: string): boolean {
  if (role === "ADMIN") return true;
  if (adminOnlyPaths.some((path) => isWithinPath(pathname, path))) return false;
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD" || normalizedMethod === "OPTIONS") {
    return true;
  }

  if (staffMutationMethods[pathname]?.includes(normalizedMethod)) return true;
  if (normalizedMethod === "PUT" && /^\/api\/students\/[^/]+$/.test(pathname)) return true;
  if (normalizedMethod === "PUT" && /^\/api\/performance\/[^/]+$/.test(pathname)) return true;
  return false;
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "ADMIN" || value === "STAFF";
}
