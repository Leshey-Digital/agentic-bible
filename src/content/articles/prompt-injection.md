---
title: Prompt injection
description: When untrusted text attempts to redirect an AI system, crossing the boundary between material to process and instructions the system should follow.
topic: Foundations
order: 8
status: Working draft
verified: '2026-10-16'
author: AI-assisted project draft
related: [ai-agent, tool-use, model-context-protocol, agent-orchestration, agent-memory, retrieval-augmented-generation, agent-evaluation]
sources:
  - id: indirect-injection
    title: 'Not what you’ve signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection'
    url: https://arxiv.org/abs/2302.12173v2
    publisher: Greshake et al., arXiv
    context: Version 2, 5 May 2023; early research on indirect instructions embedded in application-retrieved material. Demonstrations concern the studied systems, not all current products.
  - id: agentdojo
    title: 'AgentDojo: A Dynamic Environment to Evaluate Prompt Injection Attacks and Defenses for LLM Agents'
    url: https://arxiv.org/abs/2406.13352v3
    publisher: Debenedetti et al., arXiv
    context: Version 3, 24 November 2024; sections 3–4 describe tool-based tasks, attacks, defenses, benign utility, and attack success. Benchmark findings are bounded by its environment and threat model.
  - id: safety-guidance
    title: Safety in building agents
    url: https://developers.openai.com/api/docs/guides/agent-builder-safety
    publisher: OpenAI
    context: Living vendor guidance checked 16 October 2026; recommends separating untrusted inputs, constraining data flow, confirmations, and evaluation. It explicitly acknowledges residual risk.
---

**Prompt injection** is an attempt to make an AI system treat attacker-controlled text as instructions that redirect its intended task. An indirect injection reaches the system through material it is processing, such as retrieved documents or tool output, rather than through an authorized task request. Greshake and colleagues studied this route in LLM-integrated applications in 2023. Their demonstrations establish examples of the problem, not a claim that every current application has the same vulnerabilities. [1](#source-indirect-injection)

## The boundary is about authority

The central distinction is between content an application should examine and instructions it is authorized to obey. The early indirect-injection research describes how externally supplied content can blur that distinction. This matters for [agents](/articles/ai-agent/) because their responses may include [tool requests](/articles/tool-use/), extending the consequences beyond the words of an answer. [1](#source-indirect-injection)

For a benign original example, imagine an encyclopedia assistant checking a document’s publication date. The document also contains a sentence telling assistants to stop checking dates and label every article complete. The sentence is material in the document, but its author has not acquired permission to redefine the assistant’s task. Recognizing that difference is the point of the example; no attack against a real service is performed here.

A false date in the same document would be a different problem: inaccurate evidence. An injection attempts to redirect behavior. A retrieved page can contain either or both. Source authenticity, factual accuracy, and authority to issue instructions are therefore separate questions in this illustrative task.

## Retrieval and memory do not confer trust

[Retrieval-augmented generation](/articles/retrieval-augmented-generation/) can make a relevant document available to a model. Relevance would not authorize the document to change application policy. In the example, a search result’s high position would not make its embedded completion instruction binding. A source citation would identify where the sentence came from without endorsing the instruction.

The same reasoning applies if a worker copies the sentence into a summary or a [memory record](/articles/agent-memory/). A proposed research workflow would retain the origin and purpose of such text as it moves between steps. Otherwise, a later component could see an unattributed instruction rather than quoted source material. This is analysis of the example’s data flow, not an experimental finding that provenance labels solve injection.

## Defenses need enforced boundaries

OpenAI’s agent-building guidance recommends keeping untrusted material out of privileged instructions, limiting data passed between components with structured fields, using tool confirmations, and evaluating traces. It also states that these measures do not fully remove injection risk. These are vendor recommendations; they are not an independent guarantee of security for a framework, model, or this website. [3](#source-safety-guidance)

For the encyclopedia example, the application could give the research step access only to source reading, while an independently controlled operation accepts a validated article change. That proposed boundary would limit which actions a redirected research step could request successfully. A valid data shape would still need substantive checking: a well-formed date could be false, and a well-formed article could contain unsupported claims. Restricting a field’s format would not establish the field’s meaning.

## Test usefulness as well as resistance

AgentDojo provides an extensible research environment for agents using tools over untrusted data. It evaluates ordinary task utility alongside attacker success and utility under attack. That distinction matters: refusing every document can avoid some unwanted actions while also failing the legitimate task. Its findings apply to the tested tasks, agent configurations, attacks, and defenses, rather than proving that a defense handles every future input. [2](#source-agentdojo)

An [evaluation](/articles/agent-evaluation/) for the benign example would check whether the assistant still finds the date, whether the unrelated completion instruction affects its behavior, and whether any action crosses the declared permission boundary. Separate cases would remove the suspicious sentence or make the date unavailable. Those cases would help distinguish normal task failure from redirection.

## Limits of a reassuring answer

In the proposed workflow, a final statement that the assistant “ignored the injection” would be insufficient evidence on its own. A reviewer would inspect the actual result and relevant action record. [Orchestration](/articles/agent-orchestration/) would need to preserve that distinction across handoffs. The encyclopedia currently provides these explanatory drafts; it does not claim to deploy or certify an injection-resistant autonomous publishing service.
