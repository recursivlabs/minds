// Comprehensive X/Bluesky basic real-time social parity check, two real
// accounts against production. Exercises the full loop and prints a scorecard.
import { Recursiv } from '@recursiv/sdk';
// Post instance-split (2026-06-24), Minds prod = the DEDICATED api.minds.com,
// not the shared platform API. Overridable for ad-hoc runs.
const BASE_URL = process.env.PARITY_BASE_URL || 'https://api.minds.com/api/v1';
const PROJECT_ID = '019d5190-f0c0-717e-a1bd-ef9c335292b9';
const ORG_ID = '019d517b-bb87-744d-92db-b3801dc15927';
const SCOPES = ['posts:read','posts:write','users:read','users:write','communities:read','communities:write','chat:read','chat:write','agents:read','agents:write','notifications:read','notifications:write','settings:read','tags:read','uploads:write'];
const anon = new Recursiv({ baseUrl: BASE_URL, timeout: 120000, allowNoKey: true });
const ki = (n) => ({ name: n, scopes: SCOPES, projectId: PROJECT_ID });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = {};
const mark = (k, ok, detail='') => { results[k] = ok ? `PASS ${detail}` : `FAIL ${detail}`; };

try {
  const a = await anon.auth.signInAndCreateKey({ email: process.env.QA_EMAIL, password: process.env.QA_PASSWORD }, ki('pA-'+Date.now()));
  const A = new Recursiv({ apiKey: a.apiKey, baseUrl: BASE_URL, timeout: 120000 });
  const meA = (await A.profiles.me()).data;
  const b = await anon.auth.signUpAndCreateKey({ email:`qa+par${Date.now()}@recursiv.io`, password:'QaParity12345!x', name:'Parity B' }, ki('pB-'+Date.now()));
  const B = new Recursiv({ apiKey: b.apiKey, baseUrl: BASE_URL, timeout: 120000 });
  const meB = (await B.profiles.me()).data;

  // 1. FEED: A posts -> B can fetch it
  const post = (await A.posts.create({ content:'parity '+Date.now(), organization_id: ORG_ID })).data;
  await sleep(800);
  const feed = (await B.posts.list({ limit: 30, organization_id: ORG_ID })).data || [];
  mark('feed_post_visible', feed.some(p => p.id === post.id), '(B sees A\'s post)');

  // 2-5. ENGAGEMENT from B on A
  await B.profiles.follow(meA.id);
  await B.posts.react(post.id, 'upvote');
  const reply = (await B.posts.create({ content:'nice', reply_to_id: post.id, organization_id: ORG_ID })).data;
  const repost = (await B.posts.create({ content:'', reposted_from_id: post.id, organization_id: ORG_ID })).data;

  // REPLY visible on A's post
  await sleep(800);
  const detail = (await A.posts.get(post.id)).data;
  mark('reply_visible', (detail.replies||[]).some(r => r.id === reply.id) || (detail.reply_count||0) >= 1, '(reply on post)');

  // COUNTS
  const meAafter = (await A.profiles.getByUsername(meA.username)).data;
  mark('follower_count', (meAafter.followers_count ?? meAafter.followersCount ?? 0) >= 1);
  mark('repost_count', (detail.reposts_count ?? 0) >= 1);
  mark('vote_count', (detail.score ?? detail.vote_count ?? 0) >= 1);

  // 6. DM unread: A DMs B -> B's conversation list shows unread_count
  const dm = (await A.chat.dm({ user_id: meB.id, organization_id: ORG_ID })).data;
  await A.chat.send({ conversation_id: dm.id, content: 'hey' });
  await sleep(1500);
  const convosB = (await B.chat.conversations({ limit: 20, organization_id: ORG_ID })).data || [];
  const dmConv = convosB.find(cv => cv.id === dm.id);
  mark('dm_unread', (dmConv?.unread_count ?? 0) >= 1, `(unread_count=${dmConv?.unread_count})`);

  // 7. NOTIFICATIONS: A should have follow + reaction + reply + repost
  let types = [];
  for (let i=0;i<6;i++){ await sleep(2000); types = ((await A.notifications.list({limit:40})).data||[]).map(n=>(n.targetType||n.target_type||'').toLowerCase()); if (types.length>=3) break; }
  mark('notif_follow', types.some(t=>t.includes('follow')));
  mark('notif_vote', types.some(t=>t.includes('reaction')||t.includes('vote')));
  mark('notif_reply', types.some(t=>t.includes('reply')));
  mark('notif_repost', types.some(t=>t.includes('repost')));

  console.log('\n==== X/BLUESKY BASIC PARITY SCORECARD ====');
  for (const [k,v] of Object.entries(results)) console.log(`  ${v.startsWith('PASS')?'✅':'❌'} ${k.padEnd(20)} ${v}`);
  const fails = Object.values(results).filter(v=>v.startsWith('FAIL')).length;
  console.log(`\n  ${fails===0?'ALL PASS':fails+' FAILED'} (${Object.keys(results).length} checks)`);

  // cleanup
  for (const fn of [()=>B.profiles.unfollow(meA.id),()=>B.posts.delete(reply.id),()=>B.posts.delete(repost.id),()=>A.posts.delete(post.id),()=>A.chat.deleteConversation(dm.id)]) { try{await fn();}catch{} }

  // Non-zero exit on any failed check, so CI / synthetic monitoring alerts.
  if (fails > 0) process.exit(1);
} catch (err) {
  console.error('PARITY ERROR:', err?.message||err, err?.status||'', JSON.stringify(err?.body||''));
  process.exit(1);
}
