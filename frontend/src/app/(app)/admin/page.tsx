import { RoutePlaceholder } from "@/components/shell/route-placeholder";

// No T.nav key exists for this — the design package has no admin screens at
// all (roadmap Phase 5 note: "None of these exist in the design package").
export default function AdminPage() {
  return <RoutePlaceholder title="Admin" builtInPhase={5} />;
}
