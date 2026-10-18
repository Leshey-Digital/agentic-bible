---
title: Agent identity and delegation
description: How software establishes an agent caller’s identity and represents delegated authority without confusing a name or persona with verified permission.
topic: Protocols
order: 17
status: Working draft
verified: '2026-10-17'
author: AI-assisted project draft
related: ["ai-agent", "tool-permissions", "agent-to-agent-communication", "human-oversight"]
sources:
  - id: spiffe
    title: "SPIFFE Concepts"
    url: https://spiffe.io/docs/latest/spiffe-about/spiffe-concepts/
    publisher: "SPIFFE"
    context: "Living project documentation checked 17 October 2026; workload, SPIFFE ID, trust domain and SVID. Workload identity is not a person or a permission grant."
  - id: token-exchange
    title: "OAuth 2.0 Token Exchange, RFC 8693"
    url: https://datatracker.ietf.org/doc/html/rfc8693
    publisher: "IETF"
    context: "January 2020 RFC; sections 1.1, 2 and 4 distinguish delegation/impersonation, subject/actor tokens and actor claims."
  - id: mcp-auth
    title: "MCP authorization, 2025-11-25"
    url: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
    publisher: "Model Context Protocol"
    context: "Version 2025-11-25; HTTP authorization, resource targeting, token audience validation and token passthrough restrictions."
---

**Agent identity** concerns which software principal is making a request and how the receiver can verify that claim. A display name, role description or model persona is not the same as an authenticated caller. SPIFFE offers a workload-identity example: a SPIFFE ID names a workload within a trust domain, and an SVID provides a cryptographically verifiable identity document. This identifies software under that trust arrangement, rather than proving its task is appropriate. [1](#source-spiffe)

## Name the principal being represented

An agent application can involve several identities: a person requesting work, a service operating the run and another service executing an action. In an original example, a reference assistant asks a document service to read a restricted draft for a particular user. The document service needs enough verified context to apply its policy. Calling the requester “research assistant” would not answer whose access rights matter.

The distinction affects records as well as authentication. A useful record could distinguish the initiating user, the executing workload and the individual run. The run identifier would correlate activity; it would not by itself be an authentication credential. A role label could explain intended behavior; it would not be proof that the role was assigned by an authorized authority. These are design distinctions for the example, not a universal identity architecture.

## Delegation needs an explicit relationship

Delegation describes acting on another party’s behalf while retaining a meaningful distinction between parties. RFC 8693 distinguishes delegation from impersonation and defines token-exchange parameters for subject and actor tokens. Its actor claim can represent an acting party. The RFC provides protocol building blocks; the receiving deployment still needs rules for issuing tokens and deciding which resulting requests to permit. [2](#source-token-exchange)

For the reference example, the user might permit reading one collection while the assistant service has broader technical access for unrelated jobs. A proposed delegation should retain the narrower task boundary rather than silently substitute all of the service’s privileges. If the user withdraws access, the implementation needs a defined response for ongoing and future work. These requirements cannot be inferred merely from the presence of an “on behalf of” label in a message.

## Check the receiving boundary

The cited MCP authorization version requires resource-aware token handling and validation of intended audience, and prohibits token passthrough to upstream services. These rules concern its documented HTTP authorization arrangement. They illustrate why a token accepted for one resource should not be treated as a universal credential for every destination. Other protocols and local transports require their own analysis. [3](#source-mcp-auth)

[Tool permissions](/articles/tool-permissions/) covers the subsequent decision about resources and actions. Identity provides an input to that decision; it does not replace it. A correctly authenticated assistant may still be denied a write, and an authorized read may still return untrusted content. [Prompt injection](/articles/prompt-injection/) remains relevant even when every connection has authenticated successfully.

## Inspect the chain without exposing credentials

For the example, tests could include an expired credential, a valid token addressed to another service, an absent initiating user and a delegated request beyond the permitted collection. Record which boundary rejected each request and whether any action occurred. Avoid placing raw credentials in ordinary traces or an article’s evidence list. [Observability](/articles/agent-observability/) concerns the useful record and its privacy limits.

Finally, a delegation chain needs accountability for incomplete work. A second agent’s report is evidence to examine, not automatic confirmation that an action completed. [Inter-agent communication](/articles/agent-to-agent-communication/) describes that exchange; [human oversight](/articles/human-oversight/) describes possible intervention. A sound identity design lets a receiver distinguish a claimed principal, a verified principal and the authority actually granted for the request.
