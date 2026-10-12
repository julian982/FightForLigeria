// L'envoi des emails (confirmation d'adresse, nouveau mot de passe). Sans SMTP configuré (développement, tests),
// les emails sont écrits dans les journaux du serveur au lieu d'être envoyés.
import nodemailer from 'nodemailer';

const SMTP = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: +(process.env.SMTP_PORT || 587),
  secure: +(process.env.SMTP_PORT || 587) === 465,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
}) : null;
const FROM = process.env.MAIL_FROM || 'FightForLigeria <noreply@trouve-ton-serveur.fr>';

export type Mail = { to: string, subject: string, text: string, html: string };

/** mise en page commune des emails (HTML simple, lisible partout, plus une version texte) */
export function layout(title: string, paragraphs: string[], button?: { label: string, url: string }) {
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4efe4;font-family:Georgia,serif;color:#2a2117">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
<p style="margin:0 0 18px;font-size:20px;color:#8a5d12">FightForLigeria</p>
<h1 style="margin:0 0 16px;font-size:24px;font-weight:normal">${esc(title)}</h1>
${paragraphs.map(p => `<p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:15px;line-height:1.5">${esc(p)}</p>`).join('')}
${button ? `<p style="margin:22px 0"><a href="${esc(button.url)}" style="display:inline-block;background:#d9a441;color:#22180c;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;padding:12px 20px;border-radius:3px">${esc(button.label)}</a></p>
<p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:12px;color:#6b5b45;word-break:break-all">Si le bouton ne marche pas, copie ce lien dans ton navigateur : ${esc(button.url)}</p>` : ''}
<p style="margin:24px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#6b5b45">Tu reçois cet email parce que cette adresse a été utilisée sur FightForLigeria. Si ce n'est pas toi, ignore-le simplement.</p>
</div></body></html>`;
  const text = [title, '', ...paragraphs, ...(button ? ['', `${button.label} : ${button.url}`] : []), '', 'Si ce n\'est pas toi, ignore simplement cet email.'].join('\n');
  return { html, text };
}

/** n'échoue jamais : une panne du serveur d'email est journalisée (le joueur peut redemander l'email ensuite) */
export async function sendMail(m: Mail) {
  if (!SMTP) { console.log('MAIL ' + JSON.stringify({ to: m.to, subject: m.subject, text: m.text })); return true }
  try { await SMTP.sendMail({ from: FROM, to: m.to, subject: m.subject, text: m.text, html: m.html }); return true }
  catch (e: any) { console.error(`email non envoyé (${m.subject}) : ${e.code || ''} ${e.message}`); return false }
}
