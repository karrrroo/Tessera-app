import type { ErrorRequestHandler } from "express";
import { ApiError, sendApiError } from "./errors.js";
import { isPgError, mapPgError } from "../db/pg-errors.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    sendApiError(res, err);
    return;
  }
  if (isPgError(err)) {
    const mapped = mapPgError(err);
    // A generic INTERNAL from this branch means a real Postgres error hit
    // no named-constraint or SQLSTATE mapping in pg-errors.ts — worth
    // logging same as the unmapped-exception branch below, since it was
    // otherwise silently unloggable (found while diagnosing a genuine
    // missing-collation error against Neon).
    if (mapped.code === "INTERNAL") console.error(err);
    sendApiError(res, new ApiError(mapped.status, mapped.code));
    return;
  }
  console.error(err);
  sendApiError(res, new ApiError(500, "INTERNAL"));
};
