// Les routes HTTP des comptes, servies par le serveur de jeu à côté des parties (même adresse : /api/...).
import { createEndpoint, createRouter } from '@colyseus/core';
import * as A from './accounts';

const json = (r: { status: number, body?: any, redirect?: string }) => r.redirect
  ? new Response(null, { status: r.status, headers: { location: r.redirect, 'cache-control': 'no-store' } })
  : new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
/** IP du visiteur : Traefik la transmet dans X-Forwarded-For */
const ipOf = (h: Headers) => (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'local';
const token = (h: Headers) => A.bearer(h.get('authorization'));
/** une erreur imprévue ne doit jamais renvoyer de détails techniques au navigateur */
const safe = (fn: (ctx: any) => Promise<any>) => async (ctx: any) => {
  try { return json(await fn(ctx)) }
  catch (e) { console.error('api :', e); return json({ status: 500, body: { error: 'Erreur du serveur. Réessaie dans un instant.', code: 'server' } }) }
};
const post = (path: string, fn: (ctx: any) => Promise<any>) => createEndpoint(path, { method: 'POST' }, safe(fn));
const get = (path: string, fn: (ctx: any) => Promise<any>) => createEndpoint(path, { method: 'GET' }, safe(fn));

export const apiRouter = () => createRouter({
  register: post('/api/register', ctx => A.register(ctx.body, ipOf(ctx.request.headers))),
  verify: get('/api/verify', ctx => A.verify(String(ctx.query?.t ?? ''))),
  resend: post('/api/resend', ctx => A.resend(ctx.body, ipOf(ctx.request.headers))),
  login: post('/api/login', ctx => A.login(ctx.body, ipOf(ctx.request.headers))),
  logout: post('/api/logout', ctx => A.logout(token(ctx.request.headers))),
  me: get('/api/me', ctx => A.me(token(ctx.request.headers))),
  forgot: post('/api/forgot', ctx => A.forgot(ctx.body, ipOf(ctx.request.headers))),
  reset: post('/api/reset', ctx => A.reset(ctx.body, ipOf(ctx.request.headers))),
  blason: post('/api/account/blason', ctx => A.setBlason(token(ctx.request.headers), ctx.body)),
  history: get('/api/history', ctx => A.history(token(ctx.request.headers))),
  solo: post('/api/history/solo', ctx => A.soloResult(token(ctx.request.headers), ctx.body)),
  leaderboard: get('/api/leaderboard', ctx => A.leaderboard(token(ctx.request.headers), String(ctx.query?.mode ?? '1v1'))),
  admin: get('/api/admin/stats', ctx => A.adminStats(token(ctx.request.headers))),
  deleteAccount: post('/api/account/delete', ctx => A.deleteAccount(token(ctx.request.headers), ctx.body, ipOf(ctx.request.headers))),
});
