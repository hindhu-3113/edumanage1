import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client-auth";
import { authPrisma as prisma } from "@/lib/auth-prisma";
import { isUserRole } from "@/lib/permissions";
import { validatePassword } from "@/lib/password-policy";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
    return Response.json(users);
  } catch (error) {
    console.error("Failed to load user accounts:", error);
    return Response.json({ error: "Could not load user accounts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isRecord(body)) {
    return Response.json({ error: "User details must be sent as an object." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role;
  if (!name || name.length > 100) {
    return Response.json({ error: "Name is required and must be 100 characters or fewer." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!isUserRole(role)) {
    return Response.json({ error: "Choose ADMIN or STAFF as the account role." }, { status: 400 });
  }
  const passwordError = validatePassword(password);
  if (passwordError) return Response.json({ error: passwordError }, { status: 400 });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    return Response.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    console.error("Failed to create user account:", error);
    return Response.json({ error: "Could not create the user account." }, { status: 500 });
  }
}
