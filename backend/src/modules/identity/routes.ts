import { Router } from "express";
import { asyncHandler } from "../../http/async-handler.js";
import { ApiError, VALIDATION_FAILED } from "../../http/errors.js";
import { requireAuth } from "../../http/middleware/require-auth.js";
import { requireAdmin } from "../../http/middleware/require-admin.js";
import { requireScannerKey } from "../../http/middleware/require-scanner-key.js";
import { anomaliesQuerySchema, verifySchema } from "./validation.js";
import { getAnomalies, getMyCredential, getMyToday, verifyScan } from "./service.js";

export const identityRouter = Router();

identityRouter.get(
  "/me/credential",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
    res.json(await getMyCredential(req.auth));
  }),
);

identityRouter.get(
  "/me/today",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
    res.json(await getMyToday(req.auth));
  }),
);

identityRouter.post(
  "/verify",
  requireScannerKey,
  asyncHandler(async (req, res) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) throw VALIDATION_FAILED();
    res.json(await verifyScan(parsed.data));
  }),
);

identityRouter.get(
  "/verify/anomalies",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = anomaliesQuerySchema.safeParse(req.query);
    if (!parsed.success) throw VALIDATION_FAILED();
    res.json(await getAnomalies(parsed.data.since));
  }),
);
