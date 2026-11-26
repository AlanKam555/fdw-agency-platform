import { brand, DISCLAIMER, licenceLine } from "@/config/brand";

export const AGENCY = {
  name: brand.name,
  legalName: brand.legalName,
  city: brand.city,
  phone: brand.phone,
  email: brand.email,
  address: brand.address,
  licence: licenceLine,
  licenceNo: brand.licenceNo,
  logoUrl: brand.logoUrl,
  fictionalDemo: brand.fictionalDemo,
  disclaimer: DISCLAIMER,
};

export const services = [
  {
    slug: "household-matching",
    title: "Household matching",
    body: "We take a written brief — children, elders, pets, languages, skills, budget, and start date — and shortlist helpers who already consented to be introduced.",
  },
  {
    slug: "interview-coordination",
    title: "Interview coordination",
    body: `Employers with an account can shortlist profiles and ask ${brand.name} to arrange an interview. Staff confirm the time. We do not hand out a helper's phone number on the website.`,
  },
  {
    slug: "work-permit-preparation",
    title: "Work permit preparation",
    body: "After staff approve a match, we assemble a checklist and a PDF pack for the Ministry of Manpower foreign domestic worker Work Permit. Staff lodge it themselves on WP Online with Singpass or CorpPass.",
  },
  {
    slug: "replacement-window",
    title: "Replacement window",
    body: "Fictional policy for this demo: if a deployment ends within 90 days for a reason outside the employer's control, staff reopen matching. The real commercial terms would be in a signed service agreement.",
  },
];

export const carePages = [
  {
    slug: "infant-care",
    title: "Infant care",
    body: "Households with a baby can ask for feeding, sleep routines, and daytime care. The match uses the skills and experience on the file. It does not rank people by nationality.",
  },
  {
    slug: "elderly-care",
    title: "Elderly care",
    body: "Mobility, medication reminders, and company are written as job needs. Staff confirm them in an interview. Age of the helper is an eligibility gate, not a preference.",
  },
  {
    slug: "dementia-care",
    title: "Dementia care",
    body: "A household can record dementia support as a care need. The score checks whether that need is on the helper's file. It does not infer it from nationality or religion.",
  },
  {
    slug: "disability-support",
    title: "Disability support",
    body: "Personal care and transfers can be listed as skills. Describe the tasks, not a stereotype. Staff decide whether the experience fits.",
  },
  {
    slug: "cooking",
    title: "Cooking and housekeeping",
    body: "Cuisine and housekeeping are skills. Landing pages stay about the work. This site does not publish nationality-targeted advertisements.",
  },
];

export const testimonials = [
  {
    name: "Mei Lin T.",
    area: "Queenstown",
    quote:
      `${brand.name} walked us through the bond and the orientation course before anyone booked a flight. The interview was calm, and we knew the profile was a sample until we met her.`,
  },
  {
    name: "Daniel Koh",
    area: "Tampines",
    quote:
      "I cared more about infant care and English than a long list of preferences. The shortlist stuck to those points, and a person — not a chatbot — confirmed the introduction.",
  },
  {
    name: "Aisha Rahman",
    area: "Bedok",
    quote:
      "The packing list for arrival, the settling-in programme, and the medical appointment were written down. I still had to sign the MOM forms myself, which was the right split.",
  },
];

export const faqs = [
  {
    question: `Is ${brand.name} a licensed employment agency?`,
    answer: brand.fictionalDemo
      ? "This deployment is a fictional product demonstration. The licence number on the site is not real. A live agency must hold a licence from the Ministry of Manpower and follow the Employment Agencies Act."
      : `${brand.name} shows the licence number from its configuration. A live agency must hold a licence from the Ministry of Manpower and follow the Employment Agencies Act. This software does not verify that licence with the Ministry.`,
  },
  {
    question: "Do you submit the Work Permit for me?",
    answer: `No. MOM's Work Permit service requires Singpass or CorpPass. ${brand.name} prepares a checklist, eligibility notes, and a PDF summary. A staff member or the employer submits the application.`,
  },
  {
    question: "Which details affect a match score?",
    answer:
      "Skills, languages, years of experience against the household's needs, whether the salary expectation fits the budget, and availability against the start date. Age, source country, education, and the statutory sex rule are pass/fail eligibility checks. Religion, race, and pregnancy are not collected.",
  },
  {
    question: "Who can see my passport number?",
    answer:
      "Passport, FIN, and NRIC values are encrypted in the database. Staff see a masked value until they explicitly reveal it, and that reveal is written to the audit log. Employers and the public site never receive those numbers.",
  },
  {
    question: "How long do you keep an application?",
    answer:
      "The privacy notice states the retention defaults: enquiries about a year, rejected applications about six months, active files about two years, deployed files about five years, and audit logs about two years. An administrator can redact a profile sooner when the law allows.",
  },
  {
    question: "Are the helper photographs real?",
    answer:
      "Seed profiles use generated illustrations and are marked fictional. A real photograph is shown only when the helper has given photo consent, and it is withdrawn from the gallery if that consent is removed.",
  },
];
