---
title: Structured outputs
description: How schemas constrain the form of model responses while leaving factual correctness, supported features and execution authority as separate checks.
topic: Capabilities
order: 16
status: Working draft
verified: '2026-10-17'
author: AI-assisted project draft
related: ["ai-agent", "tool-use", "context-engineering", "tool-permissions"]
sources:
  - id: schema-core
    title: "JSON Schema Core, Draft 2020-12"
    url: https://json-schema.org/draft/2020-12/json-schema-core
    publisher: "JSON Schema"
    context: "Draft 2020-12; sections 4.3 and 8.1 describe schemas, vocabularies and dialect identification. A schema is not evidence of factual truth."
  - id: schema-validation
    title: "JSON Schema Validation, Draft 2020-12"
    url: https://json-schema.org/draft/2020-12/json-schema-validation
    publisher: "JSON Schema"
    context: "Draft 2020-12; validation keywords and section 7 format vocabularies. Format assertion support is optional unless required by the selected vocabulary."
  - id: openai-structured
    title: "Structured model outputs"
    url: https://developers.openai.com/api/docs/guides/structured-outputs
    publisher: "OpenAI"
    context: "Living API guide checked 17 October 2026; supported schema subset, JSON mode comparison, refusals and incomplete responses. Model/API support is specific."
---

**Structured outputs** are model responses produced under a specified output contract, often a schema describing fields and permitted values. The phrase can refer to different mechanisms: an application might validate an ordinary response afterward, or use a provider feature that constrains generation. JSON Schema supplies a vocabulary for describing JSON instances and a way to identify the schema dialect. It does not establish that an instance’s assertions about the world are true. [1](#source-schema-core)

## Agree on a contract

Consider an original reference-library example with a response containing a proposed article identifier, a short explanation and an evidence list. A schema could require the explanation to be a string and the evidence list to contain objects. The receiver could then reject a missing field before attempting to display or store the response. This example describes a possible design, not an implemented generation feature of this site.

The application would also need a meaning for each field. Does an empty evidence list mean no source was found, or that the search was not attempted? Does an article identifier refer to a current page or a proposed one? Structural rules help make these differences representable, but the contract needs documented semantics and appropriate checks at the receiver.

## Parsing is only one boundary

Valid JSON can still violate a schema. A schema-valid object can still contain the wrong date. A factually correct proposal can still request an unauthorized action. These are separate failure modes, so passing one check should not silently stand in for the others. [Tool use](/articles/tool-use/) describes the handoff to executable software; [tool permissions](/articles/tool-permissions/) describes the authority required there.

JSON Schema 2020-12 defines assertions such as types, numeric bounds and required properties. Its treatment of `format` needs particular care: the format annotation vocabulary does not require full format validation, while support for the format assertion vocabulary is optional and has stronger requirements when declared. A receiver must know the validator’s dialect, vocabulary support and configuration before claiming a string’s format was checked. [2](#source-schema-validation)

## Read provider guarantees with their scope

OpenAI’s Structured Outputs guide distinguishes schema-constrained responses from JSON mode, documents a supported schema subset, and describes refusal and incomplete-response handling. A refusal may take a separate response path rather than matching the requested schema. These details concern the documented API and supported models; they do not define every provider’s behavior or eliminate mistakes inside otherwise well-formed fields. [3](#source-openai-structured)

In the original example, the receiver could distinguish a complete candidate from an incomplete transfer, a refusal and a validation failure. It should retain that distinction through storage and user feedback. Attempting to repair every failure by asking the model again could consume resources and obscure why the first attempt failed. [Budgets and termination](/articles/agent-budgets/) covers that separate control problem.

## Test meaning as well as shape

A useful test collection for the example would include a well-formed but nonexistent source, an unsupported identifier, an explicit unknown date and an omitted required field. The expected result would differ for each case. A content checker could compare evidence against the claim; a technical validator could reject malformed structure. Neither result should be labeled as the other.

A schema also evolves. If a new revision changes what a status means, old stored objects need interpretation under the contract that produced them. Recording a schema version and preserving rejected input within an appropriate retention policy would make investigation easier. That is a design consideration, not a requirement imposed on all applications by JSON Schema. Structured outputs are most useful when they make interfaces explicit while leaving uncertainty, evidence and authority visible.
