import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <AppShell>
      <article className="grid max-w-2xl gap-3 text-sm leading-6">
        <h1 className="font-display text-3xl">Privacy Policy</h1>
        <p>ARTLink stores the account you create with Google or X: name, email, and profile image supplied by that provider, plus the artist profile and links you add.</p>
        <p>If you turn on email collection, ARTLink stores the address, the link it came from, the time, and the consent message the visitor accepted. Only you and authorized administrators can see addresses collected on your links.</p>
        <p>Page views and clicks are stored with a hash of the visitor’s network and browser, a device category, and a country only when the hosting network provides one. ARTLink does not sell this information and does not invent audience numbers.</p>
        <p>Advertisement impressions and clicks are counted so administrators can see whether a placement ran. Ads are labeled.</p>
        <p>You can delete your account from Settings. That removes your profile, links, and collected emails from the application database. Sign-in is then removed as well.</p>
        <p>Administrators can review accounts, links, and support messages in order to operate the platform. They cannot read another artist’s collected emails from the public site.</p>
      </article>
    </AppShell>
  );
}
