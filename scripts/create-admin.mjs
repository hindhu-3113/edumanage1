import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client-auth";

const prisma = new PrismaClient();

async function readHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Run this command in an interactive terminal so the password can be entered without echo.");
  }
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") return finish(new Error("Cancelled."));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " ") value += character;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin) throw new Error("An administrator already exists. Use User Management to add accounts.");

  const readline = createInterface({ input: stdin, output: stdout });
  const name = (await readline.question("Administrator name: ")).trim();
  const email = (await readline.question("Administrator email: ")).trim().toLowerCase();
  readline.close();
  if (!name || name.length > 100) throw new Error("Enter a name between 1 and 100 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Enter a valid email address.");
  }

  const password = await readHidden("Create password (input hidden): ");
  const confirmation = await readHidden("Confirm password (input hidden): ");
  if (password !== confirmation) throw new Error("Passwords do not match.");
  if (
    password.length < 12 ||
    password.length > 128 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error("Use 12–128 characters with lowercase, uppercase, numeric, and special characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { name, email, passwordHash, role: "ADMIN" } });
  stdout.write(`Administrator account created for ${email}.\n`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Could not create the administrator.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
