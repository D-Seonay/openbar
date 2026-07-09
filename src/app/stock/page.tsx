import { listBottles } from "@/lib/db";
import { calculateBottleTotalLiters, calculateTotalBottlesCount, formatLiters } from "@/lib/volumeUtils";
import StockTabs from "./StockTabs";
import AddBottleForm from "./AddBottleForm";
import PageTransition from "@/components/PageTransition";
import AlertsManagerTrigger from "./AlertsManagerTrigger";

export default async function StockPage() {
  const bottles = await listBottles();
  const normal = bottles.filter((b) => !b.vip);
  const vip = bottles.filter((b) => b.vip);

  const totalBottlesCount = bottles.reduce((sum, b) => sum + calculateTotalBottlesCount(b), 0);
  const totalLitersCount = bottles.reduce((sum, b) => sum + calculateBottleTotalLiters(b), 0);
  const lowStockCount = bottles.filter(
    (b) => b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold
  ).length;

  const addBottleForm = <AddBottleForm />;

  return (
    <PageTransition className="space-y-8">
      {/* Fresh Grocery Landing Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-ink-2 border border-white/[0.08] p-6 sm:p-10 shadow-2xl">
        <div
          className="absolute inset-0 opacity-80 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 85% 20%, rgba(255,107,53,0.18) 0%, rgba(61,35,26,0.08) 45%, rgba(17,13,12,0) 80%), radial-gradient(circle at 15% 85%, rgba(232,165,99,0.07) 0%, rgba(17,13,12,0) 60%)",
          }}
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-caps text-gold font-bold bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.08]">
              <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
              <span>Marché & Épicerie Fine de Spiritueux</span>
            </div>
            <h1 className="font-display text-4xl sm:text-6xl font-bold text-cream tracking-tight leading-none">
              Le Marché <span className="text-orange">& La Cave</span>
            </h1>
            <p className="text-muted text-xs sm:text-sm leading-relaxed">
              Explorez vos rayons comme dans un marché artisanal d&apos;exception. Ajoutez ou retirez des bouteilles en un clic, surveillez vos volumes en litres et préparez vos courses.
            </p>
          </div>

          {/* Fresh Grocery Live KPIs Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="bg-ink/80 border border-white/[0.08] rounded-2xl p-3.5 text-center min-w-[110px]">
              <span className="text-[10px] uppercase tracking-caps text-muted block font-semibold">En Rayon</span>
              <span className="font-display text-2xl font-bold text-cream mt-1 block">
                {totalBottlesCount} <span className="text-xs font-normal text-muted">btl</span>
              </span>
            </div>

            <div className="bg-ink/80 border border-white/[0.08] rounded-2xl p-3.5 text-center min-w-[110px]">
              <span className="text-[10px] uppercase tracking-caps text-muted block font-semibold">Volume Total</span>
              <span className="font-display text-2xl font-bold text-orange mt-1 block">
                {formatLiters(totalLitersCount)}
              </span>
            </div>

            <AlertsManagerTrigger bottles={bottles} lowStockCount={lowStockCount} />

            <div className="bg-ink/80 border border-white/[0.08] rounded-2xl p-3.5 text-center min-w-[110px]">
              <span className="text-[10px] uppercase tracking-caps text-gold block font-semibold">Réserve VIP</span>
              <span className="font-display text-2xl font-bold text-gold mt-1 block">
                {vip.length} <span className="text-xs font-normal text-gold-dim">réf.</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Tabs & Fresh Market Shelves */}
      <StockTabs normalBottles={normal} vipBottles={vip} addBottleForm={addBottleForm} />
    </PageTransition>
  );
}
