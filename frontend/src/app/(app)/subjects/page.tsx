"use client";

import { useT } from "@/i18n/locale-provider";
import { RoutePlaceholder } from "@/components/shell/route-placeholder";

export default function SubjectsPage() {
  const t = useT();
  return <RoutePlaceholder title={t.nav.subjects} builtInPhase={7} />;
}
