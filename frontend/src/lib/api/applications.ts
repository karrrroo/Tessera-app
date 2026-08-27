// The public admissions endpoint (group B4).
//
// Deliberately NOT built on apiJson/apiFetch. Those attach the access token
// and, on a 401, run the shared refresh dance — behaviour that is exactly
// wrong here: B4 requires "no token, no call requiring auth", and an
// applicant has no session to refresh. A refresh attempt triggered from this
// page would also fire notifyAuthFailure and could bounce a visitor who is
// merely filling in a form. So this is plain fetch, with no credentials.

export type ApplicationReceipt = { id: string; submittedAt: string };

export class ApplicationError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export type ApplicationFields = {
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  phone?: string;
  schoolChoice: string;
  streamChoice: string;
  motivation?: string;
};

export async function submitApplication(
  fields: ApplicationFields,
  transcript: File | null,
): Promise<ApplicationReceipt> {
  // multipart, because the transcript rides along in the same request — one
  // submission, one round trip, no half-created application if the second
  // call fails.
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== "") body.append(key, String(value));
  }
  if (transcript) body.append("transcript", transcript);

  let res: Response;
  try {
    res = await fetch("/api/applications", { method: "POST", body });
  } catch {
    throw new ApplicationError(0, "NETWORK");
  }

  if (!res.ok) {
    // Errors are codes, mapped in the frontend — no prose ever comes from the
    // backend (B4). A response that is not JSON still has to produce a code.
    let code = "UNKNOWN";
    try {
      const parsed = (await res.json()) as { error?: { code?: string } };
      code = parsed.error?.code ?? "UNKNOWN";
    } catch {
      code = "UNKNOWN";
    }
    throw new ApplicationError(res.status, code);
  }
  return (await res.json()) as ApplicationReceipt;
}
