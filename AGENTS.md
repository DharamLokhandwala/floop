# Repository Working Agreement

## Required reading

Before making changes, read:

- `docs/PRODUCT_CONTEXT.md` for the product direction, audience, and guardrails.
- `docs/design-system.md` for interface conventions when changing the UI.
- `README.md` and any documentation relevant to the area being changed.
- The nearby code, tests, configuration, and data model that define current behavior.

Repository documentation is the source of truth for product direction. The codebase and configuration are the source of truth for implementation details and currently shipped behavior.

If documentation and implementation conflict, do not silently choose one or broaden the task. Identify the discrepancy, preserve existing behavior unless the requested change clearly authorizes changing it, and update the appropriate documentation when the intended direction is confirmed.

## Product guardrails

- Every feature should make giving or receiving website feedback easier.
- Keep reviewer friction extremely low and protect the simplicity of the product.
- Design first for individual designers, students, mentors, founders, freelancers, and small teams.
- Keep the product approachable rather than enterprise-heavy.
- Do not turn the product into a developer bug tracker, QA platform, or enterprise issue-management system.
- Prefer progressive disclosure over exposing every option at once.
- Prioritize clarity, speed, accessibility, and responsive behavior.
- Flag proposals that move the product toward engineering issue tracking or enterprise QA before implementing them.

## Decision priorities

When tradeoffs are necessary, use this order:

1. User value
2. Simplicity
3. Speed to ship
4. Low maintenance
5. Strong differentiation
6. Sustainable scalability

## Implementation principles

- Inspect existing patterns before adding abstractions.
- Prefer the smallest complete solution that addresses the validated need.
- Avoid speculative functionality, unrelated refactors, and premature generalization.
- Avoid new dependencies or infrastructure unless the benefit clearly outweighs their cost and maintenance burden.
- Keep changes focused, reversible where practical, and consistent with the existing architecture.
- Treat security, privacy, and data ownership as part of feature correctness.

## Experience standards

- Make all primary workflows usable by keyboard and assistive technology, with semantic structure, clear labels, visible focus, and sufficient contrast.
- Preserve useful behavior across supported viewport sizes. Do not treat a desktop layout as complete without checking narrow screens and touch interaction.
- Keep interfaces calm, modern, intentional, and approachable. Use progressive disclosure to prevent visual and cognitive overload.
- Write concise, plain-language interface copy that tells people what happened, what is expected, and how to recover from an error.
- Reuse established components, tokens, interaction patterns, and terminology before creating new ones.

## Scope and verification

- Stay within the requested scope. Do not mix cleanup, migrations, or refactors into a focused change without a clear need.
- Do not alter or discard unrelated work in the working tree.
- Run the relevant checks available in the repository, including linting, type checks, builds, or targeted manual verification as appropriate.
- Review the final diff for accidental changes, duplication, accessibility regressions, and sensitive data.
- Report what changed, what was verified, and any remaining risks or unverified assumptions.

## Documentation maintenance

Update repository documentation when product behavior, product direction, setup, architecture, or an important technical decision changes. Keep guidance durable and focused on why a constraint exists; rely on the code and configuration for details that are likely to change frequently.
