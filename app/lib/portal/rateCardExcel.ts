'use client';

/**
 * The proposal's rate card as an Excel file, in Primedia Malls branding:
 * the logo, who it's for, one row per line (rate card price, discount, net
 * rate, periods, total) and the totals, with VAT when the card includes it.
 * Totals are Excel formulas, so the file stays right if someone edits a rate.
 */
import { withBasePath } from '@/lib/basePath';
import { mallName } from '@/lib/insights';
import { campaignClientName, docWords, formatRange, itemDetail, itemLabel, itemMall } from './logic';
import { emptyRateCard, PERIOD_LABEL, pricedLines, VAT_RATE } from './rates';
import type { Campaign, CampaignItem, PortalUser } from './types';

const NAVY = 'FF1B3769';
const BLUE = 'FF2861FD';
const SOFT = 'FFF5F7FC';
const MUTED = 'FF4B5870';
const LINE = 'FFE7E8EC';
const MONEY = '"R" # ##0.00';

function mallOf(item: CampaignItem): string {
  const deck = itemMall(item);
  if (deck) return mallName(deck);
  return item.kind === 'site' ? item.mall : '';
}

export async function downloadRateCard(c: Campaign, user: PortalUser): Promise<string> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = user.name;
  wb.company = 'Primedia Malls';
  wb.title = `${c.name} rate card`;
  const ws = wb.addWorksheet('Rate card', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const card = c.rateCard ?? emptyRateCard();
  const w = docWords(c);
  const client = campaignClientName(c);
  ws.columns = [
    { width: 6 }, { width: 36 }, { width: 18 }, { width: 22 }, { width: 16 }, { width: 11 }, { width: 16 }, { width: 10 }, { width: 18 },
  ];

  // Brand band with the logo
  ws.mergeCells('A1:I1');
  ws.getRow(1).height = 42;
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  try {
    const res = await fetch(withBasePath('/brand/logo-white-deck.png'));
    const buf = await res.arrayBuffer();
    const id = wb.addImage({ buffer: buf as never, extension: 'png' });
    ws.addImage(id, { tl: { col: 0.25, row: 0.25 }, ext: { width: 190, height: 40 } });
  } catch {
    ws.getCell('A1').value = 'PRIMEDIA MALLS';
    ws.getCell('A1').font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  }

  ws.getCell('A3').value = 'RATE CARD';
  ws.getCell('A3').font = { name: 'Arial', bold: true, size: 10, color: { argb: BLUE } };
  ws.getCell('A4').value = c.name;
  ws.getCell('A4').font = { name: 'Arial', bold: true, size: 18, color: { argb: 'FF0D1E3F' } };
  const facts: [string, string][] = [
    ['Prepared for', client && client !== 'No client yet' ? client : '—'],
    ['Flight', c.start || c.end ? formatRange(c.start, c.end) : 'To be agreed'],
    ['Rates', `${PERIOD_LABEL[card.per]}, in rand, excluding VAT`],
    ['Prepared by', `${user.name}${user.title ? `, ${user.title}` : ''}${user.email ? ` · ${user.email}` : ''}`],
  ];
  facts.forEach(([k, v], i) => {
    const r = 6 + i;
    ws.getCell(`A${r}`).value = k;
    ws.mergeCells(`A${r}:B${r}`);
    ws.getCell(`A${r}`).font = { name: 'Arial', bold: true, color: { argb: MUTED } };
    ws.mergeCells(`C${r}:I${r}`);
    ws.getCell(`C${r}`).value = v;
    ws.getCell(`C${r}`).font = { name: 'Arial' };
  });

  const head = ['No', w.Noun === 'Site list' ? 'Site' : 'Screen or package', 'Mall', 'Detail', `Rate card (${PERIOD_LABEL[card.per].replace('per ', '')})`, 'Discount', 'Net rate', 'Periods', 'Total'];
  const hr = 11;
  ws.getRow(hr).values = head;
  ws.getRow(hr).height = 22;
  ws.getRow(hr).eachCell((cell) => {
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  const border = { top: { style: 'thin' as const, color: { argb: LINE } }, bottom: { style: 'thin' as const, color: { argb: LINE } } };
  const rows = pricedLines(c);
  rows.forEach((p, i) => {
    const r = hr + 1 + i;
    const row = ws.getRow(r);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = itemLabel(p.item);
    row.getCell(3).value = mallOf(p.item);
    row.getCell(4).value = itemDetail(p.item);
    row.getCell(5).value = p.line.rate ?? null;
    row.getCell(6).value = (p.line.discount ?? 0) / 100;
    row.getCell(7).value = { formula: `IF(E${r}="","",E${r}*(1-F${r}))` };
    row.getCell(8).value = p.periods;
    row.getCell(9).value = { formula: `IF(E${r}="","",G${r}*H${r})` };
    row.getCell(5).numFmt = MONEY;
    row.getCell(6).numFmt = '0%';
    row.getCell(7).numFmt = MONEY;
    row.getCell(9).numFmt = MONEY;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { name: 'Arial', bold: col === 2 || col === 9 };
      cell.border = border;
      cell.alignment = { vertical: 'top', wrapText: col <= 4 };
      if (i % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } };
    });
  });
  const first = hr + 1;
  const last = hr + rows.length;
  let r = last + 2;
  const total = (label: string, formula: string, strong = false) => {
    ws.mergeCells(`F${r}:H${r}`);
    ws.getCell(`F${r}`).value = label;
    ws.getCell(`F${r}`).font = { name: 'Arial', bold: strong, color: { argb: strong ? 'FF0D1E3F' : MUTED } };
    ws.getCell(`F${r}`).alignment = { horizontal: 'right' };
    ws.getCell(`I${r}`).value = { formula };
    ws.getCell(`I${r}`).numFmt = MONEY;
    ws.getCell(`I${r}`).font = { name: 'Arial', bold: true, size: strong ? 12 : 10, color: { argb: strong ? 'FFFFFFFF' : 'FF0D1E3F' } };
    if (strong) ws.getCell(`I${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    r += 1;
  };
  total('Rate card value', `SUMPRODUCT(E${first}:E${last},H${first}:H${last})`);
  total('Discount', `SUMPRODUCT(E${first}:E${last},H${first}:H${last})-SUM(I${first}:I${last})`);
  total(card.vat ? 'Total excl. VAT' : 'Total (excl. VAT)', `SUM(I${first}:I${last})`, !card.vat);
  if (card.vat) {
    total(`VAT (${Math.round(VAT_RATE * 100)}%)`, `SUM(I${first}:I${last})*${VAT_RATE}`);
    total('Total incl. VAT', `SUM(I${first}:I${last})*${1 + VAT_RATE}`, true);
  }
  r += 1;
  if (card.note.trim()) {
    ws.mergeCells(`A${r}:I${r + 2}`);
    ws.getCell(`A${r}`).value = card.note.trim();
    ws.getCell(`A${r}`).alignment = { wrapText: true, vertical: 'top' };
    ws.getCell(`A${r}`).font = { name: 'Arial' };
    r += 4;
  }
  ws.mergeCells(`A${r}:I${r}`);
  ws.getCell(`A${r}`).value = 'Rates in rand. Media is subject to availability; the booking is confirmed once the client approves the proposal.';
  ws.getCell(`A${r}`).font = { name: 'Arial', italic: true, size: 9, color: { argb: MUTED } };
  ws.pageSetup.printTitlesRow = `${hr}:${hr}`;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `${c.name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Proposal'} — Primedia Malls rate card.xlsx`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return fileName;
}
