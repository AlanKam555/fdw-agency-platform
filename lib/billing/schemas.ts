import { z } from "zod";
import { looksLikePaymentCard, parseMoneyToCents } from "@/lib/billing/money";

const emptyToUndefined = (value: unknown) => (value == null || value === "" ? undefined : value);

export const moneyField = z
  .string()
  .trim()
  .regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter an amount like 1500.00")
  .refine((value) => parseMoneyToCents(value) != null, "Enter an amount greater than zero, up to 1000000.00")
  .transform((value) => parseMoneyToCents(value) as number);

const notes = z.string().trim().max(2000).optional().default("");
const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());
const cardFree = (value: string, ctx: z.RefinementCtx, path: string) => {
  if (!looksLikePaymentCard(value)) return;
  ctx.addIssue({ code: "custom", path: [path], message: "Do not enter a card number. Record the transfer reference only." });
};

export const contractCreateSchema = z
  .object({
    employerId: z.string().trim().min(1).max(40),
    title: z.string().trim().min(2).max(120),
    amount: moneyField,
    startsOn: z.coerce.date(),
    endsOn: optionalDate,
    notes,
  })
  .strict()
  .superRefine((value, ctx) => cardFree(value.notes, ctx, "notes"));

export const contractUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    amount: moneyField.optional(),
    status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
    endsOn: optionalDate,
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.title && value.amount == null && !value.status && value.endsOn === undefined && value.notes === undefined) {
      ctx.addIssue({ code: "custom", message: "Nothing to update." });
    }
    if (value.notes) cardFree(value.notes, ctx, "notes");
  });

export const invoiceCreateSchema = z
  .object({
    amount: moneyField,
    issuedOn: optionalDate,
    dueOn: optionalDate,
    notes,
  })
  .strict()
  .superRefine((value, ctx) => cardFree(value.notes, ctx, "notes"));

export const invoiceStatusSchema = z
  .object({
    status: z.enum(["DRAFT", "ISSUED", "VOID"]),
  })
  .strict();

export const paymentSchema = z
  .object({
    amount: moneyField,
    paidOn: z.coerce.date(),
    method: z.enum(["BANK_TRANSFER", "PAYNOW", "CASH", "CHEQUE", "OTHER"]),
    reference: z.string().trim().max(80).optional().default(""),
    notes: z.string().trim().max(500).optional().default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    cardFree(value.reference, ctx, "reference");
    cardFree(value.notes, ctx, "notes");
  });
