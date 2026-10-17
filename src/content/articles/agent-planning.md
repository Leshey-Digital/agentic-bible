---
title: Agent planning
description: How an agent represents possible steps toward a goal, checks intermediate results, and revises a course of action when assumptions fail.
topic: Capabilities
order: 9
status: Working draft
verified: '2026-10-17'
author: AI-assisted project draft
related: [ai-agent, agent-orchestration, agent-memory, agent-evaluation, durable-agent-execution, human-oversight]
sources:
  - id: plan-solve
    title: 'Plan-and-Solve Prompting: Improving Zero-Shot Chain-of-Thought Reasoning by Large Language Models'
    url: https://arxiv.org/abs/2305.04091v3
    publisher: Wang et al., arXiv
    context: Version 3, 26 May 2023; ACL 2023. Section 2 separates devising a plan from carrying it out in reasoning prompts; its experiments are not production-agent trials.
  - id: tree-thoughts
    title: 'Tree of Thoughts: Deliberate Problem Solving with Large Language Models'
    url: https://arxiv.org/abs/2305.10601v2
    publisher: Yao et al., arXiv
    context: Version 2, 3 December 2023; NeurIPS 2023. Sections 3–4 describe candidate generation, evaluation and search in selected problem-solving tasks.
  - id: react
    title: 'ReAct: Synergizing Reasoning and Acting in Language Models'
    url: https://arxiv.org/abs/2210.03629v3
    publisher: Yao et al., arXiv
    context: Version 3, 10 March 2023; section 2 describes reasoning interleaved with actions and observations. Results concern the evaluated environments and models.
---

**Agent planning** is the formation of a proposed course of action toward a goal. A plan can identify intermediate questions or dependencies before the next action is attempted. Plan-and-Solve Prompting provides one research example: it asks a language model to devise a plan and then solve the problem using it. The paper studies prompted reasoning tasks, so its results should not be presented as proof that a deployed [agent](/articles/ai-agent/) will execute a plan successfully. [1](#source-plan-solve)

## A plan is a representation of intended work

A plan describes work that might happen. An execution record describes work that did happen. For an illustrative reference-library task, “check the cited specification” could be an intended step; the fetched revision and a recorded comparison would be evidence of execution. A model producing a checklist has not thereby checked its items. This distinction is the entry’s operational interpretation, not a measured result from the prompting paper.

[Orchestration](/articles/agent-orchestration/) concerns how components and work are coordinated. Planning concerns which steps are proposed and why they might lead to the goal. An orchestrator can follow a fixed procedure without generating a new plan; a planner can produce a useful proposal without having permission to execute any of it. The terms answer different questions even when one application combines them.

## Searching over alternatives

Tree of Thoughts explores a different approach from producing a single uninterrupted answer. It generates intermediate candidate thoughts, evaluates them, and uses search to explore or abandon paths. The paper investigates breadth-first and depth-first approaches on tasks including arithmetic puzzles, writing and crosswords. Its evaluations concern those setups; a model’s self-evaluation of a candidate is not an independent correctness certificate. [2](#source-tree-thoughts)

In an original example, a planner investigating a terminology change might consider comparing specification versions or locating an announcement. These are alternatives with different evidence requirements. If the announcement contains no date for the actual change, the planner could retain the unresolved question rather than treating the announcement date as the answer. A plausible route would still need source checking.

Search also needs a stopping rule. In this example, the designer could limit the number of candidate routes, source checks and revisions to the plan. The purpose of those proposed limits would be to make incomplete investigation explicit. Exploring more alternatives would consume work without guaranteeing a better answer. This is a design consideration for the example, not a performance comparison of planning methods.

## Feedback can change the next step

ReAct interleaves generated reasoning with actions and environmental observations. It offers a research example of choosing subsequent work in light of feedback rather than relying only on an initial answer. Its experiments do not imply that every observation is trustworthy or that the model’s interpretation is correct. [3](#source-react)

Suppose the library task discovers that the cited revision predates the feature under discussion. A revised plan could seek a later revision and explicitly preserve the earlier mismatch as evidence. By contrast, merely restating the original plan would not address the new information. The example separates a changed assumption from a failed tool request: each could justify different next work.

## Keep authority outside the plan

A proposed step such as publishing a correction does not grant [tool permissions](/articles/tool-permissions/). Nor would a source document’s embedded instruction become authoritative because it appeared in a plan. [Prompt injection](/articles/prompt-injection/) explains that input boundary. An implementation would need to apply its actual execution policy to each proposed action.

For the example, [evaluation](/articles/agent-evaluation/) could check whether the agent revises a contradicted assumption, preserves unresolved dependencies, and stops when evidence is unavailable. [Memory](/articles/agent-memory/) could retain a finding for later use, while [durable execution](/articles/durable-agent-execution/) could retain which steps completed. Neither should silently turn an intended action into a completed one. Planning is useful when it makes choices inspectable; its value still needs to be tested against the task it is meant to help.
