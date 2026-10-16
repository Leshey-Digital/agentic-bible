---
title: Agent orchestration
description: How software coordinates model decisions, tools, state, and delegated work while retaining clear stopping and authority boundaries.
topic: Foundations
order: 4
status: Working draft
verified: '2026-10-16'
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
    context: Living implementation documentation checked 16 October 2026, especially Orchestrator-worker and its state-sharing example. Describes LangGraph, not all agent systems.
  - id: react
    title: 'ReAct: Synergizing Reasoning and Acting in Language Models'
    url: https://arxiv.org/abs/2210.03629v3
    publisher: Yao et al., arXiv
    context: Version 3, 10 March 2023; research on interleaving reasoning and environmental actions. Experiments concern the paper’s selected tasks and models.
---

**Agent orchestration** is the coordination around an [AI agent](/articles/ai-agent/): what work starts, which component receives it, what state is available, and when execution stops. This entry uses the term for software control rather than a particular product. Anthropic’s engineering taxonomy separates workflows with predefined paths from agents whose next steps are selected by a model. Both can appear within the same application. [1](#source-patterns)

## Control can take several forms

A sequence gives one step’s output to the next. A router selects a path. Parallel work divides independent pieces and later combines their results. An orchestrator-worker arrangement instead lets a coordinator determine the subtasks as work unfolds. Anthropic describes these as different architectural patterns and recommends starting with simpler approaches when they meet the task’s needs. Its guidance reflects engineering experience, rather than a controlled finding that one architecture always wins. [1](#source-patterns)

Multiple agents are therefore one possible arrangement, not the definition of orchestration. A single agent still needs a surrounding loop that handles observations, actions, and termination. ReAct illustrates a research approach in which generated reasoning and actions alternate with environmental observations. Its results on question answering and interactive environments support studying that pattern; they do not establish reliability for an unrelated production task. [3](#source-react)

## A handoff needs state

LangGraph’s orchestrator-worker documentation provides a concrete implementation example: the orchestrator produces subtasks, workers receive individual inputs, and their outputs accumulate in shared state for synthesis. The documentation’s dynamic worker creation is a framework capability. The broader question it illustrates is what information crosses a handoff, and how the coordinator knows which work is complete. [2](#source-langgraph)

For an illustrative encyclopedia workflow, a coordinator could assign one worker to protocol history and another to current terminology. Each assignment would identify its question, permitted sources, and expected evidence. A worker’s response could include source locations and unresolved disagreements. A synthesis step could then retain the disagreement instead of converting two incompatible answers into a confident sentence. This is an original design example, not a workflow running on this site.

In that example, a handoff record would distinguish an assignment from an accepted result. If a worker stops halfway through, its partial notes would remain partial. The coordinator would also distinguish restarting research from repeating an external write: rerunning a search and sending the same message twice have different consequences. These are proposed design criteria for the example, not guarantees supplied by any framework.

## Coordination does not grant authority

[Tool use](/articles/tool-use/) explains the boundary between a model requesting an action and application software executing it. In the example above, assigning a worker a research role would not give it permission to publish, change access rights, or increase a spending limit. A proposed implementation would enforce those boundaries where actions execute. A persuasive worker response would remain input to that boundary.

The same distinction matters for [prompt injection](/articles/prompt-injection/). A passage retrieved during research might contain instructions addressed to an assistant. Passing the passage between workers would not make its author an authorized project operator. Preserving its origin would help a reviewer distinguish evidence from instructions, although provenance alone would not make the text safe or true.

## Judge the whole arrangement

For the encyclopedia example, useful [evaluation](/articles/agent-evaluation/) questions include whether assignments were completed with evidence, conflicting findings survived synthesis, and the run stopped within its declared limits. The test should include a missing worker result and an unavailable source, rather than only a successful path. More roles would be justified only by a measured benefit for this task.

[Memory](/articles/agent-memory/) can preserve useful state between steps or runs. It also creates another coordination decision: which record is current, who may update it, and how a correction reaches downstream work. Orchestration is useful vocabulary for making those decisions visible. It is not evidence of autonomy, factual accuracy, or a deployed publishing system.
