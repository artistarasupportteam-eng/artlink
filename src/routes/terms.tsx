import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
  return (
    <AppShell>
      <article className="grid max-w-2xl gap-3 text-sm leading-6">
        <h1 className="font-display text-3xl">Terms and Conditions</h1>
        <p>ARTLink is free to use. There are no subscription plans. You keep the rights to the artwork, names, and text you upload, and you confirm you have permission to use them.</p>
        <p>Do not upload full songs, music videos, or executable files. Links should point to legitimate stores, social profiles, or pages you control.</p>
        <p>Administrators may unpublish or remove links and suspend accounts that break these terms or the law. You can edit a link without changing its public URL unless you change the slug yourself.</p>
        <p>Advertisements are controlled by administrators, labeled as advertisements, and must not block store buttons or essential artist content.</p>
        <p>The service is provided as available. ARTLink is not a label, distributor, or store, and it does not guarantee streams, saves, or ticket sales.</p>
      </article>
    </AppShell>
  );
}
