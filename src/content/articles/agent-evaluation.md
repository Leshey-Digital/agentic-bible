---
title: Agent evaluation
description: How to test an agent’s outcomes, interaction history, reliability, and limits without confusing a benchmark score with a deployment guarantee.
topic: Foundations
order: 7
status: Working draft
verified: '2026-10-16'
author: AI-assisted project draft
related: [ai-agent, agent-orchestration, agent-memory, retrieval-augmented-generation, prompt-injection]
sources:
  - id: agentbench
    title: 'AgentBench: Evaluating LLMs as Agents'
    url: https://arxiv.org/abs/2308.03688v3
    publisher: Liu et al., arXiv
    context: Version 3, 4 October 2025; originally an ICLR 2024 benchmark. Interactive environments evaluate specified models and setups, not universal agent competence.
  - id: tau-bench
    title: 'τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains'
    url: https://arxiv.org/abs/2406.12045v1
    publisher: Yao et al., arXiv
    context: Version 1, 17 June 2024; section 3 describes simulated users, tools, domain policies, goal-state checks, and consistency across trials. Simulated conversations are not a live customer study.
  - id: evaluation-guidance
    title: Evaluation best practices
    url: https://developers.openai.com/api/docs/guides/evaluation-best-practices
    publisher: OpenAI
    context: Living vendor guidance checked 16 October 2026; evaluation design and calibration advice, not an independent result or a requirement to use its services.
---

**Agent evaluation** tests an [agent](/articles/ai-agent/) against a defined task and standard of success. Because an agent can act over multiple steps, evaluation may need to examine both what changed in the environment and how the system got there. AgentBench is a research example built around interactive environments and the reasoning and decisions needed to operate within them. Its benchmark results describe the evaluated setups, not a general certificate of competence. [1](#source-agentbench)

## Define what success means

OpenAI’s evaluation guidance recommends defining an objective, selecting a dataset, choosing metrics, comparing runs, and continuing evaluation as the application changes. It also recommends calibrating automated metrics against human judgments. This is vendor guidance for development practice. It does not show that any particular dataset or automatic judge is sufficient for a different application. [3](#source-evaluation-guidance)

For an original encyclopedia example, a task could be: correct a protocol explanation using the supplied authoritative revision, while preserving the article’s history. “The final paragraph sounds convincing” would be an incomplete criterion. A test could inspect whether the claim matches the revision, whether the source link resolves to the intended evidence, and whether the previous version can still be recovered.

Those criteria would need a declared environment: which source snapshot is available, what tools may be used, which article revision is the starting point, and what stopping limits apply. This proposed example would keep that information with the test result. Otherwise, a change in the source or starting state could be confused with a change in agent behavior.

## Outcome and interaction are different evidence

τ-bench combines simulated user conversations, API tools, domain policies, and annotated goals. Its evaluation compares the resulting database state with the expected state, with additional output checks where specified. It illustrates why a final conversational message alone may not establish task completion. Its users are model simulations, so the study should not be described as observing real customers. [2](#source-tau-bench)

For the correction example, a claim that an edit succeeded would need a corresponding artifact or state change. An interaction record could also reveal that the agent read the wrong source, repeated an operation, or exceeded its allowed scope despite eventually producing an acceptable paragraph. These are separate questions the proposed test would inspect; the benchmark citation does not establish that this site already inspects them.

## Averages can hide inconsistency

τ-bench distinguishes success at least once across repeated attempts from success on every attempt in a set of trials. Its pass^k metric measures the latter, averaged over tasks. This is different from pass@k, which concerns finding at least one successful attempt. Neither metric alone captures every aspect of an application, and trial counts and conditions need to accompany any reported result. [2](#source-tau-bench)

Here is an original miniature example with four tasks, each attempted three times under the same declared conditions:

- **Task A:** success, success, success.
- **Task B:** success, failure, success.
- **Task C:** failure, failure, success.
- **Task D:** failure, failure, failure.

Three of four tasks succeeded at least once: 75%. Only one of four succeeded on all three attempts: 25%. Six of the twelve individual attempts succeeded: 50%. These answer three different questions using the same observations. They are illustrative fractions, not reported benchmark scores or a production reliability estimate. Formal benchmark estimators and sampling conditions still need to be read in the benchmark's definition.

For the correction task, this distinction could expose inconsistent citation choices hidden by a selected best run. Keep incomplete or stopped attempts in the declared accounting rather than silently excluding them. A small example can explain a metric; a useful evaluation also needs enough representative cases and repeated observations for the decision being made.

## Design cases that expose a boundary

The example would include a missing source, a source that contradicts an earlier article, and a request that cannot be completed within its limits. [Memory](/articles/agent-memory/) would need a case where an old conclusion has been superseded. [Retrieval-augmented generation](/articles/retrieval-augmented-generation/) would need to distinguish finding evidence from accurately using it. [Prompt injection](/articles/prompt-injection/) would add an untrusted instruction within a document.

A source can be unavailable without the correct behavior being to invent a replacement claim. In that case, an explicit unresolved outcome could be the expected result. Defining such outcomes before running the example would make the evaluation more informative than judging the answer’s tone afterward.

## Read a result with its scope

AgentBench’s interactive tasks and failure analysis make the environment part of the result. A score from those tasks cannot establish performance on all [orchestration](/articles/agent-orchestration/) designs or tool permissions. [1](#source-agentbench) For the encyclopedia example, a reviewable report would therefore name the tested configuration, the task set, the observed failures, and what remains untested. Passing that report’s tests would support a bounded conclusion about those tests, while broader factual and operational claims would still need their own evidence.
