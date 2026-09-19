# floop Product Context

## Product summary

floop lets people annotate feedback directly on a live website without relying on screenshots, screen recordings, or long explanations.

The intended interaction should feel as direct as commenting in a design tool: visit a live website, identify the relevant location, and leave contextual feedback.

## Core problem

Feedback on live websites frequently loses context. Reviewers must explain which element they mean, where it appears, what they experienced, and what they think should change. This creates unnecessary work for both reviewers and reviewees.

## Primary users

- Product and UX designers
- Design and HCI students
- Portfolio reviewers
- Mentors and instructors
- Founders
- Freelancers
- Small product teams

## Positioning

floop is for peer feedback and design critique on live websites.

It is not primarily:

- A bug tracker
- A QA platform
- A developer handoff system
- An enterprise project-management system
- A replacement for Jira

Engineering-focused functionality should be introduced only when it directly improves the feedback experience for the primary audience.

## Reviewer value

Reviewers should be able to:

- Start reviewing quickly.
- Give feedback naturally.
- Keep feedback connected to the relevant interface.
- Avoid unnecessary setup.
- Avoid manually documenting context the product can capture.

## Reviewee value

Reviewees should be able to:

- Understand exactly where feedback applies.
- Scan feedback efficiently.
- Avoid searching through recordings and message threads.
- Receive clear, contextual, actionable feedback.
- Share a website for review with minimal setup.

## Current product direction

The core experience includes or is intended to include:

- Creating a review for a live website.
- Generating a shareable review link.
- Placing contextual annotation pins.
- Leaving written or voice feedback.
- Sharing feedback with the website owner.

The current repository is the source of truth for what is already implemented.

A key product direction is a walkthrough experience in which a reviewer can navigate a website and speak naturally without manually creating every annotation. The system should eventually convert useful spoken feedback into clean, contextual, actionable pins. The reviewee should not need to consume an entire raw recording or transcript.

This direction should be implemented incrementally and validated before building comprehensive recording, transcription, AI-processing, or automated-placement infrastructure.

## Product principles

- Reviewer friction comes first.
- Context should require minimal effort.
- Feedback should remain easy to consume.
- Raw audio, video, or transcripts should not become the primary output.
- Prefer narrow, testable solutions over comprehensive workflows.
- Optimize for peer feedback before issue tracking.
- Use progressive disclosure.
- Keep interfaces calm, modern, intentional, and approachable.

## Business constraints

floop is a bootstrap-stage product. Decisions should account for:

- Limited development resources.
- Maintenance burden.
- Infrastructure costs.
- Speed of learning.
- Uncertain future scale.
- The cost of reversing technical decisions.

These constraints favor focused experiments, low operational overhead, and decisions that can be revisited as evidence accumulates.

## Feature evaluation

Before adding a feature, ask:

1. What user problem does it solve?
2. Has the problem been observed or validated?
3. Who experiences it?
4. How frequently does it occur?
5. What is the smallest testable solution?
6. Does it create friction elsewhere?
7. Does it weaken the product's positioning?
8. What will it cost to build and maintain?
9. How will success or failure be observed?
