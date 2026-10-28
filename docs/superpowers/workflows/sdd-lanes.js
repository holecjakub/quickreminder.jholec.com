export const meta = {
  name: 'sdd-lanes',
  description: 'Run implementation-plan tasks lane by lane: implementer, task reviewer, scoped fix rounds, ledger',
  phases: [
    { title: 'Preflight', detail: 'conflict scan and ledger' },
    { title: 'Build', detail: 'lanes in parallel, tasks sequential inside a lane' },
    { title: 'Final review', detail: 'whole-branch review, one fix wave, one re-review' },
  ],
}

const A = args
const SKILL = A.skill
const APP = A.app
const PLAN_REL = A.planRel
const SPEC_REL = A.specRel
const TRAILERS = A.trailers

const planIn = dir => `${dir}/${PLAN_REL}`
const specIn = dir => `${dir}/${SPEC_REL}`

const NO_SUBAGENTS = `You do not dispatch subagents: do all of the work yourself, never spawn a helper or a reviewer. Review comes from the controller after you report.`

const COMMON = dir => `
Repository: ${dir} (a git worktree; work ONLY here, never in another checkout). Run every git and npm command from this directory.
Spec (binding authority): ${specIn(dir)}
Contracts (names and signatures): ${dir}/docs/superpowers/plans/parts/00-contracts.md
Plan: ${planIn(dir)} — do NOT read the whole plan; read only the lines the prompt names.
App source of truth (read-only, same machine): ${APP} — SPEC.md, Sources/QuickReminder/**, Tests/QuickReminderCoreTests/**. Where the Swift code and any document disagree, the code wins.
Commits: Conventional Commits in English. End every commit message with these trailer lines exactly:
${TRAILERS}
`

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['DONE', 'DONE_WITH_CONCERNS', 'BLOCKED', 'NEEDS_CONTEXT'] },
    baseSha: { type: 'string' },
    headSha: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    testSummary: { type: 'string' },
    concerns: { type: 'string' },
    reportFile: { type: 'string' },
    briefFile: { type: 'string' },
  },
  required: ['status', 'baseSha', 'headSha', 'commits', 'testSummary', 'concerns', 'reportFile', 'briefFile'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    specCompliant: { type: 'boolean' },
    approved: { type: 'boolean' },
    findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['Critical', 'Important', 'Minor'] }, text: { type: 'string' } }, required: ['severity', 'text'] } },
    cannotVerify: { type: 'array', items: { type: 'string' } },
    diffFile: { type: 'string' },
  },
  required: ['specCompliant', 'approved', 'findings', 'cannotVerify', 'diffFile'],
}

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['DONE', 'BLOCKED'] },
    headSha: { type: 'string' },
    testSummary: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['status', 'headSha', 'testSummary', 'notes'],
}

const REREVIEW_SCHEMA = {
  type: 'object',
  properties: {
    allAddressed: { type: 'boolean' },
    open: { type: 'array', items: { type: 'string' } },
    newBreakage: { type: 'array', items: { type: 'string' } },
    outOfScope: { type: 'array', items: { type: 'string' } },
  },
  required: ['allAddressed', 'open', 'newBreakage', 'outOfScope'],
}

function implementerPrompt(lane, t, extra) {
  const dir = lane.dir
  return `You are implementing Task ${t.n} of the implementation plan for quickreminder.jholec.com (lane "${lane.name}", branch ${lane.branch}).
${COMMON(dir)}
## First
1. \`cd "${dir}" && git rev-parse HEAD\` → this is baseSha; report it exactly.
2. \`cd "${dir}" && bash "${SKILL}/scripts/task-brief" "${planIn(dir)}" ${t.n}\` → read the printed brief file FIRST and in full. It is your requirements, with the exact values to use verbatim. Report its path as briefFile.
3. \`cd "${dir}" && bash "${SKILL}/scripts/sdd-workspace" "${planIn(dir)}"\` → the workspace directory; your report file is <workspace>/task-${t.n}-report.md.
4. Read lines 15–100 of the plan (Global Constraints and the contract-deviation table): they bind this task.
## Context
${lane.context}
Earlier tasks of this lane are already committed in this worktree: read their exported names from the source files rather than from the plan. Tests from earlier tasks must keep passing.
${extra || ''}
## Your job
Implement exactly what the brief specifies, in its TDD order: write the failing test, run it and see it fail, implement, run it and see it pass, commit. While iterating run the focused test; run the full suite once before the final commit. Follow the plan's file structure; one responsibility per file. YAGNI: build only what the brief asks. If the brief and the Swift code disagree on a value, the code wins; note it in the report.
${NO_SUBAGENTS}
If the task needs an architectural decision the brief does not make, or you cannot find clarity after reading, stop and return BLOCKED or NEEDS_CONTEXT with specifics instead of guessing.
## Before reporting: self-review
Read your own diff: completeness against the brief, names that say what things do, no overbuilding, tests that verify behaviour (not mocks), pristine test output (no warnings). Fix what you find.
## Report
Write the full report to the report file: what you implemented, what you tested with results, TDD evidence (RED command + failing output, GREEN command + passing output), files changed, self-review findings, concerns. Then append one line to <workspace>/progress.md: "Task ${t.n}: implemented (commits <base7>..<head7>) — <one-line test summary>".
Return the structured result only: status, baseSha, headSha (\`git rev-parse HEAD\` after your last commit), commits (short sha + subject), testSummary, concerns, reportFile, briefFile.`
}

function reviewerPrompt(lane, t, r) {
  const dir = lane.dir
  return `You are reviewing one task's implementation: first whether it matches its requirements, then whether it is well-built. Task-scoped gate, not a merge review.
${COMMON(dir)}
Task ${t.n}. Read the task brief first: ${r.briefFile}
Then read lines 15–100 of ${planIn(dir)} (Global Constraints and contract deviations): they are the binding requirements for this task — exact values, formats and relationships.
Implementer's report (unverified claims; verify against the diff, rationales never downgrade a finding): ${r.reportFile}
## Diff under review
Base ${r.baseSha}, head ${r.headSha}. Run \`cd "${dir}" && bash "${SKILL}/scripts/review-package" "${planIn(dir)}" ${r.baseSha} ${r.headSha}\` and read the printed file once: commit list, stat, full diff with context. The diff's context lines ARE the changed files; read a changed file separately only if a hunk you must judge is cut off. Inspect code outside the diff only for a concrete named risk (e.g. a changed signature → its call sites). Read-only: never mutate the working tree, index or branches. ${NO_SUBAGENTS}
## Tests
The implementer ran the tests and reported TDD evidence. Do not re-run the suite. Run a focused test only when reading the code raises a specific doubt. Warnings or noise in the reported test output are findings.
## Part 1: spec compliance
Missing / Extra / Misunderstood against the brief and the global constraints. Every numeric value in the brief must appear in the code exactly. Requirements you cannot verify from this diff go to cannotVerify.
## Part 2: code quality
Separation of concerns, error handling, DRY without premature abstraction, edge cases; tests verify real behaviour; files follow the plan's structure; no newly huge files.
## Calibration
Important = the task cannot be trusted until fixed (wrong or fragile behaviour, a missed requirement, verbatim duplicated logic, swallowed errors, tests that assert nothing). Polish and broader coverage are Minor. Something the brief mandates that is a defect is still a finding, labelled plan-mandated.
Append one line to the workspace ledger (<workspace> from \`bash "${SKILL}/scripts/sdd-workspace" "${planIn(dir)}"\`): "Task ${t.n}: review — spec <✅|❌>, quality <Approved|Needs fixes>, <n> critical, <n> important, <n> minor".
Return the structured result: specCompliant, approved (true only when spec ✅ and no Critical/Important findings), findings (severity + text with file:line and how to fix), cannotVerify, diffFile.`
}

function fixPrompt(lane, t, r, findings, round) {
  const dir = lane.dir
  return `Fix round ${round} for Task ${t.n} of the plan (lane "${lane.name}"). A reviewer found issues in the task's implementation; you own the task now.
${COMMON(dir)}
Read in this order: the task brief ${r.briefFile}; the implementer's report ${r.reportFile} (earlier fix reports are appended there, read what was tried); lines 15–100 of ${planIn(dir)}.
## Open findings (fix every one)
${findings.map(f => `- ${f}`).join('\n')}
Fix them in the code, re-run the tests covering the amended code (name the test files), run the full suite once before committing, commit. Append a fix report to the report file: what you changed, the covering tests, the command, the output. Append to <workspace>/progress.md: "Task ${t.n}: fix round ${round} — <what changed> (head <sha7>)".
${NO_SUBAGENTS}
Return: status (DONE or BLOCKED), headSha after your last commit, testSummary, notes.`
}

function reReviewPrompt(lane, t, r, findings, fixBase, head) {
  const dir = lane.dir
  return `You are re-reviewing one task's fix round. Verdict each finding and inspect the fix diff only.
${COMMON(dir)}
Task ${t.n}. Brief: ${r.briefFile}. Report with appended fix reports: ${r.reportFile}.
## Findings under verification
${findings.map(f => `- ${f}`).join('\n')}
## The fix
Fix base ${fixBase}, head ${head}. Run \`cd "${dir}" && bash "${SKILL}/scripts/review-package" "${planIn(dir)}" ${fixBase} ${head}\` and read the printed file once. Read-only. ${NO_SUBAGENTS}
Verdict every finding ADDRESSED or NOT ADDRESSED with file:line evidence ("attempted" is not addressed). Report new Critical/Important breakage introduced by the fix diff itself. Issues entirely outside the fix diff go to outOfScope (non-blocking). Confirm the fix report names the covering tests and shows output; do not re-run the suite.
Return: allAddressed, open (findings still open, verbatim, plus new Critical/Important breakage), newBreakage, outOfScope.`
}

async function runTask(lane, t) {
  const ph = `Build · ${lane.name}`
  const label = `T${t.n}`
  let r = await agent(implementerPrompt(lane, t), { label: `${label} impl`, phase: ph, model: t.model, schema: IMPL_SCHEMA })
  if (!r) return { n: t.n, outcome: 'agent-lost' }
  if (r.status === 'BLOCKED' || r.status === 'NEEDS_CONTEXT') {
    log(`Task ${t.n} ${r.status}: ${r.concerns.slice(0, 200)} — retrying on fable`)
    r = await agent(implementerPrompt(lane, t, `## Note from the controller\nA previous implementer returned ${r.status}: "${r.concerns}". Resolve it yourself from the spec, the contracts and the Swift code (the spec is the binding authority, the code wins on values); record your ruling in the report under "Rulings".`), { label: `${label} impl (escalated)`, phase: ph, model: 'fable', schema: IMPL_SCHEMA })
    if (!r || r.status === 'BLOCKED' || r.status === 'NEEDS_CONTEXT') return { n: t.n, outcome: 'blocked', detail: r ? r.concerns : 'agent lost' }
  }
  if (r.baseSha === r.headSha) return { n: t.n, outcome: 'no-commits', detail: r.concerns }

  let review = await agent(reviewerPrompt(lane, t, r), { label: `${label} review`, phase: ph, model: t.reviewModel, schema: REVIEW_SCHEMA })
  if (!review) return { n: t.n, outcome: 'review-lost', head: r.headSha }
  const minors = review.findings.filter(f => f.severity === 'Minor').map(f => f.text)
  let open = review.findings.filter(f => f.severity !== 'Minor').map(f => `${f.severity}: ${f.text}`)
  if (!review.specCompliant && open.length === 0) open.push('Important: spec compliance ❌ (see review)')
  const unverified = review.cannotVerify
  let fixBase = r.headSha
  let head = r.headSha
  let round = 0
  const MAX = 4
  while (open.length && round < MAX) {
    round += 1
    const fixModel = round >= 4 ? 'fable' : (t.model === 'sonnet' ? 'opus' : t.model)
    const fix = await agent(fixPrompt(lane, t, r, open, round), { label: `${label} fix ${round}`, phase: ph, model: fixModel, schema: FIX_SCHEMA })
    if (!fix || fix.status === 'BLOCKED') { log(`Task ${t.n} fix round ${round} blocked`); break }
    head = fix.headSha
    if (head === fixBase) { log(`Task ${t.n} fix round ${round} made no commit`); break }
    const rr = await agent(reReviewPrompt(lane, t, r, open, fixBase, head), { label: `${label} re-review ${round}`, phase: ph, model: 'sonnet', schema: REREVIEW_SCHEMA })
    if (!rr) break
    minors.push(...rr.outOfScope)
    open = rr.open
    fixBase = head
  }
  return { n: t.n, outcome: open.length ? 'parked' : 'complete', base: r.baseSha, head, rounds: round, parked: open, minors, unverified, concerns: r.concerns }
}

async function runLane(lane) {
  const results = []
  for (const t of lane.tasks) {
    const res = await runTask(lane, t)
    results.push(res)
    log(`[${lane.name}] Task ${t.n}: ${res.outcome}${res.rounds ? ` after ${res.rounds} fix round(s)` : ''}`)
    if (res.outcome === 'blocked' || res.outcome === 'agent-lost' || res.outcome === 'no-commits') {
      log(`[${lane.name}] stopping lane at Task ${t.n}: ${res.detail || ''}`)
      break
    }
  }
  // Ledger summary for the lane
  await agent(`Append the following lines to the SDD ledger of the plan. Workspace: run \`cd "${lane.dir}" && bash "${SKILL}/scripts/sdd-workspace" "${planIn(lane.dir)}"\` and append to <workspace>/progress.md. Create the file with first line "# SDD ledger — plan: ${PLAN_REL}" if it does not exist. Append exactly these lines, one per task, then stop:
${results.map(x => `Task ${x.n}: ${x.outcome}${x.base ? ` (commits ${x.base.slice(0, 7)}..${x.head.slice(0, 7)})` : ''}${x.parked && x.parked.length ? ` — parked: ${x.parked.join(' | ')}` : ''}${x.minors && x.minors.length ? ` — minor (deferred): ${x.minors.join(' | ')}` : ''}${x.unverified && x.unverified.length ? ` — ⚠️ unverified: ${x.unverified.join(' | ')}` : ''}${x.detail ? ` — ${x.detail}` : ''}`).join('\n')}
Return "ok".`, { label: `${lane.name} ledger`, phase: `Build · ${lane.name}`, model: 'sonnet', effort: 'low' })
  return { lane: lane.name, results }
}

let preflight = null
if (A.preflight) {
  phase('Preflight')
  preflight = await agent(`You are the controller's pre-flight reviewer for an implementation plan, before any task runs.
${COMMON(A.preflight.dir)}
Read the plan ${planIn(A.preflight.dir)} in full (it is long; read it in parts) and the spec.
Scan for conflicts: tasks that contradict each other or the Global Constraints; a task whose own text disagrees with itself (tests vs code, files created vs files later touched); anything the plan mandates that is a defect (a test that asserts nothing, verbatim duplicated logic). Produce a table with one row per pair of tasks sharing a file or interface (the two tasks, produced vs consumed, what you found) and one row per task (does its text agree with itself). Rule on every finding with the spec as the binding authority and the Swift code winning on values; each ruling as "Ruling: <decision> — <why> — <cost if wrong>".
Create the ledger: run \`cd "${A.preflight.dir}" && bash "${SKILL}/scripts/sdd-workspace" "${planIn(A.preflight.dir)}"\`, write <workspace>/progress.md with first line "# SDD ledger — plan: ${PLAN_REL}", then the scan table and the rulings.
Return the rulings list only (verbatim) and the count of rows checked.`, { label: 'preflight scan', phase: 'Preflight', model: 'fable', effort: 'high' })
}

phase('Build')
const laneResults = await pipeline(A.lanes, lane => runLane(lane))

let finalReview = null
if (A.finalReview) {
  phase('Final review')
  const F = A.finalReview
  const fr = await agent(`You are the final whole-branch reviewer for the quickreminder.jholec.com build (branch ${F.branch}).
${COMMON(F.dir)}
Run \`cd "${F.dir}" && bash "${SKILL}/scripts/review-package" "${planIn(F.dir)}" ${F.mergeBase} HEAD\` and read the printed file (large; read in parts). Also read the ledger <workspace>/progress.md (workspace from \`bash "${SKILL}/scripts/sdd-workspace" "${planIn(F.dir)}"\`) and triage its "parked", "minor (deferred)" and "⚠️ unverified" lines: which must be fixed before merge.
Review against the spec and the plan's Global Constraints: 1:1 fidelity of the recreation to the Swift code (values, springs, rhythm, behaviour), the scroll choreography, accessibility, the anti-goals (no Apple assets, no scroll hijack), test quality, dead code, duplicated logic, build/typecheck/lint/test actually passing (run \`npm run typecheck && npm run lint && npm test\` once; report output). Read-only. ${NO_SUBAGENTS}
Return the structured result: approved, findings (severity + text with file:line), mustFixBeforeMerge (from the ledger triage), notes, headSha (\`git rev-parse HEAD\` in the repo).`,
    { label: 'final review', phase: 'Final review', model: 'fable', effort: 'high', schema: { type: 'object', properties: { approved: { type: 'boolean' }, findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string' }, text: { type: 'string' } }, required: ['severity', 'text'] } }, mustFixBeforeMerge: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' }, headSha: { type: 'string' } }, required: ['approved', 'findings', 'mustFixBeforeMerge', 'notes', 'headSha'] } })
  finalReview = { review: fr }
  const toFix = fr ? [...fr.findings.filter(f => f.severity !== 'Minor').map(f => `${f.severity}: ${f.text}`), ...fr.mustFixBeforeMerge] : []
  if (toFix.length) {
    const fixBase = fr.headSha
    const fix = await agent(`One fix wave after the final whole-branch review of quickreminder.jholec.com (branch ${F.branch}). Fix every finding below, re-run the covering tests, run \`npm run typecheck && npm run lint && npm test\` once before the last commit, commit (several commits are fine). ${NO_SUBAGENTS}
${COMMON(F.dir)}
## Findings
${toFix.map(f => `- ${f}`).join('\n')}
Append a "Final fix wave" report to <workspace>/final-fix-report.md (workspace from \`bash "${SKILL}/scripts/sdd-workspace" "${planIn(F.dir)}"\`): what changed, covering tests, commands, output.
Return: status, headSha, testSummary, notes.`, { label: 'final fix wave', phase: 'Final review', model: 'opus', schema: FIX_SCHEMA })
    if (fix && fix.status === 'DONE' && fix.headSha !== fixBase) {
      const rr = await agent(`Scoped re-review of the final fix wave for quickreminder.jholec.com.
${COMMON(F.dir)}
Findings under verification:
${toFix.map(f => `- ${f}`).join('\n')}
Fix report: <workspace>/final-fix-report.md (workspace from \`bash "${SKILL}/scripts/sdd-workspace" "${planIn(F.dir)}"\`). Fix base ${fixBase}, head ${fix.headSha}: run \`cd "${F.dir}" && bash "${SKILL}/scripts/review-package" "${planIn(F.dir)}" ${fixBase} ${fix.headSha}\` and read it once. Read-only. ${NO_SUBAGENTS}
Verdict each finding ADDRESSED / NOT ADDRESSED with file:line; new breakage in the fix diff only; out-of-scope observations are non-blocking.
Return: allAddressed, open, newBreakage, outOfScope.`, { label: 'final re-review', phase: 'Final review', model: 'opus', schema: REREVIEW_SCHEMA })
      finalReview.fix = fix
      finalReview.reReview = rr
    } else {
      finalReview.fix = fix
    }
  }
}

return { preflight, lanes: laneResults, finalReview }
