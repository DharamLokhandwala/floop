# Design System Contract (Model + Human)

This document defines how UI should be built in this codebase.

## Canonical source of truth

- Live source page: `/design-system`
- Token file source: `app/globals.css`
- UI primitive source: `components/ui/*`
- Pin category color source: `components/AuditViewer.tsx`

If this document and code disagree, code is authoritative.

## Core rules for models

1. Reuse existing semantic tokens first (`bg-background`, `text-foreground`, `border-border`, etc.).
2. Reuse existing primitives from `components/ui/*` before introducing custom styles.
3. Do not invent one-off colors, radii, shadows, or focus treatments unless explicitly requested.
4. Preserve accessibility states (focus-visible ring, disabled state opacity, aria-invalid styles).
5. Keep light/dark behavior token-driven (avoid hardcoding separate mode styles unless needed).

## Token categories

- Brand and semantic colors: `--primary`, `--muted`, `--border`, `--ring`, etc.
- Radius scale: `--radius`, and derived radii in `@theme inline`
- Surface and text tokens: `--background`, `--foreground`, `--card`, `--popover`
- Status tokens: `--destructive`
- Product-specific accents: `--color-floop-blue`

## Component conventions

- Buttons: use `Button` variants and sizes from `components/ui/button.tsx`
- Inputs: use `Input` from `components/ui/input.tsx`
- Textareas: use `Textarea` from `components/ui/textarea.tsx`
- Dialogs and tooltips: use `components/ui/dialog.tsx` and `components/ui/tooltip.tsx`

## Update policy

- Keep this file for high-level guidance.
- Use `/design-system` for always-fresh current tokens/recipes.
- Update this file only when design rules change (not for every token tweak).
