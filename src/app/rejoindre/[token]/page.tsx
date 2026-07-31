import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { previewInviteLink, ApiError } from "@/lib/api-client";
import { joinViaInviteLinkAction } from "@/app/bar-actions";
import PageTransition from "@/components/PageTransition";

export default async function RejoindreParLienPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let barName: string | null = null;
  try {
    const preview = await previewInviteLink(token);
    barName = preview.barName;
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) throw err;
  }

  if (!barName) {
    return (
      <PageTransition className="max-w-sm mx-auto mt-6 sm:mt-16 text-center space-y-4">
        <h1 className="font-display text-2xl text-cream">Lien invalide</h1>
        <p className="text-sm text-muted">Ce lien d&apos;invitation n&apos;existe plus ou n&apos;est plus valide.</p>
        <Link href="/login" className="text-orange hover:underline text-sm">
          Retour à la connexion
        </Link>
      </PageTransition>
    );
  }

  const session = await getSession();
  if (session) {
    await joinViaInviteLinkAction(token);
    redirect("/");
  }

  return (
    <PageTransition className="max-w-sm mx-auto mt-6 sm:mt-16 bg-ink-2/40 border border-orange/10 p-6 sm:p-8 rounded-xl box-orange-glow space-y-4 text-center">
      <h1 className="font-display text-2xl text-cream">Rejoindre {barName}</h1>
      <p className="text-sm text-muted">Connecte-toi ou crée un compte pour rejoindre ce bar.</p>
      <div className="flex flex-col gap-2">
        <Link
          href={`/login?redirectTo=/rejoindre/${token}`}
          className="w-full bg-orange text-white font-medium rounded-xl py-3 hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider text-xs font-semibold"
        >
          Se connecter
        </Link>
        <Link
          href={`/signup?inviteToken=${token}`}
          className="w-full bg-ink border border-orange/15 text-cream font-medium rounded-xl py-3 hover:border-orange/40 transition-all uppercase tracking-wider text-xs font-semibold"
        >
          Créer un compte
        </Link>
      </div>
    </PageTransition>
  );
}
