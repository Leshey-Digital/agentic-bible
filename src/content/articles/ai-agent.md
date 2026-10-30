---
title: AI agent
description: A system that uses a model to choose actions, observe their results, and work toward a goal within defined limits.
topic: Foundations
order: 1
status: Working draft
verified: '2026-10-30'
author: AI-assisted project draft
related: [tool-use, model-context-protocol, agent-orchestration, agent-memory, retrieval-augmented-generation, agent-evaluation, prompt-injection, agent-planning, durable-agent-execution, tool-permissions, agent-sandboxing, agent-observability, human-oversight]
sources:
  - id: patterns
    title: Building effective agents
    url: https://www.anthropic.com/engineering/building-effective-agents
    publisher: Anthropic
    context: Published 19 December 2024; architectural distinction checked 30 October 2026. The page warns that its tooling examples have changed.
  - id: react
    title: 'ReAct: Synergizing Reasoning and Acting in Language Models'
    url: https://arxiv.org/abs/2210.03629v3
    publisher: Yao et al., arXiv
    context: Version 3, 10 March 2023; sections 2–4 and task-specific evaluation checked 30 October 2026.
  - id: tools
    title: Tool use with Claude
    url: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
    publisher: Anthropic
    context: Living API documentation checked 30 October 2026; client versus server tools and execution results.
---

An **AI agent** uses a model to choose actions and uses their results to decide what to do next. The surrounding application supplies the tools, state and execution limits. An agent might investigate a failed test, navigate an unfamiliar interface or gather evidence for an answer. The label describes how work is controlled; it does not establish how reliably that work is done.

Definitions vary. Anthropic distinguishes agents, with model-directed steps, from workflows with predefined paths. A system can combine both. [1](#source-patterns)

## What makes the loop an agent?

The distinguishing question is whether a new observation can change the model’s choice of action. A model that writes a checklist has produced a plan. A program that always runs three prescribed steps is executing a workflow. A model that chooses which test to inspect after reading a failure is participating in an agent loop.

ReAct is an early research example of alternating generated reasoning, actions and environmental observations. Its evaluations include question answering, fact verification, a text-based household environment and web shopping. Those results concern the tested models and tasks, rather than a general reliability guarantee. [2](#source-react)

## A worked example: repairing a failing test

Consider this original, simplified example. A coding assistant receives a failing test and permission to edit a disposable checkout. The names and results below are invented; they are not a provider API or a benchmark result.

| Step | Observation available | Action selected | What changes |
| --- | --- | --- | --- |
| Start | Test `parse-empty-name` fails | Read the parser and the test | The model gains code context |
| Inspect | Parser accepts an empty string | Propose an input check | A patch is prepared |
| Apply | Patch is within the permitted files | Write the patch | Checkout files change |
| Check | The focused test passes | Run the neighbouring parser tests | New evidence can expose a regression |
| Finish | Relevant checks pass | Return the diff and test results | Work stops; nothing is deployed |

If the neighbouring test fails, the next action may be to revise the patch. If access to the required file is denied, the correct terminal result is an unresolved repair. “I fixed it” is weaker evidence than the actual diff and test outputs. Passing those tests still does not prove that every possible input works.

An agent implementation must make choices that this small trace leaves implicit: which files may change, whether commands have network access, how much work is allowed, and how a canceled run is recorded. These are application policies. Adding another model or a longer prompt does not define them.

## Tool use, retrieval and autonomy

A tool connects a model’s request to an operation. For Claude client tools, the application runs the requested function and returns its result; server tools run on Anthropic’s infrastructure. [3](#source-tools) See [tool use](/articles/tool-use/) for the request/result boundary and [tool permissions](/articles/tool-permissions/) for access decisions.

[Retrieval-augmented generation](/articles/retrieval-augmented-generation/) concerns supplying relevant information to generation. A fixed retrieve-then-answer process can use retrieval without letting a model choose another action. [Orchestration](/articles/agent-orchestration/) concerns how steps and components are coordinated. Multiple agents are an architectural option, not a prerequisite for calling a system an agent.

## How to assess an agent system

For the coding example, a useful evaluation would include a repairable failure, a misleading test, an unavailable dependency and a request outside the permitted files. Record successful repairs, regressions, elapsed work and cases left unresolved. Compare the result with a simpler fixed procedure on the same cases; an extra loop should justify its cost.

Inspect the evidence at three separate boundaries: what the model requested, what the executor did, and what final state was verified. [Observability](/articles/agent-observability/) helps retain that evidence; [evaluation](/articles/agent-evaluation/) defines what counts as success. [Budgets and termination](/articles/agent-budgets/) bound the work, while [human oversight](/articles/human-oversight/) determines where a person can inspect or intervene.
