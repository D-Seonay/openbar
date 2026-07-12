import { listBottles } from "@/lib/api-client";
import { calculateBottleTotalLiters, calculateTotalBottlesCount, formatLiters } from "@/lib/volumeUtils";
import { isAdminLoggedIn, getSession } from "@/lib/session";
import StockStudio from "./StockStudio";
import AddBottleForm from "./AddBottleForm";
import PageTransition from "@/components/PageTransition";
import AlertsManagerTrigger from "./AlertsManagerTrigger";

export default async function StockPage() {
  const [isAdmin, session, bottles] = await Promise.all([
    isAdminLoggedIn(),
    getSession(),
    listBottles(),
  ]);

  const isVipOrAdmin = Boolean(session?.vip || session?.role === "ADMIN");

  const normal = bottles.filter((b) => !b.vip);
  const vip = bottles.filter((b) => b.vip);

  const accessibleBottles = isVipOrAdmin ? bottles : normal;

  const totalBottlesCount = accessibleBottles.reduce((sum, b) => sum + calculateTotalBottlesCount(b), 0);
  const totalLitersCount = accessibleBottles.reduce((sum, b) => sum + calculateBottleTotalLiters(b), 0);
  const lowStockCount = accessibleBottles.filter(
    (b) => b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold
  ).length;

  const addBottleForm = <AddBottleForm isVip={isVipOrAdmin} />;

  return (
    <PageTransition className="space-y-8">
      {/* Warm Lounge Stock Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-orange/15">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
            <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
            <span>Rayons & Inventaire</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
            La Cave & Répertoire
          </h1>
        </div>

        {/* Warm Orange / Cream KPIs Pills */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="px-4 py-2 rounded-xl bg-ink-2 border border-white/[0.08]">
            <span className="text-muted block text-[10px] uppercase font-semibold">En Rayon</span>
            <span className="text-cream font-bold text-sm">{totalBottlesCount} btl</span>
          </div>

          <div className="px-4 py-2 rounded-xl bg-ink-2 border border-white/[0.08]">
            <span className="text-muted block text-[10px] uppercase font-semibold">Volume Total</span>
            <span className="text-orange font-bold text-sm">{formatLiters(totalLitersCount)}</span>
          </div>

          <AlertsManagerTrigger bottles={accessibleBottles} lowStockCount={lowStockCount} />
        </div>
      </div>

      {/* Master-Detail Warm Lounge Inventory Studio */}
      <StockStudio
        normalBottles={normal}
        vipBottles={vip}
        addBottleForm={addBottleForm}
        isAdmin={isAdmin}
        isVip={isVipOrAdmin}
      />
    </PageTransition>
  );
}
