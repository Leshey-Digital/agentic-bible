---
title: Agent-to-agent communication
description: How agents exchange messages, task state and artifacts across an interface, with separate checks for interoperability, authority and result quality.
topic: Protocols
order: 18
status: Working draft
verified: '2026-10-17'
author: AI-assisted project draft
related: ["ai-agent", "agent-orchestration", "agent-identity", "model-context-protocol"]
sources:
  - id: a2a
    title: "Agent2Agent Protocol specification, v0.3.0"
    url: https://a2a-protocol.org/v0.3.0/specification/
    publisher: "A2A Protocol"
    context: "Version 0.3.0; Agent Cards, messages, tasks, artifacts and lifecycle. This pinned version is not a claim about the newest specification."
  - id: jsonrpc
    title: "JSON-RPC 2.0 Specification"
    url: https://www.jsonrpc.org/specification
    publisher: "JSON-RPC Working Group"
    context: "Origin 26 March 2010, updated 4 January 2013; sections 1, 4\u20136. Request identifiers correlate responses; notifications have no response."
  - id: mcp-architecture
    title: "MCP architecture, 2025-11-25"
    url: https://modelcontextprotocol.io/specification/2025-11-25/architecture
    publisher: "Model Context Protocol"
    context: "Version 2025-11-25; host/client/server architecture and connections. Used as a separate interface example, not a universal division of protocol roles."
---

**Agent-to-agent communication** is the exchange of requests, observations or work products between agent systems. It needs an interface that the participants interpret consistently. A2A version 0.3.0 provides one such contract: an Agent Card advertises identity, capabilities, skills and connection information; messages, tasks and artifacts represent interaction and outputs. The card describes a service’s claims and interface, rather than certifying that it can perform every advertised task correctly. [1](#source-a2a)

## Separate a message from completed work

In an original reference-library example, one agent asks another to compare two specification revisions. A message can acknowledge receipt before the comparison is finished. A later artifact might contain the proposed differences and evidence references. A useful interface would preserve which event means “received,” which means “needs input” and which means “finished.” Treating every response as final would collapse those distinct states.

For example, an application could use the following conceptual exchange. These labels are invented application messages, not A2A wire objects:

1. **Assign:** task `compare-7` names the two source revisions and the expected comparison artifact.
2. **Acknowledge:** the receiver reports that it accepted `compare-7`; no completed comparison is claimed.
3. **Ask for input:** one revision is unavailable. The task remains incomplete while the caller supplies the missing input or cancels.
4. **Complete:** the receiver returns an artifact tied to `compare-7` and both revisions. The caller still checks whether its evidence supports the comparison.

If the completion reply is lost, a supported task-status lookup could reconcile that same task identity. Merely sending `compare-7` again is not a deduplication contract. Without such a lookup or retry guarantee, completion remains unknown instead of becoming a new task automatically.

The pinned A2A specification describes task states including working, input-required and terminal outcomes, and distinguishes messages from artifacts. Those types help participants represent progress under that contract. They do not establish the factual correctness of an artifact or grant access to a protected source. Both sides still need compatible versions, supported interaction modes and an authorization arrangement. [1](#source-a2a)

## Correlation is not a delivery guarantee

JSON-RPC 2.0 defines request and response objects with matching identifiers, while a notification omits an identifier and receives no response. It is transport agnostic. Those rules help match a reply to a call; they do not establish that a business task completed, nor do they supply exactly-once execution for an external effect. [2](#source-jsonrpc)

A2A supports multiple protocol bindings, so one should inspect the selected binding rather than assume all exchanges use JSON-RPC. [1](#source-a2a)

Suppose the comparison service becomes unreachable after receiving a request. The caller could know that it sent bytes while remaining uncertain whether work began. Retrying requires an agreed identity for the work and a policy for duplicate handling. [Durable execution](/articles/durable-agent-execution/) examines that broader problem. A network acknowledgment and a completed comparison are different evidence even if they arrive on the same connection.

## Interfaces have different scopes

The cited MCP architecture defines host, client and server components for connecting an AI application with capabilities and context. It offers a different interface example from A2A’s task exchange. An application can combine protocols or wrap one behind another, so their names alone do not establish a universal boundary between “tools” and “agents.” Inspect actual messages, version support and responsibilities. [3](#source-mcp-architecture)

[Orchestration](/articles/agent-orchestration/) concerns how the overall work is coordinated. Communication concerns what crosses a particular interface. A coordinator could exchange messages with several services without sharing its complete internal state. Conversely, a multi-component system might coordinate everything within one process and have no external agent protocol at all. This entry focuses on the exchange boundary rather than prescribing a multi-agent topology.

## Evaluate the whole exchange

For the original example, useful tests would include an unsupported skill, a request needing clarification, duplicate submission and a validly formatted artifact with an unsupported claim. The receiving agent should distinguish these cases instead of treating every problem as a transport failure. [Structured outputs](/articles/structured-outputs/) covers form; [evaluation](/articles/agent-evaluation/) covers outcomes and evidence.

A participant’s message also remains untrusted input with respect to the receiver’s authority. An instruction to fetch a private document should pass the applicable [identity and delegation](/articles/agent-identity/) and permission checks. Communication is useful when it makes task state and responsibility explicit. It cannot supply missing authority, consistent semantics or reliable results merely by adding another agent.
