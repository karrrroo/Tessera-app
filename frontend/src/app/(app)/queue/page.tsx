"use client";

import { useT } from "@/i18n/locale-provider";
import { RoutePlaceholder } from "@/components/shell/route-placeholder";

export default function QueuePage() {
  const t = useT();
  return <RoutePlaceholder title={t.nav.queue} builtInPhase={10} />;
}
