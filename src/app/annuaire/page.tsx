import { redirect } from "next/navigation";
import { listMyBars, listBarMembers } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import PageTransition from "@/components/PageTransition";

function formatBirthday(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export default async function AnnuairePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/creer");

  const members = await listBarMembers(activeBar.id);

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-orange/15">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>{activeBar.name}</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
          Annuaire des membres
        </h1>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => (
          <div
            key={member.id}
            className="rounded-2xl bg-ink-2/60 border border-white/[0.08] p-5 shadow-xl space-y-3"
          >
            <div className="flex items-center gap-3">
              {member.user.avatarUrl ? (
                <img
                  src={member.user.avatarUrl}
                  alt={member.user.username}
                  className="w-12 h-12 rounded-xl object-cover border border-white/[0.08]"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-ink border border-white/[0.08] flex items-center justify-center font-display text-base font-bold text-gold">
                  {member.user.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-sm text-cream">{member.user.username}</p>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-white/[0.05] text-muted">
                  {member.role === "OWNER" ? "Propriétaire" : "Membre"}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-muted">
              {member.user.birthday && (
                <p>🎂 {formatBirthday(member.user.birthday)}</p>
              )}
              {member.user.favoriteDrink && (
                <p>🍹 {member.user.favoriteDrink}</p>
              )}
              {member.user.allergies && (
                <p>⚠️ {member.user.allergies}</p>
              )}
              {!member.user.birthday && !member.user.favoriteDrink && !member.user.allergies && (
                <p className="italic text-muted/60">Profil non renseigné.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </PageTransition>
  );
}
