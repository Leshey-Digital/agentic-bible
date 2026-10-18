---
title: Agent observability
description: How traces, metrics and event records help explain an agent run, while keeping operational evidence distinct from factual evaluation and audit authority.
topic: Foundations
order: 13
status: Working draft
verified: '2026-10-17'
author: AI-assisted project draft
related: [ai-agent, agent-orchestration, agent-evaluation, durable-agent-execution, agent-sandboxing, human-oversight]
sources:
  - id: telemetry-primer
    title: OpenTelemetry observability primer
    url: https://opentelemetry.io/docs/concepts/observability-primer/
    publisher: OpenTelemetry authors
    context: Living project documentation checked 17 October 2026; instrumentation, signals, metrics, logs and distributed tracing. Describes software telemetry, not an agent factual-accuracy measure.
  - id: telemetry-traces
    title: OpenTelemetry traces
    url: https://opentelemetry.io/docs/concepts/signals/traces/
    publisher: OpenTelemetry authors
    context: Living project documentation checked 17 October 2026; trace/span identifiers, parent relationships, timing, attributes and status. Instrumented status reflects the operation being tracked.
  - id: agents-tracing
    title: OpenAI Agents SDK tracing
    url: https://openai.github.io/openai-agents-python/tracing/
    publisher: OpenAI
    context: Living Python SDK documentation checked 17 October 2026; agent/tool/handoff spans, sensitive-data controls and export/redaction behavior. SDK-specific behavior is not enabled or installed by this article.
---

**Agent observability** concerns the evidence available to understand how an agent run behaved. OpenTelemetry describes observability through instrumentation that emits signals such as traces, metrics and logs. Applied to an [agent](/articles/ai-agent/), these signals can help answer where time was spent, which operation failed, or how work moved between components. They are operational observations, not a substitute for checking whether the agent’s answer is true. [1](#source-telemetry-primer)

## Different signals answer different questions

A metric aggregates numeric observations, such as operation counts over an interval. A log records an event or message. A distributed trace relates work across components. OpenTelemetry’s primer distinguishes these signals and describes how tracing follows a request through a distributed system. The useful signal depends on the question; a total error count does not identify every affected run. [1](#source-telemetry-primer)

In an original reference-library example, a metric could count failed source checks, an event could record that a particular check timed out, and a trace could connect that check to an article investigation. These would be different views of the same operation. None would establish that the article’s replacement citation supports its claim.

## A trace has structure and scope

OpenTelemetry models a trace using spans for operations, with identifiers and parent relationships linking related work. Spans can include timing, attributes and status. The documentation’s root/child examples show how one operation can be decomposed into connected work. A successful span status describes the instrumented operation; it does not automatically establish task-level success. [2](#source-telemetry-traces)

For the example, a completed document fetch could have a successful operation status even if it returned a specification unrelated to the question. [Evaluation](/articles/agent-evaluation/) would need to examine that mismatch. A trace would help locate the fetched material and its place in the run, while a separate evidence check would judge its fit.

An [orchestration](/articles/agent-orchestration/) handoff also needs clear relationships. If two workers operate on different subtasks, merely giving them the same human-readable title would not identify which result belongs to which assignment. A proposed record could connect each assignment, attempt and accepted result without exposing the entire source text. These are design criteria for the example, not claims about a tracing service on this site.

## Visibility can expose sensitive data

The OpenAI Agents SDK documents built-in traces and spans for agent operations. Its tracing guide also warns that generation and function spans can contain sensitive inputs and outputs. It provides controls for excluding such data and discusses redaction before export. These are implementation-specific controls, and using an SDK label would not by itself establish that export or retention is appropriate. [3](#source-agents-tracing)

The same guide explains that merely adding a redaction processor does not prevent an independently registered exporter from receiving data if redaction fails. [3](#source-agents-tracing) This illustrates a broader review question: which component actually decides whether data leaves the process? Recording everything first and hiding it later would be different from preventing collection or export.

For the library example, a proposed minimal record could retain operation categories, durations and safe correlation identifiers. An actual design would still need to decide which fields are necessary, who can read them, and how long they remain. An identifier containing a private document name would not become harmless simply because its field is called an ID.

## Missing evidence needs an explicit gap

[Durable execution](/articles/durable-agent-execution/) needs authoritative progress records to recover work. Diagnostic telemetry can complement those records, but an incomplete trace should not silently replace the action’s actual result. In the example, no completion event could mean an interrupted exporter, a stopped process, or work that never finished. The record alone might not distinguish them.

Useful tests would check whether failed and cancelled attempts remain distinguishable, whether handoffs retain correlation, and whether disabled telemetry actually avoids collection/export. [Human oversight](/articles/human-oversight/) benefits from those distinctions. Observability makes behavior more inspectable within the instrumentation’s coverage; it does not create factual correctness, authorization or an audit guarantee on its own.
