"use client";

import { useT } from "@/i18n/locale-provider";
import { RoutePlaceholder } from "@/components/shell/route-placeholder";

export default function GradebookPage() {
  const t = useT();
  return <RoutePlaceholder title={t.nav.gradebook} builtInPhase={8} />;
}
