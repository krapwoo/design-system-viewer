import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { UsageData, UsageEntry, UsageUse } from '../native/catalog/usage.ts';

export interface ParsedUsage {
  /** Absent when the file was missing or invalid; `warnings` says why. */
  usage?: UsageData;
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Checks parsed JSON against file format v1 and returns it stripped of unknown fields. Any wrong
 *  shape rejects the whole file with one message naming the first problem: partly trusted usage
 *  numbers would be worse than none. */
export function validateUsage(value: unknown): { usage: UsageData } | { problem: string } {
  if (!isRecord(value)) return { problem: 'the top level must be an object' };
  if (value.version !== 1) return { problem: `"version" must be 1 (found ${JSON.stringify(value.version)})` };

  let areas: string[] | undefined;
  if (value.areas !== undefined) {
    if (!Array.isArray(value.areas) || !value.areas.every((area) => typeof area === 'string')) return { problem: '"areas" must be an array of strings' };
    areas = value.areas as string[];
  }

  if (!isRecord(value.components)) return { problem: '"components" must be an object' };
  const components: Record<string, UsageEntry> = {};
  for (const [key, raw] of Object.entries(value.components)) {
    const where = `components["${key}"]`;
    if (!isRecord(raw)) return { problem: `${where} must be an object` };
    if (raw.area !== undefined && typeof raw.area !== 'string') return { problem: `${where}.area must be a string` };
    if (!Array.isArray(raw.uses)) return { problem: `${where}.uses must be an array` };
    const uses: UsageUse[] = [];
    for (const [index, rawUse] of raw.uses.entries()) {
      const useWhere = `${where}.uses[${index}]`;
      if (!isRecord(rawUse)) return { problem: `${useWhere} must be an object` };
      if (typeof rawUse.area !== 'string') return { problem: `${useWhere}.area must be a string` };
      if (typeof rawUse.file !== 'string' || rawUse.file === '') return { problem: `${useWhere}.file must be a non-empty string` };
      if (rawUse.line !== undefined && (typeof rawUse.line !== 'number' || !Number.isInteger(rawUse.line) || rawUse.line < 1)) {
        return { problem: `${useWhere}.line must be a positive whole number` };
      }
      uses.push(rawUse.line === undefined ? { area: rawUse.area, file: rawUse.file } : { area: rawUse.area, file: rawUse.file, line: rawUse.line });
    }
    components[key] = raw.area === undefined ? { uses } : { area: raw.area, uses };
  }
  return { usage: areas ? { version: 1, areas, components } : { version: 1, components } };
}

/** Parses the text of a usage file. Malformed JSON and a wrong shape are warnings, never throws. */
export function parseUsage(text: string, label: string): ParsedUsage {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { warnings: [`Usage file ${label} is not valid JSON (${(error as Error).message}); ignoring it.`] };
  }
  const result = validateUsage(json);
  if ('problem' in result) return { warnings: [`Usage file ${label} is not in the expected format: ${result.problem}; ignoring it.`] };
  return { usage: result.usage, warnings: [] };
}

/** Reads and validates the configured usage file. A missing file is a warning too: the generator
 *  may simply not have run yet, and the catalog works without it. */
export function loadUsage(projectRoot: string, usagePath: string): ParsedUsage {
  const resolved = path.resolve(projectRoot, usagePath);
  if (!existsSync(resolved)) return { warnings: [`Usage file not found: ${usagePath} — showing no usage data.`] };
  let text: string;
  try {
    text = readFileSync(resolved, 'utf8');
  } catch (error) {
    return { warnings: [`Could not read usage file ${usagePath}: ${(error as Error).message}; ignoring it.`] };
  }
  return parseUsage(text, usagePath);
}
