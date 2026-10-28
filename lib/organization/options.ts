/**
 * CloudE5 — choices offered in the onboarding organisation profile. Kept apart from profile.ts,
 * which reaches the database, so the onboarding page can import them in the browser.
 */

/** Organisation types offered in onboarding; anything else is typed in as "Other". */
export const ORGANIZATION_TYPES = [
  "IT services / Software / SaaS",
  "Banking, financial services and insurance",
  "Healthcare / Pharma / Life sciences",
  "E-commerce / Retail",
  "Education / EdTech",
  "Telecom / Internet services",
  "Manufacturing",
  "Government / Public sector",
  "Media / Entertainment / Advertising",
  "Travel / Hospitality",
  "Logistics / Transport",
  "Professional services / Consulting",
  "Non-profit / NGO",
] as const;

export const TEAM_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1001-5000", "5000+"] as const;
