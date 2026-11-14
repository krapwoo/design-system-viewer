// Smoke test: every example on every starter-kit catalog page renders without throwing and produces
// output. It proves nothing about what the output looks like or how it is laid out — it exists so a
// component (or a catalog page) that breaks outright is caught by name, on the page and example that
// broke, before it ships to every project that runs `ds-viewer init`.
//
// Pages are found on disk (`starter-kit/**/*.catalog.tsx`: the components' pages and the standalone
// ones under `pages/`), so a new component is covered the moment its page exists. Examples are
// enumerated by the viewer's own `presentationBlocks` (native/catalog/comparison.ts) — the same call
// that decides what a page shows — so "an example" means exactly what it means in the viewer:
// a grid cell, a list/grouped item, a `render()` preview, a token section, or a family member's own
// versions of those.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderKit } from '../../../test/renderKit';
import { indexCells, presentationBlocks } from '../../../native/catalog/comparison';
import type { CatalogMember, SectionDef } from '../../../native/catalog/types';
import { tokenDefinitionSections } from '../../../native/catalog/StructuredTokenPage';

const kitRoot = fileURLToPath(new URL('../../', import.meta.url));

/** Every `*.catalog.tsx` under the starter kit, as paths relative to it, sorted. */
function discoverCatalogPages(root: string): string[] {
  return (readdirSync(root, { recursive: true, encoding: 'utf8' }) as string[])
    .filter((file) => file.endsWith('.catalog.tsx') && !file.split(path.sep).includes('__tests__'))
    .sort();
}

interface Example {
  /** `Block title › example name`, for the failure message. */
  name: string;
  node: () => React.ReactNode;
}

/** A family member as the page-level shape `presentationBlocks` reads — the same projection
 *  `FamilyPage` makes (`memberAsSectionDef`) so a member's specimens are enumerated the same way. */
function memberAsSectionDef(member: CatalogMember): SectionDef {
  return {
    id: member.id,
    description: member.description,
    path: member.source,
    variants: member.variants,
    states: member.states,
    comparison: member.comparison,
    specimenSize: member.specimenSize,
    specimenSurface: member.specimenSurface,
    previewWidths: member.previewWidths,
    previewLayout: member.previewLayout,
  } as SectionDef;
}

/** A page as authored: the viewer's `SectionDef` plus the `members` a family page declares. */
type AuthoredPage = SectionDef & { members?: CatalogMember[] };

function examplesOf(def: AuthoredPage, scope: string): Example[] {
  const examples: Example[] = [];
  const prefix = scope ? `${scope} › ` : '';

  // A `tokenDefinition` page renders its sections through the structured token renderer, not through
  // `presentationBlocks`.
  if (def.tokenDefinition) {
    for (const section of tokenDefinitionSections(def.tokenDefinition)) {
      examples.push({ name: `${prefix}Token section › ${section.title}`, node: section.render });
    }
  }

  for (const block of presentationBlocks(def)) {
    const where = `${prefix}${block.title || block.kind}`;
    switch (block.kind) {
      case 'grid': {
        const cells = indexCells(block.comparison);
        for (const cell of cells.values()) {
          if (cell.node !== undefined) examples.push({ name: `${where} › ${cell.rowKey} × ${cell.columnKey}`, node: () => cell.node });
        }
        break;
      }
      case 'grouped':
        for (const group of block.groups) {
          for (const item of group.items) examples.push({ name: `${where} › ${group.label} › ${item.label}`, node: () => item.node as React.ReactNode });
        }
        break;
      case 'list':
        for (const item of block.items) examples.push({ name: `${where} › ${item.label}`, node: () => item.node as React.ReactNode });
        break;
      case 'preview':
        examples.push({ name: where, node: () => def.render!() });
        break;
      case 'tokenSections':
        for (const section of block.sections) examples.push({ name: `${where}Token section › ${section.title}`, node: section.render });
        break;
      case 'empty':
        break;
    }
  }

  for (const member of def.members ?? []) {
    examples.push(...examplesOf(memberAsSectionDef(member), `${prefix}Member ${member.id}`));
  }
  return examples;
}

const pageFiles = discoverCatalogPages(kitRoot);

describe('starter-kit catalog smoke test', () => {
  it('finds the kit\'s catalog pages on disk', () => {
    assert.ok(pageFiles.length > 0, `no *.catalog.tsx found under ${kitRoot}`);
    assert.ok(pageFiles.some((file) => file.startsWith('components')), 'no component pages found');
    assert.ok(pageFiles.some((file) => file.startsWith('pages')), 'no standalone pages found');
  });
});

for (const file of pageFiles) {
  describe(`catalog page ${file}`, async () => {
    const imported = await import(pathToFileURL(path.join(kitRoot, file)).href).then(
      (module) => ({ module }),
      (error: unknown) => ({ error }),
    );
    it('loads and exports a page', () => {
      if ('error' in imported) throw new Error(`${file} failed to import: ${(imported.error as Error)?.stack ?? imported.error}`);
      assert.equal(imported.module.default?.__dsViewerPage, true, `${file}: default export is not a defineCatalogPage() page`);
    });
    if ('error' in imported || !imported.module.default?.__dsViewerPage) return;

    const def = imported.module.default as AuthoredPage;
    const examples = examplesOf(def, '');
    it('documents at least one example', () => {
      assert.ok(examples.length > 0, `${file} has no renderable example`);
    });
    for (const example of examples) {
      it(`renders ${example.name}`, () => {
        // Name the page and example in the failure itself, so it reads the same in a flat CI log.
        const label = `${file} › ${example.name}`;
        let rendered: ReturnType<typeof renderKit>;
        try {
          rendered = renderKit(<>{example.node()}</>);
        } catch (error) {
          throw new Error(`${label} threw while rendering: ${(error as Error)?.stack ?? error}`);
        }
        try {
          const output = rendered.container.firstElementChild ?? rendered.container.textContent?.trim();
          assert.ok(output, `${label} rendered nothing`);
        } finally {
          rendered.cleanup();
        }
      });
    }
  });
}
