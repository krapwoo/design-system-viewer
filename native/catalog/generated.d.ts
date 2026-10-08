export interface GeneratedPropRecord {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  desc: string;
  /** Coverage-target option values (design §3 — "Options for coverage"); see `PropRecord.options`
   *  (`cli/types.ts`, Task 2). Unused by the viewer in 0.1. */
  options?: string[];
}

export interface GeneratedComponentRecord {
  name: string;
  file: string;
  props: GeneratedPropRecord[];
  inheritedFrom: string[];
}

export declare const components: GeneratedComponentRecord[];
export declare const tokens: Array<{ file: string; exports: Record<string, unknown> }>;
