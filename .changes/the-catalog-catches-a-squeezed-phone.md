A `PhoneFrame` that has to shrink now says so. Any example given a cell narrower than the 375px device scales the whole phone down, and its own body text shrinks with it — which is no longer the size anyone reads the component at. The frame already computes that scale to lay itself out, so it now warns when it drops below 95%, naming the page, the example and the cell width:

    [Catalog] BottomSheet (variants/content-only) is shown at 75% of device size: its cell is
    283px, narrower than the 375px device. Declare a larger specimenSize so the example keeps
    the width it is used at.

`check:catalog` fails on any `[Catalog]` warning, so an under-declared page is caught in CI rather than by someone noticing that a screenshot looks cramped.

The threshold is 95%, not 100%: a regular cell leaves 370px for a 375px device, and warning about a 1.3% reduction nobody can see would only train authors to ignore the warning.

Where the scaling is the point — a page documenting that a narrow cell shrinks the device rather than reflowing it — the example declares `<PhoneFrame intentionalScale>`. The exemption sits in the example itself, visible where the decision was made, rather than in config.

This found four pages whose phones were being rendered at 75%: `BottomSheet`, `Dialog`, `OverlayDemo` and `PhoneScreen`. All four now declare `specimenSize: 'wide'`.
