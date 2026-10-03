import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth/client";
import { claimAdmin, deleteAccount, getMe, saveTheme } from "@/lib/fns/api";
import type { ThemeChoice } from "@/lib/model";
import { applyTheme, storedTheme } from "@/lib/theme";
import { AppShell, RequireUser } from "@/components/shell";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <AppShell>
      <RequireUser>
        <SettingsBody />
      </RequireUser>
    </AppShell>
  );
}

function SettingsBody() {
  const [choice, setChoice] = useState<ThemeChoice>(storedTheme());
  const [email, setEmail] = useState("");
  const [adminExists, setAdminExists] = useState(true);
  const [role, setRole] = useState<"admin" | "user">("user");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    getMe().then((me) => {
      setEmail(me.email);
      setAdminExists(me.adminExists);
      setRole(me.role);
      setChoice(me.theme);
      applyTheme(me.theme);
    }).catch(() => undefined);
  }, []);
  const pick = (next: ThemeChoice) => {
    setChoice(next);
    applyTheme(next);
    saveTheme({ data: { theme: next } }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save theme."));
  };
  return (
    <div className="grid max-w-xl gap-6">
      <h1 className="font-display text-3xl">Settings</h1>
      <ErrorNote>{error}</ErrorNote>
      <section className="grid gap-2">
        <h2 className="font-medium">Appearance</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <ThemeButton icon={<Moon className="size-4" />} label="Dark Mode" on={choice === "dark"} onClick={() => pick("dark")} />
          <ThemeButton icon={<Sun className="size-4" />} label="Light Mode" on={choice === "light"} onClick={() => pick("light")} />
          <ThemeButton icon={<Monitor className="size-4" />} label="System Default" on={choice === "system"} onClick={() => pick("system")} />
        </div>
      </section>
      <section className="grid gap-1 text-sm">
        <h2 className="font-medium">Account</h2>
        <p className="text-muted">{email || "Signed in"}</p>
      </section>
      {!adminExists && role !== "admin" ? (
        <section className="grid gap-2 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">Administrator setup</h2>
          <p className="text-sm text-muted">No administrator exists yet. The first signed-in person to claim this becomes the platform administrator. Do this only if you operate ARTLink.</p>
          <Button type="button" variant="primary" onClick={() => claimAdmin().then(() => { setRole("admin"); setAdminExists(true); toast.success("You are the administrator"); }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not claim."))}>Become administrator</Button>
        </section>
      ) : null}
      <section className="grid gap-3 rounded-lg border border-danger/40 p-4">
        <h2 className="font-medium text-danger">Delete Account</h2>
        <p className="text-sm text-muted">Deletes your profile, links, collected emails, and sign-in. This cannot be undone.</p>
        <Field label="Type DELETE to confirm">
          <input className={inputClass} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </Field>
        <Button variant="danger" type="button" onClick={() => {
          deleteAccount({ data: { confirm } })
            .then(() => signOut())
            .then(() => { window.location.href = "/"; })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not delete the account."));
        }}>Delete account</Button>
      </section>
    </div>
  );
}

function ThemeButton({ icon, label, on, onClick }: { icon: ReactNode; label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border text-sm ${on ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface"}`}>
      {icon} {label}
    </button>
  );
}
