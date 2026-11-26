# Demo walkthrough

Harbourlight is fictional. Licence `00C0000` is not a real EA licence. The people, testimonials, and portraits in the seed are invented. Use the addresses below. Do not type a real passport number into the demo.

## Start

Docker:

```bash
SEED_DEMO=true docker compose up --build
```

Local:

```bash
cp .env.example .env
npm install
npm run demo
npm run dev
```

Open http://localhost:3000. Password for every seeded account: `Harbourlight-Dev-1`.

| Email | You are |
| --- | --- |
| admin@harbourlight.example | Administrator |
| staff@harbourlight.example | Staff |
| employer@harbourlight.example | Employer |
| candidate@harbourlight.example | Helper |

## 1. Public site

1. Home. The hero names Harbourlight only because `AGENCY_NAME` is empty. Set that variable and restart to see another name.
2. Services, then a care page such as `/care/infant-care`.
3. Available helpers. Seed profiles that consented to a photo are listed and marked fictional.
4. Journal, FAQ, testimonials, privacy, and disclaimer.
5. Contact. Submit with an `@example` address. Staff will see it under Enquiries.

## 2. Helper

1. Open `/apply` in a private window.
2. Use an email you control on `example.com`, or the seeded `candidate@harbourlight.example` if you only want to see the acknowledgement.
3. The confirmation does not say whether the address was new. Sign in at `/login` and open `/candidate` to see the status when the account is yours.

## 3. Employer

1. Sign in as `employer@harbourlight.example`.
2. Open Helpers, shortlist one fictional profile, and request an interview.
3. Household requirements are already seeded. Edit them if you want the next match to change.

## 4. Staff

1. Sign out and sign in as `staff@harbourlight.example`.
2. Candidates. Open a profile. Status changes are one step at a time.
3. Matching. Run a ranking. The page shows the score breakdown. Protected traits are not on the form.
4. Change a weight or use the what-if controls, then compare two helpers. The fairness note is about nationality counts, not a ranking input.
5. Approve a match, open the MOM pack, and download the PDF. The PDF says it is not a submission.
6. Marketing. Generate a draft. Approval stays inside the app. The compliance check refuses a draft that drops the licence line.

## 5. Admin

1. Sign in as `admin@harbourlight.example`.
2. Settings. Provider rows say yes or no. Keys are not on the page. The rate limiter reads `memory` unless you configured Redis or Upstash. Retention reads `dry run`.
3. Audit. Status changes, rankings, and reveals are listed. Document numbers are not copied into the metadata.
4. Users. Create a staff account with a password you choose. Do not reuse the demo password on a shared server.

## Reset

`npm run db:seed` replaces the `@harbourlight.example` rows and loads the fictional set again. It does not delete addresses outside that domain. `docker compose down -v` deletes the Postgres volume.
