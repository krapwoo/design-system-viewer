// Ported from QQ's `Badge.test.tsx`. Asserts on the react-native-web DOM the viewer renders (the
// accessible name is the element's `aria-label`; the label is real text), not on RN props.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { withKit } from '../../../../test/renderKit';
import { Badge, BADGE_VARIANT_ANNOUNCEMENT } from '../Badge';
import type { BadgeVariant } from '../Badge.types';

const VARIANTS: BadgeVariant[] = ['neutral', 'info', 'positive', 'warning', 'negative'];

/** The badge's own outermost element. */
const badge = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe('Badge accessible name', () => {
  it('has a word for every variant in the one exported map', () => {
    assert.deepEqual(Object.keys(BADGE_VARIANT_ANNOUNCEMENT).sort(), [...VARIANTS].sort());
  });

  for (const variant of VARIANTS.filter((v) => v !== 'neutral')) {
    it(`a ${variant} badge announces its label plus the variant word`, () => {
      withKit(<Badge variant={variant} label="Delayed" />, ({ container }) => {
        assert.equal(badge(container).getAttribute('aria-label'), `Delayed, ${BADGE_VARIANT_ANNOUNCEMENT[variant]}`);
        // QQ also asserts accessibilityRole === 'text' and accessible === true. react-native-web
        // emits neither (no ARIA role maps to "text", and `accessible` has no DOM attribute), so
        // there is nothing in the DOM to assert — skipped rather than faked.
      });
    });
  }

  it('announces the exact words for the five variants', () => {
    assert.deepEqual(BADGE_VARIANT_ANNOUNCEMENT, { neutral: '', info: 'info', positive: 'positive', warning: 'warning', negative: 'negative' });
  });

  it('neutral adds nothing: no composed label, so the badge reads as its own text', () => {
    withKit(<Badge variant="neutral" label="Delayed" />, ({ container }) => {
      assert.equal(badge(container).hasAttribute('aria-label'), false);
      assert.equal(badge(container).textContent, 'Delayed');
    });
  });

  it('defaults to neutral', () => {
    withKit(<Badge label="Delayed" />, ({ container }) => {
      assert.equal(badge(container).hasAttribute('aria-label'), false);
    });
  });

  it('an explicit accessibilityLabel wins and the variant word is not appended', () => {
    withKit(<Badge variant="warning" label="3" accessibilityLabel="3 delays" />, ({ container }) => {
      assert.equal(badge(container).getAttribute('aria-label'), '3 delays');
    });
  });

  it('an icon-only badge is named by its accessibilityLabel', () => {
    withKit(<Badge variant="negative" leadingIcon="circle-slash" accessibilityLabel="Cancelled" />, ({ container }) => {
      assert.equal(badge(container).getAttribute('aria-label'), 'Cancelled');
    });
  });
});

// QQ's 'Badge props type' test is `@ts-expect-error` lines that only `tsc` can check. `npm run
// typecheck` does not cover `starter-kit/`, so it would pass vacuously here — skipped, not faked.

describe('Badge dev warning backstop', () => {
  const realWarn = console.warn;
  const warnings: unknown[][] = [];
  afterEach(() => { console.warn = realWarn; warnings.length = 0; });
  const captureWarnings = () => { console.warn = (...args: unknown[]) => { warnings.push(args); }; };

  it('still warns for an untyped caller that renders an icon-only badge with no name', () => {
    captureWarnings();
    const Untyped = Badge as unknown as (props: Record<string, unknown>) => React.ReactElement;
    withKit(React.createElement(Untyped, { leadingIcon: 'pin' }), () => {});
    // React may re-invoke a component's render in dev, so count the badge's own warning, not all of them.
    const own = warnings.filter((args) => String(args[0]).includes('[Badge]'));
    assert.ok(own.length >= 1);
    assert.match(String(own[0][0]), /accessibilityLabel/);
  });

  it('does not warn for a labelled badge', () => {
    captureWarnings();
    withKit(<Badge label="Delayed" />, () => {});
    assert.equal(warnings.filter((args) => String(args[0]).includes('[Badge]')).length, 0);
  });
});
