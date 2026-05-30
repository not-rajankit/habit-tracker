# Future Platform Plans

This document is planning-only. These systems are not implemented in the current admin, template, RBAC, and analytics phase.

## Architecture Defaults

- Keep user-owned data separate from platform-managed content.
- Use permission-based authorization for every privileged workflow.
- Capture product behavior as analytics events instead of coupling future products to transactional tables.
- Treat imported templates as copied user-owned habits, not live references.
- Keep future systems behind isolated route namespaces and explicit permissions.

## Subscriptions

- Add a billing domain with plans, subscriptions, invoices, and entitlement checks.
- Store provider IDs separately from user profile data.
- Gate paid capabilities through permissions or entitlements, not frontend-only checks.
- Emit subscription lifecycle events for analytics and support.

## AI Recommendations

- Base recommendations on explicit user consent and aggregate/anonymized behavior where possible.
- Keep AI-generated suggestions as drafts until the user imports or accepts them.
- Log recommendation impressions, accepts, dismissals, and imports as analytics events.
- Avoid exposing private habits, goals, or notes to admins through recommendation tooling.

## Team Workspaces

- Introduce workspace-owned resources separately from personal resources.
- Add workspace roles instead of reusing global platform roles.
- Support audit logs for membership, role changes, and shared content changes.
- Keep personal habits private unless a user intentionally shares them into a workspace.

## Social And Public Sharing

- Add explicit publishing records for any habit, goal, or template shared publicly.
- Never infer public visibility from the existence of user-owned content.
- Add moderation queues for public content only.
- Track shares, views, imports, and reports as analytics events.

## Notifications

- Add notification preferences per user and channel.
- Store notification jobs separately from product events.
- Support digest and reminder modes.
- Respect account suspension and user opt-out state before dispatch.

## Gamification And Achievements

- Define achievements from analytics events and user-owned aggregates.
- Store unlocked achievements as immutable records.
- Keep leaderboard participation opt-in.
- Avoid admin access to private habit details when calculating public rankings.

## Recommendation Engine

- Start with rule-based recommendations using template category popularity and user-selected interests.
- Add model-based ranking only after enough consented analytics volume exists.
- Keep ranking metadata explainable enough for support and debugging.
- Measure recommendation quality through imports, retention, dismissals, and abandoned templates.
