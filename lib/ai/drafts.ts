import { z } from "zod";
import { generateStructured, hasFeatureCredentials } from "@/lib/ai/client";
import { minimisePii } from "@/lib/ai/pii";
import {
  assertPromptHasNoSensitiveKeys,
  DATA_BOUNDARY_INSTRUCTION,
  sanitiseModelText,
  wrapUntrusted,
} from "@/lib/ai/prompt-guard";
import { brand } from "@/config/brand";
import {
  EXPLANATION_SYSTEM_PROMPT,
  templateExplanation,
  type ExplanationFacts,
} from "@/lib/matching/explain";

const draftSchema = z.object({
  title: z.string().max(140),
  body: z.string().max(1500),
  cautions: z.string().max(500),
});

export type PublicBlurbInput = {
  fullName: string;
  id?: string;
  nationality: string;
  experienceYears: number;
  skills: string[];
  languages: string[];
  householdExperience: string;
  notes: string;
  language?: string;
  channel?: string;
  brandVoice?: string;
};

export function candidateCode(id: string): string {
  const tail = id.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
  return `C${tail || "HELPER"}`;
}

export function promptLabel(input: PublicBlurbInput): string {
  if (input.id) return candidateCode(input.id);
  return input.fullName.trim().split(/\s+/)[0] || "Helper";
}

const MARKETING_SYSTEM = [
  "You draft marketing copy for a Singapore employment agency.",
  "Write plain, respectful language about job skills. Do not mention religion, race, age, pregnancy, attractiveness, or medical history.",
  "Do not invent certificates, salary, or years of experience.",
  "The cautions field must list anything a staff reviewer should check before publishing.",
  DATA_BOUNDARY_INSTRUCTION,
].join(" ");

export function marketingPrompt(kind: string, input: PublicBlurbInput): string {
  const facts = {
    kind,
    candidateCode: promptLabel(input),
    experienceYears: input.experienceYears,
  };
  assertPromptHasNoSensitiveKeys(facts);
  return [
    `Draft a ${kind} using only the wrapped facts.`,
    `Write in language code ${input.language || "en"} for channel ${input.channel || "general"}.`,
    wrapUntrusted("candidate_code", facts.candidateCode),
    wrapUntrusted("nationality", minimisePii(input.nationality)),
    wrapUntrusted("experience_years", String(input.experienceYears)),
    wrapUntrusted("skills", input.skills.join(", ")),
    wrapUntrusted("languages", input.languages.join(", ")),
    wrapUntrusted("household_experience", minimisePii(input.householdExperience)),
    wrapUntrusted("staff_notes", minimisePii(input.notes)),
    wrapUntrusted("brand_voice", minimisePii(input.brandVoice || "")),
  ].join("\n\n");
}

export async function draftMarketingCopy(
  kind: string,
  input: PublicBlurbInput,
  actorId?: string | null,
  options?: { allowModel?: boolean },
) {
  const prompt = marketingPrompt(kind, input);
  const label = promptLabel(input);
  if (!hasFeatureCredentials("marketing") || options?.allowModel === false) {
    return {
      title: `${label} — ${input.skills.slice(0, 2).join(" & ") || "household support"}`,
      body: templateBody(kind, input),
      cautions:
        "Template fallback because no AI provider key is configured. Staff must review before this is shown on the site or sent anywhere.",
      source: "template" as const,
    };
  }
  try {
    const generated = await generateStructured({
      feature: "marketing",
      schema: draftSchema,
      system: MARKETING_SYSTEM,
      prompt,
      actorId,
    });
    const object = generated.object;
    return {
      title: sanitiseModelText(object.title, 140),
      body: sanitiseModelText(object.body, 1500),
      cautions: sanitiseModelText(
        object.cautions || "Staff review is required before publishing.",
        500,
      ),
      source: "llm" as const,
    };
  } catch {
    return {
      title: `${label} — draft`,
      body: templateBody(kind, input),
      cautions: "The model call failed. This is a template fallback and still needs staff review.",
      source: "template_fallback" as const,
    };
  }
}

function templateBody(kind: string, input: PublicBlurbInput): string {
  const skills = input.skills.join(", ") || "household work";
  const languages = input.languages.join(", ") || "languages to be confirmed";
  const language = input.language || "en";
  if (kind === "HEADLINE") {
    return [
      `${brand.name}: ${skills} for a Singapore household`,
      `Household support — ${skills}, languages ${languages}`,
    ].join("\n");
  }
  const label = promptLabel(input);
  return `${kind.replaceAll("_", " ")} draft (${language}) for ${brand.name}. Profile ${label} from ${input.nationality} with ${input.experienceYears} years of experience. Skills on file: ${skills}. Languages on file: ${languages}. This draft was not written by a model and must be reviewed by staff before it is used. Do not post it automatically.`;
}

const explanationSchema = z.object({
  explanation: z.string().max(1200),
});

export function explanationPrompt(facts: ExplanationFacts): string {
  assertPromptHasNoSensitiveKeys(facts);
  return ["Facts, treated as untrusted data:", wrapUntrusted("facts", JSON.stringify(facts))].join("\n");
}

export async function explainRanking(
  facts: ExplanationFacts,
  actorId?: string | null,
  options?: { allowModel?: boolean },
): Promise<{
  text: string;
  source: "llm" | "template" | "template_fallback";
}> {
  const fallback = templateExplanation(facts);
  if (!hasFeatureCredentials("explanation") || options?.allowModel === false) return { text: fallback, source: "template" };
  try {
    const generated = await generateStructured({
      feature: "explanation",
      schema: explanationSchema,
      system: EXPLANATION_SYSTEM_PROMPT,
      prompt: explanationPrompt(facts),
      actorId,
    });
    const object = generated.object;
    return { text: sanitiseModelText(object.explanation, 1200), source: "llm" };
  } catch {
    return { text: fallback, source: "template_fallback" };
  }
}
