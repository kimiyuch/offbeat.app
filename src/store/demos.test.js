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

describe('electro demo harmony', () => {
  const project = fromJSON(DEMOS.find((d) => d.id === 'electro').build());
  const byName = (n) => project.tracks.find((t) => t.name === n);
  const expectChords = (track, em, f) => {
    let checked = 0;
    firstNotePerBar(track, project).forEach((note, bar) => {
      if (note === null) return;
      checked++;
      expect([bar, note]).toEqual([bar, bar % 2 === 0 ? em : f]);
    });
    expect(checked).toBeGreaterThan(0);
  };

  it('bass follows Em | F for the whole song', () => expectChords(byName('Bass'), 0, 1));
  it('pads follow Em | F for the whole song', () => {
    expectChords(byName('Pad high'), 4, 5);
    expectChords(byName('Pad low'), 2, 3);
  });
  it('lead follows Em | F for the whole song', () => expectChords(byName('Lead'), 4, 5));

  it('uses the 808, a bit of swing, and every sound exists on that machine', () => {
    expect(project.bank).toBe('tr808');
    expect(project.swing).toBeGreaterThan(0);
    // sounds the TR-808 map has (tidal-drum-machines): no rd, no cr in this demo
    const has808 = ['bd', 'sd', 'cp', 'rim', 'hh', 'oh', 'cb', 'ht', 'mt', 'lt', 'cr', 'perc', 'sh'];
    for (const t of project.tracks.filter((t) => t.type !== 'synth')) expect(has808).toContain(t.sound);
  });

  it('every section is an even number of bars (keeps Em on section starts)', () => {
    const runs = [];
    project.chain.forEach((p, k) => (k && project.chain[k - 1] === p ? runs[runs.length - 1].n++ : runs.push({ p, n: 1 })));
    for (const r of runs) expect(r.n % 2).toBe(0);
  });
});
