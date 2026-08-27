import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { asyncHandler } from "../../http/async-handler.js";
import { requireAuth } from "../../http/middleware/require-auth.js";
import { requirePasswordChanged } from "../../http/middleware/require-password-changed.js";
import { requireUuidParam } from "../../http/middleware/require-uuid-param.js";
import { ApiError, sendApiError, VALIDATION_FAILED } from "../../http/errors.js";
import { filenameSegment } from "../../lib/transliterate.js";
import { credentialCreateSchema, credentialDecisionSchema, credentialListQuerySchema } from "./validation.js";
import * as service from "./service.js";

export const credentialsRouter = Router();

credentialsRouter.use(requireAuth);
credentialsRouter.use(asyncHandler(requirePasswordChanged));

function auth(req: { auth?: { sub: string; role: "student" | "teacher" | "admin" } }) {
  if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
  return req.auth;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

// CR-2 (S-6): content-inspected, not extension-trusted — a renamed
// executable or a PDF with appended bytes fails here regardless of what
// the client called it or claimed as Content-Type.
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];

credentialsRouter.get(
  "/credentials",
  asyncHandler(async (req, res) => {
    const parsed = credentialListQuerySchema.safeParse(req.query);
    if (!parsed.success) throw VALIDATION_FAILED();
    res.json(await service.listCredentials(auth(req), parsed.data));
  }),
);

// Rejecting on Content-Length before multer ever starts streaming avoids a
// real crash: letting the body arrive and having multer/busboy abort
// mid-stream once the fileSize limit is hit leaves the still-uploading
// socket in a state that produces a raw, unhandled 500 instead of this
// route's own 413 — reproduced directly with a real 11MB upload. A
// multipart body's overhead (boundary, field headers) is only a few
// hundred bytes, so a generous fixed allowance here still catches every
// real oversized file while never false-rejecting one at the true limit.
const CONTENT_LENGTH_ALLOWANCE = 2048;

credentialsRouter.post(
  "/credentials",
  (req: Request, res: Response, next: NextFunction) => {
    const contentLength = Number(req.headers["content-length"]);
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES + CONTENT_LENGTH_ALLOWANCE) {
      sendApiError(res, new ApiError(413, "CREDENTIAL_FILE_TOO_LARGE", { details: { maxBytes: MAX_UPLOAD_BYTES } }));
      return;
    }
    upload.single("file")(req, res, (err) => {
      if (err) {
        sendApiError(res, new ApiError(413, "CREDENTIAL_FILE_TOO_LARGE", { details: { maxBytes: MAX_UPLOAD_BYTES } }));
        return;
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(422, "CREDENTIAL_FILE_REQUIRED");

    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (!detected || !ALLOWED_MIME.includes(detected.mime)) {
      throw new ApiError(415, "CREDENTIAL_FILE_TYPE_INVALID", { details: { detected: detected?.mime ?? null, allowed: ALLOWED_MIME } });
    }

    const parsed = credentialCreateSchema.safeParse(req.body);
    if (!parsed.success) throw VALIDATION_FAILED();

    const row = await service.submitCredential(auth(req), parsed.data, {
      buffer: req.file.buffer,
      mime: detected.mime,
      ext: `.${detected.ext}`,
      originalName: req.file.originalname,
    });
    res.status(201).json(row);
  }),
);

const EXT_FOR_MIME: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

credentialsRouter.get(
  "/credentials/:id/attachment",
  requireUuidParam("id"),
  asyncHandler(async (req, res) => {
    const object = await service.getAttachment(auth(req), req.params.id);
    const isImage = object.meta.contentType.startsWith("image/");
    // filenameSegment() strips anything outside [A-Za-z0-9-], including the
    // dot before an extension — transliterating the whole original name
    // (export.ts's own pattern, see writer.ts) loses the extension entirely
    // (`test-cred.pdf` -> `test-credpdf`, unopenable by an old client with
    // no filename* support). The real extension is appended back on,
    // derived from the sniffed content type rather than trusting whatever
    // the original upload's own filename claimed.
    const ext = EXT_FOR_MIME[object.meta.contentType] ?? "bin";
    const asciiBase = filenameSegment(object.meta.originalName.replace(/\.[^.]+$/, "")) || "attachment";
    res.setHeader("Content-Type", object.meta.contentType);
    res.setHeader(
      "Content-Disposition",
      `${isImage ? "inline" : "attachment"}; filename="${asciiBase}.${ext}"; filename*=UTF-8''${encodeURIComponent(object.meta.originalName)}`,
    );
    object.stream.pipe(res);
  }),
);

credentialsRouter.post(
  "/credentials/:id/decision",
  requireUuidParam("id"),
  asyncHandler(async (req, res) => {
    const parsed = credentialDecisionSchema.safeParse(req.body);
    if (!parsed.success) throw VALIDATION_FAILED();
    const idempotencyKey = req.header("idempotency-key") || undefined;
    res.json(await service.decideCredential(auth(req), req.params.id, parsed.data, idempotencyKey));
  }),
);
