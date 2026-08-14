"use client";

import { useEffect, useState, useTransition } from "react";
import { inviteMemberAction, searchUsersAction } from "@/app/bar-actions";
import type { UserSearchResult } from "@/lib/types";
import { Button } from "@/components/ui";

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
    <section className="bg-paper-sunk/40 border border-rule p-5 sm:p-6 rounded-xl space-y-4">
      <div>
        <h2 className="font-display text-[17px] text-ink">Inviter un membre</h2>
        <p className="text-ink-soft text-[13px] mt-0.5">Cherche parmi les comptes existants.</p>
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
            className="w-full min-h-[44px] bg-paper-sunk border border-rule rounded-xl px-3 py-2 text-[15px] placeholder:text-ink-soft focus:outline-none focus:border-terracotta transition-all text-ink"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-paper border border-rule rounded-xl overflow-hidden">
              {results.map((user) => (
                <button
                  type="button"
                  key={user.id}
                  onClick={() => handleSelect(user)}
                  className="tap-target w-full text-left px-3 py-2 text-[15px] text-ink hover:bg-paper-sunk transition-colors cursor-pointer"
                >
                  {user.username}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink-soft">
          <input
            type="checkbox"
            name="vip"
            className="tap-target shrink-0 rounded border-rule accent-terracotta cursor-pointer"
          />
          Accès VIP sur ce bar
        </label>
        <Button type="submit" pleineLargeur disabled={isPending}>
          Inviter
        </Button>
      </form>
      {error && (
        <div className="text-[13px] bg-paper-sunk border border-terracotta/30 rounded-xl p-3 text-terracotta">{error}</div>
      )}
    </section>
  );
}
