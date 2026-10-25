// Task 2B2's own pure helper coverage: `referenceLinkProps` (`catalogReferences.ts`), the smallest
// shared contract `SectionBlock -> ReferenceDetails` and `FamilyPage` use to turn an already-true
// reference fact into a real, canonical, activatable link. No React here — this is the same
// Node-test-runner convention `catalogReferences.test.ts` already establishes for its own module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenceLinkProps, type ReferenceNavigation } from '../catalogReferences.ts';

function navigationStub(overrides: Partial<ReferenceNavigation> = {}): ReferenceNavigation & { opened: Array<{ pageId: string; memberId?: string; sourceMemberId?: string }> } {
  const opened: Array<{ pageId: string; memberId?: string; sourceMemberId?: string }> = [];
  return {
    resolve: () => undefined,
    open: (pageId, memberId, sourceMemberId) => { opened.push({ pageId, memberId, sourceMemberId }); },
    opened,
    ...overrides,
  };
}

test('referenceLinkProps is undefined when navigation is omitted — never fabricate a link', () => {
  assert.equal(referenceLinkProps(undefined, 'Button'), undefined);
});

test('referenceLinkProps is undefined for an unresolved name, even with navigation present', () => {
  const navigation = navigationStub({ resolve: () => undefined });
  assert.equal(referenceLinkProps(navigation, 'NoSuchThing'), undefined);
});

test('referenceLinkProps returns the resolved page-level target and an activating onPress', () => {
  const navigation = navigationStub({ resolve: (name) => (name === 'Button' ? { pageId: 'Button' } : undefined) });
  const link = referenceLinkProps(navigation, 'Button');
  assert.ok(link);
  assert.equal(link!.pageId, 'Button');
  assert.equal(link!.memberId, undefined);
  link!.onPress();
  assert.deepEqual(navigation.opened, [{ pageId: 'Button', memberId: undefined, sourceMemberId: undefined }]);
});

test('referenceLinkProps returns the resolved member target, distinct from its owning page', () => {
  const navigation = navigationStub({ resolve: (name) => (name === 'OldFace' ? { pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView' } : undefined) });
  const link = referenceLinkProps(navigation, 'OldFace');
  assert.deepEqual({ pageId: link!.pageId, memberId: link!.memberId }, { pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView' });
  link!.onPress();
  assert.deepEqual(navigation.opened, [{ pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView', sourceMemberId: undefined }]);
});

test('referenceLinkProps forwards an explicit source-member hint to navigation.open, and omits it when the call site supplies none', () => {
  const navigation = navigationStub({ resolve: () => ({ pageId: 'BotFamily' }) });
  referenceLinkProps(navigation, 'BotFamily', 'BotFace')!.onPress();
  assert.deepEqual(navigation.opened, [{ pageId: 'BotFamily', memberId: undefined, sourceMemberId: 'BotFace' }]);

  navigation.opened.length = 0;
  referenceLinkProps(navigation, 'BotFamily')!.onPress();
  assert.deepEqual(navigation.opened, [{ pageId: 'BotFamily', memberId: undefined, sourceMemberId: undefined }]);
});

test("referenceLinkProps's plain activation has one navigation owner and cancels the native anchor default", () => {
  let prevented = false;
  const event = { preventDefault: () => { prevented = true; } };
  const navigation = navigationStub({ resolve: () => ({ pageId: 'Button' }) });
  referenceLinkProps(navigation, 'Button')!.onPress(event);
  assert.equal(prevented, true, 'the shell owns normal reference activation and URL synchronization; native anchor default must not race it');
});

test("referenceLinkProps's onPress tolerates a missing event (a direct call, not a real press)", () => {
  const navigation = navigationStub({ resolve: () => ({ pageId: 'Button' }) });
  assert.doesNotThrow(() => referenceLinkProps(navigation, 'Button')!.onPress());
});

test("referenceLinkProps's onPress lets a modified click (new-tab) through untouched — no navigation, no preventDefault", () => {
  const navigation = navigationStub({ resolve: () => ({ pageId: 'Button' }) });
  for (const modified of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
    let prevented = false;
    navigation.opened.length = 0;
    referenceLinkProps(navigation, 'Button')!.onPress({ preventDefault: () => { prevented = true; }, ...modified });
    assert.equal(prevented, false, `${JSON.stringify(modified)} must not cancel the real anchor navigation`);
    assert.deepEqual(navigation.opened, [], `${JSON.stringify(modified)} must not trigger the shell's own activation`);
  }
});
