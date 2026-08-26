import { Router } from "express";
import { asyncHandler } from "../../http/async-handler.js";
import { ApiError, VALIDATION_FAILED } from "../../http/errors.js";
import { requireAuth } from "../../http/middleware/require-auth.js";
import {
  createAssessmentSchema,
  gradebookQuerySchema,
  patchAssessmentSchema,
  publishSchema,
  putMarksSchema,
  supersedeSchema,
} from "./validation.js";
import * as service from "./service.js";

export const gradebookRouter = Router();

gradebookRouter.use(requireAuth);

function auth(req: { auth?: { sub: string; role: "student" | "teacher" | "admin" } }) {
  if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
  return req.auth;
}

gradebookRouter.get(
  "/teacher/classes",
  asyncHandler(async (req, res) => {
    res.json(await service.getTeacherClasses(auth(req)));
  }),
);

gradebookRouter.get(
  "/gradebook",
  asyncHandler(async (req, res) => {
    const parsed = gradebookQuerySchema.safeParse(req.query);
    if (!parsed.success) throw VALIDATION_FAILED();
    res.json(await service.getGradebook(auth(req), parsed.data.classId, parsed.data.subjectId, parsed.data.termId));
  }),
);

gradebookRouter.post(
  "/assessments",
  asyncHandler(async (req, res) => {
    const parsed = createAssessmentSchema.safeParse(req.body);
    if (!parsed.success) throw VALIDATION_FAILED();
    res.status(201).json(await service.createAssessment(auth(req), parsed.data));
  }),
);

gradebookRouter.patch(
  "/assessments/:id",
  asyncHandler(async (req, res) => {
    const parsed = patchAssessmentSchema.safeParse(req.body);
    if (!parsed.success) throw VALIDATION_FAILED();
    res.json(await service.patchAssessment(auth(req), req.params.id, parsed.data));
  }),
);

gradebookRouter.delete(
  "/assessments/:id",
  asyncHandler(async (req, res) => {
    await service.deleteAssessment(auth(req), req.params.id);
    res.status(204).end();
  }),
);

gradebookRouter.put(
  "/marks",
  asyncHandler(async (req, res) => {
    const parsed = putMarksSchema.safeParse(req.body);
    if (!parsed.success) throw VALIDATION_FAILED();
    res.json(await service.putMarks(auth(req), parsed.data));
  }),
);

gradebookRouter.delete(
  "/marks/:id",
  asyncHandler(async (req, res) => {
    await service.deleteMark(auth(req), req.params.id);
    res.status(204).end();
  }),
);

gradebookRouter.post(
  "/marks/publish",
  asyncHandler(async (req, res) => {
    const parsed = publishSchema.safeParse(req.body);
    if (!parsed.success) throw VALIDATION_FAILED();
    const idempotencyKey = req.header("idempotency-key") || undefined;
    res.json(await service.publishMarks(auth(req), parsed.data, idempotencyKey));
  }),
);

gradebookRouter.post(
  "/marks/:id/supersede",
  asyncHandler(async (req, res) => {
    const parsed = supersedeSchema.safeParse(req.body);
    if (!parsed.success) throw VALIDATION_FAILED();
    res.status(201).json(await service.supersedeMark(auth(req), req.params.id, parsed.data));
  }),
);

gradebookRouter.get(
  "/marks/:id/history",
  asyncHandler(async (req, res) => {
    res.json(await service.getMarkHistory(auth(req), req.params.id));
  }),
);
