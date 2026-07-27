import { redirect } from "next/navigation";
import { getBarById, listBottles } from "@/lib/api-client";
import { calculateBottleTotalLiters, calculateTotalBottlesCount, formatLiters } from "@/lib/volumeUtils";
import { isAdminLoggedIn } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import StockStudio from "@/app/stock/StockStudio";
import AlertsManagerTrigger from "@/app/stock/AlertsManagerTrigger";

export default async function AdminBarStockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }

  const { id } = await params;
  const [bar, bottles] = await Promise.all([getBarById(id), listBottles(id)]);

  const normal = bottles.filter((b) => !b.vip);
  const vip = bottles.filter((b) => b.vip);
  const totalBottlesCount = bottles.reduce((sum, b) => sum + calculateTotalBottlesCount(b), 0);
  const totalLitersCount = bottles.reduce((sum, b) => sum + calculateBottleTotalLiters(b), 0);
  const lowStockCount = bottles.filter(
    (b) => b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold
  ).length;

  return (
    <PageTransition className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-orange/15">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
            <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
            <span>Espace Administrateur</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
            Cave de {bar.name}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="px-4 py-2 rounded-xl bg-ink-2 border border-white/[0.08]">
            <span className="text-muted block text-[10px] uppercase font-semibold">En Rayon</span>
            <span className="text-cream font-bold text-sm">{totalBottlesCount} btl</span>
          </div>

          <div className="px-4 py-2 rounded-xl bg-ink-2 border border-white/[0.08]">
            <span className="text-muted block text-[10px] uppercase font-semibold">Volume Total</span>
            <span className="text-orange font-bold text-sm">{formatLiters(totalLitersCount)}</span>
          </div>

          <AlertsManagerTrigger bottles={bottles} lowStockCount={lowStockCount} />
        </div>
      </div>

      <StockStudio
        normalBottles={normal}
        vipBottles={vip}
        barId={id}
        isAdmin
        isVip
      />
    </PageTransition>
  );
}
