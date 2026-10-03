import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsBody } from "@/routes/analytics";
import { AppShell, RequireUser } from "@/components/shell";

export const Route = createFileRoute("/analytics/$id")({
  component: LinkAnalyticsPage,
});

function LinkAnalyticsPage() {
  const { id } = Route.useParams();
  return (
    <AppShell>
      <RequireUser>
        <AnalyticsBody linkId={id} />
      </RequireUser>
    </AppShell>
  );
}
