import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadingNumber, leadingQuantity, tokenGridOrderProblems, TOKEN_GRID_ORDER_PREFIX } from '../tokenGridOrder.ts';

test('leadingNumber reads the first number a tile name starts with', () => {
  assert.equal(leadingNumber('4pt'), 4);
  assert.equal(leadingNumber('0.25s'), 0.25);
  assert.equal(leadingNumber('.5x'), 0.5);
  assert.equal(leadingNumber('22 × 22'), 22);
  assert.equal(leadingNumber('-8pt'), -8);
  assert.equal(leadingNumber('Pill'), undefined);
  assert.equal(leadingNumber('x4'), undefined);
});

test('an ascending scale, and non-numeric names anywhere, say nothing', () => {
  assert.deepEqual(tokenGridOrderProblems(['2pt', '4pt', '4 pt radius', '6pt', '17pt', '22 × 22']), []);
  assert.deepEqual(tokenGridOrderProblems(['Pill', '8pt', 'Card', '12pt', 'Sheet']), []);
  assert.deepEqual(tokenGridOrderProblems([]), []);
});

test('17pt before 4pt is reported once, naming both tiles', () => {
  const problems = tokenGridOrderProblems(['6pt', '17pt', '4pt', '2pt']);
  assert.equal(problems.length, 1);
  assert.ok(problems[0].startsWith(TOKEN_GRID_ORDER_PREFIX));
  assert.match(problems[0], /"4pt" comes after "17pt"/);
  assert.match(problems[0], /order="authored"/);
});

test('numeric order compares numbers, not strings (9pt before 10pt is fine)', () => {
  assert.deepEqual(tokenGridOrderProblems(['9pt', '10pt']), []);
  assert.equal(tokenGridOrderProblems(['10pt', '9pt']).length, 1);
});

test('a name used twice is reported once per name', () => {
  const problems = tokenGridOrderProblems(['6pt', '6pt', '6pt', '8pt', '8pt']);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /two tiles are named "6pt"/);
  assert.match(problems[1], /two tiles are named "8pt"/);
});

test('ordered: false skips only the ordering check', () => {
  assert.deepEqual(tokenGridOrderProblems(['17pt', '4pt'], { ordered: false }), []);
  assert.equal(tokenGridOrderProblems(['17pt', '4pt', '4pt'], { ordered: false }).length, 1);
});

test('a thousands group is one number (500ms before 1,000ms is fine)', () => {
  assert.equal(leadingNumber('1,000ms'), 1000);
  assert.equal(leadingNumber('1,234,567.5'), 1234567.5);
  assert.deepEqual(tokenGridOrderProblems(['500ms', '1,000ms']), []);
  assert.equal(tokenGridOrderProblems(['1,000ms', '500ms']).length, 1);
});

test('tiles are compared only when they share a unit', () => {
  assert.deepEqual(tokenGridOrderProblems(['250ms', '500ms', '1s']), []);
  assert.deepEqual(tokenGridOrderProblems(['250ms', '500ms', '1s', '2s']), []);
  const problems = tokenGridOrderProblems(['250ms', '1s', '2s', '1.5s']);
  assert.equal(problems.length, 1, 'a real mistake within one unit still fires');
  assert.match(problems[0], /"1.5s" comes after "2s"/);
});

test('ratios are no number, so a list of aspect ratios says nothing', () => {
  assert.equal(leadingNumber('16:9'), undefined);
  assert.equal(leadingNumber('3/2'), undefined);
  assert.equal(leadingNumber('4 : 3'), undefined);
  assert.deepEqual(tokenGridOrderProblems(['1:1', '4:3', '3:2', '16:9']), []);
  assert.deepEqual(tokenGridOrderProblems(['1/1', '4/3', '3/2', '16/9']), []);
});

test('a Unicode minus is read as a minus', () => {
  assert.equal(leadingNumber('\u22124pt'), -4);
  assert.deepEqual(tokenGridOrderProblems(['\u22128pt', '\u22124pt', '0pt']), []);
  assert.equal(tokenGridOrderProblems(['\u22124pt', '\u22128pt']).length, 1);
});

test('the unit is the token right after the number, so sizes and suffixed names are still compared', () => {
  assert.deepEqual(leadingQuantity('22 × 22'), { value: 22, unit: '×' });
  assert.deepEqual(leadingQuantity('4pt · xs'), { value: 4, unit: 'pt' });
  assert.deepEqual(leadingQuantity('4 pt radius'), { value: 4, unit: 'pt' });
  assert.deepEqual(leadingQuantity('16'), { value: 16, unit: '' });
  assert.equal(tokenGridOrderProblems(['44 × 44', '22 × 22']).length, 1);
  assert.equal(tokenGridOrderProblems(['4pt · xs', '2pt · xxs']).length, 1);
  assert.deepEqual(tokenGridOrderProblems(['250ms', '500ms', '1s']), []);
});
