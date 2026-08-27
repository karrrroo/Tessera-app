"use client";

import { useT } from "@/i18n/locale-provider";
import { CredentialList } from "@/components/credentials/credential-list";

export default function CredentialsPage() {
  const t = useT();
  return (
    <main className="mx-auto max-w-2xl space-y-1 p-6">
      <h1 className="font-serif text-2xl" style={{ color: "var(--ink)" }}>
        {t.scr.cr.title}
      </h1>
      <div className="pt-3">
        <CredentialList />
      </div>
    </main>
  );
}
