---
title: Context engineering
description: How an agent selects and maintains the information available for each model call, with separate boundaries for memory, retrieval and authority.
topic: Foundations
order: 15
status: Working draft
verified: '2026-10-17'
author: AI-assisted project draft
related: ["ai-agent", "agent-memory", "retrieval-augmented-generation", "structured-outputs"]
sources:
  - id: context-guide
    title: "Effective context engineering for AI agents"
    url: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
    publisher: "Anthropic"
    context: "29 September 2025 engineering article; context components, just-in-time retrieval and compaction. Vendor practice, not a universal reliability result."
  - id: lost-middle
    title: "Lost in the Middle: How Language Models Use Long Contexts"
    url: https://arxiv.org/abs/2307.03172v3
    publisher: "Liu et al., arXiv"
    context: "Version 3, 20 November 2023; multi-document question answering and key-value retrieval. Historical models and task-specific position effects."
  - id: langchain-context
    title: "Context engineering in agents"
    url: https://docs.langchain.com/oss/python/langchain/context-engineering
    publisher: "LangChain"
    context: "Living Python documentation checked 17 October 2026; model context, tool context and lifecycle hooks are framework-specific categories."
---

**Context engineering** concerns which instructions, history, evidence and tool descriptions an agent receives at a particular model call, and how that selection changes over a run. Anthropic’s September 2025 engineering article describes context curation as an iterative activity extending beyond writing an initial prompt. It discusses retrieval and compaction among practical techniques. These are the vendor’s recommendations and examples, rather than a guarantee that any particular context arrangement will work. [1](#source-context-guide)

## Select information for a decision

A model call receives a bounded representation of the available information. An original example is a reference assistant comparing two definitions: it could receive the question, the relevant passages and their revision dates, rather than every document in the archive. This proposed arrangement would make the evidence easier to inspect. It would still need testing against cases where an apparently irrelevant passage changes the answer.

The boundary differs from [memory](/articles/agent-memory/), which concerns retaining and recovering information across steps or sessions. [Retrieval-augmented generation](/articles/retrieval-augmented-generation/) concerns finding material and using it in generation. Context engineering includes the decision to include retrieved material, but also covers instructions, recent observations and available tools. Storing a fact does not ensure that the next call sees it; retrieving a passage does not establish that it deserves authority.

## Capacity and use are different questions

Lost in the Middle investigates how language models use long inputs through multi-document question answering and key-value retrieval. Moving relevant information within the input affected performance in the studied setups, often disadvantaging material in the middle. The cited version is from 2023. Its experiments provide a reason to evaluate information placement, not a current ranking of models or proof that every long input fails. [2](#source-lost-middle)

For the reference example, a useful test would place a necessary qualification at several positions while keeping the question unchanged. Another would add plausible but irrelevant documents. Record whether the answer preserves the qualification and points to the supporting passage. Merely checking that the input fits a provider’s advertised window would leave those questions unanswered. Token counts describe size; they do not certify comprehension.

## Keep state and presentation distinguishable

LangChain’s Python guide distinguishes transient model context from persistent state and describes tool and lifecycle context separately. Its middleware offers framework-specific places to change prompts, tools or saved state. Those categories illustrate an implementation approach; they are not mandatory terminology for other systems, and the guide’s reliability claims should be read as vendor guidance. [3](#source-langchain-context)

In the original example, removing an old passage from the next prompt would not have to delete it from the archive. The system could keep a reference to its original bytes and explain why a newer passage was selected. A summary would be a derived record with its own date and limitations. If it omits an exception, future reasoning can change even though the underlying archive remains correct.

## Preserve uncertainty through compression

A proposed compaction procedure should retain unresolved questions, evidence references and action outcomes separately. “A change was proposed” and “the change completed” describe different states. Compressing both into “handled” would discard information needed for [durable execution](/articles/durable-agent-execution/). Testing a summary against the original record can reveal that loss; a fluent summary alone cannot establish fidelity.

Finally, source material remains input to process. A sentence in a retrieved page cannot grant [tool permissions](/articles/tool-permissions/) or override the application’s instruction boundary. [Prompt injection](/articles/prompt-injection/) examines that risk. Context selection can reduce unnecessary exposure, but enforced authority and [evaluation](/articles/agent-evaluation/) remain separate responsibilities. A useful context policy makes its selection and omissions inspectable, including when the available evidence is insufficient.
