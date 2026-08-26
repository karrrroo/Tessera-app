import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { asyncHandler } from "../../http/async-handler.js";
import { requireAuth } from "../../http/middleware/require-auth.js";
import { requireAdmin } from "../../http/middleware/require-admin.js";
import { requirePasswordChanged } from "../../http/middleware/require-password-changed.js";
import { ApiError, sendApiError, VALIDATION_FAILED } from "../../http/errors.js";
import * as service from "./service.js";
import * as repo from "./repo.js";
import {
  institutionPatchSchema,
  academicYearCreateSchema,
  academicYearPatchSchema,
  termCreateSchema,
  termPatchSchema,
  subjectCreateSchema,
  subjectPatchSchema,
  classCreateSchema,
  classGenerateSchema,
  enrollmentPatchSchema,
  studentCreateSchema,
  assignmentCreateSchema,
  importTemplateQuerySchema,
  importUploadQuerySchema,
  importRowPatchSchema,
} from "./validation.js";

export const adminRouter = Router();

const guarded = [requireAuth, asyncHandler(requirePasswordChanged), requireAdmin];
adminRouter.use(...guarded);

// Resolves the sole institution row once per request (docs/decisions.md —
// there is no admin->institution link in the schema).
adminRouter.use(
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    req.institutionId = await repo.resolveActorInstitutionId();
    next();
  }),
);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      institutionId?: string;
    }
  }
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

function parseOr422<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { path: (string | number)[] }[] } } }, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw VALIDATION_FAILED({ issues: parsed.error?.issues.map((i) => i.path.join(".")) });
  }
  return parsed.data as T;
}

// --- Institution ---

adminRouter.get(
  "/institution",
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.getInstitution(req.institutionId!));
  }),
);

adminRouter.patch(
  "/institution",
  asyncHandler(async (req: Request, res: Response) => {
    const patch = parseOr422(institutionPatchSchema, req.body);
    res.json(await service.updateInstitution(req.institutionId!, patch));
  }),
);

// --- Academic years ---

adminRouter.get(
  "/academic-years",
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.listAcademicYears(req.institutionId!));
  }),
);

adminRouter.post(
  "/academic-years",
  asyncHandler(async (req: Request, res: Response) => {
    const data = parseOr422(academicYearCreateSchema, req.body);
    const row = await service.createAcademicYear(req.institutionId!, data);
    res.status(201).json(row);
  }),
);

adminRouter.patch(
  "/academic-years/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const patch = parseOr422(academicYearPatchSchema, req.body);
    res.json(await service.updateAcademicYear(req.params.id, req.institutionId!, patch));
  }),
);

// --- Terms ---

adminRouter.get(
  "/terms",
  asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId;
    if (typeof academicYearId !== "string") throw VALIDATION_FAILED({ field: "academicYearId" });
    res.json(await service.listTerms(academicYearId, req.institutionId!));
  }),
);

adminRouter.post(
  "/terms",
  asyncHandler(async (req: Request, res: Response) => {
    const data = parseOr422(termCreateSchema, req.body);
    const row = await service.createTerm(req.institutionId!, data);
    res.status(201).json(row);
  }),
);

adminRouter.patch(
  "/terms/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const patch = parseOr422(termPatchSchema, req.body);
    res.json(await service.updateTerm(req.params.id, req.institutionId!, patch));
  }),
);

adminRouter.delete(
  "/terms/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await service.deleteTerm(req.params.id, req.institutionId!);
    res.status(204).end();
  }),
);

// --- Subjects ---

adminRouter.get(
  "/subjects",
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.listSubjects(req.institutionId!));
  }),
);

adminRouter.post(
  "/subjects",
  asyncHandler(async (req: Request, res: Response) => {
    const data = parseOr422(subjectCreateSchema, req.body);
    const row = await service.createSubject(req.institutionId!, data);
    res.status(201).json(row);
  }),
);

adminRouter.patch(
  "/subjects/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const patch = parseOr422(subjectPatchSchema, req.body);
    res.json(await service.updateSubject(req.params.id, req.institutionId!, patch));
  }),
);

adminRouter.delete(
  "/subjects/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await service.deleteSubject(req.params.id, req.institutionId!);
    res.status(204).end();
  }),
);

// --- Classes + generator ---

adminRouter.get(
  "/classes",
  asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = typeof req.query.academicYearId === "string" ? req.query.academicYearId : undefined;
    res.json(await service.listClasses(req.institutionId!, academicYearId));
  }),
);

adminRouter.post(
  "/classes",
  asyncHandler(async (req: Request, res: Response) => {
    const data = parseOr422(classCreateSchema, req.body);
    const row = await service.createClass(req.institutionId!, data);
    res.status(201).json(row);
  }),
);

adminRouter.post(
  "/classes/generate",
  asyncHandler(async (req: Request, res: Response) => {
    const data = parseOr422(classGenerateSchema, req.body);
    const result = await service.generateClasses(req.institutionId!, data);
    res.status(201).json(result);
  }),
);

adminRouter.post(
  "/classes/:id/credentials",
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.reissueClassCredentials(req.params.id, req.institutionId!);
    res.json(result);
  }),
);

// --- Roster ---

adminRouter.get(
  "/roster",
  asyncHandler(async (req: Request, res: Response) => {
    const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json(await service.listRoster(req.institutionId!, { classId, status }));
  }),
);

adminRouter.post(
  "/students",
  asyncHandler(async (req: Request, res: Response) => {
    const data = parseOr422(studentCreateSchema, req.body);
    const row = await service.addMidYearStudent(req.institutionId!, data);
    res.status(201).json(row);
  }),
);

adminRouter.patch(
  "/enrollments/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const patch = parseOr422(enrollmentPatchSchema, req.body);
    const row = await service.transitionEnrollment(req.params.id, req.auth!.sub, patch);
    res.json(row);
  }),
);

// --- Assignments ---

adminRouter.get(
  "/teachers",
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.listTeachers(req.institutionId!));
  }),
);

adminRouter.get(
  "/assignments",
  asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId;
    if (typeof academicYearId !== "string") throw VALIDATION_FAILED({ field: "academicYearId" });
    res.json(await service.listAssignments(req.institutionId!, academicYearId));
  }),
);

adminRouter.post(
  "/assignments",
  asyncHandler(async (req: Request, res: Response) => {
    const data = parseOr422(assignmentCreateSchema, req.body);
    const row = await service.createAssignment(data);
    res.status(201).json(row);
  }),
);

adminRouter.delete(
  "/assignments/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await service.deleteAssignment(req.params.id);
    res.status(204).end();
  }),
);

// --- Import ---

adminRouter.get(
  "/import/template",
  asyncHandler(async (req: Request, res: Response) => {
    const { kind } = parseOr422(importTemplateQuerySchema, req.query);
    const buffer = await service.getImportTemplate(kind);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${kind}-template.xlsx"`);
    res.send(buffer);
  }),
);

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

adminRouter.post(
  "/import",
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        sendApiError(res, new ApiError(413, "PAYLOAD_TOO_LARGE"));
        return;
      }
      next();
    });
  },
  asyncHandler(async (req: Request, res: Response) => {
    const { kind } = parseOr422(importUploadQuerySchema, req.query);
    if (!req.file) throw new ApiError(400, "IMPORT_FILE_UNREADABLE");
    const academicYearId = req.body.academicYearId;
    if (typeof academicYearId !== "string") throw VALIDATION_FAILED({ field: "academicYearId" });

    // Content-inspected, not extension-trusted (S-6) — a renamed .exe fails
    // here regardless of what the client called it.
    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (!detected || detected.mime !== XLSX_MIME) {
      throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE");
    }

    const result = await service.previewImport(
      req.institutionId!,
      req.auth!.sub,
      academicYearId,
      kind,
      req.file.originalname,
      req.file.buffer,
    );
    res.status(201).json(result);
  }),
);

adminRouter.get(
  "/import/:batchId",
  asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId;
    if (typeof academicYearId !== "string") throw VALIDATION_FAILED({ field: "academicYearId" });
    res.json(await service.getImportBatch(req.params.batchId, req.institutionId!, academicYearId));
  }),
);

adminRouter.patch(
  "/import/:batchId/rows/:rowIndex",
  asyncHandler(async (req: Request, res: Response) => {
    const { raw } = parseOr422(importRowPatchSchema, req.body);
    const academicYearId = req.body.academicYearId;
    if (typeof academicYearId !== "string") throw VALIDATION_FAILED({ field: "academicYearId" });
    const rowIndex = Number(req.params.rowIndex);
    const result = await service.patchImportRow(req.params.batchId, rowIndex, req.institutionId!, academicYearId, raw);
    res.json(result);
  }),
);

adminRouter.post(
  "/import/:batchId/apply",
  asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.body.academicYearId;
    if (typeof academicYearId !== "string") throw VALIDATION_FAILED({ field: "academicYearId" });
    const result = await service.applyImport(req.params.batchId, req.institutionId!, academicYearId);
    res.json(result);
  }),
);

adminRouter.post(
  "/import/:batchId/discard",
  asyncHandler(async (req: Request, res: Response) => {
    await service.discardImport(req.params.batchId, req.institutionId!);
    res.status(204).end();
  }),
);
