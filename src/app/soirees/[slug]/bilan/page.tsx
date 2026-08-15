import { notFound, redirect } from "next/navigation";
import { getEvent, listBottles, listStockAdjustments, listMyBars } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import BilanClientForm from "./BilanClientForm";

export default async function BilanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const event = await getEvent(slug);
  if (!event) notFound();

  // Le bilan porte sur le bar hôte de la soirée, pas sur le bar actuellement
  // sélectionné dans le switcher : sinon un propriétaire perd le contrôle de
  // sa propre soirée dès qu'il bascule sur un autre bar (faux négatif), et
  // peut à l'inverse écraser le stock d'un autre bar sous le titre d'une
  // soirée dont il n'est pas l'hôte (faux positif). Même résolution que la
  // page sœur src/app/soirees/[slug]/page.tsx.
  const bars = await listMyBars();
  const hostBar = bars.find((bar) => bar.id === event.barId) ?? null;

  // Le bilan est réservé au propriétaire du bar hôte et à l'ADMIN global : le
  // proxy ne connaît pas l'appartenance au bar, donc cette garde vit ici
  // plutôt que dans src/proxy.ts.
  const canViewBilan = session.role === "ADMIN" || hostBar?.myRole === "OWNER";
  if (!canViewBilan) redirect(`/soirees/${slug}`);

  const [bottles, adjustments] = await Promise.all([
    listBottles(event.barId),
    listStockAdjustments(slug),
  ]);

  // Calculate net adjustments per bottle
  const netAdjustments = adjustments.reduce((acc, adj) => {
    if (!acc[adj.bottleId]) {
      acc[adj.bottleId] = { ...adj };
    } else {
      acc[adj.bottleId].quantityAfter = adj.quantityAfter;
    }
    return acc;
  }, {} as Record<string, typeof adjustments[0]>);

  const enrichedBottles = bottles.map((b) => {
    const net = netAdjustments[b.id];
    const diff = net ? net.quantityAfter - net.quantityBefore : 0;
    // originalQuantity is the stock before ANY adjustment from this specific event
    const originalQuantity = b.quantity - diff;
    return { ...b, originalQuantity };
  });

  // Sort alphabetically so it is predictable
  enrichedBottles.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8">
      <div>
        <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">
          Bilan de fin de soirée
        </span>
        <h1 className="font-display text-[27px] text-ink mt-1">
          {event.name}
        </h1>
        <p className="text-ink-soft text-[13px] mt-2 max-w-xl leading-relaxed">
          Ajustez les stocks après votre soirée. Indiquez le nombre de bouteilles consommées ou le nouveau stock restant : le système synchronisera automatiquement les quantités et les volumes de votre cave.
        </p>
      </div>

      <BilanClientForm slug={slug} bottles={enrichedBottles} />
    </div>
  );
}
