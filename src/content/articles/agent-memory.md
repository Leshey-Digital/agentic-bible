---
title: Agent memory
description: How an agent stores and retrieves information across steps or sessions, and why persistence, relevance, and truth are separate questions.
topic: Capabilities
order: 5
status: Working draft
verified: '2026-10-16'
author: AI-assisted project draft
related: [ai-agent, agent-orchestration, retrieval-augmented-generation, agent-evaluation, prompt-injection]
sources:
  - id: generative-agents
    title: 'Generative Agents: Interactive Simulacra of Human Behavior'
    url: https://arxiv.org/abs/2304.03442v2
    publisher: Park et al., arXiv
    context: Version 2, 6 August 2023; section 4 describes memory, retrieval, reflection, and planning in a simulated town. Believability in that setting is not factual reliability or evidence of consciousness.
  - id: memgpt
    title: 'MemGPT: Towards LLMs as Operating Systems'
    url: https://arxiv.org/abs/2310.08560v2
    publisher: Packer et al., arXiv
    context: Version 2, 12 February 2024; section 2 describes movement between a fixed model context and external stores. The operating-system comparison is an architectural analogy.
  - id: langgraph-memory
    title: Memory overview
    url: https://docs.langchain.com/oss/python/concepts/memory
    publisher: LangChain
    context: Living documentation checked 16 October 2026; thread-scoped checkpoints, cross-thread stores, and memory-writing tradeoffs describe this implementation.
---

**Agent memory** refers here to information an [agent](/articles/ai-agent/) retains and can use in later decisions. The term covers several mechanisms. LangChain’s documentation distinguishes conversation or thread-scoped state from information shared across sessions in a longer-lived store. Its use of “short-term” and “long-term” describes recall scope; even thread state may be persisted in a database. These labels do not by themselves specify a retention period. [3](#source-langgraph-memory)

## What is actually being retained?

A useful distinction is between text currently supplied to a model and records held outside that context. MemGPT makes this separation explicit. Its architecture uses function calls to move information between a fixed context and external archival or conversation storage. Keeping more information externally does not put all of it into one inference: the system must retrieve and move the relevant material into context. The paper evaluates document analysis and multi-session conversation, not unrestricted perfect recall. [2](#source-memgpt)

Another research example is Generative Agents. In its simulated town, agents record observations, retrieve memories using recency, importance, and relevance, and form higher-level reflections to inform behavior. A reflection is generated interpretation of stored experience. The study concerns believable simulated behavior, so it would be a mistake to treat a retrieved reflection as independently verified knowledge or as evidence of human-like experience. [1](#source-generative-agents)

These examples concern information managed around model calls. A stored note and a change to a model’s learned parameters are different mechanisms. Describing an application as remembering a preference does not establish that its underlying model has been retrained. The storage and retrieval path needs to be specified before making that claim.

## Reading and writing are separate decisions

LangChain describes memory updates during a request or in background work. Immediate updates can be available to the next interaction but add work to the current response; background updates introduce a question about when other interactions see the new information. This is implementation guidance, not evidence that either timing policy is best for every application. [3](#source-langgraph-memory)

Consider an original example: a research assistant records that an article’s protocol reference needs checking. A useful record could include the article, the source revision, why it was questioned, and whether the issue remains open. A later run could retrieve that record before repeating the investigation. Nothing in this example requires the assistant to store a user’s unrelated conversation history.

Suppose a subsequent check resolves the issue. Simply appending “resolved” while leaving the earlier warning equally eligible for retrieval would create ambiguity. In this proposed design, the new record would identify the earlier record it supersedes, retain the evidence for the correction, and make the current status visible. This is a design illustration rather than a claim that this encyclopedia already has such memory.

## Persistence is not verification

The example also separates what happened from what a model inferred. “A request failed” is a different record from “the document no longer exists.” A system should not silently promote the second statement from the first. This entry’s proposed record format would label observations and interpretations separately so future work could revisit the inference.

[Retrieval-augmented generation](/articles/retrieval-augmented-generation/) may supply records to a response, but selecting a relevant record does not resolve whether it is current, accurate, or appropriate to disclose. An external instruction stored as a note could also reappear later; the [prompt-injection](/articles/prompt-injection/) entry explains why source text needs a different authority from application instructions.

## Evaluate remembering and forgetting

For the research-assistant example, a useful [evaluation](/articles/agent-evaluation/) would test whether a later run retrieves the correction, avoids reviving the obsolete warning, and respects the intended scope of the record. A separate test would remove a record and check both the store and later answers. An answer that happens to omit it would not prove deletion.

Retention, access, correction, and deletion are explicit design decisions in this example. Neither a memory label nor a convincing recollection demonstrates that those decisions have been implemented. [Orchestration](/articles/agent-orchestration/) determines when records flow between steps; memory determines what can survive those steps. Both need evidence about their actual behavior.
