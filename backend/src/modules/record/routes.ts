import { Router } from "express";
import { asyncHandler } from "../../http/async-handler.js";
import { ApiError, VALIDATION_FAILED } from "../../http/errors.js";
import { requireAuth } from "../../http/middleware/require-auth.js";
import { requirePasswordChanged } from "../../http/middleware/require-password-changed.js";
import { recordQuerySchema } from "./validation.js";
import { getArchive, getMarkHistory, getRecord, getSubjectDetail } from "./service.js";

export const recordRouter = Router();

recordRouter.use(requireAuth);
recordRouter.use(asyncHandler(requirePasswordChanged));

recordRouter.get(
  "/record",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
    const parsed = recordQuerySchema.safeParse(req.query);
    if (!parsed.success) throw VALIDATION_FAILED();
    res.json(await getRecord(req.auth, parsed.data.termId));
  }),
);

recordRouter.get(
  "/subjects/:subjectId",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
    const parsed = recordQuerySchema.safeParse(req.query);
    if (!parsed.success) throw VALIDATION_FAILED();
    res.json(await getSubjectDetail(req.auth, req.params.subjectId, parsed.data.termId));
  }),
);

recordRouter.get(
  "/archive",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
    res.json(await getArchive(req.auth));
  }),
);

recordRouter.get(
  "/marks/:markId/history",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
    res.json(await getMarkHistory(req.auth, req.params.markId));
  }),
);
