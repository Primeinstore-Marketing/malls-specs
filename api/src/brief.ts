/**
 * Reads a client's brief (a PDF, or text taken from a Word, PowerPoint or
 * Excel file in the browser) and drafts a campaign from it with Claude:
 * name, client and contact, dates, objective, and screens picked from the
 * inventory the site sends with it. Sales check it before anything is sent.
 *
 * Needs the Worker secret ANTHROPIC_API_KEY (npx wrangler secret put ANTHROPIC_API_KEY).
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

export const BriefDraft = z.object({
  summary: z.string().describe('One or two sentences: what the client wants, in plain words.'),
  name: z.string().describe('A short campaign name, e.g. "Sunrise Yoghurt winter launch".'),
  client: z.object({
    company: z.string().describe('The advertiser or brand. Empty string if not stated.'),
    contactName: z.string().describe('The person to send the proposal to. Empty string if not stated.'),
    email: z.string().describe('Their email address. Empty string if not stated.'),
  }),
  start: z.string().nullable().describe('First day, YYYY-MM-DD. Null if the brief gives no dates.'),
  end: z.string().nullable().describe('Last day, YYYY-MM-DD. Null if the brief gives no dates.'),
  objective: z.string().describe('What the campaign must achieve, in one or two sentences.'),
  items: z
    .array(z.object({ key: z.string().describe('A key from the inventory, exactly as written.'), reason: z.string().describe('Why this screen fits, in a few words.') }))
    .describe('The screens to propose, chosen only from the inventory.'),
  noteForClient: z.string().describe('A short, friendly note to the client to go with the proposal (2–4 sentences, no greeting or sign-off).'),
  missing: z.array(z.string()).describe('Things the brief does not say that the salesperson should confirm before sending, e.g. "No budget given".'),
});
export type BriefDraft = z.infer<typeof BriefDraft>;

const SYSTEM = `You are a media planner at Primedia Malls, which sells advertising on digital screens in South African shopping malls.
A salesperson has received a brief from a client and wants a proposal they can check and send.

Read the brief and draft the campaign:
- Use only screens from the inventory, by their exact key. Choose the ones that best match the brief's audience, regions, malls, formats, size requirements and budget hints. If the brief names malls or regions, stay within them. If it gives a number of screens or a budget level, respect it; otherwise propose a sensible plan (usually 4 to 12 screens).
- Dates: use the brief's dates. Resolve relative dates ("next month", "from 1 March") against today's date, which is given. If there are no dates, return null for both.
- Take the client company, contact person and email from the brief if they are there; never invent an email address.
- List in "missing" anything the salesperson should confirm before sending (budget, exact dates, contact details, creative, anything ambiguous).
- Write in plain South African English. Keep the note to the client short and specific to their brief.`;

export interface BriefInput {
  /** The brief as text (Word, PowerPoint, Excel, CSV or plain text, read in the browser). */
  readonly text?: string;
  /** A PDF, base64 without newlines. */
  readonly pdf?: string;
  /** An image (a photo or screenshot of a brief), base64. */
  readonly image?: { readonly data: string; readonly mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' };
  readonly filename: string;
  /** One line per screen or package that can be booked, starting with its key. */
  readonly inventory: string;
  readonly today: string;
}

export async function draftFromBrief(apiKey: string, input: BriefInput): Promise<{ draft: BriefDraft; model: string }> {
  const client = new Anthropic({ apiKey });
  const brief: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.pdf) brief.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.pdf }, title: input.filename });
  if (input.image) brief.push({ type: 'image', source: { type: 'base64', media_type: input.image.mediaType, data: input.image.data } });
  if (input.text) brief.push({ type: 'text', text: `The brief (${input.filename}):\n\n${input.text}` });
  brief.push({
    type: 'text',
    text: `Today is ${input.today}.\n\nInventory (key | mall and place | screen | size | shoppers):\n${input.inventory}\n\nDraft the campaign from the brief${input.pdf || input.image ? ` (${input.filename})` : ''} above.`,
  });

  const response = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: { effort: 'medium', format: betaZodOutputFormat(BriefDraft) },
    messages: [{ role: 'user', content: brief }],
  });

  if (response.stop_reason === 'refusal') throw new Error('The AI couldn’t read this brief. Try another file, or fill the proposal in by hand.');
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) throw new Error('The AI’s answer was incomplete. Try again.');
  return { draft: response.parsed_output, model: response.model };
}
