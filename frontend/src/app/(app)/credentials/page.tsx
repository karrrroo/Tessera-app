"use client";

import { useT } from "@/i18n/locale-provider";
import { RoutePlaceholder } from "@/components/shell/route-placeholder";

export default function CredentialsPage() {
  const t = useT();
  return <RoutePlaceholder title={t.nav.creds} builtInPhase={10} />;
}
