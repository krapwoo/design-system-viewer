`ds-viewer.config.ts`'s `starterKit` gained an optional `root` field, written by `init --new`;
older configs without it still work via inference from the `components` glob.
