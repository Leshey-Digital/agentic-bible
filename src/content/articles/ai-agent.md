---
title: AI agent
description: A system that uses a model to choose actions, observe their results, and work toward a goal within defined limits.
topic: Foundations
order: 1
status: Working draft
verified: '2026-10-16'
author: AI-assisted project draft
related: [tool-use, model-context-protocol, agent-orchestration, agent-memory, retrieval-augmented-generation, agent-evaluation, prompt-injection]
sources:
  - id: patterns
    title: Building effective agents
    url: https://www.anthropic.com/engineering/building-effective-agents
    publisher: Anthropic
    context: Published 19 December 2024; architectural patterns, not a current SDK reference.
  - id: react
    title: 'ReAct: Synergizing Reasoning and Acting in Language Models'
    url: https://arxiv.org/abs/2210.03629
    publisher: Yao et al., arXiv
    context: Research first submitted October 2022; results apply to the paper’s evaluated tasks.
  - id: tools
    title: Tool use with Claude
    url: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
    publisher: Anthropic
    context: Living API documentation; consulted for the client-tool execution boundary.
---

An **AI agent** is a system that uses a model to select actions, receives feedback from its environment, and continues toward a goal. In this encyclopedia, the term describes a pattern of control. It does not imply consciousness, unlimited independence, or reliable judgment. Definitions vary: Anthropic distinguishes model-directed agents from workflows whose paths are fixed in code. [1](#source-patterns)

## The action–observation loop

A task starts with an objective and a set of available actions. The model may request an action, the surrounding software executes it, and the result becomes input for the next decision. A stop condition ends the loop. Anthropic describes environmental feedback and bounded iteration as practical ingredients of this pattern. [1](#source-patterns)

The ReAct research paper explored interleaving reasoning and actions so a language model could interact with external environments. Its experiments are evidence for particular methods on particular benchmarks, rather than proof that every agent is dependable. [2](#source-react)

Consider an illustrative library assistant asked to investigate a broken citation. It could open the cited page, inspect a replacement source, and propose an edit with evidence. A successful run would leave a reviewable correction and an explanation of its sources. A failed fetch should remain a failed fetch; generating a plausible replacement URL would not complete the task.

## Agent or workflow?

The useful question is who chooses the next step. A workflow might always retrieve a document, summarize it, and pass the summary to a reviewer. An agent can choose another retrieval after inspecting the first result. Real systems can combine these approaches. Anthropic’s taxonomy is a helpful architectural distinction, not a universally agreed definition. [1](#source-patterns)

More autonomy also creates more possible failure paths. A fixed workflow can be easier to test when a task has predictable steps. Anthropic recommends adding complexity only when the task benefits justify the extra latency and cost. [1](#source-patterns)

## Tools and authority

[Tool use](/articles/tool-use/) supplies the actions in many agent loops. With client-side tools, the model returns a structured request and the application executes it. That boundary gives the application a place to validate arguments, enforce permissions, and reject an operation. A tool request is not itself proof that an operation happened. [3](#source-tools)

[Model Context Protocol](/articles/model-context-protocol/) is one way to connect such capabilities. An agent can also use ordinary application functions. The protocol choice and the decision to allow an action are separate design questions.

## How to evaluate a claim

For this project, we propose evaluating agents against an observable outcome: did a correction have valid evidence, did it preserve history, and did the system stop within its limits? These are editorial design criteria, not measurements from a deployed pipeline.

An evaluation should make the task, environment, allowed actions, failure cases, and budget explicit. A fluent final answer alone would not show whether a citation was checked. The long-term Agentic Bible goal includes bounded autonomous maintenance; this first slice implements reading and search only.
