import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listMyBars } from "@/lib/api-client";
import { createBarAction } from "@/app/bar-actions";

export default async function NewBarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  if (bars.some((bar) => bar.myRole === "OWNER")) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <div className="max-w-sm mx-auto mt-16 bg-ink-2/40 border border-orange/10 p-8 rounded-xl box-orange-glow space-y-4">
      <div className="text-center">
        <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">Bienvenue</span>
        <h1 className="font-display text-3xl text-cream mt-1">Crée ton bar</h1>
      </div>
      <form action={createBarAction} className="space-y-3">
        <input
          name="name"
          type="text"
          placeholder="Nom du bar"
          required
          autoFocus
          className="w-full bg-ink border border-orange/15 rounded-xl px-4 py-2.5 text-xs text-center placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
        {error && <p className="text-xs text-red-400 text-center">Nom requis.</p>}
        <button
          type="submit"
          className="w-full bg-orange text-white font-medium rounded-xl py-3 hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider text-xs font-semibold"
        >
          Créer mon bar
        </button>
      </form>
    </div>
  );
}
