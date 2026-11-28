export const LOCALES = ["en", "zh", "ms", "id", "tl", "my", "ta"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  zh: "中文",
  ms: "Bahasa Melayu",
  id: "Bahasa Indonesia",
  tl: "Tagalog",
  my: "မြန်မာ",
  ta: "தமிழ்",
};

export const HTML_LANG: Record<Locale, string> = {
  en: "en-SG",
  zh: "zh-Hans",
  ms: "ms",
  id: "id",
  tl: "tl",
  my: "my",
  ta: "ta",
};

const en = {
  "skip": "Skip to content",
  "nav.primary": "Primary",
  "nav.language": "Language",
  "nav.services": "Services",
  "nav.care": "Care",
  "nav.helpers": "Helpers",
  "nav.journal": "Journal",
  "nav.stories": "Stories",
  "nav.faq": "FAQ",
  "nav.contact": "Contact",
  "nav.apply": "Helper application",
  "nav.desk": "Your desk",
  "nav.signIn": "Sign in",
  "footer.privacy": "Privacy notice",
  "footer.disclaimer": "Disclaimer",
  "locale.fallbackNote": "Some text is still in English until a translator reviews it.",
  "home.kicker": "Employment agency",
  "home.title": "Care for the household, with the paperwork kept in the open.",
  "home.lede": "introduces foreign domestic workers to families in Singapore, then prepares the Ministry of Manpower file for a person to submit. Staff decide every match. AI only drafts words for review.",
  "home.household": "Tell us about your household",
  "home.galleryLink": "See available helpers",
  "home.stepsTitle": "How a placement moves",
  "home.step1": "Helper applies, with consent for the data we actually need.",
  "home.step2": "Staff screen documents and mark a profile available.",
  "home.step3": "An employer shortlists and requests an interview.",
  "home.step4": "Staff approve a match. A model can explain the score. It cannot decide.",
  "home.step5": "Staff download a MOM pack and lodge it themselves.",
  "home.helpersTitle": "Helpers who agreed to be introduced",
  "home.fullGallery": "Full gallery",
  "home.empty": "No consented profiles are available yet.",
  "home.fictional": "Fictional profile",
  "apply.title": "Helper application",
  "candidate.nav": "Your application",
  "candidate.update": "Update details",
  "candidate.missingTitle": "Your application",
  "candidate.missingBody": "Use the same email as this account so the file is linked.",
  "candidate.privateNote": "Staff move the file through screening, availability, matching, and the Ministry of Manpower steps. This page does not show passport or medical details.",
  "candidate.nextTitle": "What happens next",
  "candidate.interviews": "Interviews",
  "candidate.noInterviews": "No interview has been requested.",
  "candidate.documents": "Documents you uploaded",
  "candidate.noDocuments": "No documents are on the file yet.",
  "candidate.consent": "Consent",
  "candidate.photoOn": "Portrait consent is on.",
  "candidate.photoOff": "Portrait consent is off.",
  "candidate.privacyOn": "Processing consent is recorded.",
  "candidate.privacyOff": "Processing consent is not on this file yet.",
  "candidate.upload": "Add a document",
  "candidate.area": "Neighbourhood",
} as const;

export type MessageKey = keyof typeof en;

const partials: Record<Locale, Partial<Record<MessageKey, string>>> = {
  en,
  zh: {
    "skip": "跳到主要内容",
    "nav.primary": "主导航",
    "nav.language": "语言",
    "nav.services": "服务",
    "nav.care": "护理",
    "nav.helpers": "帮佣",
    "nav.journal": "日志",
    "nav.stories": "故事",
    "nav.faq": "常见问题",
    "nav.contact": "联络",
    "nav.apply": "帮佣申请",
    "nav.desk": "我的工作台",
    "nav.signIn": "登录",
    "footer.privacy": "隐私声明",
    "footer.disclaimer": "免责声明",
    "locale.fallbackNote": "部分文字仍为英文，待翻译审阅。",
    "home.kicker": "职业介绍所",
    "home.title": "照料家庭，手续公开。",
    "home.household": "告诉我们您的家庭情况",
    "home.galleryLink": "查看可介绍的帮佣",
    "apply.title": "帮佣申请",
    "candidate.nav": "我的申请",
    "candidate.update": "更新资料",
    "candidate.missingTitle": "我的申请",
    "candidate.interviews": "面试",
    "candidate.documents": "已上传的文件",
    "candidate.consent": "同意",
    "candidate.upload": "添加文件",
  },
  ms: {
    "skip": "Langkau ke kandungan",
    "nav.primary": "Utama",
    "nav.language": "Bahasa",
    "nav.services": "Perkhidmatan",
    "nav.care": "Penjagaan",
    "nav.helpers": "Pembantu",
    "nav.journal": "Jurnal",
    "nav.stories": "Cerita",
    "nav.faq": "Soalan lazim",
    "nav.contact": "Hubungi",
    "nav.apply": "Permohonan pembantu",
    "nav.desk": "Meja anda",
    "nav.signIn": "Log masuk",
    "footer.privacy": "Notis privasi",
    "footer.disclaimer": "Penafian",
    "locale.fallbackNote": "Sebahagian teks masih dalam bahasa Inggeris sehingga disemak oleh penterjemah.",
    "home.kicker": "Agensi pekerjaan",
    "home.title": "Penjagaan rumah, dengan kertas kerja yang jelas.",
    "home.household": "Beritahu kami tentang isi rumah anda",
    "home.galleryLink": "Lihat pembantu yang tersedia",
    "apply.title": "Permohonan pembantu",
    "candidate.nav": "Permohonan anda",
    "candidate.update": "Kemas kini butiran",
    "candidate.interviews": "Temu duga",
    "candidate.documents": "Dokumen yang dimuat naik",
    "candidate.consent": "Kebenaran",
    "candidate.upload": "Tambah dokumen",
  },
  id: {
    "skip": "Lewati ke isi",
    "nav.primary": "Utama",
    "nav.language": "Bahasa",
    "nav.services": "Layanan",
    "nav.care": "Perawatan",
    "nav.helpers": "Pekerja rumah tangga",
    "nav.journal": "Jurnal",
    "nav.stories": "Cerita",
    "nav.faq": "Pertanyaan",
    "nav.contact": "Kontak",
    "nav.apply": "Lamaran pekerja",
    "nav.desk": "Meja Anda",
    "nav.signIn": "Masuk",
    "footer.privacy": "Pemberitahuan privasi",
    "footer.disclaimer": "Penafian",
    "locale.fallbackNote": "Sebagian teks masih bahasa Inggris sampai penerjemah meninjaunya.",
    "home.kicker": "Agensi penempatan",
    "home.title": "Perawatan rumah tangga, dengan berkas yang terbuka.",
    "apply.title": "Lamaran pekerja",
    "candidate.nav": "Lamaran Anda",
    "candidate.update": "Perbarui data",
    "candidate.interviews": "Wawancara",
    "candidate.documents": "Dokumen yang diunggah",
    "candidate.consent": "Persetujuan",
    "candidate.upload": "Tambah dokumen",
  },
  tl: {
    "skip": "Lumaktaw sa nilalaman",
    "nav.primary": "Pangunahin",
    "nav.language": "Wika",
    "nav.services": "Mga serbisyo",
    "nav.care": "Pangangalaga",
    "nav.helpers": "Mga helper",
    "nav.journal": "Talaan",
    "nav.stories": "Mga kuwento",
    "nav.faq": "Mga tanong",
    "nav.contact": "Makipag-ugnayan",
    "nav.apply": "Aplikasyon ng helper",
    "nav.desk": "Ang iyong mesa",
    "nav.signIn": "Mag-sign in",
    "footer.privacy": "Abiso sa privacy",
    "footer.disclaimer": "Paunawa",
    "locale.fallbackNote": "May tekstong Ingles pa hanggang suriin ito ng tagasalin.",
    "home.kicker": "Ahensya ng empleo",
    "home.title": "Pag-aalaga sa tahanan, nang malinaw ang mga papeles.",
    "apply.title": "Aplikasyon ng helper",
    "candidate.nav": "Ang iyong aplikasyon",
    "candidate.update": "I-update ang detalye",
    "candidate.interviews": "Mga panayam",
    "candidate.documents": "Mga dokumentong in-upload",
    "candidate.consent": "Pahintulot",
    "candidate.upload": "Magdagdag ng dokumento",
  },
  my: {
    "skip": "အကြောင်းအရာသို့ ကျော်ရန်",
    "nav.primary": "အဓိက",
    "nav.language": "ဘာသာစကား",
    "nav.services": "ဝန်ဆောင်မှု",
    "nav.care": "ပြုစုစောင့်ရှောက်မှု",
    "nav.helpers": "အိမ်အကူ",
    "nav.journal": "ဂျာနယ်",
    "nav.stories": "ဇာတ်လမ်း",
    "nav.faq": "မေးလေ့ရှိသောမေးခွန်း",
    "nav.contact": "ဆက်သွယ်ရန်",
    "nav.apply": "အိမ်အကူလျှောက်လွှာ",
    "nav.desk": "သင့်စားပွဲ",
    "nav.signIn": "ဝင်ရောက်ရန်",
    "footer.privacy": "ကိုယ်ရေးအချက်အလက်",
    "footer.disclaimer": "ရှင်းလင်းချက်",
    "locale.fallbackNote": "ဘာသာပြန်စစ်ဆေးခြင်းမပြီးမီ စာသားအချို့သည် အင်္ဂလိပ်လိုရှိနေပါသည်။",
    "home.kicker": "အလုပ်အကိုင်အေဂျင်စီ",
    "home.title": "အိမ်ထောင်စုစောင့်ရှောက်မှု၊ စာရွက်စာတမ်းများကို ပွင့်လင်းစွာထားပါသည်။",
    "apply.title": "အိမ်အကူလျှောက်လွှာ",
    "candidate.nav": "သင့်လျှောက်လွှာ",
    "candidate.update": "အချက်အလက်ပြင်ရန်",
    "candidate.interviews": "အင်တာဗျူး",
    "candidate.documents": "တင်ထားသောစာရွက်စာတမ်း",
    "candidate.consent": "သဘောတူညီချက်",
    "candidate.upload": "စာရွက်စာတမ်းထည့်ရန်",
  },
  ta: {},
};

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function t(locale: Locale, key: MessageKey): string {
  return partials[locale][key] ?? en[key];
}

export function localeHasGaps(locale: Locale): boolean {
  return locale !== "en" && Object.keys(partials[locale]).length < Object.keys(en).length;
}

/** Same-origin path only. Rejects protocol-relative and backslash tricks. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "/";
  }
  if (decoded.length > 200 || decoded.length === 0) return "/";
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/";
  if (decoded.includes("\\") || decoded.includes("://") || decoded.includes("\0")) return "/";
  if (/[\r\n]/.test(decoded)) return "/";
  return decoded;
}
