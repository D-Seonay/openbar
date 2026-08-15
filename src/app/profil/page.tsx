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
      <div className="pb-6 border-b border-rule">
        <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">
          Mon Compte
        </span>
        <h1 className="font-display text-[27px] text-ink mt-1">
          Mon Profil
        </h1>
        <p className="text-ink-soft text-[13px] mt-2">
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
