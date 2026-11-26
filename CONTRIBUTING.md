# Contributing

This repository is MIT licensed. Copyright (c) 2026 Alan. The seeded agency, Harbourlight, is a fictional demo. Do not add real people's documents, passport numbers, or production secrets.

## Setup

Use Node.js 22 and PostgreSQL 16.

```bash
cp .env.example .env
npm install
npm run demo
npm run dev
```

`npm run demo` applies migrations and loads the fictional seed. The demo password is `Harbourlight-Dev-1`.

## Branching

Branch from `main`. Keep a branch focused on one change. Open a pull request and fill in the template. Do not merge your own security-sensitive change without a review from a code owner.

## Tests

```bash
npm run lint
npm run typecheck
npm test
```

Add a unit test when you change matching, MOM eligibility, advertisement compliance, or provider fallback. Integration tests use the database named by `DATABASE_URL`.

## Commit style

Use a short imperative subject, optionally with a conventional prefix (`feat`, `fix`, `docs`, `test`, `chore`). Say what changed for an operator. Do not commit `.env`.

## Add an AI provider

1. Add the id to `PROVIDER_IDS` in `lib/ai/providers.ts`.
2. Teach `providerConfigured`, `languageModelFor`, and, if the host can embed, `embeddingModelFor` how to read that provider's environment variables.
3. Document the variables in `.env.example` with empty values.
4. Add the id to a feature list (`AI_MARKETING_PROVIDERS` or another `AI_*_PROVIDERS` variable) when you want it used.
5. Extend the provider fallback test so an unconfigured id is skipped.

Keys stay on the server. The settings page may show the model name and a yes/no for configuration. It must not show the key.

## Add a marketing channel

1. Add the channel id to the marketing request schema and the campaign form.
2. Keep drafts in review. Do not call an external network on approval.
3. Run `checkAdvertisement` on the body. The licence footer stays attached.
4. Mention the channel in `docs/advertising.md`.

## Add a matching factor

1. Add a key to `WEIGHT_KEYS` with a default of `0` unless you also rebalance the defaults so they still sum to 100. Existing tests expect the original five factors to total 100 when the new weights are zero.
2. Score it in `scoreJobFit` from job facts only.
3. Do not add religion, race, ethnicity, pregnancy, or a nationality preference. Age and nationality stay gates.
4. Include the points in the explanation facts as numbers, not as a hidden trait.
5. Cover the factor in `tests/unit`.
