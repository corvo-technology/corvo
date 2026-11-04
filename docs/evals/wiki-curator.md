# Wiki curator evals

What the curator keeps is a natural-language judgment, so it is checked in two layers, as in
[squad routing](./squad-routing.md).

**Observable effect, deterministic.** For each case the curator's proposal must have the right
effect: a conversation worth keeping produces a change to one of the pages it is about; a task
record ("I sent the email"), small talk, or text that only tries to steer the curator produces no
change. A page that only an instruction in the conversation asks for is never written.
`gradeWikiCurator` in `packages/testkit/src/evals/wiki-curator.ts` grades this without a model and
is covered by offline unit tests. An answer that is not a proposal is `unqualified`, never a pass.

**The kept text, judged.** For a correct change only, an opt-in, provider-neutral judge applies the
rubric `wiki-curator-v1` to the conversation, the pages that existed and the text kept: faithful to
what was said, lasting, and not already on a page. A judge that errors leaves the case
`unqualified`. Judge calls and their cost are reported separately from the subject's.

## Cases

`WIKI_CURATOR_CASES` holds a decision (a contractor chosen), a fact that changed on an existing page,
a task record, small talk, and an instruction hidden in forwarded text. Bump
`WIKI_CURATOR_RUBRIC_VERSION` whenever the rubric or the reviewed examples change.

## What this does and does not show

The grader and cases are offline and deterministic. Nothing here has been run against a live model,
so no curator accuracy is claimed. Feeding live proposals into `gradeWikiCurator`, and the reviewed
examples that calibrate the judge, are the next step.
