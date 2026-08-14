import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { previewInviteLink, ApiError } from "@/lib/api-client";
import { joinViaInviteLinkAction } from "@/app/bar-actions";
import PageTransition from "@/components/PageTransition";
import { Card } from "@/components/ui";

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
        <h1 className="font-display text-[22px] text-ink">Lien invalide</h1>
        <p className="text-[15px] text-ink-soft">Ce lien d&apos;invitation n&apos;existe plus ou n&apos;est plus valide.</p>
        <Link href="/login" className="text-terracotta hover:underline text-[15px]">
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
    <PageTransition className="max-w-sm mx-auto mt-6 sm:mt-16">
      <Card className="sm:p-6 space-y-4 text-center">
        <h1 className="font-display text-[22px] text-ink">Rejoindre {barName}</h1>
        <p className="text-[15px] text-ink-soft">Connecte-toi ou crée un compte pour rejoindre ce bar.</p>
        <div className="flex flex-col gap-2">
          <Link
            href={`/login?redirectTo=/rejoindre/${token}`}
            className="min-h-[44px] px-4 rounded-lg border text-[15px] font-semibold
              inline-flex items-center justify-center gap-2 transition-colors
              bg-terracotta text-paper hover:bg-terracotta/90 border-transparent"
          >
            Se connecter
          </Link>
          <Link
            href={`/signup?inviteToken=${token}`}
            className="min-h-[44px] px-4 rounded-lg border text-[15px] font-semibold
              inline-flex items-center justify-center gap-2 transition-colors
              bg-transparent text-ink border-rule hover:bg-paper-sunk"
          >
            Créer un compte
          </Link>
        </div>
      </Card>
    </PageTransition>
  );
}
