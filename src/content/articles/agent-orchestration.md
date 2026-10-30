---
title: Agent orchestration
description: How software coordinates model decisions, tools, state, and delegated work while retaining clear stopping and authority boundaries.
topic: Foundations
order: 4
status: Working draft
verified: '2026-10-30'
author: AI-assisted project draft
related: [ai-agent, tool-use, agent-memory, agent-evaluation, prompt-injection]
sources:
  - id: patterns
    title: Building effective agents
    url: https://www.anthropic.com/engineering/building-effective-agents
    publisher: Anthropic
    context: Engineering guidance published 19 December 2024; the page now acknowledges subsequent tooling changes. Its architectural taxonomy is not a universal definition or benchmark.
  - id: langgraph
    title: Workflows and agents
    url: https://docs.langchain.com/oss/python/langgraph/workflows-agents
    publisher: LangChain
    context: Living implementation documentation checked 30 October 2026; chaining, routing, parallelization and orchestrator-worker state flow. Framework examples are not comparative benchmarks.
  - id: react
    title: 'ReAct: Synergizing Reasoning and Acting in Language Models'
    url: https://arxiv.org/abs/2210.03629v3
    publisher: Yao et al., arXiv
    context: Version 3, 10 March 2023; research on interleaving reasoning and environmental actions. Experiments concern the paper’s selected tasks and models.
---

**Agent orchestration** coordinates when work starts, which component receives it, how results are combined and when a run ends. It can coordinate one model, several agents, ordinary functions or a mixture. [Planning](/articles/agent-planning/) proposes actions; orchestration connects their execution and state.

Anthropic describes composable workflow patterns and recommends using simpler arrangements when they suffice. Its taxonomy is engineering guidance, not a universal definition or a ranking of frameworks. [1](#source-patterns)

## Five arrangements and the problem each solves

LangGraph’s guide demonstrates chaining, routing, parallelization, orchestrator-workers and evaluator-optimizer loops. In its orchestrator-worker example, a model determines subtasks, workers receive their own inputs, and results accumulate for synthesis. [2](#source-langgraph)

The following examples are original design comparisons for a hypothetical document-processing application. They describe possible choices, not measured performance or a system running on this site.

| Arrangement | Example | Decision to make |
| --- | --- | --- |
| Sequence | Extract fields, validate them, then render a report | Which invalid output stops the next step? |
| Router | Send an invoice to one extractor and a contract to another | What happens to an unknown document type? |
| Parallel work | Check dates and totals independently | Is a partial result useful if one check fails? |
| Orchestrator and workers | Break an unfamiliar report into sections as they are discovered | Who decides the work is complete? |
| Evaluator and revision loop | Check a draft against an explicit rubric, then revise | What stops repeated revisions that do not improve it? |

For a known invoice format, a fixed extraction-and-validation sequence might be enough. For an unfamiliar bundle of mixed documents, discovering the required subtasks during execution could be useful. This is a task-design judgment to test, rather than a reason to maximize the number of agents.

## Follow one handoff from input to result

Suppose the document application asks two workers to check a report. One checks date consistency; the other checks arithmetic. A useful handoff might look like this:

```json
{
  "task_id": "dates-1",
  "document_revision": "synthetic-revision-7",
  "question": "Do the stated dates agree?",
  "allowed_action": "read supplied document",
  "result": {
    "status": "needs-review",
    "locations": ["section-2", "appendix-a"],
    "finding": "The two dates differ."
  }
}
```

This invented record is an application contract, not a LangGraph message format. A coordinator can compare its revision field with the current document revision and reject a stale result; merely including the field enforces nothing. Its locations let the receiving step inspect the finding. The arithmetic worker may succeed while the date worker fails; the coordinator must decide whether to return a partial report or stop. Inventing the missing result would conceal that decision.

A coordinator should also distinguish an assigned task from a completed task. An assignment can be recorded before work begins; acceptance requires the expected result. If a worker is restarted, [durable execution](/articles/durable-agent-execution/) determines whether it resumes, repeats a safe read or reconciles an earlier write.

## A model loop fits inside orchestration

ReAct interleaves reasoning and actions with observations, showing how feedback can affect subsequent work. [3](#source-react) An orchestration layer can host such a loop as one component while keeping the surrounding validation and delivery sequence fixed. Conversely, several fixed model calls do not necessarily form a model-directed agent.

This distinction helps diagnose failure. A wrong classification belongs at the router. A lost result belongs at the handoff or persistence boundary. A contradictory synthesis belongs at the combining step. “The agent failed” is too broad to identify which control needs correction.

## Evaluate coordination as a whole

For the example, test a missing worker, two conflicting results, a stale document revision and an exhausted deadline. Measure whether a correct report is delivered, how much work is consumed and whether an incomplete result is clearly marked. Compare with running one checker sequentially; parallel execution can add coordination work as well as reduce waiting.

The orchestration layer also needs explicit [tool permissions](/articles/tool-permissions/). A worker authorized to read a report does not acquire publication rights from a coordinator’s prose. Retrieved instructions remain untrusted input; [prompt injection](/articles/prompt-injection/) can cross a handoff if the receiver confuses source text with authority. Retaining origin and [observable execution records](/articles/agent-observability/) helps investigation, but those records still need interpretation.
