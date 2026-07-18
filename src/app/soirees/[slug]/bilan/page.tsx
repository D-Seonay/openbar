import { notFound, redirect } from "next/navigation";
import { getEvent, listBottles, listMyBars } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import BilanClientForm from "./BilanClientForm";

export default async function BilanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const event = await getEvent(slug);
  if (!event) notFound();

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/creer");

  const bottles = await listBottles(activeBar.id);
  // Sort alphabetically so it is predictable
  bottles.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8">
      <div>
        <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">
          Bilan de fin de soirée
        </span>
        <h1 className="font-display text-3xl sm:text-4xl text-cream mt-1">
          {event.name}
        </h1>
        <p className="text-muted text-xs mt-2 max-w-xl leading-relaxed">
          Ajustez les stocks après votre soirée. Indiquez le nombre de bouteilles consommées ou le nouveau stock restant : le système synchronisera automatiquement les quantités et les volumes de votre cave.
        </p>
      </div>

      <BilanClientForm slug={slug} bottles={bottles} />
    </div>
  );
}
