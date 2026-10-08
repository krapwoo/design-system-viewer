# Release planning workflow (controller rules)

Approved by the owner on 2026-10-08, after the 0.4 retrospective. These rules apply from **0.5** onward. 0.4 is built from its existing plan and Errata, unchanged.

**Why:** in 0.2–0.4, every plan's first Fable review was NOT_READY. Most findings were defects that compiling or one test run would have caught. Each correction pass added code, and that new code produced most of the next round's findings: in 0.4, 6 of the 8 new Critical and Important findings were in code the correction pass wrote. Runtime behaviour (signals, ports) was only settled by running it.

## Adopted

1. **Spike runtime behaviour before the plan review.** Before the plan goes to review, the controller (or a slice) runs anything that depends on processes, signals, ports, the network, the OS or the package manager on a real host, and records the results in the plan. The review then judges recorded evidence, not guesses.
2. **Map state across boundaries before the plan is final.** When state crosses a process restart, a page reload, or more than one screen, run the `ux-flow-state` analysis on that flow and fold its findings into the plan before review. (Example from 0.4: once the update applied, `update.json` became null while the success screen still needed it.)
3. **Check correction coverage before any re-review.** The controller compares every review finding with the corrected plan text and marks it applied, partial or missing. Partial or missing findings go back to the author first. A worker's report that nothing was left unapplied doesn't count until the controller has checked it. Any spike the controller required must exist before the re-review.

## Trial (0.5): one plan review

4. **One Fable plan review, aimed at design, mockup conformance, security, and the order tasks must run in.** Its findings are applied in one correction pass, which the controller checks under rule 3. There is no second plan review: anything left goes into a binding `## Errata` section at the top of the plan. The full review happens on the built branch.
   - **Measure:** the Critical and Important counts from the 0.5 build review, compared with 0.3 (0 Critical, 6 Important) and 0.4 (1 Critical, 3 Important, 12 Minor; Fable, 2026-10-08), plus the hours from the mockup approval to the first build slice. 0.4 for reference: mockup approved at 11:59, first build slice started at 15:05 (local).
   - **Decide after 0.5:** keep the trial if the build-review Critical and Important counts are no worse than 0.3's or 0.4's, whichever is higher. Otherwise go back to two plan reviews.

## Not adopted

- **Contract-level plans** (interfaces, tests and acceptance checks instead of full code) are not adopted. Full-code plans keep Sonnet slices mechanical, and there is no evidence yet that contract-level plans would leave the build cleaner. A possible later experiment: keep full code only for high-risk tasks (the local endpoint, process control), and use contracts for the rest.
