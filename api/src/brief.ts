/**
 * Reads a client's brief and drafts a campaign from it, with Cloudflare
 * Workers AI — free within the account's daily allowance (10,000 neurons;
 * a brief uses roughly 500), no API key needed.
 *
 *  - Word, PowerPoint, Excel, CSV and text arrive as text, read in the browser.
 *  - PDFs, images and older formats (.xls, .odt, .numbers) arrive as a file
 *    and are turned into text here with Workers AI's document converter.
 *  - The model drafts name, client and contact, dates, objective and screens
 *    picked from the inventory the site sends, as JSON; it's checked here.
 */
import { z } from 'zod';

export const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
/** Keeps a request well inside the model's context window. */
export const MAX_BRIEF_CHARS = 40_000;

export const BriefDraft = z.object({
  summary: z.string(),
  name: z.string(),
  client: z.object({ company: z.string(), contactName: z.string(), email: z.string() }),
  start: z.string().nullable(),
  end: z.string().nullable(),
  objective: z.string(),
  items: z.array(z.object({ key: z.string(), reason: z.string() })),
  noteForClient: z.string(),
  missing: z.array(z.string()),
});
export type BriefDraft = z.infer<typeof BriefDraft>;

/** The same shape as JSON Schema, for the model's JSON mode. */
const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'One or two sentences: what the client wants.' },
    name: { type: 'string', description: 'A short campaign name.' },
    client: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'Advertiser or brand; empty string if not stated.' },
        contactName: { type: 'string', description: 'Person to send the proposal to; empty string if not stated.' },
        email: { type: 'string', description: 'Their email; empty string if not stated. Never invent one.' },
      },
      required: ['company', 'contactName', 'email'],
    },
    start: { type: ['string', 'null'], description: 'First day YYYY-MM-DD, or null.' },
    end: { type: ['string', 'null'], description: 'Last day YYYY-MM-DD, or null.' },
    objective: { type: 'string', description: 'What the campaign must achieve, one or two sentences.' },
    items: {
      type: 'array',
      description: 'Screens to propose, only keys from the inventory.',
      items: {
        type: 'object',
        properties: { key: { type: 'string' }, reason: { type: 'string', description: 'Why it fits, a few words.' } },
        required: ['key', 'reason'],
      },
    },
    noteForClient: { type: 'string', description: 'A short note to the client, 2–4 sentences, no greeting or sign-off.' },
    missing: { type: 'array', items: { type: 'string' }, description: 'What the salesperson should confirm before sending.' },
  },
  required: ['summary', 'name', 'client', 'start', 'end', 'objective', 'items', 'noteForClient', 'missing'],
} as const;

const SYSTEM = `You are a media planner at Primedia Malls, which sells advertising on digital screens in South African shopping malls.
A salesperson has a brief from a client and wants a proposal they can check and send. Read the brief and draft the campaign as JSON.

Rules:
- "name": a short campaign name made of the brand and what the campaign is for, e.g. "Fresh Bakes holiday promotion" or "Sunrise winter yoghurt launch". Not the company's legal name.
- "items": choose only from the inventory, copying each key exactly (it starts with "scr:" or "pkg:"). Each inventory line shows the mall's province after the "·"; check it. If the brief names provinces, cities or malls, choose only screens there. Prefer what the brief asks for (food courts, portrait screens, busy malls, the audience). If it gives a number of screens, use it; otherwise propose 4 to 12.
- "reason": a few words on why that screen fits, naming the mall's real province or city from its inventory line.
- Dates: the brief's dates as YYYY-MM-DD. Resolve relative dates against today's date. If there are none, use null.
- Company, contact person and email: from the brief only. Never invent an email address; use an empty string.
- "noteForClient": written TO the client, about their campaign, e.g. "Here's a plan for your December promotion: six food-court screens in Durban and Johannesburg, where families stop to eat. You can change the screens or approve it on the page." Never ask the client to confirm things here.
- "missing": what the salesperson should confirm before sending (budget, exact dates, contact details, artwork, anything unclear).
- Plain South African English.`;

export type BriefFile = { readonly name: string; readonly mediaType: string; readonly data: string };

/** A file the browser couldn't read (PDF, image, older Office formats), turned into text by Workers AI. */
export async function fileToText(ai: Ai, file: BriefFile): Promise<string> {
  const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
  const result = await ai.toMarkdown({ name: file.name, blob: new Blob([bytes], { type: file.mediaType }) });
  const one = Array.isArray(result) ? result[0] : result;
  if (!one || one.format === 'error' || !one.data?.trim()) {
    throw new Error('The AI couldn’t read that file. If it’s a scan, try a clearer copy, or save it as Word or PDF with real text.');
  }
  return one.data;
}

export async function draftFromBrief(
  ai: Ai,
  input: { readonly text: string; readonly filename: string; readonly inventory: string; readonly today: string },
): Promise<{ draft: BriefDraft; model: string; truncated: boolean }> {
  const truncated = input.text.length > MAX_BRIEF_CHARS;
  const brief = truncated ? input.text.slice(0, MAX_BRIEF_CHARS) : input.text;
  const user = `Today is ${input.today}.

INVENTORY (key | mall and place | screen | size | shoppers):
${input.inventory}

THE BRIEF (${input.filename})${truncated ? ', first part only — the file is very long' : ''}:
${brief}`;

  const run = async () =>
    (await ai.run(MODEL, {
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      max_tokens: 2048,
    } as never)) as { response?: unknown };

  // JSON mode can occasionally miss the schema; one retry, then a clear message.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const out = await run();
      const raw = typeof out.response === 'string' ? JSON.parse(out.response) : out.response;
      const parsed = BriefDraft.safeParse(raw);
      if (parsed.success) {
        // The model sometimes lists a screen while saying it's leaving it out; drop those.
        const items = parsed.data.items.filter((i) => !/\b(skip|skipping|exclud|not in (the )?target|outside (the )?target|not (a )?match)/i.test(i.reason));
        return { draft: { ...parsed.data, items }, model: MODEL, truncated };
      }
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  throw new Error('The AI’s answer didn’t come out right. Try again, or fill the proposal in by hand.');
}
