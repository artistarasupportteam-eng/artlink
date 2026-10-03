import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getPublicSettings, submitReport } from "@/lib/fns/api";
import { AppShell } from "@/components/shell";
import { Button, ErrorNote, Field, areaClass, inputClass } from "@/components/ui";

export const Route = createFileRoute("/help")({ component: HelpPage });

const DEFAULT_HELP = `Create a Smart Link for a released song, a Pre-Save Link for an upcoming song, or a Bio Link for your artist page.

Add store and social destinations, choose a public URL, then publish. Share that URL anywhere. ARTLink records views and clicks. It does not host full songs.

Email collection only runs when you turn it on, and visitors must agree to the consent message you write.

If a link breaks a rule, an administrator can unpublish it. You will see a notification when that happens.`;

function HelpPage() {
  const { user } = useCurrentUserState();
  const [help, setHelp] = useState(DEFAULT_HELP);
  const [support, setSupport] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    getPublicSettings().then((settings) => {
      if (settings.help) setHelp(settings.help);
      setSupport(settings.support);
    }).catch(() => undefined);
  }, []);
  return (
    <AppShell>
      <div className="grid max-w-2xl gap-4">
        <h1 className="font-display text-3xl">Help and Support</h1>
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted">{help}</p>
        {support ? <p className="text-sm">Support: {support}</p> : null}
        {user ? (
          <form
            className="grid gap-3 rounded-lg border border-border bg-surface p-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitReport({ data: { subject, body } })
                .then(() => {
                  setSubject("");
                  setBody("");
                  toast.success("Message sent");
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not send."));
            }}
          >
            <h2 className="font-medium">Contact support</h2>
            <ErrorNote>{error}</ErrorNote>
            <Field label="Subject"><input className={inputClass} value={subject} onChange={(event) => setSubject(event.target.value)} /></Field>
            <Field label="Message"><textarea className={areaClass} value={body} onChange={(event) => setBody(event.target.value)} /></Field>
            <Button type="submit" variant="primary">Send</Button>
          </form>
        ) : <p className="text-sm text-muted">Sign in to send a support message.</p>}
      </div>
    </AppShell>
  );
}
