import { listBarsDirectory } from "@/lib/api-client";
import PageTransition from "@/components/PageTransition";
import PaginationLinks from "@/components/PaginationLinks";
import BarDirectory from "@/app/BarDirectory";
import { paginate } from "@/lib/pagination";

export default async function DecouvrirPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const directory = await listBarsDirectory();
  const { page } = await searchParams;
  const bars = paginate(directory, page);

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-rule">
        <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">
          Sans compte
        </span>
        <h1 className="font-display text-[27px] text-ink mt-1">
          Découvrir les bars
        </h1>
      </div>

      <BarDirectory entries={bars.items} guestMode />

      <PaginationLinks
        currentPage={bars.currentPage}
        totalPages={bars.totalPages}
        basePath="/decouvrir"
      />
    </PageTransition>
  );
}
