# Matching fairness

Staff ask the product to rank helpers for one employer requirement. The ranker is `rankCandidates` in `lib/matching/score.ts`. An optional language model writes an explanation of that score. Staff approve or reject the suggestion. The model cannot change the score or the decision.

## What is scored

Weights sum to 100:

| Factor | Points | Rule |
| --- | --- | --- |
| Skills | 40 | Share of requested skills the helper has |
| Languages | 20 | Share of preferred languages the helper speaks |
| Experience | 15 | Years against a household target, capped at the target |
| Salary | 15 | Full points if the expectation is within the budget ceiling. A lower salary does not score higher. |
| Availability | 10 | Full points if the helper is free on or before the start date |

Equal scores are ordered by candidate id. Age and nationality are not tie-breakers.

Staff can save a different weight set per requirement. Extra factors — semantic similarity, proficiency, care needs, and placement kind (new hire, transfer, returning) — default to zero so the original five factors still sum to 100. A what-if preview on the requirement page does not write those weights. Interview feedback and placement outcomes can suggest moving five points toward a gap. The suggestion stores the evidence count and is shown as not applied. Nothing writes `appliedAt`. Staff save the weights themselves.

Placement outcomes are recorded by staff when a placement ends or at a 1, 3, or 6 month check-in. The record has duration, completion, a reason category, employer satisfaction, helper satisfaction, and a staff-only note. An early ending, or employer satisfaction of 2 or lower, can suggest a weight move for a mapped reason (skill, language, care, experience, salary, availability, or transfer). Helper satisfaction does not move a weight. Religion, race, and pregnancy are not collected.

Semantic similarity uses an embedding provider when one is configured and the semantic weight is above zero. Otherwise it uses a deterministic token overlap so the score does not depend on the network. Nationality is grouped only in the fairness audit. It is not a weight. The score audit tells staff to review a nationality group when its eligible mean is at least 15 points from the overall mean and the group has at least two eligible scores. The outcome audit does the same for employer satisfaction, with a gap of 1.5 points, and it marks any group of fewer than five outcomes as a small sample that should not be read as a pattern.

## What is a gate, not a score

These facts can exclude a profile. They never add or remove points among eligible profiles:

- Completed age below 23 or 50 and above, using the configurable MOM window
- Nationality outside the configured approved source list
- Formal education below the configured minimum
- Sex, only when `requiredSex` is set, because current MOM eligibility describes a female migrant domestic worker. Set `requiredSex` to `null` if that rule changes. It is not a preference weight.
- Medical fitness recorded as unfit

A pending medical exam scores the same as a fit result. The exam is a later MOM step, not a ranking bonus.

## What is not collected

The database schema has no fields for religion, race, ethnicity, or pregnancy. Employer requirements have no preferred nationality and no preferred age. Public profiles hide date of birth, passport, FIN, medical notes, email, phone, and internal notes.

The explanation payload sent to a model contains scores and pass/fail gate labels. It does not contain an age, a date of birth, or a document number. Applicant and employer free text is wrapped as untrusted data. The model has no tools.

If no API key is configured, or the provider call fails, the explanation is a labelled template. Either way, a person makes the placement decision.
