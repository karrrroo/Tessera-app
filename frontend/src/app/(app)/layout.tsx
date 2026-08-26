import { AuthGate } from "@/state/auth-gate";
import { AppShell } from "@/components/shell/app-shell";
import { IterProvider } from "@/components/iter/iter-provider";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGate>
      <IterProvider>
        <AppShell>{children}</AppShell>
      </IterProvider>
    </AuthGate>
  );
}
