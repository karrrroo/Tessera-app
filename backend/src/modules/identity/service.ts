import { timingSafeEqual } from "node:crypto";
import { ApiError, FORBIDDEN, NOT_FOUND } from "../../http/errors.js";
import { buildPayload, deriveMac, deriveTesseraId, parsePayload } from "./crypto.js";
import { lookupHandle } from "./handle-map.js";
import {
  findAnomalies,
  findAnomalyPeer,
  findScanTargetByStudentId,
  findStudentIdentity,
  findTeacherIdentity,
  findTodayAssessmentsForTeacher,
  findQrCredentialById,
  getOrCreateQrCredential,
  insertScanEvent,
} from "./repo.js";

type AuthClaims = { sub: string; role: "student" | "teacher" | "admin" };

const CREDENTIAL_MISSING = () => new ApiError(404, "CREDENTIAL_MISSING");
const CREDENTIAL_REVOKED = () => new ApiError(409, "CREDENTIAL_REVOKED");
const SCAN_PAYLOAD_MALFORMED = () => new ApiError(400, "SCAN_PAYLOAD_MALFORMED");

export async function getMyCredential(auth: AuthClaims) {
  if (auth.role === "student") {
    const identity = await findStudentIdentity(auth.sub);
    if (!identity) throw NOT_FOUND();
    const credential = await getOrCreateQrCredential(identity.studentId);
    if (credential.revokedAt) throw CREDENTIAL_REVOKED();

    return {
      credentialId: credential.id,
      payload: buildPayload(credential.seed),
      issuedAt: credential.issuedAt,
      holder: {
        role: "student" as const,
        firstName: identity.firstName,
        lastName: identity.lastName,
        institutionName: identity.institutionName,
        classLabel: identity.classLabel,
        tesseraId: deriveTesseraId(identity.studentId),
      },
    };
  }

  if (auth.role === "teacher") {
    const identity = await findTeacherIdentity(auth.sub);
    if (!identity) throw NOT_FOUND();

    // No `qr_credential` row exists for teachers at all (the table's FK is
    // student-only, and C2 forbids adding a teacher one) — the card
    // displays, but there is nothing to scan and no payload to return.
    return {
      credentialId: null,
      payload: null,
      issuedAt: null,
      holder: {
        role: "teacher" as const,
        firstName: identity.firstName,
        lastName: identity.lastName,
        institutionName: identity.institutionName,
        classLabels: identity.classLabels,
        subjects: identity.subjects,
      },
    };
  }

  throw FORBIDDEN();
}

export async function getMyToday(auth: AuthClaims) {
  if (auth.role !== "teacher") throw FORBIDDEN();
  const identity = await findTeacherIdentity(auth.sub);
  if (!identity) throw NOT_FOUND();

  const rows = await findTodayAssessmentsForTeacher(identity.teacherId);
  return rows.map((r) => ({
    assessmentId: r.assessmentId,
    kind: r.kind,
    classLabel: `${r.grade}-${r.letter}`,
    subjectNameHy: r.subjectNameHy,
    subjectNameEn: r.subjectNameEn,
    subjectNameRu: r.subjectNameRu,
  }));
}

export type VerifyResult = {
  result: "valid" | "revoked" | "unknown" | "signature_invalid" | "not_enrolled";
  student?: {
    firstName: string;
    lastName: string;
    classLabel: string | null;
    institutionName: string;
    enrollmentStatus: string | null;
  };
  anomaly?: { flagged: boolean; reason?: "MULTI_LOCATION_WINDOW"; previousScannerId?: string; secondsAgo?: number };
};

export async function verifyScan(input: { payload: string; scannerId: string; location?: string }): Promise<VerifyResult> {
  const parsed = parsePayload(input.payload);
  if (!parsed) throw SCAN_PAYLOAD_MALFORMED();

  const expectedMac = deriveMac(parsed.handle);
  const macValid = expectedMac.length === parsed.mac.length && timingSafeEqual(expectedMac, parsed.mac);

  const entry = lookupHandle(parsed.handle);

  if (!macValid) {
    // A tampered/garbled payload whose handle half still happens to resolve
    // is exactly ID-9's "stolen or reused code" case, and is logged against
    // the real credential it points at. One that doesn't resolve at all
    // (e.g. a non-Tessera QR code scanned by mistake) has no row to log
    // against — scan_event.qr_credential_id is NOT NULL and C2 forbids
    // relaxing it, so that sliver of "signature_invalid" is answered but
    // not persisted (see docs/decisions.md).
    if (entry) await logScan(entry.credentialId, input, "signature_invalid");
    return { result: "signature_invalid" };
  }

  if (!entry) {
    // Mac verifies (so it was minted with our own key at some point) but
    // isn't in the live map — same NOT NULL constraint, same gap, and just
    // as rare in practice: nothing in this app's lifecycle currently
    // removes a qr_credential row outside of deleting the student outright.
    return { result: "unknown" };
  }

  const credential = await findQrCredentialById(entry.credentialId);
  if (!credential) return { result: "unknown" };

  if (credential.revokedAt) {
    const scan = await logScan(credential.id, input, "revoked");
    return { result: "revoked", anomaly: await checkAnomaly(credential.id, input.scannerId, scan.id) };
  }

  const target = await findScanTargetByStudentId(credential.studentId);
  const enrollmentStatus = target?.status ?? null;
  const classLabel = target && target.grade != null && target.letter != null ? `${target.grade}-${target.letter}` : null;

  const resultCode = enrollmentStatus === "active" ? "valid" : "not_enrolled";
  const scan = await logScan(credential.id, input, resultCode);

  return {
    result: resultCode,
    student: {
      firstName: target?.firstName ?? "",
      lastName: target?.lastName ?? "",
      classLabel,
      institutionName: target?.institutionName ?? "",
      enrollmentStatus,
    },
    anomaly: await checkAnomaly(credential.id, input.scannerId, scan.id),
  };
}

async function logScan(qrCredentialId: string, input: { scannerId: string; location?: string }, result: string) {
  return insertScanEvent({ qrCredentialId, scannerId: input.scannerId, result, location: input.location });
}

async function checkAnomaly(qrCredentialId: string, scannerId: string, scanEventId: string) {
  const peer = await findAnomalyPeer(qrCredentialId, scannerId, scanEventId);
  if (!peer) return { flagged: false };
  return {
    flagged: true,
    reason: "MULTI_LOCATION_WINDOW" as const,
    previousScannerId: peer.scanner_id,
    secondsAgo: peer.seconds_ago,
  };
}

export async function getAnomalies(since?: string) {
  const rows = await findAnomalies(since);
  return rows.map((r) => ({
    scanEventId: r.scan_event_id,
    scannedAt: r.scanned_at,
    scannerId: r.scanner_id,
    location: r.location,
    result: r.result,
    previousScannerId: r.previous_scanner_id,
    previousScannedAt: r.previous_scanned_at,
    secondsAgo: r.seconds_ago,
    studentFirstName: r.student_first_name,
    studentLastName: r.student_last_name,
    classLabel: r.class_label,
  }));
}
