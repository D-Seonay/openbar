"use client";

import { useEffect, useState, useTransition } from "react";
import { inviteMemberAction, searchUsersAction } from "@/app/bar-actions";
import type { UserSearchResult } from "@/lib/types";

export default function InviteMemberForm({ barId }: { barId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<UserSearchResult | null>(null);
  const [results, setResults] = useState<UserSearchResult[]>([]);

  useEffect(() => {
    if (!query.trim() || selected) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchUsersAction(query).then(setResults);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, selected]);

  const handleSelect = (user: UserSearchResult) => {
    setSelected(user);
    setQuery(user.username);
    setResults([]);
  };

  return (
    <section className="bg-ink-2/40 border border-orange/10 p-5 sm:p-6 rounded-xl space-y-4">
      <div>
        <h2 className="font-display text-xl text-cream">Inviter un membre</h2>
        <p className="text-muted text-[11px] mt-0.5">Cherche parmi les comptes existants.</p>
      </div>
      <form
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await inviteMemberAction(barId, formData);
            if (result.error) {
              setError(result.error);
            } else {
              setQuery("");
              setSelected(null);
            }
          });
        }}
        className="space-y-3.5"
      >
        <div className="relative">
          <input
            name="username"
            required
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder="Chercher un identifiant"
            autoComplete="off"
            className="w-full bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange transition-all text-cream"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-ink-2 border border-orange/20 rounded-xl overflow-hidden shadow-xl">
              {results.map((user) => (
                <button
                  type="button"
                  key={user.id}
                  onClick={() => handleSelect(user)}
                  className="w-full text-left px-3 py-2 text-xs text-cream hover:bg-orange/10 transition-colors cursor-pointer"
                >
                  {user.username}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="vip" className="accent-gold" />
          Accès VIP sur ce bar
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-orange text-white font-medium rounded-xl py-2.5 hover:bg-orange-hover transition-all text-xs uppercase tracking-wider font-semibold"
        >
          Inviter
        </button>
      </form>
      {error && (
        <div className="text-xs bg-red-950/30 border border-red-500/30 rounded-xl p-3 text-red-300">{error}</div>
      )}
    </section>
  );
}
