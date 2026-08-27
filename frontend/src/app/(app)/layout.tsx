import { AuthGate } from "@/state/auth-gate";
import { AppShell } from "@/components/shell/app-shell";
import { IterProvider } from "@/components/iter/iter-provider";
import { RouteRoleGuard } from "@/components/shell/route-role-guard";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGate>
      <IterProvider>
        <AppShell>
          <RouteRoleGuard>{children}</RouteRoleGuard>
        </AppShell>
      </IterProvider>
    </AuthGate>
  );
}
