---
title: Durable agent execution
description: How an agent workflow records progress and resumes after interruption, while distinguishing replayed results from repeated external actions.
topic: Capabilities
order: 10
status: Working draft
verified: '2026-10-17'
author: AI-assisted project draft
related: [ai-agent, agent-orchestration, agent-memory, agent-planning, agent-observability, human-oversight]
sources:
  - id: langgraph-tasks
    title: Functional API overview
    url: https://docs.langchain.com/oss/python/langgraph/functional-api
    publisher: LangChain
    context: Living implementation documentation checked 17 October 2026; checkpointing, resumption and Idempotency sections distinguish saved task results from unfinished tasks that may run again.
  - id: temporal-replay
    title: Temporal Workflow
    url: https://docs.temporal.io/workflows
    publisher: Temporal
    context: Living implementation documentation checked 17 October 2026; How Workflow replay works and Resuming a Workflow describe event history and replay constraints in Temporal.
  - id: idempotent-apis
    title: Making retries safe with idempotent APIs
    url: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
    publisher: Malcolm Featonby, Amazon Builders’ Library
    context: Primary engineering guidance checked 17 October 2026; request identifiers, semantic equivalence, late requests and changed intent. An API-specific contract is needed; this is not a universal exactly-once guarantee.
---

**Durable agent execution** means retaining enough execution information to continue work after a process stops or loses contact with another component. It concerns completed work and recovery, rather than only an agent’s conversational [memory](/articles/agent-memory/). LangGraph’s Functional API illustrates this distinction: saved task results can be reused when execution resumes, while a task that started but did not finish may execute again. [1](#source-langgraph-tasks)

## Saving progress has a boundary

A checkpoint is a recorded state from which a system can continue. It does not automatically establish what happened outside that state. In an illustrative research workflow, a checkpoint could record that a source revision was retrieved and compared. If it records only an intention to fetch, recovery still needs to determine whether a usable result exists. This is an original example, not a description of this encyclopedia’s production infrastructure.

LangGraph documents placing API calls in task functions so their completed results can be checkpointed, and making operations idempotent where re-execution is possible. That recommendation matters at partial-failure boundaries. It should not be paraphrased as a guarantee that checkpointing makes every external action occur exactly once. [1](#source-langgraph-tasks)

## Replay is not necessarily a fresh run

Temporal describes reconstructing workflow state by running workflow code against a recorded event history. Completed activity results are reused during replay instead of repeating those activities solely to reconstruct state. The workflow logic must make consistent decisions from the same recorded history; uncontrolled time, randomness or direct external calls can undermine that consistency. This describes Temporal’s implementation contract, not a feature shared automatically by all agents. [2](#source-temporal-replay)

For a model-assisted workflow, the distinction is consequential. Reusing a previously recorded response and requesting a new response are different operations. A fresh response could propose different next steps. A recovery design therefore needs to specify what is restored, what is recalculated, and which version of the workflow is allowed to interpret the stored state. Those are questions to ask of a particular implementation, rather than assumptions supplied by the word “durable.”

## The uncertain-write problem

Amazon’s engineering article describes a caller that receives no response after requesting an operation. The operation may have succeeded even though the acknowledgment was lost. Its preferred API pattern uses a caller-provided request identifier to express the same intended operation across retries, with a contract governing duplicate requests and changed intent. Retrying identical parameters alone does not necessarily express that identity. [3](#source-idempotent-apis)

Consider an original article-update example. A workflow requests that a particular revision become current, then loses its response. Recovery could query the operation’s recorded result using its identifier. If the result remains unknown, the workflow would preserve uncertainty rather than silently announce success or generate another unrelated update request. Whether such a query exists depends on the actual API.

An idempotency contract also needs a retention period and a rule for reusing an identifier with different content. The cited engineering guidance discusses late requests and changed intent. [3](#source-idempotent-apis) A system that has discarded its prior record cannot infer an unlimited deduplication guarantee from a familiar identifier.

## Resume, cancel and repair are different choices

Resuming the recorded plan is one recovery action. Cancelling future work or deliberately starting a new investigation are others. In the example, the source may have changed during a long pause, making an old finding historically accurate but unsuitable for the current task. Recovery policy would need to decide whether to continue from the pinned revision or start a new, explicitly identified run.

[Observability](/articles/agent-observability/) can help establish which attempt produced an outcome. [Human oversight](/articles/human-oversight/) can supply a decision when recovery needs judgment. Neither replaces the underlying action record. A useful test would stop the example before a write, after the write but before acknowledgment, and after acknowledgment, then inspect both the recovered state and actual effects. Durability is a recoverability property with boundaries; it is not proof of factual correctness or a deployed autonomous service.
