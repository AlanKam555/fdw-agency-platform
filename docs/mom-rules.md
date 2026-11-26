# MOM work permit preparation

The app prepares a checklist, reminders, and a PDF for one staff-approved match. It does not submit anything to the Ministry of Manpower. Work Permit applications are lodged by a person on [WP Online](https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker) with Singpass or CorpPass.

Every numeric rule lives in `config/mom-rules.ts` and can be overridden with the `MOM_*` variables in `.env.example`. The file is flagged **verify against current MOM guidance**. The values were transcribed on 2026-11-26 from the public pages below. MOM can change them. Operators should re-read those pages before using a pack in a real placement. An environment override does not make a number official.

## Sources

- [Migrant domestic worker eligibility](https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/fdw-eligibility) — age 23 to below 50, female, at least eight years of formal education, and the approved source countries and regions.
- [Employer requirements](https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/employer-requirements) — employer at least 21 and not an undischarged bankrupt. Caregiving needs and financial ability are described qualitatively, so this product does not invent an income number.
- [Employers' Orientation Programme](https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/employers-orientation-programme-eop) — first-time employers, configured as two working days before submission. The completion day is not counted.
- [Security bond](https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/security-bond) — SGD 5,000, with Malaysia on the configured exemption list.
- [Insurance requirements](https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/insurance-requirements) — medical insurance and personal accident cover, each configured at a minimum of SGD 60,000.
- [Settling-in Programme](https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/settling-in-programme-sip) — first-time helpers, within seven days of arrival excluding Sunday and public holidays.
- [Medical examination](https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker/eligibility-and-requirements/medical-examination) — within 14 days of arrival.
- [Work Permit hub](https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-domestic-worker)

`publicHolidays` is empty until an operator maintains Singapore public holidays. SIP reminders mention that exclusion. They do not compute a calendar date from an empty list.

The PDF states that it is a preparation pack, not a lodged application.
