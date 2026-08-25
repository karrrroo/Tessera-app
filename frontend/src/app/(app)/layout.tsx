import { AuthGate } from "@/state/auth-gate";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AuthGate>{children}</AuthGate>;
}
