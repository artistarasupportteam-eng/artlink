import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  return (
    <AppShell>
      <article className="grid max-w-2xl gap-3">
        <h1 className="font-display text-3xl">About ARTLink</h1>
        <p>ARTLink is a free smart-link platform for musicians. A released song gets a Smart Link. An upcoming song gets a Pre-Save Link. An artist gets a Bio Link.</p>
        <p className="text-muted">Listeners leave ARTLink for the stores and social profiles you choose. ARTLink does not stream music, sell tracks, or host full songs or music videos.</p>
        <p className="text-muted">The product stays free. The platform can show advertisements that administrators place and label. Those ads never cover your store buttons.</p>
      </article>
    </AppShell>
  );
}
