import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getEvent, listContributions, listBottles, listStockAdjustments, evaluateCocktails, listMyBars, listWishlistItems, listEventMedia } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import GuestPanel from "./GuestPanel";
import WishlistSection from "./WishlistSection";
import MediaGallery from "./MediaGallery";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const event = await getEvent(slug);
  if (!event) notFound();

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/");

  const [bottles, adjustments, availability, contributions, wishlistItems, media] = await Promise.all([
    listBottles(activeBar.id),
    listStockAdjustments(slug),
    evaluateCocktails(activeBar.id),
    listContributions(slug),
    listWishlistItems(slug),
    listEventMedia(slug),
  ]);

  const stock = bottles
    .filter((b) => !b.vip && b.type !== "mixer" && b.quantity > 0)
    .map((b) => ({ name: b.name, type: b.type, quantity: b.quantity }));

  const vipStock = bottles
    .filter((b) => b.vip && b.quantity > 0)
    .map((b) => ({ name: b.name, type: b.type, quantity: b.quantity }));

  const readyCocktails = availability.filter((a) => a.makeable && !a.usesVip);
  const vipCocktails = availability.filter((a) => a.makeable && a.usesVip);

  const canManageWishlist =
    session.role === "ADMIN" || (event.barId === activeBar.id && activeBar.myRole === "OWNER");

  const netAdjustments = Object.values(
    adjustments.reduce((acc, adj) => {
      if (!acc[adj.bottleId]) {
        acc[adj.bottleId] = { ...adj };
      } else {
        acc[adj.bottleId].quantityAfter = adj.quantityAfter;
      }
      return acc;
    }, {} as Record<string, typeof adjustments[0]>)
  ).filter((adj) => adj.quantityBefore !== adj.quantityAfter);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-orange/15 pb-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">
            {event.isClosed ? "Soirée clôturée" : "Soirée en cours"}
          </span>
          <h1 className="font-display text-3xl sm:text-4xl text-cream mt-1 break-words">{event.name}</h1>
          <p className="text-muted text-xs mt-2 capitalize font-mono text-orange-dim">
            {new Date(event.date).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Link
          href={`/soirees/${slug}/bilan`}
          className="tap-target shrink-0 flex items-center justify-center text-xs px-4 py-2.5 rounded-xl border border-orange/30 bg-orange/10 text-orange hover:bg-orange hover:text-ink transition-all duration-300 font-bold uppercase tracking-wider text-center shadow-md shadow-orange/10"
        >
          📝 Faire / Modifier le bilan
        </Link>
      </div>

      {netAdjustments.length > 0 && (
        <div className="rounded-2xl border border-orange/30 bg-ink-2/90 p-5 shadow-xl box-orange-glow space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-orange/20 text-orange flex items-center justify-center text-base">
                📊
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-cream">
                  Bilan de la Soirée enregistré
                </h3>
                <p className="text-xs text-muted">
                  {netAdjustments.length} référence(s) ajustée(s) lors du bilan
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
            {netAdjustments.map((adj) => {
              const diff = adj.quantityAfter - adj.quantityBefore;
              return (
                <div
                  key={adj.bottleId}
                  className="flex items-center justify-between p-3 rounded-xl bg-ink border border-white/[0.06] text-xs"
                >
                  <span className="font-semibold text-cream truncate min-w-0 mr-2">
                    {adj.bottleName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-muted">
                      {adj.quantityBefore} → {adj.quantityAfter}
                    </span>
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                        diff < 0
                          ? "bg-red-500/15 text-red-400"
                          : "bg-emerald-500/15 text-emerald-400"
                      }`}
                    >
                      {diff > 0 ? `+${diff}` : `${diff}`} btl
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <GuestPanel
        slug={slug}
        session={session}
        contributions={contributions}
        stock={stock}
        vipStock={vipStock}
        readyCocktails={readyCocktails}
        vipCocktails={vipCocktails}
      />

      <WishlistSection slug={slug} items={wishlistItems} canManage={canManageWishlist} currentUserId={session.sub} />

      <MediaGallery
        slug={slug}
        items={media}
        currentUserId={session.sub}
        canManage={canManageWishlist}
      />
    </div>
  );
}
