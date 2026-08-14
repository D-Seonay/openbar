import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getEvent, listContributions, listBottles, listStockAdjustments, evaluateCocktails, listMyBars, listWishlistItems, listEventMedia } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import GuestPanel from "./GuestPanel";
import WishlistSection from "./WishlistSection";
import DiscordActions from "./DiscordActions";
import MediaGallery from "./MediaGallery";
import { Badge } from "@/components/ui";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const event = await getEvent(slug);
  if (!event) notFound();

  // This page is about the host's bar, not whichever bar the viewer happens to
  // have selected in the switcher. `GET /events/:slug` already refused anyone
  // who is not a member of `event.barId`, so reading that bar's stock here is
  // always allowed — and the API scopes VIP visibility to the viewer's
  // membership in *that* bar.
  const bars = await listMyBars();
  const hostBar = bars.find((bar) => bar.id === event.barId) ?? null;

  const [bottles, adjustments, availability, contributions, wishlistItems, media] = await Promise.all([
    listBottles(event.barId),
    listStockAdjustments(slug),
    evaluateCocktails(event.barId),
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

  // Hosting is a property of the soirée's own bar. Keying this off the selected
  // bar meant an owner lost control of their own party as soon as they switched
  // the switcher to another bar.
  const canManageWishlist = session.role === "ADMIN" || hostBar?.myRole === "OWNER";

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
        <div>
          <Badge ton={event.isClosed ? "complet" : "neutre"}>
            {event.isClosed ? "Soirée clôturée" : "Soirée en cours"}
          </Badge>
          <h1 className="font-display text-[27px] text-ink mt-1 break-words">{event.name}</h1>
          <p className="text-ink-soft text-[13px] mt-2 capitalize">
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
          className="tap-target shrink-0 inline-flex items-center justify-center px-4 rounded-lg border border-terracotta/40 bg-terracotta/10 text-terracotta hover:bg-terracotta hover:text-paper transition-colors text-[13px] font-semibold text-center"
        >
          📝 Faire / Modifier le bilan
        </Link>
      </div>

      {/* "À ramener" en premier : c'est la question qu'on se pose pendant la
          soirée — qu'est-ce que je dois faire maintenant. Tout le reste (bilan,
          panneau invité, galerie, Discord) vient après. */}
      <WishlistSection
        slug={slug}
        items={wishlistItems}
        canManage={canManageWishlist}
        currentUserId={session.sub}
      />

      {netAdjustments.length > 0 && (
        <section className="rounded-xl bg-paper border border-rule p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 shrink-0 rounded-lg bg-paper-sunk border border-rule text-terracotta flex items-center justify-center text-base">
              📊
            </span>
            <div>
              <h2 className="font-display text-[17px] text-ink">Bilan de la Soirée enregistré</h2>
              <p className="text-[13px] text-ink-soft">
                {netAdjustments.length} référence(s) ajustée(s) lors du bilan
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {netAdjustments.map((adj) => {
              const diff = adj.quantityAfter - adj.quantityBefore;
              return (
                <div
                  key={adj.bottleId}
                  className="flex items-center justify-between p-3 rounded-xl bg-paper-sunk border border-rule text-[13px]"
                >
                  <span className="font-semibold text-ink truncate min-w-0 mr-2">
                    {adj.bottleName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-ink-soft">
                      {adj.quantityBefore} → {adj.quantityAfter}
                    </span>
                    <span
                      className={`font-semibold px-1.5 py-0.5 rounded text-[13px] ${
                        diff < 0 ? "text-terracotta" : "text-done"
                      }`}
                    >
                      {diff > 0 ? `+${diff}` : `${diff}`} btl
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
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

      <MediaGallery
        slug={slug}
        items={media}
        currentUserId={session.sub}
        canManage={canManageWishlist}
      />

      {canManageWishlist && <DiscordActions slug={slug} barId={event.barId} />}
    </div>
  );
}
