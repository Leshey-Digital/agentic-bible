---
title: Computer-use agents
description: How agents observe and act through browser or desktop interfaces, with separate checks for screen grounding, action effects, isolation and authority.
topic: Capabilities
order: 20
status: Working draft
verified: '2026-10-17'
author: AI-assisted project draft
related: ["ai-agent", "tool-use", "agent-sandboxing", "agent-budgets"]
sources:
  - id: osworld
    title: "OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer Environments"
    url: https://arxiv.org/abs/2404.07972v1
    publisher: "Xie et al., arXiv"
    context: "Version 1, 11 April 2024; environment, observation/action spaces and execution-based evaluation. Historical benchmark setup and models, not current universal performance."
  - id: webarena
    title: "WebArena: A Realistic Web Environment for Building Autonomous Agents"
    url: https://arxiv.org/abs/2307.13854v2
    publisher: "Zhou et al., arXiv"
    context: "Version 2, 24 October 2023; self-hosted web environment and task evaluation. Browser observations/actions need not be screenshot-only."
  - id: computer-tool
    title: "Computer use tool"
    url: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool
    publisher: "Anthropic"
    context: "Living platform documentation checked 17 October 2026; application-executed action loop and security warnings. Tool/model versions and supported actions vary."
---

**Computer-use agents** pursue tasks through interfaces such as a browser or desktop, observing state and requesting actions such as clicks or typing. They can encounter the same application surfaces that a person uses, but an action request still needs executable software behind it. Anthropic’s computer-use documentation describes a loop in which the model requests actions, the application executes them and returns results. This is a vendor-specific interface, not a universal desktop-control protocol. [3](#source-computer-tool)

## Ground an action in the observed state

An original example is an assistant changing a view filter in a document library. It first needs to determine which control is relevant, then act, then check that the displayed documents match the requested filter. Recognizing a button in an image and changing the intended application state are different achievements. A screenshot may be stale by the time a click occurs, especially after navigation or a delayed render.

[Tool use](/articles/tool-use/) describes the general request/execution boundary. Computer use adds questions about how an interface is observed and how the action target is grounded. Some systems use screenshots, some use accessibility information or browser structure, and some combine signals. A report of “clicked” describes an attempted interaction; evidence that the desired filter is active describes its effect.

## Evaluate resulting state

OSWorld introduces a real-computer environment with task setup, observation and action spaces, and execution-based evaluation across desktop workflows. Its cited first version studies a particular collection of tasks and baseline systems in 2024. It offers an example of checking resulting state instead of requiring a single prescribed click sequence. Its benchmark results should not be read as the present capability of every computer-use model. [1](#source-osworld)

For the library example, a test could inspect both the visible filter and the resulting collection. Two action sequences might correctly reach the same state. Conversely, a convincing screenshot could conceal an unsaved change. The evaluator should define which persisted or visible outcome matters, then include cases where appearance and state disagree. This is a proposed test design, not a reported OSWorld experiment.

## Browser work has its own environment

WebArena provides a self-hosted interactive web environment with tasks and functional evaluation. The cited version describes controlled sites and interfaces for evaluating autonomous web agents; observations and actions need not be limited to raw screenshots. Such an environment makes repeatable experiments possible, but its task distribution, software and historical models limit what its results establish about arbitrary public websites. [2](#source-webarena)

An application deployment could change its layout, language or focus behavior while keeping the underlying task the same. In the example, a useful evaluation would vary those conditions and include loading failures. The goal would be to learn when the system needs a fresh observation or should stop. [Agent evaluation](/articles/agent-evaluation/) covers how such cases relate to broader outcome and reliability claims.

## Authority follows the action

A desktop session may expose capabilities beyond the current task. The computer-use vendor documentation warns about malicious instructions in pages or images and recommends isolating sensitive data and actions. These warnings identify a risk and precautions; they do not prove that a model or an isolated environment will resist every attack. [3](#source-computer-tool)

For the original example, permission to change a view would not imply permission to delete documents or send their contents elsewhere. [Sandboxing](/articles/agent-sandboxing/) concerns the execution boundary, [tool permissions](/articles/tool-permissions/) the allowed action, and [prompt injection](/articles/prompt-injection/) the authority of encountered content. A run also needs [budgets and termination](/articles/agent-budgets/) for repeated failed interactions. A useful completion record states the verified effect and any remaining uncertainty, rather than treating a sequence of plausible gestures as proof of success.
