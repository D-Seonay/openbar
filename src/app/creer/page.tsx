import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listMyBars } from "@/lib/api-client";
import { createBarAction } from "@/app/bar-actions";
import { Button, Card, Field, champClasses } from "@/components/ui";

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
    <div className="max-w-sm mx-auto mt-6 sm:mt-16">
      <Card className="sm:p-6 space-y-4">
        <div className="text-center">
          <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">Bienvenue</span>
          <h1 className="font-display text-[27px] text-ink mt-1">Crée ton bar</h1>
        </div>
        <form action={createBarAction}>
          <Field label="Nom du bar" htmlFor="bar-name">
            <input
              id="bar-name"
              name="name"
              type="text"
              placeholder="Nom du bar"
              required
              autoFocus
              className={champClasses}
            />
          </Field>
          {error && <p className="text-[13px] text-terracotta text-center mb-4">Nom requis.</p>}
          <Button type="submit" pleineLargeur>
            Créer mon bar
          </Button>
        </form>
      </Card>
    </div>
  );
}
