---
title: Model Context Protocol
description: An open protocol for connecting AI applications to tools, resources, and prompts through a shared interface.
topic: Protocols
order: 3
status: Working draft
verified: '2026-10-16'
author: AI-assisted project draft
related: [ai-agent, tool-use, tool-permissions, agent-identity, agent-to-agent-communication]
sources:
  - id: architecture
    title: MCP specification — Architecture
    url: https://modelcontextprotocol.io/specification/2025-11-25/architecture
    publisher: Model Context Protocol
    context: Pinned specification revision 2025-11-25; host, client, server and capability negotiation.
  - id: transports
    title: MCP specification — Transports
    url: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
    publisher: Model Context Protocol
    context: Pinned specification revision 2025-11-25; stdio and Streamable HTTP.
  - id: security
    title: MCP security best practices
    url: https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices
    publisher: Model Context Protocol
    context: Official security guidance; authorization boundaries and implementation risks.
  - id: tools
    title: MCP specification — Tools
    url: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
    publisher: Model Context Protocol
    context: Pinned specification revision 2025-11-25; discovery and invocation methods.
---

**Model Context Protocol (MCP)** defines a shared interface through which an AI application can connect to external capabilities and context. Its architecture separates a host application, client connections, and servers. This article uses specification revision **2025-11-25** as a stable reference; it does not assert that every implementation supports every feature or that this is the newest revision. [1](#source-architecture)

## Host, client, and server

The host coordinates the application, including model integration, connection permissions, and user authorization decisions. It creates clients; each client maintains a connection to a server. Servers expose focused capabilities, including tools, resources, and prompts. MCP uses JSON-RPC messages and negotiates capabilities during initialization. [1](#source-architecture)

Imagine a reference editor as the host and a source-catalog service as a server. A client connects the two. The editor could discover a source-lookup tool through that connection. This is an explanatory example, not an integration running on Agentic Bible.

## How a tool becomes available

A server that offers tools declares that capability. A client can discover tool definitions through `tools/list` and invoke a tool through `tools/call`. Definitions describe expected arguments; results report what the tool returned. The protocol does not mandate a single user-interface pattern. [4](#source-tools)

MCP can support [tool use](/articles/tool-use/) inside an [AI agent](/articles/ai-agent/), but the surrounding application still has to decide which actions are allowed and how results are handled. Sharing an interface does not make two implementations equivalent in permissions, quality, or operational behavior.

## Local and remote connections

The referenced transport specification defines **stdio**, where a client starts a server subprocess and exchanges messages over standard input and output, and **Streamable HTTP**, which uses HTTP for independently running servers. The specification also describes compatibility with an older HTTP+SSE transport. Transport support must be checked against the version implemented by each side. [2](#source-transports)

A local server is executable software. A remote server is a network service. Both deserve an explicit trust decision before connection. The location of the process alone is not a sufficient security assessment.

## Security is an implementation responsibility

The official security guidance discusses risks including confused-deputy attacks, token passthrough, server-side request forgery, and session hijacking. It prohibits accepting and forwarding tokens that were not issued for the MCP server, and explains why sessions should not be treated as authentication. [3](#source-security)

For a future encyclopedia integration, our proposed boundaries are read-only discovery, minimal source context, allowlisted destinations, and an explicit reviewable diff. These are project design proposals. MCP does not automatically enforce our editorial standards, check a citation’s truth, or impose a spending cap.

## What to verify before connecting

Record the protocol revision, supported capabilities, executable or service owner, requested access, and failure behavior. In an evaluation, test both a successful lookup and a denied or unavailable operation. Keep evidence about the connection separate from evidence about the content it returns. Agentic Bible currently explains MCP; it does not connect to an MCP server or execute any tools for readers.
