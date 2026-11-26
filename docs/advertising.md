# Advertising checks

Employment agency advertisements in Singapore are expected to show the EA licence number and the registration numbers of the personnel, and to avoid depicting a helper as a product or in a demeaning way. The check in `lib/marketing/compliance.ts` runs when a draft is created and again when staff try to approve it.

It blocks a draft that:

- does not contain the configured licence number
- does not contain at least one configured personnel registration number
- uses discount, sale, or promotion wording, including a few common phrases in Chinese, Malay, Tagalog, Indonesian, and Burmese
- uses a short list of objectifying phrases

The word "maid" on its own is not blocked. The footer is appended in English because the licence number has to be readable as issued. The body can be drafted in English, Chinese, Malay, Tamil, Tagalog, Bahasa Indonesia, or Burmese. The model is asked to write in that language. A template fallback does not pretend to be a translation.

Approval copies text into the product only for a consented profile blurb. It does not call Facebook, Instagram, TikTok, WhatsApp, Google, or an email provider.

The check is code, not a sentence in the prompt. Notes wrapped as untrusted data cannot disable it.
