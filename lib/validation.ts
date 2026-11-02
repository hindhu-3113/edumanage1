export type StudentInput = {
  name: string;
  registerNo: string;
  email: string;
  phone: string;
  departmentId: string;
  academicYear: string;
};

export type TeacherInput = {
  name: string;
  email: string;
  phone: string | null;
  qualification: string | null;
  departmentId?: string | null;
};

export type ClassInput = {
  name: string;
  academicYear: string;
  section: string;
};

export type SubjectInput = {
  name: string;
  code: string;
  classIds: string[];
  teacherIds: string[];
};

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

const academicYears = new Set(["Year 1", "Year 2", "Year 3", "Year 4"]);

export function validateSubject(value: unknown): ValidationResult<SubjectInput> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { success: false, message: "Subject details must be sent as an object." };
  }

  const body = value as Record<string, unknown>;
  if (typeof body.name !== "string" || !body.name.trim()) {
    return { success: false, message: "Subject name is required." };
  }
  if (typeof body.code !== "string" || !body.code.trim()) {
    return { success: false, message: "Subject code is required." };
  }
  const name = body.name.trim();
  const code = body.code.trim().toUpperCase();
  if (name.length > 100) {
    return { success: false, message: "Subject name must be 100 characters or fewer." };
  }
  if (code.length > 30 || !/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
    return {
      success: false,
      message: "Subject code must be 30 characters or fewer and use only letters, numbers, hyphens, or underscores.",
    };
  }

  const parseIds = (field: "classIds" | "teacherIds", label: string) => {
    const raw = body[field] ?? [];
    if (!Array.isArray(raw) || !raw.every((id) => typeof id === "string" && id.trim())) {
      return { success: false as const, message: `${label} selection is invalid.` };
    }
    const ids = raw.map((id) => (id as string).trim());
    if (new Set(ids).size !== ids.length) {
      return { success: false as const, message: `${label} cannot contain duplicates.` };
    }
    return { success: true as const, value: ids };
  };
  const classIds = parseIds("classIds", "Class");
  if (!classIds.success) return { success: false, message: classIds.message };
  const teacherIds = parseIds("teacherIds", "Teacher");
  if (!teacherIds.success) return { success: false, message: teacherIds.message };

  return { success: true, data: { name, code, classIds: classIds.value, teacherIds: teacherIds.value } };
}

export function validateClass(value: unknown): ValidationResult<ClassInput> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { success: false, message: "Class details must be sent as an object." };
  }

  const body = value as Record<string, unknown>;
  const fields: (keyof ClassInput)[] = ["name", "academicYear", "section"];
  const input = {} as ClassInput;
  const limits: Record<keyof ClassInput, number> = {
    name: 100,
    academicYear: 30,
    section: 30,
  };
  const labels: Record<keyof ClassInput, string> = {
    name: "Class name",
    academicYear: "Academic year",
    section: "Section",
  };

  for (const field of fields) {
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return { success: false, message: `${labels[field]} is required.` };
    }
    input[field] = body[field].trim();
    if (input[field].length > limits[field]) {
      return {
        success: false,
        message: `${labels[field]} must be ${limits[field]} characters or fewer.`,
      };
    }
  }

  return { success: true, data: input };
}

export function validateTeacher(value: unknown): ValidationResult<TeacherInput> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { success: false, message: "Teacher details must be sent as an object." };
  }

  const body = value as Record<string, unknown>;
  if (typeof body.name !== "string" || !body.name.trim()) {
    return { success: false, message: "Name is required." };
  }
  if (typeof body.email !== "string" || !body.email.trim()) {
    return { success: false, message: "Email is required." };
  }
  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: "Enter a valid email address." };
  }
  if (body.name.trim().length > 100) {
    return { success: false, message: "Name must be 100 characters or fewer." };
  }

  const optionalText = (field: "phone" | "qualification", label: string) => {
    const fieldValue = body[field];
    if (fieldValue === undefined || fieldValue === null) return { success: true as const, value: null };
    if (typeof fieldValue !== "string") {
      return { success: false as const, message: `${label} must be text.` };
    }
    const normalized = fieldValue.trim();
    if (normalized.length > 100) {
      return { success: false as const, message: `${label} must be 100 characters or fewer.` };
    }
    return { success: true as const, value: normalized || null };
  };
  const phone = optionalText("phone", "Phone number");
  if (!phone.success) return { success: false, message: phone.message };
  const qualification = optionalText("qualification", "Qualification");
  if (!qualification.success) return { success: false, message: qualification.message };

  const departmentId = body.departmentId;
  if (departmentId !== undefined && departmentId !== null && typeof departmentId !== "string") {
    return { success: false, message: "Department selection is invalid." };
  }

  return {
    success: true,
    data: {
      name: body.name.trim(),
      email,
      phone: phone.value,
      qualification: qualification.value,
      ...(departmentId === undefined
        ? {}
        : { departmentId: typeof departmentId === "string" && departmentId.trim() ? departmentId.trim() : null }),
    },
  };
}

export function validateStudent(value: unknown): ValidationResult<StudentInput> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { success: false, message: "Student details must be sent as an object." };
  }

  const body = value as Record<string, unknown>;
  const fields: (keyof StudentInput)[] = [
    "name",
    "registerNo",
    "email",
    "phone",
    "departmentId",
    "academicYear",
  ];
  const input = {} as StudentInput;

  for (const field of fields) {
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return { success: false, message: `${fieldLabel(field)} is required.` };
    }
    input[field] = (body[field] as string).trim();
  }

  if (input.name.length > 100) {
    return { success: false, message: "Name must be 100 characters or fewer." };
  }
  if (input.registerNo.length > 30) {
    return { success: false, message: "Register number must be 30 characters or fewer." };
  }
  if (input.phone.length > 25) {
    return { success: false, message: "Phone number must be 25 characters or fewer." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return { success: false, message: "Enter a valid email address." };
  }
  if (!academicYears.has(input.academicYear)) {
    return { success: false, message: "Choose an academic year from Year 1 to Year 4." };
  }

  return { success: true, data: input };
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function fieldLabel(field: keyof StudentInput): string {
  const labels: Record<keyof StudentInput, string> = {
    name: "Name",
    registerNo: "Register number",
    email: "Email",
    phone: "Phone",
    departmentId: "Department",
    academicYear: "Academic year",
  };
  return labels[field];
}
