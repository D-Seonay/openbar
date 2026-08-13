import PageTransition from "@/components/PageTransition";
import ProfileForm from "./ProfileForm";
import DiscordLink from "./DiscordLink";
import { isDiscordConfigured } from "@/lib/discord";
import { getMyProfileForForm } from "./actions";

export default async function ProfilPage({
  searchParams,
}: {
  searchParams: Promise<{ discord?: string }>;
}) {
  const profile = await getMyProfileForForm();
  const { discord } = await searchParams;

  return (
    <PageTransition className="space-y-8 max-w-lg">
      <div className="pb-6 border-b border-orange/15">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>Mon Compte</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
          Mon Profil
        </h1>
        <p className="text-muted text-xs mt-2">
          Ces informations sont visibles par les membres de tes bars, dans l&apos;annuaire.
        </p>
      </div>

      <ProfileForm profile={profile} />

      {/* Read on the server: the button is only worth offering when the
          deployment actually has Discord credentials, otherwise it can do
          nothing but return a bare 503. */}
      <DiscordLink profile={profile} status={discord} configured={isDiscordConfigured()} />
    </PageTransition>
  );
}
