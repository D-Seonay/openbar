import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listMyBars, listBarMembers, listPendingJoinRequests } from "@/lib/api-client";
import { resolveActiveBar } from "@/lib/active-bar";
import PageTransition from "@/components/PageTransition";
import InviteMemberForm from "./InviteMemberForm";
import MemberRow from "./MemberRow";
import PendingRequests from "./PendingRequests";
import BarVisibilitySection from "./BarVisibilitySection";
import InviteLinkSection from "./InviteLinkSection";
import BarNameSection from "./BarNameSection";

export default async function BarMembresPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/");
  if (activeBar.myRole !== "OWNER") redirect("/");

  const [members, pendingRequests] = await Promise.all([
    listBarMembers(activeBar.id),
    listPendingJoinRequests(activeBar.id),
  ]);

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-orange/15">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>Gestion du bar</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
          Membres de {activeBar.name}
        </h1>
      </div>

      <PendingRequests barId={activeBar.id} requests={pendingRequests} />

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
          <BarNameSection barId={activeBar.id} name={activeBar.name} />
          <div className="rounded-2xl bg-ink-2 border border-white/[0.08] p-6 shadow-xl">
            <InviteMemberForm barId={activeBar.id} />
          </div>
          <BarVisibilitySection barId={activeBar.id} isPublic={activeBar.isPublic} />
          <InviteLinkSection barId={activeBar.id} inviteToken={activeBar.inviteToken} />
        </div>

        <div className="lg:col-span-8 rounded-2xl bg-ink-2/60 border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-xl">
          {members.map((member) => (
            <MemberRow key={member.id} barId={activeBar.id} member={member} />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
