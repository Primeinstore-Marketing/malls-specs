import type { Campaign, CampaignEvent, Client, PortalState, PortalUser } from './types';

/**
 * Demo accounts and campaigns, so both portals have something in them the
 * first time they're opened. Campaign dates are set relative to the day the
 * demo is first loaded, so there is always one live, one coming up, and so on.
 */

const BASE_CLIENTS: readonly Client[] = [
  { id: 'rialto', name: 'Rialto Foods', industry: 'Food & FMCG', contact: { name: 'Anele Ndlovu', email: 'anele@rialtofoods.demo' } },
  { id: 'karoo-fresh', name: 'Karoo Fresh Juices', industry: 'Beverages', contact: { name: 'Megan Botha', email: 'megan@karoofresh.demo' } },
];

/** Clients, with any an admin has added or edited (content "client:<id>"). */
export let CLIENTS: readonly Client[] = BASE_CLIENTS;

export function applyClients(edited: readonly (Client & { hidden?: boolean })[]) {
  const byId = new Map(edited.map((c) => [c.id, c]));
  CLIENTS = [...BASE_CLIENTS.map((c) => byId.get(c.id) ?? c), ...edited.filter((c) => !BASE_CLIENTS.some((b) => b.id === c.id))].filter(
    (c) => !(c as { hidden?: boolean }).hidden,
  );
}

export const USERS: readonly PortalUser[] = [
  { id: 'u-lerato', name: 'Lerato Mokoena', email: 'lerato.mokoena@primedia.demo', role: 'sales', title: 'Account Manager, Primedia Malls' },
  { id: 'u-anele', name: 'Anele Ndlovu', email: 'anele@rialtofoods.demo', role: 'client', clientId: 'rialto', title: 'Brand Manager, Rialto Foods' },
  { id: 'u-megan', name: 'Megan Botha', email: 'megan@karoofresh.demo', role: 'client', clientId: 'karoo-fresh', title: 'Marketing Lead, Karoo Fresh Juices' },
];

const DAY = 86_400_000;
const iso = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const at = (offset: number, hour = 10) => {
  const d = new Date(Date.now() + offset * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
let n = 0;
const ev = (offset: number, by: string, text: string, kind: CampaignEvent['kind'] = 'status'): CampaignEvent => ({
  id: `e${++n}`,
  at: at(offset, 9 + (n % 7)),
  by,
  text,
  kind,
});
const pkg = (code: string) => ({ id: `i-${code}`, kind: 'package' as const, code });

export function seedState(): PortalState {
  n = 0;
  const campaigns: Campaign[] = [
    {
      id: 'c-winter-pasta',
      name: 'Winter Pasta Launch',
      clientId: 'rialto',
      objective: 'Launch the new winter pasta range in Gauteng and Western Cape food courts.',
      start: iso(-95),
      end: iso(-68),
      audience: { gender: 'female', ages: ['25-34', '35-44'], lsm: 'A', provinces: ['Gauteng', 'Western Cape'] },
      status: 'booked',
      createdBy: 'u-lerato',
      createdAt: at(-130),
      updatedAt: at(-100),
      items: [pkg('PCK01570'), pkg('CA19'), pkg('PCK01989'), pkg('CA07')],
      events: [
        ev(-130, 'u-lerato', 'Created the campaign'),
        ev(-125, 'u-lerato', 'Sent the proposal to Rialto Foods'),
        ev(-121, 'u-anele', 'Approved the proposal'),
        ev(-120, 'u-lerato', 'Confirmed the booking'),
      ],
    },
    {
      id: 'c-summer-sauces',
      name: 'Summer Braai Sauces',
      clientId: 'rialto',
      objective: 'Drive trial of the braai sauce range ahead of the summer holidays.',
      start: iso(-9),
      end: iso(19),
      audience: { gender: 'any', ages: ['25-34', '35-44'], lsm: 'A', provinces: [] },
      status: 'booked',
      createdBy: 'u-lerato',
      createdAt: at(-45),
      updatedAt: at(-20),
      items: [pkg('PCK01834'), pkg('PCK01570'), pkg('PCK01989'), pkg('CA19'), pkg('CA07'), pkg('PCK01942')],
      events: [
        ev(-45, 'u-anele', 'Sent a campaign brief to Primedia'),
        ev(-44, 'u-anele', 'We want to be in front of families stocking up for the holidays.', 'message'),
        ev(-40, 'u-lerato', 'Sent the proposal to Rialto Foods'),
        ev(-39, 'u-lerato', 'Added Waterfall Mall — strong 25–34 audience in Rustenburg.', 'message'),
        ev(-36, 'u-anele', 'Approved the proposal'),
        ev(-35, 'u-lerato', 'Confirmed the booking'),
      ],
    },
    {
      id: 'c-festive',
      name: 'Festive Feast',
      clientId: 'rialto',
      objective: 'Festive season recipes and in-store promotions near grocery anchors.',
      start: iso(15),
      end: iso(42),
      audience: { gender: 'female', ages: ['35-44', '45-64'], lsm: 'any', provinces: ['KwaZulu-Natal', 'Gauteng'] },
      status: 'sent',
      createdBy: 'u-lerato',
      createdAt: at(-6),
      updatedAt: at(-1),
      items: [pkg('PCK01570'), pkg('CH11'), pkg('PCK01428'), pkg('PCK02049'), pkg('PCK02030')],
      events: [
        ev(-6, 'u-lerato', 'Created the campaign'),
        ev(-1, 'u-lerato', 'Sent the proposal to Rialto Foods'),
        ev(-1, 'u-lerato', 'Chatsworth and the Pavilion over-index on your 35–64 audience. Brooklyn is still running your braai sauces for the first few days — we can move the dates or swap it for Menlyn.', 'message'),
      ],
    },
    {
      id: 'c-back-to-school',
      name: 'Back to School Lunchbox',
      clientId: 'rialto',
      objective: 'Lunchbox snacks for parents doing back-to-school shopping in January.',
      start: iso(55),
      end: iso(82),
      audience: { gender: 'female', ages: ['25-34', '35-44'], lsm: 'any', provinces: ['Western Cape'] },
      status: 'proposed',
      createdBy: 'u-anele',
      createdAt: at(-2),
      updatedAt: at(-2),
      items: [pkg('CA19'), pkg('CA07')],
      events: [
        ev(-2, 'u-anele', 'Sent a campaign brief to Primedia'),
        ev(-2, 'u-anele', 'Can you suggest one more mall in the northern suburbs?', 'message'),
      ],
    },
    {
      id: 'c-karoo-summer',
      name: 'Summer Squeeze',
      clientId: 'karoo-fresh',
      objective: 'Cold-pressed juice range, summer refresh.',
      start: iso(3),
      end: iso(30),
      audience: { gender: 'any', ages: ['15-24', '25-34'], lsm: 'A', provinces: ['Western Cape'] },
      status: 'booked',
      createdBy: 'u-lerato',
      createdAt: at(-30),
      updatedAt: at(-12),
      items: [pkg('SO02'), pkg('PCK01808')],
      events: [
        ev(-30, 'u-lerato', 'Created the campaign'),
        ev(-20, 'u-lerato', 'Sent the proposal to Karoo Fresh Juices'),
        ev(-14, 'u-megan', 'Approved the proposal'),
        ev(-12, 'u-lerato', 'Confirmed the booking'),
      ],
    },
  ];
  return { version: 1, userId: null, campaigns, active: {}, seen: {} };
}
