---
title: Tool use
description: The structured handoff between a model’s request and software that can retrieve information or take an action.
topic: Capabilities
order: 2
status: Working draft
verified: '2026-10-16'
author: AI-assisted project draft
related: [ai-agent, model-context-protocol]
sources:
  - id: openai
    title: Function calling
    url: https://developers.openai.com/api/docs/guides/function-calling
    publisher: OpenAI
    context: Living Responses API documentation; schemas and execution flow vary by API.
  - id: claude
    title: Tool use with Claude
    url: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
    publisher: Anthropic
    context: Living documentation; distinguishes client tools from provider-executed server tools.
  - id: mcp-tools
    title: MCP specification — Tools
    url: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
    publisher: Model Context Protocol
    context: Pinned specification revision 2025-11-25; tool inputs, results and error handling.
---

**Tool use**, often called function calling, lets a model request a capability outside text generation. A capability might look up a record, calculate a value, or create a draft. For an application-defined function, the surrounding program executes the request and supplies a result to the model. OpenAI documents this as a multi-step exchange between the application and the model. [1](#source-openai)

## Anatomy of a tool call

A tool definition describes a name, purpose, and expected arguments. The model returns a structured request with arguments; the application decides how to handle it. In OpenAI’s function-calling flow, the application sends the execution result back with the corresponding call identifier before asking for a further response. Schema constraints help structure the request, but do not establish that its contents are correct or authorized. [1](#source-openai)

## A request, execution, and result

The following original example uses a generic application envelope, not an OpenAI, Claude, or MCP wire format. All records are invented. A read-only `find_source` tool looks up an article’s registered citations in a local catalog; it does not fetch arbitrary URLs. The model requests:

```json
{
  "call_id": "lookup-1",
  "name": "find_source",
  "arguments": { "article_id": "ai-agent" }
}
```

Before execution, the application checks that `find_source` is an allowed tool, that the arguments contain exactly one string `article_id`, that the article exists, and that the caller may read its citations. It then queries the catalog. A successful result returns the same call identifier:

```json
{
  "call_id": "lookup-1",
  "status": "ok",
  "result": {
    "article_id": "ai-agent",
    "sources": [
      { "source_id": "demo-source-1", "title": "Example agent specification" }
    ]
  }
}
```

The application checks the result’s shape and correlation before passing it back to the model. The model could then report that the catalog lists one citation. This result establishes neither that the source is reachable nor that it supports a particular claim. Permission to read the catalog also grants no permission to edit or publish an article.

If the catalog is unavailable, an alternative response for that same request is:

```json
{
  "call_id": "lookup-1",
  "status": "error",
  "error": {
    "code": "catalog_unavailable",
    "message": "The catalog could not be read. No source list was returned."
  }
}
```

An error is not an empty successful lookup. In this example, the application may retry a transient read failure once within the original deadline, then return an unresolved outcome. Invalid arguments or denied access require correction or authority, not an automatic retry. These are illustrative application rules, not provider guarantees. A missing reply leaves completion unknown; for a tool that writes, check durable status or an idempotency record before repeating the operation. A call identifier correlates messages but does not by itself prevent duplicate execution.

## Where execution happens

Provider terminology matters. Anthropic distinguishes client tools, which run in the application, from server tools, which run on Anthropic’s infrastructure. With client tools, a response contains a tool-use block; the application executes the operation and returns a tool-result block. The exact message format is API-specific. [2](#source-claude)

This distinction matters when interpreting traces. A generated request can show what the model attempted. A recorded result can show what the executor reported. Neither should silently substitute for verification of a consequential external change.

## Results, errors, and retries

[Model Context Protocol](/articles/model-context-protocol/) offers a shared tool interface. Its tools specification separates protocol-level failures, such as an unknown tool, from tool-execution errors, such as an upstream API failure. It also specifies input schemas and permits structured output schemas. [3](#source-mcp-tools)

The generic example’s `status` and `error` fields are its own contract. An MCP implementation instead uses the protocol’s specified error and tool-result shapes. A citation-checker would also distinguish an unreachable source from evidence that contradicts a claim. Bounded attempts, deadlines and resource limits belong to the executor; the model requesting another call does not override them.

## Authority stays with the application

MCP’s tool guidance calls for input validation and access control on servers, and recommends confirmation for sensitive operations on clients. Tool annotations should not be trusted merely because a server supplies them. [3](#source-mcp-tools)

An implementation can therefore expose a read-only source lookup without exposing publication. This is a design choice, not a property guaranteed by a model’s willingness to follow instructions. Tool use can be a single exchange inside a fixed workflow or a repeated part of an [AI agent](/articles/ai-agent/) loop. A tool call alone does not tell you which kind of system you are observing.
