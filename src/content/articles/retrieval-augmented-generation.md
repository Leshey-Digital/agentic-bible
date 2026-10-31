---
title: Retrieval-augmented generation
description: A way to generate responses with retrieved material, with distinct failure points in finding evidence, selecting context, and using it faithfully.
topic: Capabilities
order: 6
status: Working draft
verified: '2026-10-16'
author: AI-assisted project draft
related: [ai-agent, tool-use, agent-memory, agent-evaluation, prompt-injection]
sources:
  - id: rag
    title: Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks
    url: https://arxiv.org/abs/2005.11401v4
    publisher: Lewis et al., arXiv
    context: Version 4, 12 April 2021; NeurIPS 2020 research. Section 2 defines the paper’s retriever-generator models, which are more specific than the broad contemporary label RAG.
  - id: dpr
    title: Dense Passage Retrieval for Open-Domain Question Answering
    url: https://arxiv.org/abs/2004.04906v3
    publisher: Karpukhin et al., arXiv
    context: Version 3, 30 September 2020; section 3 describes learned question/passage encoders. Retrieval results concern the paper’s open-domain QA setting.
  - id: long-context
    title: 'Lost in the Middle: How Language Models Use Long Contexts'
    url: https://arxiv.org/abs/2307.03172v3
    publisher: Liu et al., arXiv
    context: Version 3, 20 November 2023; controlled multi-document question answering and key-value retrieval. Its position effects are findings for the evaluated models and setups.
---

**Retrieval-augmented generation**, often abbreviated **RAG**, combines finding external material with generating an answer conditioned on that material. The influential Lewis and colleagues paper joins a learned sequence generator with a retriever over a dense document index. It distinguishes information represented in model parameters from information accessible through retrieval. The architecture makes external material available during generation; it does not make every resulting claim correct. [1](#source-rag)

## The research architecture and the broader idea

The paper defines RAG-Sequence, which marginalizes over a retrieved document for the output sequence, and RAG-Token, which can use a different retrieved document when predicting each token. These are particular probabilistic models, trained and evaluated in specified settings. An application that searches documents and adds excerpts to a prompt should not claim to reproduce those experiments merely because it also uses the label RAG. [1](#source-rag)

Dense Passage Retrieval provides one relevant retrieval technique. Its question encoder and passage encoder map text to representations that can be scored for retrieval. This separates candidate selection from the later reading or answering stage. The paper’s retrieval experiments do not establish that a high-scoring passage is authoritative, up to date, or sufficient to support a new claim. [2](#source-dpr)

In this entry, the broader operational distinction is simple: a retrieval stage chooses material, and a generation stage uses selected material. [Tool use](/articles/tool-use/) can expose the retrieval stage to an agent. [Orchestration](/articles/agent-orchestration/) may determine whether another search is needed. A single fixed retrieval-and-answer path can also operate without a model selecting its own next action.

## A passage can be found and still not be used

Lost in the Middle investigated multi-document question answering and key-value retrieval. It found that changing where relevant information appears in the context affected performance, with stronger results often near the beginning or end than in the middle. This is evidence about the tested models and experiments, not a timeless ranking of all current models. It supports testing context placement rather than equating context capacity with successful use. [3](#source-long-context)

Consider a miniature corpus for a fictional product, Harbor. These three records and all dates are invented to show the evidence decision; they are not product documentation or experimental results.

- **A — manual, 3 May 2025:** Harbor does not support CSV export.
- **B — manual, 15 June 2025:** CSV export is available from the Export menu.
- **C — release note, 8 June 2025:** CSV export became available today.

The question is “When did Harbor gain CSV export?” A search that returns B has found relevant words but not the requested date. A search that also returns C has supplied evidence for an answer: 8 June 2025, citing C. A describes an earlier state; it does not contradict the later release. The retrieval stage must retain each record's identity, date and text so the answering stage can make that distinction.

## Citations need a claim-level check

A citation should let a reader inspect the evidence for the adjacent statement. In the Harbor example, citing B for the launch date would not support the answer even though B discusses the right feature. If C were missing, the available records would place the change between A's May observation and B's June observation, not establish an exact day. Asking who requested the feature would be unanswerable from these records. This claim-level check follows retrieval; a high retrieval score cannot supply the missing fact.

The selected material also remains external data. A document’s instruction to change the task would not become an authorized instruction merely because search ranked it highly. [Prompt injection](/articles/prompt-injection/) examines that boundary. [Memory](/articles/agent-memory/) adds a related question when previously generated notes become retrieval candidates: is the note an observation, an interpretation, or a superseded conclusion?

## Evaluate the stages separately

For the protocol-history example, [evaluation](/articles/agent-evaluation/) could first ask whether retrieval found the relevant revision. It could then test whether the selected context preserved its meaning and whether the final answer accurately represented the evidence. A fluent answer would not distinguish these failure modes.

The example would also need an unanswerable question and a pair of conflicting sources. A useful result could be a bounded statement of uncertainty. Retrieval supplies an opportunity to inspect evidence; the quality of the source, its fit to the claim, and the generator’s use of it still require separate examination.
