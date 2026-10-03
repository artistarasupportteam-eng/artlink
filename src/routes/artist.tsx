import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { getMe, saveProfile } from "@/lib/fns/api";
import { readArtwork } from "@/lib/media";
import { AppShell, RequireUser } from "@/components/shell";
import { Button, ErrorNote, Field, Spinner, areaClass, inputClass } from "@/components/ui";

export const Route = createFileRoute("/artist")({ component: ArtistPage });

function ArtistPage() {
  return (
    <AppShell>
      <RequireUser>
        <ArtistBody />
      </RequireUser>
    </AppShell>
  );
}

function ArtistBody() {
  const [artistName, setArtistName] = useState("");
  const [username, setUsername] = useState("");
  const [about, setAbout] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getMe().then((me) => {
      setArtistName(me.artistName);
      setUsername(me.username);
      setAbout(me.about);
      setAvatarUrl(me.avatarUrl);
      setBannerUrl(me.bannerUrl);
      setReady(true);
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load profile."));
  }, []);
  if (!ready && !error) return <Spinner />;
  const onFile = (file: File | undefined, set: (value: string) => void) => {
    if (!file) return;
    readArtwork(file).then(set).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not read that image."));
  };
  return (
    <form
      className="grid max-w-xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        saveProfile({ data: { artistName, username, about, avatarUrl, bannerUrl } })
          .then(() => toast.success("Profile saved"))
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save."))
          .finally(() => setBusy(false));
      }}
    >
      <h1 className="font-display text-3xl">My Artist Profile</h1>
      <p className="text-sm text-muted">This identity pre-fills new bio links. It is separate from any public bio page.</p>
      <ErrorNote>{error}</ErrorNote>
      {bannerUrl ? <img src={bannerUrl} alt="" className="h-28 w-full rounded-lg object-cover" /> : null}
      <Field label="Banner"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onFile(event.target.files?.[0], setBannerUrl)} /></Field>
      {avatarUrl ? <img src={avatarUrl} alt="" className="size-16 rounded-lg object-cover" /> : null}
      <Field label="Profile picture"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onFile(event.target.files?.[0], setAvatarUrl)} /></Field>
      <Field label="Artist name"><input className={inputClass} value={artistName} onChange={(event) => setArtistName(event.target.value)} /></Field>
      <Field label="Username"><input className={inputClass} value={username} onChange={(event) => setUsername(event.target.value)} /></Field>
      <Field label="About"><textarea className={areaClass} value={about} onChange={(event) => setAbout(event.target.value)} /></Field>
      <Button type="submit" variant="primary" busy={busy}>Save profile</Button>
    </form>
  );
}
