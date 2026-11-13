import { describe, it, expect } from 'vitest';
import { DEMOS } from './demos.js';
import { fromJSON, toJSON, MAX_CHAIN } from './serialize.js';
import { generateCode, trackMini, playOrder, PATTERN_NAMES } from '../engine/codegen.js';
import { mini } from '@strudel/mini';

// first note of every bar for one track over the whole song (null = silent bar)
function firstNotePerBar(track, project) {
  const order = playOrder(project);
  const m = trackMini(track, order);
  if (!m) return order.map(() => null);
  const pat = mini(m);
  return order.map((_, bar) => {
    const haps = pat.queryArc(bar, bar + 1).filter((h) => h.hasOnset()).sort((a, b) => a.whole.begin.compare(b.whole.begin));
    return haps.length ? Number(haps[0].value) : null;
  });
}

describe.each(DEMOS)('demo: $name', ({ build }) => {
  const raw = build();
  const project = fromJSON(raw);

  it('survives normalisation and a save/load round trip unchanged', () => {
    expect(project.tracks.length).toBe(raw.tracks.length);
    expect(project.chain).toEqual(raw.chain);
    const again = fromJSON(JSON.parse(JSON.stringify(toJSON(project))));
    expect(toJSON(again)).toEqual(toJSON(project));
  });

  it('fits the limits and is a real song', () => {
    expect(project.song).toBe(true);
    expect(project.chain.length).toBeLessThanOrEqual(MAX_CHAIN);
    expect(project.chain.length * (4 * 60) / project.bpm).toBeGreaterThan(45); // seconds
  });

  it('every generated line parses', () => {
    const lines = generateCode(project).split('\n').slice(1);
    expect(lines.length).toBe(project.tracks.length);
    for (const line of lines) {
      const body = line.match(/^\$: (?:s|n)\("([^"]*)"\)/)[1];
      expect(() => mini(body).queryArc(0, project.chain.length)).not.toThrow();
    }
  });

  it('share link stays reasonably short', () => {
    expect(JSON.stringify(toJSON(project)).length).toBeLessThan(8000);
  });
});

describe('trance demo harmony', () => {
  const project = fromJSON(DEMOS.find((d) => d.id === 'trance').build());
  const byName = (n) => project.tracks.find((t) => t.name === n);

  // Am on even bars, F on odd bars, across every section boundary.
  const expectChords = (track, am, f) => {
    firstNotePerBar(track, project).forEach((note, bar) => {
      if (note === null) return;
      expect([bar, note]).toEqual([bar, bar % 2 === 0 ? am : f]);
    });
  };

  it('bass follows Am | F for the whole song', () => expectChords(byName('Bass'), 7, 5));
  it('pad follows Am | F for the whole song', () => expectChords(byName('Pad high'), 4, 5));
  it('lead starts each bar on A', () => expectChords(byName('Lead'), 7, 7));

  it('sections are where they should be', () => {
    const names = project.chain.map((p) => PATTERN_NAMES[p]).join('');
    expect(names).toBe('AAAABBBBBBBBEEEEEEEECCCCDDDDFGGGGGGGHHHH');
    const bass = firstNotePerBar(byName('Bass'), project);
    expect(bass.slice(0, 4)).toEqual([null, null, null, null]); // intro: drums only
    expect(bass.slice(12, 20).every((n) => n === null)).toBe(true); // breakdown: no bass
  });
});
