import { BottleType } from '@prisma/client';

/**
 * Open Food Facts lookup for a scanned barcode.
 *
 * This is the only outbound HTTP call the API makes, and it sits on the path of
 * a user-facing scan, so it must never hang a request or throw: every failure
 * mode (timeout, non-200, malformed body, unknown product) collapses to `null`
 * and the caller falls back to a blank form.
 */

const OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org/api/v2/product';

// Open Food Facts is a community database, so a scan can take a while or return
// something unusable. Cap the wait well below anything a user would tolerate
// standing in front of a shelf.
const LOOKUP_TIMEOUT_MS = 4000;

// Identifying the client is required by the Open Food Facts terms of use.
const USER_AGENT = 'OpenBar/1.0 (https://github.com/D-Seonay/bardenoa)';

export interface LookedUpProduct {
  name: string;
  type: BottleType;
  imageUrl: string | null;
  size: string | null;
}

/**
 * Scanners and humans disagree about spacing, and some readers prefix UPC-A
 * codes with a leading zero. Reduce everything to digits so a code stored from
 * one device still matches a scan from another; anything outside the real
 * barcode lengths (EAN-8 through ITF-14) is rejected rather than stored.
 */
export function normaliseBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}

/**
 * Open Food Facts categories are free-form, comma-separated and often in the
 * contributor's language, so this matches on substrings rather than exact tags.
 * Order matters: the first hit wins, so the more specific spirits come before
 * the broad `liqueur`/`autre` catch-alls.
 */
const TYPE_KEYWORDS: [BottleType, string[]][] = [
  // `whisk` rather than `whisky`, so the plurals ("whiskies", "whiskeys")
  // Open Food Facts actually uses are matched too.
  [BottleType.whisky, ['whisk', 'bourbon', 'scotch']],
  [BottleType.rhum, ['rhum', 'rum']],
  [BottleType.vodka, ['vodka']],
  [BottleType.gin, ['gin']],
  [BottleType.tequila, ['tequila', 'mezcal']],
  [BottleType.champagne, ['champagne', 'cremant', 'crémant', 'prosecco']],
  [BottleType.vin, ['vin', 'wine', 'rose', 'rosé']],
  [BottleType.biere, ['biere', 'bière', 'beer', 'lager', 'pils']],
  [
    BottleType.liqueur,
    ['liqueur', 'aperitif', 'apéritif', 'porto', 'vermouth'],
  ],
  [
    BottleType.mixer,
    ['jus', 'juice', 'soda', 'tonic', 'sirop', 'syrup', 'limonade', 'cola'],
  ],
];

export function mapCategoriesToType(
  categories: string | undefined,
): BottleType {
  if (!categories) return BottleType.autre;
  const haystack = categories.toLowerCase();
  for (const [type, keywords] of TYPE_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) return type;
  }
  return BottleType.autre;
}

/**
 * Open Food Facts reports quantity as free text ("70 cl", "1,5 L", "75cl e").
 * Pull out the leading number + unit and normalise it to the format the volume
 * editor already uses; anything unrecognisable is dropped rather than guessed.
 */
export function parseSize(quantity: string | undefined): string | null {
  if (!quantity) return null;
  const match = /(\d+(?:[.,]\d+)?)\s*(cl|ml|l|litre|liter)\b/i.exec(quantity);
  if (!match) return null;

  const amount = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = match[2].toLowerCase();
  if (unit === 'ml')
    return amount >= 1000 ? `${amount / 1000}L` : `${amount}ml`;
  if (unit === 'cl') return `${amount}cl`;
  return `${amount}L`;
}

interface OpenFoodFactsResponse {
  status?: number;
  product?: {
    product_name?: string;
    product_name_fr?: string;
    generic_name?: string;
    brands?: string;
    categories?: string;
    quantity?: string;
    image_front_url?: string;
    image_url?: string;
  };
}

export async function lookUpProduct(
  barcode: string,
): Promise<LookedUpProduct | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${OPEN_FOOD_FACTS_URL}/${encodeURIComponent(barcode)}.json`,
      {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;

    const body = (await response.json()) as OpenFoodFactsResponse;
    if (body.status !== 1 || !body.product) return null;

    const product = body.product;
    const name = (
      product.product_name_fr ||
      product.product_name ||
      product.generic_name ||
      product.brands ||
      ''
    ).trim();
    // A product with no usable name is worse than no result at all: it would
    // silently fill the form with an empty required field.
    if (!name) return null;

    const imageUrl = (
      product.image_front_url ||
      product.image_url ||
      ''
    ).trim();

    return {
      name,
      type: mapCategoriesToType(product.categories),
      // Remote https URL, stored as-is. `BottleImage` already renders absolute
      // URLs, and uploads stay reserved for files the user picked themselves.
      imageUrl: imageUrl.startsWith('https://') ? imageUrl : null,
      size: parseSize(product.quantity),
    };
  } catch {
    // Timeout, DNS failure, malformed JSON — all indistinguishable to the
    // caller, who just needs to know there is nothing to prefill.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
