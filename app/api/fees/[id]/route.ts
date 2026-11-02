import { Prisma } from "@prisma/client-fee";
import { feePrisma as prisma } from "@/lib/fee-prisma";
import { parseDateOnly, parseRupeesToPaise } from "@/lib/fee-validation";

type RouteContext = { params: Promise<{ id: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PUT(request: Request, { params }: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isRecord(body)) {
    return Response.json({ error: "Fee details must be sent as an object." }, { status: 400 });
  }

  const { id } = await params;
  const totalAmountPaise = parseRupeesToPaise(body.totalAmount);
  const dueDate = parseDateOnly(body.dueDate);
  const classId = typeof body.classId === "string" && body.classId.trim() ? body.classId.trim() : null;
  if (totalAmountPaise === null) {
    return Response.json({ error: "Total fee must be a positive amount with up to two decimal places." }, { status: 400 });
  }
  if (!dueDate) return Response.json({ error: "Enter a valid payment due date." }, { status: 400 });

  try {
    const fee = await prisma.feeRecord.findUnique({ where: { id }, select: { amountPaidPaise: true } });
    if (!fee) return Response.json({ error: "Fee record not found." }, { status: 404 });
    if (totalAmountPaise < fee.amountPaidPaise) {
      return Response.json({ error: "Total fee cannot be lower than the amount already collected." }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.feeRecord.updateMany({
        where: { id, amountPaidPaise: fee.amountPaidPaise },
        data: { totalAmountPaise, dueDate, classId },
      });
      if (result.count !== 1) throw new Error("FEE_BALANCE_CHANGED");
      return transaction.feeRecord.findUnique({
        where: { id },
        include: { student: true, class: true },
      });
    });
    if (!updated) return Response.json({ error: "Fee record not found." }, { status: 404 });
    return Response.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "FEE_BALANCE_CHANGED") {
      return Response.json({ error: "Payments changed while updating this fee. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return Response.json({ error: "Fee record not found." }, { status: 404 });
      if (error.code === "P2003") return Response.json({ error: "Choose an existing class." }, { status: 400 });
    }
    console.error("Failed to update fee record:", error);
    return Response.json({ error: "Could not update fee record." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const fee = await prisma.feeRecord.findUnique({
      where: { id },
      select: { id: true, payments: { select: { id: true }, take: 1 } },
    });
    if (!fee) return Response.json({ error: "Fee record not found." }, { status: 404 });
    if (fee.payments.length) {
      return Response.json({ error: "Fee records with payment history cannot be deleted." }, { status: 409 });
    }
    await prisma.feeRecord.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return Response.json({ error: "Fee record not found." }, { status: 404 });
      if (error.code === "P2003") return Response.json({ error: "Fee records with payment history cannot be deleted." }, { status: 409 });
    }
    console.error("Failed to delete fee record:", error);
    return Response.json({ error: "Could not delete fee record." }, { status: 500 });
  }
}
