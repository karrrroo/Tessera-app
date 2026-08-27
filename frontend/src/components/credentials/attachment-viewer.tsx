"use client";

import { useEffect, useState } from "react";
import { credentialsApi } from "@/lib/api/credentials";

// C10: fetched with the bearer through the backend's own authenticated
// endpoint into a blob URL — never a signed URL, never a plain <a href>.
// Revoked on unmount so the blob doesn't leak past this component's life.
export function AttachmentViewer({ credentialId }: { credentialId: string }) {
  const [state, setState] = useState<{ url: string; contentType: string } | "loading" | "error">("loading");

  useEffect(() => {
    let url: string | null = null;
    credentialsApi
      .fetchAttachment(credentialId)
      .then((r) => {
        url = r.url;
        setState(r);
      })
      .catch(() => setState("error"));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [credentialId]);

  if (state === "loading") return <div className="h-40 animate-pulse rounded-[14px]" style={{ background: "var(--surface2)" }} />;
  if (state === "error") return null;

  if (state.contentType === "application/pdf") {
    return <object data={state.url} type="application/pdf" className="h-80 w-full rounded-[14px]" style={{ border: "1px solid var(--hair)" }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={state.url} alt="" className="max-h-80 w-full rounded-[14px] object-contain" style={{ border: "1px solid var(--hair)" }} />
  );
}
