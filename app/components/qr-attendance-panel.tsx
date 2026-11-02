"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { Icon } from "@/app/components/icons";

type AttendanceStudent = {
  id: string;
  name: string;
  registerNo: string;
  status: "PRESENT" | "ABSENT" | null;
};
type ClassRecord = { id: string; name: string; academicYear: string; section: string };
type Props = {
  date: string;
  students: AttendanceStudent[];
  onAttendanceMarked: (student: Pick<AttendanceStudent, "id" | "name">) => void;
};

function errorMessage(result: unknown, fallback: string): string {
  return result && typeof result === "object" && "error" in result && typeof result.error === "string"
    ? result.error
    : fallback;
}

export default function QrAttendancePanel({ date, students, onAttendanceMarked }: Props) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [classId, setClassId] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualStudentId, setManualStudentId] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cameraStartRef = useRef<Promise<null> | null>(null);
  const mountedRef = useRef(true);
  const scanBusyRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetch("/api/classes")
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) throw new Error(errorMessage(result, "Could not load classes."));
        return result as ClassRecord[];
      })
      .then((result) => {
        if (active) setClasses(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load classes.");
      })
      .finally(() => {
        if (active) setLoadingClasses(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const scanner = scannerRef.current;
      const cameraStart = cameraStartRef.current;
      scannerRef.current = null;
      if (scanner) {
        void (async () => {
          if (cameraStart) {
            try {
              await cameraStart;
            } catch {
              // startCamera reports startup failures while the component is mounted.
            }
          }
          if (scanner.isScanning) await scanner.stop();
          scanner.clear();
        })().catch((caught: unknown) => {
          console.error("Could not stop QR attendance camera:", caught);
        });
      }
    };
  }, []);

  const filteredStudents = students.filter((student) =>
    `${student.name} ${student.registerNo}`.toLowerCase().includes(manualSearch.trim().toLowerCase()),
  );

  async function submitAttendance(input: { qrToken?: string; studentId?: string }) {
    if (!date || !classId) {
      setError("Select an attendance date and class before scanning or marking a student.");
      return;
    }
    setError("");
    setMessage("");
    const response = await fetch("/api/attendance/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, date, classId }),
    });
    const result: unknown = await response.json();
    if (!response.ok) throw new Error(errorMessage(result, "Could not mark attendance."));
    if (
      !result ||
      typeof result !== "object" ||
      !("student" in result) ||
      typeof result.student !== "object" ||
      result.student === null ||
      !("id" in result.student) ||
      typeof result.student.id !== "string" ||
      !("name" in result.student) ||
      typeof result.student.name !== "string"
    ) {
      throw new Error("Attendance was saved, but the student details could not be refreshed.");
    }
    const student = { id: result.student.id, name: result.student.name };
    onAttendanceMarked(student);
    setMessage(`${student.name} marked Present for ${date}.`);
  }

  async function startCamera() {
    if (!date || !classId) {
      setError("Select an attendance date and class before starting the scanner.");
      return;
    }
    setError("");
    setMessage("");
    setCameraStarting(true);
    let scanner: Html5Qrcode | null = null;
    let cameraStart: Promise<null> | null = null;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mountedRef.current) return;
      scanner = new Html5Qrcode("qr-attendance-reader", false);
      scannerRef.current = scanner;
      cameraStart = scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (scanBusyRef.current) return;
          scanBusyRef.current = true;
          void submitAttendance({ qrToken: decodedText })
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not mark attendance."))
            .finally(() => { scanBusyRef.current = false; });
        },
        () => {},
      );
      cameraStartRef.current = cameraStart;
      await cameraStart;
      if (scannerRef.current !== scanner) {
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
        return;
      }
      setCameraActive(true);
    } catch (caught) {
      if (scanner && scannerRef.current === scanner) {
        scannerRef.current = null;
        try {
          if (scanner.isScanning) await scanner.stop();
        } catch (stopError) {
          console.error("Could not clean up QR camera after start failure:", stopError);
        } finally {
          scanner.clear();
        }
        setCameraActive(false);
        setError(caught instanceof Error
          ? `Could not start the camera. Check browser permission and camera availability. ${caught.message}`
          : "Could not start the camera. Check browser permission and camera availability.");
      } else if (!scanner && mountedRef.current) {
        setError(caught instanceof Error
          ? `Could not start the camera. Check browser permission and camera availability. ${caught.message}`
          : "Could not start the camera. Check browser permission and camera availability.");
      }
    } finally {
      if (cameraStart && cameraStartRef.current === cameraStart) cameraStartRef.current = null;
      if (mountedRef.current && (!scanner || scannerRef.current === scanner)) setCameraStarting(false);
    }
  }

  async function stopCamera() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) {
      setCameraActive(false);
      return;
    }
    try {
      await scanner.stop();
      scanner.clear();
      setCameraActive(false);
    } catch (caught) {
      console.error("Could not stop QR attendance camera:", caught);
      setError("The camera could not be stopped cleanly. Close this page to release the camera.");
    }
  }

  async function markManualStudent() {
    if (!manualStudentId) {
      setError("Choose a student for manual attendance lookup.");
      return;
    }
    setSavingManual(true);
    try {
      await submitAttendance({ studentId: manualStudentId });
      setManualStudentId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not mark attendance.");
    } finally {
      setSavingManual(false);
    }
  }

  return (
    <section className="panel qr-attendance-panel" aria-labelledby="qr-attendance-heading">
      <div className="panel-header">
        <div><h2 id="qr-attendance-heading">QR attendance scanner</h2><p>Scan a student’s QR code or use manual student lookup.</p></div>
        <span className="calendar-chip"><Icon name="qr" size={18} /></span>
      </div>
      <div className="qr-class-context">
        <label className="form-field">
          <span>Class for this attendance session <b>*</b></span>
          <select value={classId} onChange={(event) => { setClassId(event.target.value); setError(""); setMessage(""); }}>
            <option value="">{loadingClasses ? "Loading classes…" : "Select class"}</option>
            {classes.map((classRecord) => (
              <option key={classRecord.id} value={classRecord.id}>
                {classRecord.name} · {classRecord.section} · {classRecord.academicYear}
              </option>
            ))}
          </select>
        </label>
        <p>Student records do not currently store class membership, so the selected class is session context and cannot be checked against an individual student.</p>
      </div>

      <div className="qr-scanner-grid">
        <div className="qr-camera-column">
          <div className="qr-camera-viewport">
            <div id="qr-attendance-reader" aria-label="QR camera preview" />
            {!cameraActive && !cameraStarting && (
              <div className="qr-camera-placeholder">
                <span className="empty-icon"><Icon name="qr" size={22} /></span>
                <strong>Camera is off</strong>
                <span>Camera permission is requested only after you start scanning.</span>
              </div>
            )}
            {cameraStarting && <div className="qr-camera-placeholder"><span className="spinner" /><strong>Starting camera…</strong></div>}
          </div>
          <button className={`button ${cameraActive ? "button-outline" : "button-primary"} qr-camera-button`} onClick={() => void (cameraActive ? stopCamera() : startCamera())} disabled={loadingClasses || cameraStarting || !classes.length || !date}>
            <Icon name={cameraActive ? "close" : "qr"} size={17} />{cameraStarting ? "Requesting camera…" : cameraActive ? "Stop scanner" : "Start camera scanner"}
          </button>
        </div>

        <div className="qr-manual-column">
          <div className="qr-manual-heading"><strong>Manual student lookup</strong><span>Use this if camera access is unavailable.</span></div>
          <label className="form-field">
            <span>Find student</span>
            <input value={manualSearch} onChange={(event) => { setManualSearch(event.target.value); setManualStudentId(""); }} placeholder="Search name or register number" />
          </label>
          <label className="form-field">
            <span>Select student</span>
            <select value={manualStudentId} onChange={(event) => setManualStudentId(event.target.value)}>
              <option value="">Choose student</option>
              {filteredStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} · {student.registerNo}{student.status ? ` · ${student.status}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-light" onClick={() => void markManualStudent()} disabled={savingManual || !manualStudentId || !classId || !date}>
            {savingManual ? <><span className="button-spinner" /> Marking…</> : <><Icon name="check" size={16} /> Mark Present</>}
          </button>
          <div className="qr-identity-note">A QR code is a bearer code only; scanning it does not verify the identity of the person holding it.</div>
        </div>
      </div>

      {message && <div className="qr-scan-success" role="status"><Icon name="check" size={16} />{message}</div>}
      {error && <div className="alert alert-error qr-scan-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    </section>
  );
}
