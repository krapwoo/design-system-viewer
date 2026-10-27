import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findUsage, formatUseLocation, pageLevelUsage, usageByArea, usageRowLabel, type UsageData } from '../usage.ts';

const DATA: UsageData = {
  version: 1,
  components: {
    ChatBubble: { area: 'Chat', uses: [{ area: 'Bots', file: 'a.swift', line: 1 }, { area: 'Chat', file: 'b.swift' }, { area: 'Bots', file: 'c.swift', line: 9 }] },
    constructor: { uses: [] },
  },
};

test('findUsage returns the first key that has an entry, in the order given', () => {
  assert.equal(findUsage(DATA, ['Missing', 'ChatBubble']), DATA.components.ChatBubble);
  assert.equal(findUsage(DATA, [undefined, '', 'ChatBubble']), DATA.components.ChatBubble);
  assert.equal(findUsage(DATA, ['Missing', undefined]), undefined);
});

test('findUsage is absent without data and ignores inherited object keys', () => {
  assert.equal(findUsage(null, ['ChatBubble']), undefined);
  assert.equal(findUsage(undefined, ['ChatBubble']), undefined);
  assert.equal(findUsage({ version: 1, components: {} }, ['toString', 'hasOwnProperty']), undefined);
});

test('usageByArea counts per area, highest first, ties by name', () => {
  assert.deepEqual(usageByArea(DATA.components.ChatBubble), [{ area: 'Bots', count: 2 }, { area: 'Chat', count: 1 }]);
  const tied = usageByArea({ uses: [{ area: 'Zed', file: 'z' }, { area: 'Alpha', file: 'a' }] });
  assert.deepEqual(tied.map((r) => r.area), ['Alpha', 'Zed']);
});

test('formatUseLocation is file:line, or the file alone without a line', () => {
  assert.equal(formatUseLocation({ area: 'A', file: 'BotRoomView.swift', line: 152 }), 'BotRoomView.swift:152');
  assert.equal(formatUseLocation({ area: 'A', file: 'BotRoomView.swift' }), 'BotRoomView.swift');
});

test('usageRowLabel reads "Chat, 5 uses" and uses the singular for one', () => {
  assert.equal(usageRowLabel('Chat', 5), 'Chat, 5 uses');
  assert.equal(usageRowLabel('Chat', 1), 'Chat, 1 use');
});

test('pageLevelUsage gives a family page its own entry, unless one of its members already shows it', () => {
  const data: UsageData = { version: 1, components: { Card: { uses: [{ area: 'A', file: 'f' }] }, Other: { uses: [] } } };
  assert.equal(pageLevelUsage(data, { id: 'Card' }, [{ id: 'CardHeader' }]), data.components.Card);
  assert.equal(pageLevelUsage(data, { id: 'CardPage', component: 'Card' }, []), data.components.Card);
  assert.equal(pageLevelUsage(data, { id: 'Card' }, [{ id: 'Card' }]), undefined, 'the whole shows it');
  assert.equal(pageLevelUsage(data, { id: 'Missing' }, []), undefined);
  assert.equal(pageLevelUsage(null, { id: 'Card' }, []), undefined);
});
