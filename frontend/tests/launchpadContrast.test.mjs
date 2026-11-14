import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/design-tokens.css', import.meta.url), 'utf8');
const variables = block => Object.fromEntries([...block.matchAll(/(--lp-[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(([, key, value]) => [key, value]));
const light = variables(css.match(/:root\s*\{([^}]+)\}/)[1]);
const dark = { ...light, ...variables(css.match(/:root\[data-theme='dark'\]\s*\{([^}]+)\}/)[1]) };
const luminance = hex => hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => { const values = [luminance(a), luminance(b)].sort((x,y) => y-x); return (values[0] + .05) / (values[1] + .05); };

for (const [theme, tokens] of Object.entries({ light, dark })) {
  test(`Launchpad ${theme}: text and actions meet WCAG AA contrast`, () => {
    for (const surface of ['--lp-bg', '--lp-surface', '--lp-surface-soft', '--lp-surface-blue']) {
      for (const text of ['--lp-text', '--lp-muted', '--lp-primary']) {
        const ratio = contrast(tokens[text], tokens[surface]);
        assert.ok(ratio >= 4.5, `${text} on ${surface}: ${ratio.toFixed(2)}:1`);
      }
    }
    for (const [text, surface] of [['--lp-accent','--lp-bg'], ['--lp-accent','--lp-accent-soft'], ['--lp-on-primary','--lp-primary'], ['--lp-on-primary','--lp-primary-hover']]) {
      const ratio = contrast(tokens[text], tokens[surface]);
      assert.ok(ratio >= 4.5, `${text} on ${surface}: ${ratio.toFixed(2)}:1`);
    }
  });
  test(`Launchpad ${theme}: input boundaries and focus indicators meet 3:1`, () => {
    for (const surface of ['--lp-bg', '--lp-surface']) {
      for (const control of ['--lp-input-border', '--lp-focus']) {
        const ratio = contrast(tokens[control], tokens[surface]);
        assert.ok(ratio >= 3, `${control} on ${surface}: ${ratio.toFixed(2)}:1`);
      }
    }
  });
}
