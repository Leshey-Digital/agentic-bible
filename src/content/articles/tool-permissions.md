---
title: Tool permissions
description: The boundaries that determine who may request a tool action, which resource it may affect, and where authorization is enforced.
topic: Protocols
order: 11
status: Working draft
verified: '2026-10-17'
author: AI-assisted project draft
related: [ai-agent, tool-use, model-context-protocol, prompt-injection, agent-sandboxing, human-oversight]
sources:
  - id: mcp-authorization
    title: Model Context Protocol authorization
    url: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
    publisher: Model Context Protocol
    context: Versioned 25 November 2025 specification, checked 17 October 2026; HTTP authorization roles, resource parameters, scope and access-token validation. It does not define every application permission.
  - id: resource-indicators
    title: 'RFC 8707: Resource Indicators for OAuth 2.0'
    url: https://datatracker.ietf.org/doc/html/rfc8707
    publisher: IETF
    context: February 2020 Standards Track RFC; sections 2–3 distinguish the intended resource from scope and explain audience restrictions. Describes an OAuth mechanism, not agent behavior or user approval of individual actions.
  - id: mcp-security
    title: Model Context Protocol security best practices
    url: https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices
    publisher: Model Context Protocol
    context: Versioned security guidance checked 17 October 2026; token passthrough and confused-deputy risks. These requirements do not prove that a particular deployment enforces them.
---

**Tool permissions** determine which operations an [agent](/articles/ai-agent/) may cause and which resources those operations may affect. [Tool use](/articles/tool-use/) explains the request/execution boundary; permission checking belongs at that boundary and any downstream resource server. A model’s ability to describe or select a tool does not establish access. MCP’s authorization specification gives a concrete protocol example by assigning distinct roles to the client, resource owner, authorization server and protected resource server. [1](#source-mcp-authorization)

## Identity, resource and action are different questions

A useful permission question identifies the actor, the intended resource and the permitted operation. RFC 8707 introduces a resource indicator so a client can identify where a requested access token will be used. The RFC distinguishes that resource from the scope of access and explains how the authorization server can restrict a token’s audience. These are protocol mechanisms; they do not establish whether the user wanted a particular agent action. [2](#source-resource-indicators)

For an illustrative reference-library application, permission to read an article would be different from permission to replace its current revision. The resource would also matter: a grant concerning one collection would not, by itself, grant authority over another. This is an original design example, not a configured authorization service on this site.

A human decision to allow a specific edit would answer another question: whether that proposed change should proceed now. A reusable credential and an action-specific confirmation serve different purposes. A design that combines them would still need to bind the decision to the actual operation being executed.

## Validate at the receiver

The versioned MCP HTTP authorization specification requires resource servers to validate tokens, including that a token was issued for the server as its intended audience. It also describes conveying authorization with each HTTP request and selecting access scopes. Its authorization flow is for HTTP-based transports; the document treats local stdio credentials differently. A protocol version and transport therefore belong in any claim about the mechanism. [1](#source-mcp-authorization)

RFC 8707 explains why audience restriction matters when a token presented to one resource must not become a credential for unrelated resources. It also discusses identifying the intended tenant within a resource URI where relevant. A broad hostname alone may not express the intended boundary in a multi-tenant system. [2](#source-resource-indicators)

The security guidance for [MCP](/articles/model-context-protocol/) separately prohibits token passthrough and discusses a confused deputy: a component with its own authority can be induced to misuse that authority for another party. A working connection is consequently insufficient evidence that every delegated action is correctly authorized. [3](#source-mcp-security)

## Descriptions are not enforcement

In the library example, a tool description could say that it updates only draft articles. The application would still need to check the actual target and its current state. Similarly, calling a field “read-only” would not constrain a server that implements a write behind that name. These are reasons to examine the execution contract rather than infer permissions from interface labels.

An external document asking the agent to change the target collection would remain untrusted input. [Prompt injection](/articles/prompt-injection/) concerns that attempted redirection; authorization limits what a redirected component can successfully do. [Sandboxing](/articles/agent-sandboxing/) can restrict an execution environment, but it does not decide whether a permitted application-level edit is factually justified.

## Check changes and failures

For the example, useful tests would include an expired grant, a valid grant for a different resource, an operation outside the allowed scope, and a resource whose state changed after the proposal. A denial should remain distinguishable from a network failure or an unknown outcome. Those tests would inspect actual receiver behavior, rather than accept an agent’s summary of its authority.

Permission design is specific to a system and its threat model. The cited protocol documents provide requirements and mechanisms, not a certification of this encyclopedia. [Human oversight](/articles/human-oversight/) and recorded action outcomes can make decisions reviewable, while enforcement still depends on the application and services that carry out the request.
