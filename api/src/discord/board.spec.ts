import { buildBoardEmbed } from './board';

const base = {
  eventName: 'Apéro du samedi',
  eventDate: 'samedi 12 septembre',
  eventUrl: 'https://openbar.example/soirees/apero',
};

describe('buildBoardEmbed', () => {
  it('marks an item covered only once every slot is taken', () => {
    const embed = buildBoardEmbed({
      ...base,
      items: [
        { label: 'Glaçons', neededCount: 3, assignees: ['alice', 'bob'] },
        { label: 'Bière', neededCount: 2, assignees: ['léa', 'tom'] },
      ],
    });
    expect(embed.fields[0].name).toBe('⬜ Glaçons — 2/3');
    expect(embed.fields[1].name).toBe('✅ Bière — 2/2');
    expect(embed.description).toContain('**1/2**');
  });

  it('omits the count for an item that wants a single person', () => {
    const embed = buildBoardEmbed({
      ...base,
      items: [{ label: 'Chips', neededCount: 1, assignees: [] }],
    });
    // "0/1" would be noise, same rule the web UI follows.
    expect(embed.fields[0].name).toBe('⬜ Chips');
  });

  it('says so when nobody has claimed an item', () => {
    const embed = buildBoardEmbed({
      ...base,
      items: [{ label: 'Chips', neededCount: 1, assignees: [] }],
    });
    expect(embed.fields[0].value).toContain('personne');
  });

  it('handles an empty list without pretending there is progress', () => {
    const embed = buildBoardEmbed({ ...base, items: [] });
    expect(embed.fields).toHaveLength(0);
    expect(embed.description).toBe("Rien à ramener pour l'instant.");
  });

  it('stays within the 25 fields Discord accepts, and says what it hid', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      label: `Item ${i}`,
      neededCount: 1,
      assignees: [],
    }));
    const embed = buildBoardEmbed({ ...base, items });
    // 25 items + one line explaining the remainder.
    expect(embed.fields).toHaveLength(26);
    expect(embed.fields[25].name).toContain('5 autres');
  });

  it('truncates rather than letting Discord silently cut a long guest list', () => {
    const embed = buildBoardEmbed({
      ...base,
      items: [
        {
          label: 'x',
          neededCount: 40,
          assignees: Array<string>(300).fill('invité-au-nom-long'),
        },
      ],
    });
    expect(embed.fields[0].value.length).toBeLessThanOrEqual(1024);
    expect(embed.fields[0].value.endsWith('…')).toBe(true);
  });

  it('truncates an over-long soirée name', () => {
    const embed = buildBoardEmbed({
      ...base,
      eventName: 'é'.repeat(400),
      items: [],
    });
    expect(embed.title.length).toBeLessThanOrEqual(200);
  });
});
