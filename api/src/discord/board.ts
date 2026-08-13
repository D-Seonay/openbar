/** Shapes the board needs, kept independent of Prisma's generated types. */
export interface BoardItem {
  label: string;
  neededCount: number;
  assignees: string[];
}

export interface BoardInput {
  eventName: string;
  eventDate: string;
  eventUrl: string;
  items: BoardItem[];
}

export interface DiscordEmbed {
  title: string;
  url?: string;
  description?: string;
  color: number;
  fields: { name: string; value: string; inline: boolean }[];
  footer: { text: string };
  timestamp: string;
}

/** The app's orange, so the board reads as coming from OpenBar. */
const ORANGE = 0xd8783a;

/** Discord rejects an embed carrying more than 25 fields. One item per field. */
const MAX_FIELDS = 25;
const MAX_FIELD_NAME = 256;
const MAX_FIELD_VALUE = 1024;

/**
 * Discord truncates over-long values silently, which would quietly drop the
 * end of a guest list. Cut deliberately instead, with an ellipsis that shows
 * something was removed.
 */
function clamp(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export function buildBoardEmbed(input: BoardInput): DiscordEmbed {
  const shown = input.items.slice(0, MAX_FIELDS);
  const hidden = input.items.length - shown.length;

  const fields = shown.map((item) => {
    const taken = item.assignees.length;
    const full = taken >= item.neededCount;
    const heading =
      item.neededCount > 1
        ? `${full ? '✅' : '⬜'} ${item.label} — ${taken}/${item.neededCount}`
        : `${full ? '✅' : '⬜'} ${item.label}`;

    return {
      name: clamp(heading, MAX_FIELD_NAME),
      value: clamp(
        taken > 0 ? item.assignees.join(', ') : "_personne pour l'instant_",
        MAX_FIELD_VALUE,
      ),
      inline: false,
    };
  });

  if (hidden > 0) {
    fields.push({
      name: `… et ${hidden} autre${hidden > 1 ? 's' : ''}`,
      value: 'Voir la liste complète sur OpenBar.',
      inline: false,
    });
  }

  const done = input.items.filter(
    (i) => i.assignees.length >= i.neededCount,
  ).length;

  return {
    title: clamp(`🍹 ${input.eventName}`, 200),
    url: input.eventUrl,
    description:
      input.items.length === 0
        ? "Rien à ramener pour l'instant."
        : `**${done}/${input.items.length}** ${done === 1 ? 'item couvert' : 'items couverts'} · ${input.eventDate}`,
    color: ORANGE,
    fields,
    footer: { text: 'OpenBar · à ramener' },
    timestamp: new Date().toISOString(),
  };
}
