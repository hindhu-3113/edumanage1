import { Prisma } from "@prisma/client-report";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { reportPrisma as prisma } from "@/lib/report-prisma";

type ExportReport = {
  title: string;
  headers: string[];
  rows: string[][];
};

const feeStatuses = ["PAID", "PARTIALLY_PAID", "PENDING"] as const;

function feeStatus(paid: number, total: number) {
  if (paid >= total) return "Paid";
  return paid > 0 ? "Partially paid" : "Pending";
}

function money(paise: number) {
  return `INR ${(paise / 100).toFixed(2)}`;
}

function dateText(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-IN", { timeZone: "UTC" });
}

function validDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Choose a valid report date.");
  }
  return date;
}

async function loadReport(report: string, searchParams: URLSearchParams): Promise<ExportReport> {
  const search = searchParams.get("search")?.trim() ?? "";
  switch (report) {
    case "students": {
      const departmentId = searchParams.get("departmentId") ?? "";
      const academicYear = searchParams.get("academicYear") ?? "";
      const students = await prisma.student.findMany({
        where: {
          ...(search ? { OR: [{ name: { contains: search } }, { registerNo: { contains: search } }] } : {}),
          ...(departmentId ? { departmentId } : {}),
          ...(academicYear ? { academicYear } : {}),
        },
        include: { department: true },
        orderBy: { name: "asc" },
      });
      return {
        title: "Student List",
        headers: ["Name", "Register Number", "Email", "Phone", "Department", "Academic Year", "Status"],
        rows: students.map((student) => [
          student.name, student.registerNo, student.email, student.phone, student.department.name,
          student.academicYear, student.status,
        ]),
      };
    }
    case "attendance": {
      const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
      validDate(date);
      const departmentCode = searchParams.get("department") ?? "";
      const students = await prisma.student.findMany({
        where: {
          ...(search
            ? { OR: [{ name: { contains: search } }, { registerNo: { contains: search } }] }
            : {}),
          ...(departmentCode ? { department: { code: departmentCode } } : {}),
        },
        include: {
          department: true,
          attendance: { where: { date }, select: { status: true } },
        },
        orderBy: { name: "asc" },
      });
      return {
        title: `Attendance Report - ${date}`,
        headers: ["Date", "Student", "Register Number", "Department", "Academic Year", "Status"],
        rows: students.map((student) => [
          date, student.name, student.registerNo, student.department.name, student.academicYear,
          student.attendance[0]?.status === "PRESENT" ? "Present" : student.attendance[0]?.status === "ABSENT" ? "Absent" : "Not marked",
        ]),
      };
    }
    case "fees": {
      if (searchParams.get("view") === "payments") {
        const fromText = searchParams.get("from");
        const toText = searchParams.get("to");
        const from = validDate(fromText);
        const to = validDate(toText);
        if (from && to && from > to) throw new Error("Start date must not be after end date.");
        const status = searchParams.get("status") ?? "";
        if (status && !feeStatuses.includes(status as (typeof feeStatuses)[number])) {
          throw new Error("Fee status filter is invalid.");
        }
        const payments = await prisma.feePayment.findMany({
          where: {
            ...(status ? { statusAfter: status } : {}),
            ...((from || to) ? { paymentDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: new Date(`${toText}T23:59:59.999Z`) } : {}) } } : {}),
            ...(search ? {
              OR: [
                { receiptNumber: { contains: search } },
                { transactionReference: { contains: search } },
                { feeRecord: { student: { OR: [{ name: { contains: search } }, { registerNo: { contains: search } }, { id: { contains: search } }] } } },
              ],
            } : {}),
          },
          include: { feeRecord: { include: { student: { include: { department: true } } } } },
          orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
        });
        return {
          title: "Fee Payment History",
          headers: ["Student", "Register Number", "Department", "Amount", "Payment Date", "Method", "Transaction Reference", "Receipt Number", "Status After Payment"],
          rows: payments.map((payment) => [
            payment.feeRecord.student.name, payment.feeRecord.student.registerNo,
            payment.feeRecord.student.department.name, money(payment.amountPaise), dateText(payment.paymentDate),
            payment.paymentMethod.replaceAll("_", " "), payment.transactionReference ?? "",
            payment.receiptNumber, payment.statusAfter.replaceAll("_", " "),
          ]),
        };
      }

      const status = searchParams.get("status") ?? "";
      if (status && !feeStatuses.includes(status as (typeof feeStatuses)[number])) {
        throw new Error("Fee status filter is invalid.");
      }
      const records = await prisma.feeRecord.findMany({
        include: { student: { include: { department: true } }, class: true },
        orderBy: [{ dueDate: "asc" }, { student: { name: "asc" } }],
      });
      const filtered = records.filter((record) => {
        const matchesStatus = !status || feeStatus(record.amountPaidPaise, record.totalAmountPaise).toUpperCase().replaceAll(" ", "_") === status;
        const needle = search.toLocaleLowerCase();
        const matchesSearch = !needle || [record.student.name, record.student.registerNo, record.student.id]
          .some((value) => value.toLocaleLowerCase().includes(needle));
        return matchesStatus && matchesSearch;
      });
      return {
        title: "Student Fee Report",
        headers: ["Student", "Register Number", "Department", "Class", "Academic Year", "Total Fee", "Amount Paid", "Balance", "Due Date", "Status"],
        rows: filtered.map((record) => [
          record.student.name, record.student.registerNo, record.student.department.name,
          record.class ? `${record.class.name} ${record.class.section}` : "Unassigned",
          record.student.academicYear, money(record.totalAmountPaise), money(record.amountPaidPaise),
          money(record.totalAmountPaise - record.amountPaidPaise), dateText(record.dueDate),
          feeStatus(record.amountPaidPaise, record.totalAmountPaise),
        ]),
      };
    }
    case "performance": {
      const subjectId = searchParams.get("subjectId") ?? "";
      const exam = searchParams.get("exam") ?? "";
      const sort = searchParams.get("sort") ?? "date_desc";
      const sorts: Record<string, Prisma.PerformanceRecordOrderByWithRelationInput[]> = {
        date_desc: [{ createdAt: "desc" }],
        student_asc: [{ student: { name: "asc" } }],
        subject_asc: [{ subject: { name: "asc" } }],
        exam_asc: [{ examName: "asc" }],
      };
      if (!sorts[sort]) throw new Error("Performance sort option is invalid.");
      const records = await prisma.performanceRecord.findMany({
        where: {
          ...(subjectId ? { subjectId } : {}),
          ...(exam ? { examName: { contains: exam } } : {}),
          ...(search ? { student: { name: { contains: search } } } : {}),
        },
        include: { student: true, subject: true },
        orderBy: sorts[sort],
      });
      return {
        title: "Student Performance Report",
        headers: ["Student", "Register Number", "Academic Year", "Subject", "Subject Code", "Exam", "Marks Obtained", "Maximum Marks", "Percentage", "Sample Record"],
        rows: records.map((record) => [
          record.student.name, record.student.registerNo, record.student.academicYear,
          record.subject.name, record.subject.code, record.examName,
          (record.marksObtainedHundredths / 100).toFixed(2),
          (record.maximumMarksHundredths / 100).toFixed(2),
          `${((record.marksObtainedHundredths / record.maximumMarksHundredths) * 100).toFixed(2)}%`,
          record.isSample ? "Yes" : "No",
        ]),
      };
    }
    case "teachers": {
      const teachers = await prisma.teacher.findMany({
        where: search ? { OR: [{ name: { contains: search } }, { email: { contains: search.toLowerCase() } }] } : undefined,
        include: { department: true },
        orderBy: { name: "asc" },
      });
      return {
        title: "Teacher List",
        headers: ["Name", "Email", "Phone", "Qualification", "Department", "Sample Record"],
        rows: teachers.map((teacher) => [
          teacher.name, teacher.email, teacher.phone ?? "", teacher.qualification ?? "",
          teacher.department?.name ?? "", teacher.isSample ? "Yes" : "No",
        ]),
      };
    }
    case "subjects": {
      const subjects = await prisma.subject.findMany({
        where: search ? { OR: [{ name: { contains: search } }, { code: { contains: search.toUpperCase() } }] } : undefined,
        include: {
          classes: { include: { class: true } },
          teachers: { include: { teacher: true } },
        },
        orderBy: { name: "asc" },
      });
      return {
        title: "Subject List",
        headers: ["Subject", "Subject Code", "Assigned Classes", "Assigned Teachers", "Sample Record"],
        rows: subjects.map((subject) => [
          subject.name,
          subject.code,
          subject.classes.map(({ class: classRecord }) => `${classRecord.name} ${classRecord.academicYear} ${classRecord.section}`).join("; "),
          subject.teachers.map(({ teacher }) => teacher.name).join("; "),
          subject.isSample ? "Yes" : "No",
        ]),
      };
    }
    default:
      throw new Error("Export report type is not supported.");
  }
}

async function createWorkbook(report: ExportReport, generatedAt: Date) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EduManage";
  workbook.created = generatedAt;
  const sheet = workbook.addWorksheet("Report");
  sheet.addRow([report.title]);
  sheet.addRow([`Generated: ${generatedAt.toLocaleString("en-IN")}`]);
  sheet.addRow([]);
  sheet.addRow(report.headers);
  for (const row of report.rows) sheet.addRow(row);

  sheet.mergeCells(1, 1, 1, report.headers.length);
  sheet.mergeCells(2, 1, 2, report.headers.length);
  sheet.getRow(1).height = 25;
  sheet.getRow(2).height = 19;
  sheet.getRow(4).height = 24;
  sheet.getRow(1).font = { bold: true, size: 16, color: { argb: "FF24334D" } };
  sheet.getRow(2).font = { italic: true, size: 10, color: { argb: "FF8290A5" } };
  sheet.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4169E1" } };
  sheet.views = [{ state: "frozen", ySplit: 4 }];
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: report.headers.length },
  };
  sheet.columns = report.headers.map((header, index) => {
    const widest = report.rows.reduce((width, row) => Math.max(width, row[index]?.length ?? 0), header.length);
    return { width: Math.min(Math.max(widest + 2, 14), 42) };
  });
  if (!report.rows.length) sheet.addRow(["No records matched the selected filters."]);
  return workbook.xlsx.writeBuffer();
}

async function createPdf(report: ExportReport, generatedAt: Date) {
  const landscape = report.headers.length > 5;
  const document = new PDFDocument({
    size: "A4",
    layout: landscape ? "landscape" : "portrait",
    margins: { top: 42, right: 34, bottom: 38, left: 34 },
    bufferPages: true,
  });
  const chunks: Buffer[] = [];
  const buffer = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  const left = document.page.margins.left;
  const tableWidth = document.page.width - left - document.page.margins.right;
  const columnWidth = tableWidth / report.headers.length;
  const fontSize = report.headers.length > 8 ? 6.5 : report.headers.length > 5 ? 7.5 : 9;
  const padding = 4;

  function drawHeading() {
    document.font("Helvetica-Bold").fontSize(16).fillColor("#24334d").text(report.title, left, 30, { width: tableWidth });
    document.font("Helvetica").fontSize(8).fillColor("#8290a5")
      .text(`Generated: ${generatedAt.toLocaleString("en-IN")}`, left, 52, { width: tableWidth });
    document.y = 70;
  }

  function drawTableHeader() {
    const height = 28;
    document.rect(left, document.y, tableWidth, height).fill("#4169e1");
    report.headers.forEach((header, index) => {
      document.font("Helvetica-Bold").fontSize(fontSize).fillColor("#ffffff")
        .text(header, left + index * columnWidth + padding, document.y + 5, {
          width: columnWidth - padding * 2,
          height: height - 8,
          ellipsis: true,
        });
    });
    document.y += height;
  }

  drawHeading();
  drawTableHeader();
  if (!report.rows.length) {
    document.font("Helvetica").fontSize(9).fillColor("#66748a")
      .text("No records matched the selected filters.", left + padding, document.y + 12);
  }

  for (const [rowIndex, row] of report.rows.entries()) {
    const cellHeights = row.map((cell) => {
      document.font("Helvetica").fontSize(fontSize);
      return document.heightOfString(cell || " ", {
        width: columnWidth - padding * 2,
        lineGap: 1,
      });
    });
    const rowHeight = Math.min(Math.max(22, ...cellHeights.map((height) => height + padding * 2)), 64);
    if (document.y + rowHeight > document.page.height - document.page.margins.bottom) {
      document.addPage();
      drawHeading();
      drawTableHeader();
    }
    if (rowIndex % 2 === 1) document.rect(left, document.y, tableWidth, rowHeight).fill("#f5f7fb");
    document.save();
    document.rect(left, document.y, tableWidth, rowHeight).strokeColor("#e6eaf1").lineWidth(0.35).stroke();
    for (let index = 1; index < report.headers.length; index += 1) {
      document.moveTo(left + index * columnWidth, document.y)
        .lineTo(left + index * columnWidth, document.y + rowHeight).strokeColor("#e6eaf1").lineWidth(0.35).stroke();
    }
    document.restore();
    row.forEach((cell, index) => {
      document.font("Helvetica").fontSize(fontSize).fillColor("#34435b")
        .text(cell, left + index * columnWidth + padding, document.y + padding, {
          width: columnWidth - padding * 2,
          height: rowHeight - padding * 2,
          ellipsis: true,
        });
    });
    document.y += rowHeight;
  }
  document.end();
  return buffer;
}

export async function GET(request: Request, context: { params: Promise<{ report: string }> }) {
  try {
    const { report: reportName } = await context.params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    if (format !== "xlsx" && format !== "pdf") {
      return Response.json({ error: "Choose an Excel or PDF export format." }, { status: 400 });
    }

    const report = await loadReport(reportName, searchParams);
    const generatedAt = new Date();
    const filename = `edumanage-${reportName}-${generatedAt.toISOString().slice(0, 10)}.${format}`;
    if (format === "xlsx") {
      const workbook = await createWorkbook(report, generatedAt);
      return new Response(new Uint8Array(workbook), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const pdf = await createPdf(report, generatedAt);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && [
      "Choose a valid report date.",
      "Start date must not be after end date.",
      "Fee status filter is invalid.",
      "Performance sort option is invalid.",
      "Export report type is not supported.",
    ].includes(error.message)) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to generate export:", error);
    return Response.json({ error: "Could not generate the requested report." }, { status: 500 });
  }
}
