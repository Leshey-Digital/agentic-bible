---
title: Agent budgets and termination
description: How an agent bounds turns, requests, time and paid work, and reports incomplete or uncertain outcomes when a limit stops execution.
topic: Foundations
order: 19
status: Working draft
verified: '2026-10-17'
author: AI-assisted project draft
related: ["ai-agent", "durable-agent-execution", "agent-observability", "computer-use-agents"]
sources:
  - id: sdk-turns
    title: "Running agents, OpenAI Agents SDK"
    url: https://openai.github.io/openai-agents-python/running_agents/
    publisher: "OpenAI Agents SDK"
    context: "Living Python SDK guide checked 17 October 2026; agent loop and max_turns. Turn limits are SDK-specific, not currency caps."
  - id: graph-limit
    title: "GRAPH_RECURSION_LIMIT"
    url: https://docs.langchain.com/oss/python/langgraph/errors/GRAPH_RECURSION_LIMIT
    publisher: "LangChain"
    context: "Living LangGraph Python troubleshooting guide checked 17 October 2026; graph steps before a stop condition and recursion_limit configuration."
  - id: retry-safety
    title: "Making retries safe with idempotent APIs"
    url: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
    publisher: "Amazon Builders\u2019 Library"
    context: "Living engineering article checked 17 October 2026; timeouts, caller request identifiers and idempotent API semantics."
---

**Agent budgets** bound resources a run may consume, while **termination** defines when and how it stops. Relevant resources can include model turns, tool requests, elapsed time, tokens and paid provider usage. These quantities are related but not interchangeable. The OpenAI Agents Python SDK, for example, documents a `max_turns` setting and a `MaxTurnsExceeded` exception. That is a particular execution guard, not a promise that each turn costs the same amount. [1](#source-sdk-turns)

## Define the resource and the boundary

An original example is a reference assistant allowed a fixed number of source checks for one comparison. A separate deadline could bound how long the comparison remains active. Neither control alone would establish a monetary ceiling: one request could return a large response, invoke downstream work or carry a price that depends on usage. A spending rule would need its own accounting and enforcement boundary.

For this example, a proposed system could reserve the maximum allowed work before dispatch and reconcile the result afterward. Concurrent jobs would need to share the same budget authority rather than each reading a stale balance. If usage or price is unknown, the application needs a defined policy for refusing new paid work. These are design considerations, not a claim that this encyclopedia has connected a paid agent or implemented a provider billing stop.

For an original arithmetic example, start with **10 work units**, with no monetary value implied. Two concurrent jobs each ask to reserve 6. An atomic shared ledger can admit one, leaving 4 available; admitting both would promise 12 against a limit of 10. If the admitted job later confirms usage of 3, the ledger can settle that reservation at 3 and make 7 available. If its response is lost and usage is unknown, retain the 6-unit hold, leaving 4 available until reconciliation. A timeout does not establish a zero charge. These invented quantities illustrate admission and settlement, not a provider's billing rules or this site's configured spending limits.

## A loop needs a terminal condition

LangGraph’s GRAPH_RECURSION_LIMIT documentation describes reaching the maximum number of graph steps before a stop condition. Its example shows a cycle, and its troubleshooting discusses configuring the step limit for intended longer executions. A graph step counter describes that framework’s execution model. It should not be equated with model turns, wall-clock time or a universal definition of an agent’s reasoning effort. [2](#source-graph-limit)

The reference example could stop because the comparison is complete, evidence is unavailable, a limit was reached or the user canceled. Those outcomes need different records. “Stopped” does not mean “successful,” and a partial finding need not be discarded just because the original goal remains unfinished. The remaining question and the exhausted resource should be visible enough for someone to decide whether further work is justified.

## Cancellation does not reverse an action

Amazon’s idempotent-API article explains why a timeout can leave a caller uncertain whether a side effect happened, and how caller-provided request identifiers can support safe retries under an API contract. The contract’s semantics matter: repeating a request is not automatically safe merely because the caller would prefer a single effect. [3](#source-retry-safety)

In the original example, a request to save a comparison might time out as the run reaches its deadline. The application should preserve an unknown outcome until it can reconcile the write. Blindly retrying under a new identifier could create a duplicate; reporting failure as if no write happened could also be wrong. [Durable execution](/articles/durable-agent-execution/) examines that state and replay boundary in more detail.

## Test stops under pressure

Useful tests for the example would start two jobs near a shared limit, interrupt a request after dispatch, and restart the coordinator before its response arrives. Check the accounting, the retained action identity and the reported state. A test that merely observes an exception would miss whether additional work escaped the boundary. [Observability](/articles/agent-observability/) supplies operational evidence, while [evaluation](/articles/agent-evaluation/) asks whether the behavior meets the intended requirement.

Finally, raising a limit is a policy change with resource consequences. Repeating a failed request or delegating work should not silently create a fresh allowance. A useful budget design exposes who can change limits, which work counts and what happens when accounting is unavailable. Explicit incomplete outcomes make bounded autonomy understandable without presenting a configured counter as unlimited operational assurance.
