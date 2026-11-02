# Squad routing evals

Routing quality is a natural-language judgment, so it is checked in two layers.

**Observable effect, deterministic.** For each case the router's run must end in the right effect:
a `handoff_to_bot` to the expected group with a reason, an `ask_user` when two squads fit equally, or
no handoff when none fits. `gradeSquadRouting` in `packages/testkit/src/evals/squad-routing.ts`
grades this without a model and is covered by offline unit tests.

**The reason, judged.** For a correct handoff only, an opt-in, provider-neutral judge applies the
rubric `squad-routing-v1` to the request, the squads' purposes and the reason given. A judge that
errors leaves the case `unqualified`; it is never a pass. Judge calls and their cost are reported
separately from the subject's.

## Cases

`SQUAD_ROUTING_CASES` holds a clear match (landing page review to the product squad, an invoice to
finance), an ambiguous request that two near-identical support squads both fit, and a request no
squad covers. Bump `SQUAD_ROUTING_RUBRIC_VERSION` whenever the rubric or the reviewed examples change.

## What this does and does not show

The grader and cases are offline and deterministic. Nothing here has been run against a live model, so
no routing accuracy is claimed. Feeding live runs into `gradeSquadRouting`, and the reviewed examples
that calibrate the judge, are the next step.
