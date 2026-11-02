# Workflows and the two-level sidebar

## Why

A routine today wakes one agent with one prompt. Real work is a chain: a schedule or event starts
one agent, whose result another agent continues, and so on until the work is done. Owners should be
able to see that chain, run it, and watch each step finish. At the same time the sidebar mixes
the agent list with every other screen, so moving between Agents, Routines, Usage and Artifacts
costs a wide panel the other screens do not need.

## Goals

- A **workflow**: one trigger plus an ordered list of steps. Each step is an agent and an instruction.
  A step receives the previous step's final answer and its own instruction, runs as a normal run, and
  hands its answer to the next step.
- Triggers are the ones a routine already has: schedule, webhook, GitHub event, change watch, and
  a manual "Run now". A workflow reuses them; it does not add new trigger kinds.
- A workflows screen: a canvas with the trigger and the steps as cards in a line, each showing the
  agent, its instruction and the state of the last run; a details panel for the selected run with
  each step's state. A "Run now" button on the trigger card.
- A narrow icon rail (Agents, Routines, Workflows, Usage, Artifacts; Store and Help at the bottom).
  The wide panel with the agent list and search shows only under Agents. Other screens use the full width.
- Usage becomes its own screen in the rail; the account menu keeps Settings and Sign out.

## Non-goals

- No branching, loops, parallel steps or conditions. A workflow is a straight line. Anything more
  waits until owners ask for it.
- No new way for an agent to run a workflow in this work (a later `run_workflow` tool follows the same
  approval path as other fleet tools).
- No new visible copy beyond rail labels that already exist in menus, and names for the new screen
  and its controls.

## Anti-goals

- A failed or cancelled step must never silently continue the chain, and a retry must never run a step twice.
- Step results are the owner's data: they move between agents of the same space only.

## Design

**Data (additive migration, safe for rolling deploy).**
- `Workflow`: id, spaceId, userId, name, active, plus the trigger fields a routine has, so the
  schedule, webhook, GitHub and watch machinery is shared with `Routine` rather than copied.
  Preferred shape: a workflow *is* the existing routine for step 1; added tables only extend it.
- `RoutineStep`: id, routineId, position (from 2), botId, instruction. Step 1 stays the routine's own
  bot and prompt, so every existing routine is already a one-step workflow and nothing has to be migrated.
- `Run` gains nullable `routineStepId` and `previousRunId` to tie a step's run to its predecessor.

**Execution (backend owns it).**
- When a routine run completes and the routine has steps, the server enqueues the next step's run with
  trigger `routine`, the previous run's final answer and the step's instruction as its prompt. The
  enqueue is keyed by (previous run id, step position) so a lost response or double delivery creates the run once.
- A step that fails or is cancelled ends the chain; the workflow run shows which step stopped it.
- Approvals, spending limits and tool rules apply to each step as to any run. A step's agent must be in the same space.
- Running it by hand reuses the `testRun` path (to be extracted into one shared "start a routine run" function
  that the schedule, webhook and manual button all call).

**API.** `routines.*` grows step operations (add, update, reorder, remove) and the list/read
responses include steps and each step's last run state. `routines.calendar` and `list_routines` keep working.

**Web.**
- Rail component with an active state per section; wide panel rendered only under Agents.
- Workflows screen at `/app/workflows` using the existing routine card, a simple vertical or horizontal
  chain, and a details panel. Usage at `/app/usage`.
- On phone widths the rail becomes the existing menu; mobile native work is out of scope here.

## Calls I made (change any of them)

1. Workflow = routine plus extra steps, not a separate model, so triggers and schedules are not duplicated.
2. Straight line only.
3. Step output passes as the previous run's final answer text, not structured data.
4. Usage moves to a screen; its panel entry in the account menu is removed.
5. The routines calendar stays as "Routines"; "Agenda" is not a separate screen.

## Left to the builder

Exact table and column names, the rail's icons, canvas spacing, and the details-panel layout, following
existing tokens and components.

## Testing

Deterministic and offline: unit tests for step chaining (success, failure stops the chain, duplicate
delivery creates one run), API contract tests for step operations, web tests for the rail and the screens.
Postgres journeys cover the migration and the chain end to end; they run in CI.
