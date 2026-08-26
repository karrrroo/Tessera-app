import { Router } from "express";
import { asyncHandler } from "../../http/async-handler.js";
import { ApiError, VALIDATION_FAILED } from "../../http/errors.js";
import { requireAuth } from "../../http/middleware/require-auth.js";
import { requirePasswordChanged } from "../../http/middleware/require-password-changed.js";
import { exportLogsQuerySchema, exportQuerySchema } from "./validation.js";
import * as service from "./service.js";
import * as repo from "./repo.js";
import { writeExport } from "./writer.js";

export const exportRouter = Router();

exportRouter.use(requireAuth);
exportRouter.use(asyncHandler(requirePasswordChanged));

function auth(req: { auth?: { sub: string; role: "student" | "teacher" | "admin" } }) {
  if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
  return req.auth;
}

exportRouter.get(
  "/export",
  asyncHandler(async (req, res) => {
    const parsed = exportQuerySchema.safeParse(req.query);
    if (!parsed.success) throw VALIDATION_FAILED();
    const plan = await service.prepareExport(auth(req), parsed.data);
    const { markCount } = await writeExport(plan, res);
    await repo.insertExportLog({
      institutionId: plan.institutionId,
      actorUserId: auth(req).sub,
      scope: { scope: plan.scope, classId: parsed.data.classId, subjectId: parsed.data.subjectId, termId: plan.termId },
      format: plan.format,
      markCount,
    });
  }),
);

exportRouter.get(
  "/export/logs",
  asyncHandler(async (req, res) => {
    const parsed = exportLogsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw VALIDATION_FAILED();
    res.json(await service.getExportLogs(auth(req), parsed.data.limit));
  }),
);
