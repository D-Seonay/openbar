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
      {/* Studio Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>INVENTORY_CORE // BAR PRINCIPAL</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight">
            Cave & Répertoire Spirits
          </h1>
        </div>

        {/* Technical Telemetry Pills */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800">
            <span className="text-zinc-500 block text-[10px]">EN RAYON</span>
            <span className="text-zinc-100 font-bold">{totalBottlesCount} BTL</span>
          </div>

          <div className="px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800">
            <span className="text-zinc-500 block text-[10px]">VOLUME TOTAL</span>
            <span className="text-amber-400 font-bold">{formatLiters(totalLitersCount)}</span>
          </div>

          <AlertsManagerTrigger bottles={accessibleBottles} lowStockCount={lowStockCount} />
        </div>
      </div>

      {/* Master-Detail Technical Studio */}
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
