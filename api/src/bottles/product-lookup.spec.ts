import { BottleType } from '@prisma/client';
import {
  mapCategoriesToType,
  normaliseBarcode,
  parseSize,
} from './product-lookup';

describe('normaliseBarcode', () => {
  it('strips the separators a scanner or a human may introduce', () => {
    expect(normaliseBarcode('3 049 197 000 470')).toBe('3049197000470');
    expect(normaliseBarcode('  5000267023656\n')).toBe('5000267023656');
    expect(normaliseBarcode('50-002-670')).toBe('50002670');
  });

  it('accepts the real barcode lengths', () => {
    expect(normaliseBarcode('12345678')).toBe('12345678');
    expect(normaliseBarcode('12345678901234')).toBe('12345678901234');
  });

  it('rejects anything too short, too long, or with no digits at all', () => {
    expect(normaliseBarcode('1234567')).toBeNull();
    expect(normaliseBarcode('123456789012345')).toBeNull();
    expect(normaliseBarcode('')).toBeNull();
    expect(normaliseBarcode('pas-un-code')).toBeNull();
  });
});

describe('mapCategoriesToType', () => {
  it('matches on substrings of the free-form category list', () => {
    expect(mapCategoriesToType('Boissons, Spiritueux, Whiskies écossais')).toBe(
      BottleType.whisky,
    );
    expect(mapCategoriesToType('Boissons alcoolisées, Rhums, Rhum ambré')).toBe(
      BottleType.rhum,
    );
    expect(mapCategoriesToType('Beverages, Beers, Lagers')).toBe(
      BottleType.biere,
    );
  });

  it('prefers the specific spirit over the generic catch-alls', () => {
    // Both "liqueur" and "gin" appear; gin is listed first and must win.
    expect(mapCategoriesToType('Liqueurs, Gin, Apéritifs')).toBe(
      BottleType.gin,
    );
  });

  it('falls back to `autre` when nothing matches or nothing is provided', () => {
    expect(mapCategoriesToType('Épicerie, Conserves')).toBe(BottleType.autre);
    expect(mapCategoriesToType(undefined)).toBe(BottleType.autre);
  });
});

describe('parseSize', () => {
  it('normalises the free-text quantity Open Food Facts returns', () => {
    expect(parseSize('70 cl')).toBe('70cl');
    expect(parseSize('75cl e')).toBe('75cl');
    expect(parseSize('1,5 L')).toBe('1.5L');
    expect(parseSize('1 litre')).toBe('1L');
  });

  it('promotes millilitres to litres past the thousand mark', () => {
    expect(parseSize('500 ml')).toBe('500ml');
    expect(parseSize('1000 ml')).toBe('1L');
  });

  it('drops values it cannot read rather than guessing', () => {
    expect(parseSize('grande bouteille')).toBeNull();
    expect(parseSize('0 cl')).toBeNull();
    expect(parseSize(undefined)).toBeNull();
  });
});
