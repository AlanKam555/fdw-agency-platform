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

`publicHolidays` is filled from the MOM public holidays page for 2025, 2026, and 2027 (`config/public-holidays.ts`, last verified 2026-11-26). Each year records that source URL. A Monday is included when MOM says it is a holiday if the rest day falls on the Sunday holiday. 2027 lunar dates (Chinese New Year, Hari Raya Puasa, Hari Raya Haji, Vesak Day, and Deepavali) can move when the holidays are gazetted. Re-check them before relying on 2027. Staff can add or suppress a date under Holidays. `MOM_PUBLIC_HOLIDAYS` still replaces the whole list when it is set.

SIP dates exclude Sunday and those holidays and count Saturday. That is separate from the Employers' Orientation Programme, which uses working days and skips Saturday as well. Medical examination dates are calendar days. Permit renewal lead time (`REMINDER_PERMIT_LEAD_DAYS`, default 30) and the 30-day rest-day follow-up are agency windows, not MOM figures.

The rules review page lists every catalog value with its unit, MOM link, last verified date, and who verified it. Nothing on that page invents a new figure. A row needs verification until an admin marks it. Rows older than `MOM_RULE_STALE_DAYS` (default 90) are also flagged on the staff desk.

The PDF states that it is a preparation pack, not a lodged application.
