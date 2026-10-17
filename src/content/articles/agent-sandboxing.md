---
title: Agent sandboxing
description: How an execution environment restricts code and tools, and why filesystem, network, resource and application boundaries need separate examination.
topic: Capabilities
order: 12
status: Working draft
verified: '2026-10-17'
author: AI-assisted project draft
related: [ai-agent, tool-use, prompt-injection, tool-permissions, agent-observability, human-oversight]
sources:
  - id: gvisor-overview
    title: What is gVisor?
    url: https://gvisor.dev/docs/
    publisher: gVisor authors
    context: Living project documentation checked 17 October 2026; Sentry and Gofer describe an application-kernel isolation design and compatibility boundaries.
  - id: gvisor-security
    title: gVisor security model
    url: https://gvisor.dev/docs/architecture_guide/security/
    publisher: gVisor authors
    context: Living security design documentation checked 17 October 2026; goals, host interactions, resource controls and hardware-side-channel limitations. No blanket sandbox or virtual-machine ranking follows.
  - id: claude-sandbox
    title: 'Beyond permission prompts: making Claude Code more secure and autonomous'
    url: https://www.anthropic.com/engineering/claude-code-sandboxing
    publisher: Anthropic
    context: Engineering announcement published 20 October 2025, checked 17 October 2026; filesystem/network isolation in that product’s described runtime. Vendor-reported statistics and present product defaults are not reproduced here.
---

**Agent sandboxing** restricts the environment in which an agent’s requested code or tools execute. The boundary is implemented by surrounding software and operating-system mechanisms, rather than by asking the model to behave cautiously. gVisor illustrates one design: an application kernel called the Sentry handles application system calls, while a separate Gofer mediates filesystem access. This is a particular isolation architecture, not the definition of every sandbox. [1](#source-gvisor-overview)

## The boundary needs a threat model

The gVisor security model aims to reduce exposure to host system interfaces through layered restrictions. It also describes limits: hardware side channels, host resource controls and other reachable services require separate consideration. Its documentation explicitly treats a sandbox as one part of a secure architecture. These statements concern gVisor’s design and assumptions; they do not prove that any environment labeled “sandboxed” provides equivalent isolation. [2](#source-gvisor-security)

For an illustrative research assistant, the threat model could include a tool accidentally overwriting an unrelated file, untrusted downloaded code running a subprocess, or a generated command attempting an unauthorized connection. A proposed sandbox would need to state which of those actions it constrains and what remains reachable. Listing the threats would be more informative than simply displaying a sandbox badge.

## Files and network are separate surfaces

Anthropic’s 2025 engineering announcement describes filesystem and network isolation for its agent coding tools. It explains directory restrictions and an external proxy enforcing allowed network destinations, including restrictions applying to subprocesses. This is vendor architecture guidance for the described implementation. It should not be generalized into a claim about current defaults, all coding agents, or a measured security guarantee for this website. [3](#source-claude-sandbox)

In the research-assistant example, a writable scratch directory would not answer whether the process can also contact arbitrary servers. Conversely, blocking external connections would not answer whether it can modify an unrelated local project. A useful boundary description would separately identify permitted reads, writes and destinations, along with how exceptions are handled.

The relevant unit is the actual executing process and its descendants. Naming the assistant’s top-level tool is insufficient if the command starts other programs with different access. The cited vendor example discusses subprocess coverage; [3](#source-claude-sandbox) a different implementation would need its own evidence of what inherits the restrictions.

## Isolation is not unlimited compatibility

gVisor’s overview notes that its Linux-compatible environment does not implement every system call or interface, so some applications may be incompatible. Restricting exposed behavior has practical consequences for what software can run. [1](#source-gvisor-overview) A failure inside a sandbox could therefore reflect an intentional boundary or a compatibility gap, rather than evidence that a task needs unrestricted access.

For the example, a denied write would be recorded as denied. A recovery step could choose another permitted way to produce a reviewable artifact, or stop with the boundary stated. It would not silently interpret a failed operation as successful. This is a proposed recovery criterion, not a claim about a deployed assistant here.

## Permissions and content still matter

The gVisor security model allows applications to use resources exposed inside their environment and relies on additional controls for resource exhaustion and network policy. [2](#source-gvisor-security) Isolation consequently does not settle whether a reachable application operation is appropriate. [Tool permissions](/articles/tool-permissions/) address that action-level boundary; [prompt injection](/articles/prompt-injection/) addresses attempts to redirect the agent through untrusted material.

A sandboxed assistant could still produce an unsupported statement in a permitted output file. Factual review needs different evidence. An [observability](/articles/agent-observability/) record could show that a command was denied or completed, while [human oversight](/articles/human-oversight/) could decide how to respond. Tests of the example would inspect the actual filesystem, connection policy and action outcome, including subprocess behavior and interruption. Sandboxing can limit consequences within a stated model; it does not certify the whole agent.
