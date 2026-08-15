import Link from "next/link";
import { redirect } from "next/navigation";
import { getBarById, listBarMembers, listPendingJoinRequests } from "@/lib/api-client";
import { isAdminLoggedIn } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import BarNameSection from "@/app/membres/BarNameSection";
import BarVisibilitySection from "@/app/membres/BarVisibilitySection";
import InviteLinkSection from "@/app/membres/InviteLinkSection";
import InviteMemberForm from "@/app/membres/InviteMemberForm";
import MemberRow from "@/app/membres/MemberRow";
import PendingRequests from "@/app/membres/PendingRequests";
import { lienBoutonClasses } from "@/components/ui";

export default async function AdminBarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }

  const { id } = await params;
  const [bar, members, pendingRequests] = await Promise.all([
    getBarById(id),
    listBarMembers(id),
    listPendingJoinRequests(id),
  ]);

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-rule">
        <div className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-caps text-terracotta mb-2">
          <span className="w-2 h-2 rounded-full bg-terracotta animate-pulse" />
          <span>Espace Administrateur</span>
        </div>
        <h1 className="font-display text-[27px] text-ink mt-1">
          Gestion de {bar.name}
        </h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/admin/bars/${id}/stock`} className={lienBoutonClasses("discret")}>
          Voir la cave →
        </Link>
        <Link href={`/admin/bars/${id}/cocktails`} className={lienBoutonClasses("discret")}>
          Voir les cocktails →
        </Link>
        <Link href={`/admin/bars/${id}/soirees`} className={lienBoutonClasses("discret")}>
          Voir les soirées →
        </Link>
      </div>

      <PendingRequests barId={id} requests={pendingRequests} />

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* min-w-0 : sans lui, un grid item mesure ses enfants à leur largeur
            de contenu (min-width: auto par défaut) plutôt qu'à la largeur de
            la colonne, ce qui pousse toute la grille — et donc la page — au-
            delà du viewport en mobile. Même correctif que membres/page.tsx et
            soirees/page.tsx. */}
        <div className="lg:col-span-4 space-y-6 min-w-0">
          <BarNameSection barId={id} name={bar.name} />
          <div className="rounded-2xl bg-paper-sunk border border-rule p-5 sm:p-6">
            <InviteMemberForm barId={id} />
          </div>
          <BarVisibilitySection barId={id} isPublic={bar.isPublic} />
          <InviteLinkSection barId={id} inviteToken={bar.inviteToken} />
        </div>

        <div className="lg:col-span-8 min-w-0 rounded-2xl bg-paper-sunk border border-rule overflow-hidden divide-y divide-rule">
          {members.map((member) => (
            <MemberRow key={member.id} barId={id} member={member} canManage={true} />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
