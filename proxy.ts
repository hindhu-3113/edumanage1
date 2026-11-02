import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessApi, canAccessPath, isUserRole } from "@/lib/permissions";

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const user = request.auth?.user;

  if (pathname === "/login" || pathname === "/signup") {
    return user
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (!user || !isUserRole(user.role)) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Authentication is required." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessPath(user.role, pathname)) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "You do not have permission to perform this action." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  if (pathname.startsWith("/api/") && !canAccessApi(user.role, pathname, request.method)) {
    return Response.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-edumanage-user-id", user.id);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
