import { Prisma } from "@prisma/client-fee";
import { randomUUID } from "node:crypto";
import { feePrisma as prisma } from "@/lib/fee-prisma";
import { parseRupeesToPaise } from "@/lib/fee-validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payment = await prisma.feePayment.findUnique({
      where: { id },
      include: {
        feeRecord: {
          include: {
            student: { include: { department: true } },
            class: true,
          },
        },
      },
    });
    if (!payment) return Response.json({ error: "Payment receipt not found." }, { status: 404 });
    return Response.json(payment);
  } catch (error) {
    console.error("Failed to load payment receipt:", error);
    return Response.json({ error: "Could not load payment receipt." }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function statusAfterPayment(paid: number, total: number): string {
  if (paid >= total) return "PAID";
  return paid > 0 ? "PARTIALLY_PAID" : "PENDING";
}

export async function PATCH(request: Request, context: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isRecord(body)) {
    return Response.json({ error: "Correction details must be sent as an object." }, { status: 400 });
  }

  const correctedAmountPaise = parseRupeesToPaise(body.correctedAmount);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (correctedAmountPaise === null) {
    return Response.json({ error: "Corrected amount must be positive with up to two decimal places." }, { status: 400 });
  }
  if (reason.length < 5 || reason.length > 500) {
    return Response.json({ error: "Enter a correction reason between 5 and 500 characters." }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    const original = await prisma.feePayment.findUnique({
      where: { id },
      include: { feeRecord: { include: { student: true, class: true } } },
    });
    if (!original) return Response.json({ error: "Payment record not found." }, { status: 404 });
    if (original.paymentMethod === "ADJUSTMENT") {
      return Response.json({ error: "Adjustment entries cannot be corrected directly." }, { status: 409 });
    }

    const adjustment = await prisma.$transaction(async (transaction) => {
      const priorAdjustments = await transaction.feePayment.findMany({
        where: { paymentMethod: "ADJUSTMENT", transactionReference: original.receiptNumber },
        select: { amountPaise: true },
      });
      const currentCorrectedAmount = original.amountPaise +
        priorAdjustments.reduce((sum, adjustmentRecord) => sum + adjustmentRecord.amountPaise, 0);
      const deltaPaise = correctedAmountPaise - currentCorrectedAmount;
      if (deltaPaise === 0) throw new Error("CORRECTION_UNCHANGED");

      const fee = await transaction.feeRecord.findUnique({
        where: { id: original.feeRecordId },
        select: { id: true, totalAmountPaise: true, amountPaidPaise: true },
      });
      if (!fee) throw new Error("FEE_RECORD_NOT_FOUND");
      const correctedPaidPaise = fee.amountPaidPaise + deltaPaise;
      if (correctedPaidPaise < 0 || correctedPaidPaise > fee.totalAmountPaise) {
        throw new Error("CORRECTION_OUT_OF_BALANCE");
      }

      const updateResult = await transaction.feeRecord.updateMany({
        where: { id: fee.id, amountPaidPaise: fee.amountPaidPaise },
        data: { amountPaidPaise: correctedPaidPaise },
      });
      if (updateResult.count !== 1) throw new Error("FEE_BALANCE_CHANGED");

      const now = new Date();
      return transaction.feePayment.create({
        data: {
          feeRecordId: fee.id,
          amountPaise: deltaPaise,
          paymentDate: now,
          paymentMethod: "ADJUSTMENT",
          transactionReference: original.receiptNumber,
          description: `Correction of ${original.receiptNumber} from ${(currentCorrectedAmount / 100).toFixed(2)} to ${(correctedAmountPaise / 100).toFixed(2)}: ${reason}`,
          receiptNumber: `EM-ADJ-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
          idempotencyKey: randomUUID(),
          balanceAfterPaise: fee.totalAmountPaise - correctedPaidPaise,
          statusAfter: statusAfterPayment(correctedPaidPaise, fee.totalAmountPaise),
        },
        include: { feeRecord: { include: { student: { include: { department: true } }, class: true } } },
      });
    });
    return Response.json({ adjustment, originalPaymentId: original.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FEE_RECORD_NOT_FOUND") return Response.json({ error: "Fee record not found." }, { status: 404 });
      if (error.message === "CORRECTION_OUT_OF_BALANCE") {
        return Response.json({ error: "This correction would make the collected amount negative or exceed the total fee." }, { status: 409 });
      }
      if (error.message === "FEE_BALANCE_CHANGED") {
        return Response.json({ error: "The fee balance changed during correction. Refresh and try again." }, { status: 409 });
      }
      if (error.message === "CORRECTION_UNCHANGED") {
        return Response.json({ error: "The corrected amount matches the current payment amount." }, { status: 400 });
      }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "Payment record not found." }, { status: 404 });
    }
    console.error("Failed to correct payment:", error);
    return Response.json({ error: "Could not correct payment." }, { status: 500 });
  }
}
