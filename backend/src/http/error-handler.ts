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
    sendApiError(res, new ApiError(mapped.status, mapped.code));
    return;
  }
  console.error(err);
  sendApiError(res, new ApiError(500, "INTERNAL"));
};
