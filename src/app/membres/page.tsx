import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listMyBars, listBarMembers, listPendingJoinRequests } from "@/lib/api-client";
import { resolveActiveBar } from "@/lib/active-bar";
import PageTransition from "@/components/PageTransition";
import PaginationLinks from "@/components/PaginationLinks";
import { paginate } from "@/lib/pagination";
import { EmptyState } from "@/components/ui";
import InviteMemberForm from "./InviteMemberForm";
import MemberRow from "./MemberRow";
import PendingRequests from "./PendingRequests";
import BarVisibilitySection from "./BarVisibilitySection";
import InviteLinkSection from "./InviteLinkSection";
import DiscordChannelBinding from "./DiscordChannelBinding";
import BarNameSection from "./BarNameSection";

export default async function BarMembresPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/");

  // The old /membres required OWNER to even load; the old /annuaire was open
  // to any member. Merged, the screen is open to any member — only the
  // management actions below stay gated on this.
  const isOwner = activeBar.myRole === "OWNER";

  const [members, pendingRequests] = await Promise.all([
    listBarMembers(activeBar.id),
    // Fetched only for the owner: a simple member has no use for it, and
    // there is no reason to ship it to their client at all.
    isOwner ? listPendingJoinRequests(activeBar.id) : Promise.resolve([]),
  ]);

  const { page } = await searchParams;
  const roster = paginate(members, page);

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-rule">
        <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">
          {isOwner ? "Gestion du bar" : activeBar.name}
        </span>
        <h1 className="font-display text-[27px] text-ink mt-1">Membres de {activeBar.name}</h1>
      </div>

      {isOwner && <PendingRequests barId={activeBar.id} requests={pendingRequests} />}

      <div className={isOwner ? "grid lg:grid-cols-12 gap-8 items-start" : ""}>
        {isOwner && (
          // min-w-0 : sans lui, un grid item mesure ses enfants à leur
          // largeur de contenu (min-width: auto par défaut) plutôt qu'à la
          // largeur de la colonne, ce qui pousse toute la grille — et donc
          // la page — au-delà du viewport en mobile. Même correctif que
          // soirees/page.tsx.
          <div className="lg:col-span-4 space-y-6 min-w-0">
            <BarNameSection barId={activeBar.id} name={activeBar.name} />
            <div className="rounded-2xl bg-paper-sunk border border-rule p-5 sm:p-6">
              <InviteMemberForm barId={activeBar.id} />
            </div>
            <BarVisibilitySection barId={activeBar.id} isPublic={activeBar.isPublic} />
            <DiscordChannelBinding
              barId={activeBar.id}
              channelId={activeBar.discordChannelId ?? null}
            />
            <InviteLinkSection barId={activeBar.id} inviteToken={activeBar.inviteToken} />
          </div>
        )}

        <div className={isOwner ? "lg:col-span-8 space-y-3 min-w-0" : "space-y-3"}>
          {roster.items.length === 0 ? (
            <EmptyState titre="Aucun membre" message="Aucun membre pour le moment." />
          ) : (
            roster.items.map((member) => (
              <MemberRow key={member.id} barId={activeBar.id} member={member} canManage={isOwner} />
            ))
          )}

          <PaginationLinks
            currentPage={roster.currentPage}
            totalPages={roster.totalPages}
            basePath="/membres"
          />
        </div>
      </div>
    </PageTransition>
  );
}
