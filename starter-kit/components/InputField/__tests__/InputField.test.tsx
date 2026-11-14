// Ported from QQ's `InputField.test.tsx`.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { withKit } from '../../../../test/renderKit';
import { InputField } from '../InputField';

/** The field's own outermost element. */
const field = (root: HTMLElement) => root.firstElementChild as HTMLElement;

describe('InputField free-text label', () => {
  for (const label of ['Age', 'Location', 'Deadline']) {
    it(`renders the label "${label}" as given`, () => {
      withKit(<InputField label={label} onPress={() => {}} />, ({ container }) => {
        assert.equal(container.textContent, label);
      });
    });
  }

  it('announces a picker field by its label alone, and by label and value once filled', () => {
    withKit(<InputField label="Location" onPress={() => {}} />, ({ container }) => {
      assert.equal(field(container).getAttribute('role'), 'button');
      assert.equal(field(container).getAttribute('aria-label'), 'Location');
    });
    withKit(<InputField label="Age" value="18–24" onPress={() => {}} />, ({ container }) => {
      assert.equal(field(container).getAttribute('aria-label'), 'Age, 18–24');
    });
  });

  it('shows the label on an editable field and appends the optional marker', () => {
    withKit(<InputField label="Occupation" editable optional />, ({ container }) => {
      assert.ok(container.textContent!.includes('Occupation'));
      assert.ok(container.textContent!.includes('(Optional)'));
    });
  });

  it('has no default label: nothing is rendered or announced for a missing one', () => {
    // Untyped JS caller: the type requires `label` or `labelIcon`, so this only happens outside it.
    const Untyped = InputField as unknown as (p: Record<string, unknown>) => React.ReactElement;
    withKit(React.createElement(Untyped, { onPress: () => {} }), ({ container }) => {
      assert.doesNotMatch(container.textContent!, /To|From|Walk time|Arrive by/);
      assert.equal(field(container).getAttribute('aria-label'), '');
    });
  });
});

describe('InputField icon label', () => {
  it('renders the icon instead of a word', () => {
    withKit(<InputField labelIcon="flag" onPress={() => {}} />, ({ container }) => {
      assert.ok(container.querySelectorAll('svg').length > 0);
      assert.equal(container.textContent, '');
    });
  });

  it('is announced by its value only, since an icon has no text name', () => {
    withKit(<InputField labelIcon="flag" value="18–24" onPress={() => {}} />, ({ container }) => {
      assert.equal(field(container).getAttribute('aria-label'), '18–24');
    });
  });
});

// QQ's 'InputField props type' test is `@ts-expect-error` lines that only `tsc` can check. `npm run
// typecheck` does not cover `starter-kit/`, so it would pass vacuously here — skipped, not faked.
