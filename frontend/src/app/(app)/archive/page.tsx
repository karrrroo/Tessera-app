"use client";

import { useT } from "@/i18n/locale-provider";
import { RoutePlaceholder } from "@/components/shell/route-placeholder";

export default function ArchivePage() {
  const t = useT();
  return <RoutePlaceholder title={t.nav.archive} builtInPhase={7} />;
}
