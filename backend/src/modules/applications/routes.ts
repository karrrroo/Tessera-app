import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { asyncHandler } from "../../http/async-handler.js";
import { requireAuth } from "../../http/middleware/require-auth.js";
import { requireAdmin } from "../../http/middleware/require-admin.js";
import { requirePasswordChanged } from "../../http/middleware/require-password-changed.js";
import { requireUuidParam } from "../../http/middleware/require-uuid-param.js";
import { ApiError, sendApiError, VALIDATION_FAILED } from "../../http/errors.js";
import { filenameSegment } from "../../lib/transliterate.js";
import {
  applicationCreateSchema,
  applicationListQuerySchema,
  applicationRejectSchema,
} from "./validation.js";
import { clientIp } from "./rate-limit.js";
import * as service from "./service.js";

// ---------------------------------------------------------------------------
// PUBLIC. No requireAuth anywhere on this router, by design — B4: "Public, no
// token, no call requiring auth."
//
// It is also the only unauthenticated endpoint in the product that both writes
// to the database and accepts an upload, so every guard that exists is on the
// POST below: the open/closed gate, the school check, a two-key rate limit, a
// Content-Length pre-check, and byte-level content sniffing.
// ---------------------------------------------------------------------------
export const publicApplicationsRouter = Router();

const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_TRANSCRIPT_BYTES } });

// PDF or image (B4). Sniffed from the bytes, never taken from the filename or
// the client's Content-Type, so an .exe renamed .pdf fails here.
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

// Rejecting on Content-Length before multer starts streaming, for the same
// reason the credentials route does: aborting mid-stream on the fileSize limit
// leaves the socket in a state that yields a raw 500 instead of this route's
// own 413. The allowance covers multipart overhead (boundary, field headers).
const CONTENT_LENGTH_ALLOWANCE = 4096;

/** Whether the form is accepting submissions, and what it offers. Public. */
publicApplicationsRouter.get("/applications/status", (_req, res) => {
  res.json({ open: service.applicationsOpen() });
});

publicApplicationsRouter.post(
  "/applications",
  (req: Request, res: Response, next: NextFunction) => {
    // The closed check runs before the body is read at all: when applications
    // are closed there is no reason to accept 5MB from an anonymous caller.
    if (!service.applicationsOpen()) {
      sendApiError(res, new ApiError(403, "APPLICATIONS_CLOSED"));
      return;
    }
    const contentLength = Number(req.headers["content-length"]);
    if (Number.isFinite(contentLength) && contentLength > MAX_TRANSCRIPT_BYTES + CONTENT_LENGTH_ALLOWANCE) {
      sendApiError(res, new ApiError(413, "APPLICATION_FILE_TOO_LARGE", { details: { maxBytes: MAX_TRANSCRIPT_BYTES } }));
      return;
    }
    upload.single("transcript")(req, res, (err) => {
      if (err) {
        sendApiError(res, new ApiError(413, "APPLICATION_FILE_TOO_LARGE", { details: { maxBytes: MAX_TRANSCRIPT_BYTES } }));
        return;
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    // Validate the fields BEFORE inspecting the file: a submission with a bad
    // email should not depend on whether the attachment happened to be valid.
    const parsed = applicationCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      // Field paths only, never values — B6: nothing about an applicant goes
      // into an error payload.
      throw VALIDATION_FAILED({ fields: parsed.error.issues.map((i) => i.path.join(".")) });
    }

    let transcript: { buffer: Buffer; mime: string; ext: string; originalName: string } | null = null;
    if (req.file) {
      const detected = await fileTypeFromBuffer(req.file.buffer);
      if (!detected || !ALLOWED_MIME.includes(detected.mime)) {
        throw new ApiError(415, "APPLICATION_FILE_TYPE_INVALID", {
          details: { detected: detected?.mime ?? null, allowed: ALLOWED_MIME },
        });
      }
      transcript = {
        buffer: req.file.buffer,
        mime: detected.mime,
        ext: `.${detected.ext}`,
        originalName: req.file.originalname,
      };
    }

    const receipt = await service.submitApplication(parsed.data, transcript, {
      ip: clientIp(req.headers as Record<string, unknown>, req.socket.remoteAddress),
    });
    res.status(201).json(receipt);
  }),
);

// ---------------------------------------------------------------------------
// ADMIN. Mounted under /api/admin, and admin-only — B5.
// ---------------------------------------------------------------------------
export const adminApplicationsRouter = Router();

adminApplicationsRouter.use(requireAuth, asyncHandler(requirePasswordChanged), requireAdmin);

function actor(req: { auth?: { sub: string } }): string {
  if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
  return req.auth.sub;
}

function requireIdempotencyKey(req: Request): string {
  const key = req.header("idempotency-key");
  if (!key || !key.trim()) {
    throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED");
  }
  return key.trim();
}

adminApplicationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = applicationListQuerySchema.safeParse(req.query);
    if (!parsed.success) throw VALIDATION_FAILED();
    res.json(await service.listApplications(parsed.data.status));
  }),
);

/**
 * The transcript, streamed through the backend (C10 — no presigned URL ever
 * reaches a browser). The token in the path is short-lived and signed, and
 * this route is *still* admin-only: the signature bounds the link's lifetime,
 * it is not a substitute for a session.
 */
adminApplicationsRouter.get(
  "/transcript/:token",
  asyncHandler(async (req, res) => {
    const object = await service.readTranscript(req.params.token);
    const ext = EXT_FOR_MIME[object.meta.contentType] ?? "bin";
    const isImage = object.meta.contentType.startsWith("image/");
    // The applicant's own filename is transliterated for the ASCII fallback
    // and carried intact in filename*, same as the credentials attachment.
    const asciiBase = filenameSegment(object.meta.originalName.replace(/\.[^.]+$/, "")) || "transcript";
    res.setHeader("Content-Type", object.meta.contentType);
    // Never cached by a shared cache: this is a document about a child behind
    // an expiring link.
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader(
      "Content-Disposition",
      `${isImage ? "inline" : "attachment"}; filename="${asciiBase}.${ext}"; filename*=UTF-8''${encodeURIComponent(object.meta.originalName)}`,
    );
    object.stream.pipe(res);
  }),
);

// Declared AFTER /transcript/:token above, deliberately: Express matches in
// declaration order, so with "/:id" first a request for the transcript would
// match it and `requireUuidParam` would reject "transcript" with a 400.
adminApplicationsRouter.get(
  "/:id",
  requireUuidParam("id"),
  asyncHandler(async (req, res) => {
    res.json(await service.getApplication(req.params.id));
  }),
);

adminApplicationsRouter.post(
  "/:id/approve",
  requireUuidParam("id"),
  asyncHandler(async (req, res) => {
    const key = requireIdempotencyKey(req);
    res.json(await service.approveApplication(req.params.id, actor(req), key));
  }),
);

adminApplicationsRouter.post(
  "/:id/reject",
  requireUuidParam("id"),
  asyncHandler(async (req, res) => {
    const key = requireIdempotencyKey(req);
    const parsed = applicationRejectSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw VALIDATION_FAILED();
    res.json(await service.rejectApplication(req.params.id, actor(req), parsed.data.reason, key));
  }),
);

adminApplicationsRouter.delete(
  "/:id",
  requireUuidParam("id"),
  asyncHandler(async (req, res) => {
    res.json(await service.deleteApplication(req.params.id, actor(req)));
  }),
);

const EXT_FOR_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
