import { listBarsDirectory } from "@/lib/api-client";
import PageTransition from "@/components/PageTransition";
import BarDirectory from "@/app/BarDirectory";

export default async function DecouvrirPage() {
  const directory = await listBarsDirectory();

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-orange/15">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>Sans compte</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
          Découvrir les bars
        </h1>
      </div>

      <BarDirectory entries={directory} guestMode />
    </PageTransition>
  );
}
