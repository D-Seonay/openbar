import Link from "next/link";
import { redirect } from "next/navigation";
import { listMyBars, listBarsDirectory } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import PageTransition from "@/components/PageTransition";
import { lienBoutonClasses } from "@/components/ui";
import BarDirectory from "./BarDirectory";
import GuestLanding from "./GuestLanding";

export default async function HomePage() {
  const session = await getSession();
  if (!session) return <GuestLanding />;

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);

  // La barre d'onglets basse est le point d'entrée navigué pour qui a déjà un
  // bar : "/" ne sert plus alors qu'à trancher entre l'accueil public et ce
  // renvoi. Le cas sans bar reste géré ici, sans quoi ce renvoi bouclerait
  // avec les pages qui, elles, renvoient vers "/" faute de bar actif.
  if (activeBar) redirect("/soirees");

  const directory = await listBarsDirectory();
  return (
    <PageTransition className="space-y-8">
      <div className="py-12 text-center border-b border-rule">
        <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">
          Bienvenue sur OpenBar
        </span>
        <h1 className="font-display text-[27px] text-ink mt-2 mb-4">
          L&apos;Art du Cocktail Privé
        </h1>
        <p className="text-ink-soft max-w-lg mx-auto mb-8 text-[15px]">
          Vous n&apos;avez pas encore de bar. Vous pouvez en créer un ou rejoindre un bar existant pour accéder aux fonctionnalités.
        </p>
        <Link href="/creer" className={lienBoutonClasses("principal")}>
          Créer mon premier bar
        </Link>
      </div>
      <BarDirectory entries={directory} />
    </PageTransition>
  );
}
