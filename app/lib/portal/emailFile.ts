/**
 * A ready-to-send email as a file the installed Outlook opens as a new
 * message: the address, subject and the designed email already in it.
 * Outlook for Mac opens an email template (.emltpl) as a new message;
 * Outlook for Windows opens an .eml marked "X-Unsent" as a draft.
 */

/** UTF-8 text as base64, wrapped at 76 characters as email expects. */
function base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/.{76}(?=.)/g, '$&\r\n');
}

/** A header value, encoded when it isn't plain ASCII (e.g. a curly quote in the subject). */
const header = (v: string) => (/^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${base64(v).replace(/\r\n/g, '')}?=`);

export function emailFile({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }): string {
  const boundary = `----malls-specs-${Math.random().toString(36).slice(2)}`;
  const doc = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${html}</body></html>`;
  return [
    ...(to.trim() ? [`To: ${to.trim()}`] : []),
    `Subject: ${header(subject)}`,
    'X-Unsent: 1',
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64(text),
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64(doc),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

/** Saves the email as a file for Outlook: a template on a Mac, an unsent .eml on Windows. */
export function downloadEmailFile(email: { to: string; subject: string; html: string; text: string }, mac: boolean): string {
  const name = `${email.subject.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Email'}.${mac ? 'emltpl' : 'eml'}`;
  const url = URL.createObjectURL(new Blob([emailFile(email)], { type: 'message/rfc822' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}
