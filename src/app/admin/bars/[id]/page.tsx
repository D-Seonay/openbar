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
      <div className="pb-6 border-b border-orange/15">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>Espace Administrateur</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
          Gestion de {bar.name}
        </h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/admin/bars/${id}/stock`}
          className="text-xs px-3 py-2 rounded-xl bg-ink-2 border border-white/[0.08] text-cream hover:border-orange/50 transition-colors"
        >
          Voir la cave →
        </Link>
        <Link
          href={`/admin/bars/${id}/cocktails`}
          className="text-xs px-3 py-2 rounded-xl bg-ink-2 border border-white/[0.08] text-cream hover:border-orange/50 transition-colors"
        >
          Voir les cocktails →
        </Link>
        <Link
          href={`/admin/bars/${id}/soirees`}
          className="text-xs px-3 py-2 rounded-xl bg-ink-2 border border-white/[0.08] text-cream hover:border-orange/50 transition-colors"
        >
          Voir les soirées →
        </Link>
      </div>

      <PendingRequests barId={id} requests={pendingRequests} />

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
          <BarNameSection barId={id} name={bar.name} />
          <div className="rounded-2xl bg-ink-2 border border-white/[0.08] p-6 shadow-xl">
            <InviteMemberForm barId={id} />
          </div>
          <BarVisibilitySection barId={id} isPublic={bar.isPublic} />
          <InviteLinkSection barId={id} inviteToken={bar.inviteToken} />
        </div>

        <div className="lg:col-span-8 rounded-2xl bg-ink-2/60 border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-xl">
          {members.map((member) => (
            <MemberRow key={member.id} barId={id} member={member} />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
