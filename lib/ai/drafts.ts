import { z } from "zod";
import { generateStructured, hasFeatureCredentials } from "@/lib/ai/client";
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

const MARKETING_SYSTEM = [
  "You draft marketing copy for a Singapore employment agency.",
  "Write plain, respectful language about job skills. Do not mention religion, race, age, pregnancy, attractiveness, or medical history.",
  "Do not invent certificates, salary, or years of experience.",
  "The cautions field must list anything a staff reviewer should check before publishing.",
  DATA_BOUNDARY_INSTRUCTION,
].join(" ");

export function marketingPrompt(kind: string, input: PublicBlurbInput): string {
  const payload = {
    kind,
    fullName: input.fullName,
    nationality: input.nationality,
    experienceYears: input.experienceYears,
    skills: input.skills,
    languages: input.languages,
  };
  assertPromptHasNoSensitiveKeys(payload);
  return [
    `Draft a ${kind} using only these facts:`,
    JSON.stringify(payload),
    `Write in language code ${input.language || "en"} for channel ${input.channel || "general"}.`,
    wrapUntrusted("household_experience", input.householdExperience),
    wrapUntrusted("staff_notes", input.notes),
    wrapUntrusted("brand_voice", input.brandVoice || ""),
  ].join("\n\n");
}

export async function draftMarketingCopy(kind: string, input: PublicBlurbInput) {
  const prompt = marketingPrompt(kind, input);
  if (!hasFeatureCredentials("marketing")) {
    return {
      title: `${input.fullName.split(" ")[0]} — ${input.skills.slice(0, 2).join(" & ") || "household support"}`,
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
      title: `${input.fullName.split(" ")[0]} — draft`,
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
  return `${kind.replaceAll("_", " ")} draft (${language}) for ${brand.name}. ${input.fullName}, a helper from ${input.nationality} with ${input.experienceYears} years of experience. Skills on file: ${skills}. Languages on file: ${languages}. This draft was not written by a model and must be reviewed by staff before it is used. Do not post it automatically.`;
}

const explanationSchema = z.object({
  explanation: z.string().max(1200),
});

export async function explainRanking(facts: ExplanationFacts): Promise<{
  text: string;
  source: "llm" | "template" | "template_fallback";
}> {
  const fallback = templateExplanation(facts);
  if (!hasFeatureCredentials("explanation")) return { text: fallback, source: "template" };
  try {
    assertPromptHasNoSensitiveKeys(facts);
    const generated = await generateStructured({
      feature: "explanation",
      schema: explanationSchema,
      system: EXPLANATION_SYSTEM_PROMPT,
      prompt: `Facts JSON:\n${JSON.stringify(facts)}`,
    });
    const object = generated.object;
    return { text: sanitiseModelText(object.explanation, 1200), source: "llm" };
  } catch {
    return { text: fallback, source: "template_fallback" };
  }
}
