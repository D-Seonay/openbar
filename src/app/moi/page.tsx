import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listMyBars } from "@/lib/api-client";
import { resolveActiveBar } from "@/lib/active-bar";
import { Row } from "@/components/ui";

export default async function MoiPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  const estProprietaire = activeBar?.myRole === "OWNER";

  return (
    <div>
      <h1 className="font-display text-[27px] text-ink mb-5">Moi</h1>

      <section className="mb-7">
        <h2 className="text-[13px] font-display uppercase tracking-caps text-ink-soft mb-1">
          Mon compte
        </h2>
        <Row titre="Profil" href="/profil" chevron />
        <Row titre="Changer mon mot de passe" href="/changer-mot-de-passe" chevron />
      </section>

      {activeBar ? (
        <section className="mb-7">
          <h2 className="text-[13px] font-display uppercase tracking-caps text-ink-soft mb-1">
            {activeBar.name}
          </h2>
          <Row titre="Membres" href="/membres" chevron />
          {/* Comptes et journal sont des outils de gestion : le propriétaire
              seul les voit, comme le veut la spec. */}
          {estProprietaire ? (
            <>
              <Row titre="Comptes" href="/comptes" chevron />
              <Row titre="Journal" href="/journal" chevron />
            </>
          ) : null}
        </section>
      ) : null}

      <section className="mb-7">
        <h2 className="text-[13px] font-display uppercase tracking-caps text-ink-soft mb-1">
          Ailleurs
        </h2>
        <Row titre="Découvrir des bars" href="/decouvrir" chevron />
        <Row titre="Créer un bar" href="/creer" chevron />
        {session.role === "ADMIN" ? (
          <Row titre="Administration" href="/admin" chevron />
        ) : null}
      </section>
    </div>
  );
}
