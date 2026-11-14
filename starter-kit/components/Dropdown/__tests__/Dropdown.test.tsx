// Ported from QQ's `Dropdown.test.tsx`. QQ forces the picker open by patching `useState`; here the
// trigger is clicked, as a user would, and the Modal is counted in the real DOM.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act } from 'react';
import { settle, withKitAsync } from '../../../../test/renderKit';
import { Dropdown } from '../Dropdown';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];
const picker = <Dropdown label="Pick" options={OPTIONS} onChange={() => {}} />;
const modalCount = (body: HTMLElement) => body.querySelectorAll('[aria-modal="true"]').length;

describe('Dropdown picker', () => {
  it('renders no Modal while closed', async () => {
    await withKitAsync(picker, async ({ body }) => {
      await settle();
      assert.equal(modalCount(body), 0);
    });
  });

  it('renders exactly one Modal when open — BottomSheet owns it, Dropdown adds none', async () => {
    await withKitAsync(picker, async ({ container, body }) => {
      await settle();
      await act(async () => { container.querySelector<HTMLElement>('[aria-label="Pick"]')!.click(); });
      assert.equal(modalCount(body), 1);
      assert.deepEqual(
        Array.from(body.querySelectorAll('[role="radio"]')).map((option) => option.textContent),
        ['Alpha', 'Beta'],
      );
    });
  });
});
