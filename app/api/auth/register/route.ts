import bcrypt from "bcryptjs";
import { authPrisma as prisma } from "@/lib/auth-prisma";
import { validatePassword } from "@/lib/password-policy";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isRecord(body)) {
    return Response.json({ error: "Account details must be sent as an object." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLocaleLowerCase("en-US") : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!name || name.length > 100) {
    return Response.json({ error: "Enter your full name (up to 100 characters)." }, { status: 400 });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const passwordError = validatePassword(password);
  if (passwordError) return Response.json({ error: passwordError }, { status: 400 });
  if (password !== confirmPassword) {
    return Response.json({ error: "Passwords do not match." }, { status: 400 });
  }
  if (body.role !== undefined && body.role !== "STAFF") {
    return Response.json({ error: "Public registration can only create STAFF accounts." }, { status: 400 });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: "STAFF" },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    return Response.json(
      { message: "Your STAFF account is ready. You can now sign in.", user },
      { status: 201 },
    );
  } catch (error) {
    if (isRecord(error) && error.code === "P2002") {
      return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    console.error("Failed to register account:", error);
    return Response.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }
}
