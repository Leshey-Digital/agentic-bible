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

Consider an original reference-library example that extracts a source identifier and publication year. Here is a small JSON Schema using the Draft 2020-12 dialect. It is an application validation contract, not a provider API request or a claim of support for every provider’s schema subset. [1](#source-schema-core) [2](#source-schema-validation)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "source_id": { "type": "string", "minLength": 1 },
    "publication_year": { "type": "integer", "minimum": 2000, "maximum": 2100 }
  },
  "required": ["source_id", "publication_year"],
  "additionalProperties": false
}
```

For this example, `source_id` names a record in the receiver’s source catalog, and `publication_year` means the initial publication year of that specific version. The year bounds are an arbitrary application choice; older sources would need a different contract. This schema rejects missing fields, extra fields and a year encoded as a string. It cannot check whether a source identifier exists or whether the year matches its record.

## Parsing is only one boundary

Valid JSON can still violate a schema. A schema-valid object can still contain the wrong date. A factually correct proposal can still request an unauthorized action. These are separate failure modes, so passing one check should not silently stand in for the others. [Tool use](/articles/tool-use/) describes the handoff to executable software; [tool permissions](/articles/tool-permissions/) describes the authority required there.

Compare four inputs under the contract above. This first input passes both parsing and schema validation. Its year also agrees with the [τ-bench v1 publication record](https://arxiv.org/abs/2406.12045v1), dated 17 June 2024:

```json
{ "source_id": "tau-bench-v1", "publication_year": 2024 }
```

This input is invalid JSON because of its trailing comma. Parsing fails before schema validation:

```text
{ "source_id": "tau-bench-v1", "publication_year": 2024, }
```

This input is valid JSON but schema-invalid: the year is a string, not an integer:

```json
{ "source_id": "tau-bench-v1", "publication_year": "2024" }
```

This input parses and satisfies the schema, but its publication year is factually wrong for that version:

```json
{ "source_id": "tau-bench-v1", "publication_year": 2023 }
```

The last failure requires comparison with evidence. A successful schema check alone cannot catch it, and none of these objects grants authority to change the catalog. If the year is unknown, this contract requires the receiver to report an unresolved extraction separately; inventing a year to satisfy the schema would defeat its purpose.

JSON Schema 2020-12 defines assertions such as types, numeric bounds and required properties. Its treatment of `format` needs particular care: the format annotation vocabulary does not require full format validation, while support for the format assertion vocabulary is optional and has stronger requirements when declared. A receiver must know the validator’s dialect, vocabulary support and configuration before claiming a string’s format was checked. [2](#source-schema-validation)

## Read provider guarantees with their scope

OpenAI’s Structured Outputs guide distinguishes schema-constrained responses from JSON mode, documents a supported schema subset, and describes refusal and incomplete-response handling. A refusal may take a separate response path rather than matching the requested schema. These details concern the documented API and supported models; they do not define every provider’s behavior or eliminate mistakes inside otherwise well-formed fields. [3](#source-openai-structured)

In the original example, the receiver could distinguish a complete candidate from an incomplete transfer, a refusal and a validation failure. It should retain that distinction through storage and user feedback. Attempting to repair every failure by asking the model again could consume resources and obscure why the first attempt failed. [Budgets and termination](/articles/agent-budgets/) covers that separate control problem.

## Test meaning as well as shape

A useful test collection for the example would include a well-formed but nonexistent source, an unsupported identifier, an explicit unknown date and an omitted required field. The expected result would differ for each case. A content checker could compare evidence against the claim; a technical validator could reject malformed structure. Neither result should be labeled as the other.

A schema also evolves. If a new revision changes what a status means, old stored objects need interpretation under the contract that produced them. Recording a schema version and preserving rejected input within an appropriate retention policy would make investigation easier. That is a design consideration, not a requirement imposed on all applications by JSON Schema. Structured outputs are most useful when they make interfaces explicit while leaving uncertainty, evidence and authority visible.
