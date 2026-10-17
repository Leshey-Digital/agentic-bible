---
title: Human oversight
description: How people can inspect, interrupt, correct and govern agent behavior, with explicit distinctions between action approval, later review and technical enforcement.
topic: Foundations
order: 14
status: Working draft
verified: '2026-10-17'
author: AI-assisted project draft
related: [ai-agent, agent-evaluation, prompt-injection, durable-agent-execution, tool-permissions, agent-observability]
sources:
  - id: human-ai-guidelines
    title: Guidelines for Human-AI Interaction
    url: https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/
    publisher: Amershi et al., Microsoft Research / CHI 2019
    context: Primary research publication and linked camera-ready paper, checked 17 October 2026; Linked-paper guideline discussion address capabilities, dismissal, correction and controls. Design evaluation is not proof that human review prevents every error.
  - id: langgraph-interrupts
    title: LangGraph interrupts
    url: https://docs.langchain.com/oss/python/langgraph/interrupts
    publisher: LangChain
    context: Living implementation documentation checked 17 October 2026; pausing, resuming with external input, thread identity and re-execution rules. An interrupt mechanism is not a complete reviewer-authentication or authorization policy.
  - id: mcp-tools
    title: Model Context Protocol tools
    url: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
    publisher: Model Context Protocol
    context: Versioned 25 November 2025 specification, checked 17 October 2026; User Interaction Model recommends human ability to deny invocations and visible tool/confirmation UI. Protocol guidance is distinct from this project’s article-publication policy.
---

**Human oversight** gives people meaningful ways to inspect and influence an agent system’s behavior. It can involve setting boundaries, responding to a pause, correcting a result or changing future operating policy. Amershi and colleagues’ human-AI interaction research discusses design guidance for communicating capabilities and supporting dismissal, correction and user controls. These are design principles evaluated in the paper’s interaction settings, not evidence that the presence of a reviewer guarantees correctness. [1](#source-human-ai-guidelines)

## Oversight happens at different times

Before an action, a person may decide whether a specific operation should proceed. During work, they may stop or redirect execution. Afterward, they may inspect an outcome, correct it or revise policy. This entry uses those as operational distinctions rather than a universal ranking of oversight models. The appropriate arrangement depends on what the system can do and which decisions require human judgment.

[Agentic Bible’s stated editorial policy](/about/#editorial) is automatic article publication with flags for human review afterward. This explanatory entry does not replace that policy with universal editorial preapproval. Technical checks, evidence requirements and reversible history remain separate requirements. A particular implementation could also need an action-specific decision for an operation outside its standing authority; that would be a different decision from approving every article before publication.

## A pause needs a concrete decision

LangGraph’s interrupt documentation describes saving execution state, returning a payload to the caller and resuming with external input under the same thread identity. It also warns that the interrupted node runs again from its beginning when resumed. The mechanism illustrates a pause/resume boundary; it does not authenticate the person supplying the response or define what that person is authorized to approve. [2](#source-langgraph-interrupts)

In an original reference-library example, an after-publication flag could identify a disputed claim, show the relevant source revision, and offer a choice about a correction. A useful decision would concern the actual article revision and evidence in view. An unexplained “Continue?” prompt would not tell a reviewer whether continuing repeats research, changes an article or sends a notification.

If the article changed while the flag was waiting, the old decision might no longer describe the current result. The example’s proposed design would preserve the earlier context and make the newer revision visible. It would distinguish “reviewed this version” from “approved any future version.” Those are design criteria, not an implemented production review service here.

## Make control visible and consequential

The versioned MCP tools specification recommends a human’s ability to deny tool invocations, clear indications of available tools and invocations, and confirmation prompts for operations. These are protocol interaction recommendations. They should be attributed as such, rather than treated as proof that a tool client implements them or as a universal article editorial policy. [3](#source-mcp-tools)

In the example, a stop control would need to state its effect. Stopping future work would not necessarily undo a completed write. [Durable execution](/articles/durable-agent-execution/) helps distinguish recorded actions from pending work; [tool permissions](/articles/tool-permissions/) determine which operations can actually proceed. A visible button without the corresponding execution behavior would not supply meaningful control.

## Correction needs evidence and recovery

The human-AI guidelines recommend making correction and recovery practical when an AI system is wrong. [1](#source-human-ai-guidelines) For the reference-library example, that could mean retaining the original article, the questioned claim, the evidence and the subsequent correction. Simply changing a status label would not explain what was reviewed or what changed.

[Observability](/articles/agent-observability/) can provide relevant action context, while [evaluation](/articles/agent-evaluation/) can test whether the intervention had its intended effect. A useful test would include an interruption, a stale decision and a reviewer declining a proposed operation. It would inspect the resulting state rather than rely solely on the agent’s account of what happened.

Human oversight is therefore an interaction and governance arrangement with explicit scope. It works alongside technical enforcement and source checking. The cited research and documentation describe principles and mechanisms; they do not certify this encyclopedia’s factual content or authorize a production release.
