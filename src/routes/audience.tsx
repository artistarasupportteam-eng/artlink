import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsBody } from "@/routes/analytics";
import { AppShell, RequireUser } from "@/components/shell";

export const Route = createFileRoute("/audience")({ component: AudiencePage });

function AudiencePage() {
  return (
    <AppShell>
      <RequireUser>
        <div className="grid gap-3">
          <h1 className="font-display text-3xl">Audience</h1>
          <AnalyticsBody />
        </div>
      </RequireUser>
    </AppShell>
  );
}
