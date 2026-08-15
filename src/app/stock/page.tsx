import { redirect } from "next/navigation";
import { listBottles, listMyBars } from "@/lib/api-client";
import { calculateBottleTotalLiters, calculateTotalBottlesCount, formatLiters } from "@/lib/volumeUtils";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import StockStudio from "./StockStudio";
import PageTransition from "@/components/PageTransition";
import AlertsManagerTrigger from "./AlertsManagerTrigger";

export default async function StockPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/");

  const bottles = await listBottles(activeBar.id);

  const isVipOrAdmin = Boolean(session.vip || session.role === "ADMIN" || activeBar.myVip);
  const canManageStock = session.role === "ADMIN" || activeBar.myRole === "OWNER";

  const normal = bottles.filter((b) => !b.vip);
  const vip = bottles.filter((b) => b.vip);

  const accessibleBottles = isVipOrAdmin ? bottles : normal;

  const totalBottlesCount = accessibleBottles.reduce((sum, b) => sum + calculateTotalBottlesCount(b), 0);
  const totalLitersCount = accessibleBottles.reduce((sum, b) => sum + calculateBottleTotalLiters(b), 0);
  const lowStockCount = accessibleBottles.filter(
    (b) => b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold
  ).length;

  return (
    <PageTransition className="space-y-8">
      {/* Warm Lounge Stock Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-rule">
        <div>
          <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">
            Rayons & Inventaire
          </span>
          <h1 className="font-display text-[27px] text-ink mt-1">La Cave & Répertoire</h1>
        </div>

        {/* KPIs Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-4 py-2 rounded-xl bg-paper-sunk border border-rule">
            <span className="text-ink-soft block text-[13px] uppercase font-semibold">En Rayon</span>
            <span className="text-ink font-bold text-[15px]">{totalBottlesCount} btl</span>
          </div>

          <div className="px-4 py-2 rounded-xl bg-paper-sunk border border-rule">
            <span className="text-ink-soft block text-[13px] uppercase font-semibold">Volume Total</span>
            <span className="text-terracotta font-bold text-[15px]">{formatLiters(totalLitersCount)}</span>
          </div>

          <AlertsManagerTrigger bottles={accessibleBottles} lowStockCount={lowStockCount} />
        </div>
      </div>

      {/* Master-Detail Warm Lounge Inventory Studio */}
      <StockStudio
        normalBottles={normal}
        vipBottles={vip}
        barId={activeBar.id}
        isAdmin={canManageStock}
        isVip={isVipOrAdmin}
      />
    </PageTransition>
  );
}
