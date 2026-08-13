import { askAI } from './aiClient';
import { getFeatureRow, updateFeatureStatus, getFeaturesByStatus } from './googleAuth';
import {
  SignoffEntry, getAllSignoffEntries, addSignoffEntry, saveSignoffEntry,
  getEntriesForFeature, findByPMThread, findOwnerEntry, getCurrentRound,
  hasActiveSignoff, initSignoffTabs, getOwnerMappings,
} from './signoffSheet';
import {
  postMessage, updateMessage, openModal, getDMChannel, resolveUserIdByName,
} from './slackClient';

const SIGNOFF_CHANNEL = () => process.env.SIGNOFF_CHANNEL ?? '';
const PM_SLACK_ID = () => process.env.PM_SLACK_HANDLE ?? '';

// Reminder thresholds — override via env vars for testing (in ms)
// Defaults: Reminder 1 after 24h, Reminder 2 after 12h, Escalation after 12h
const REMINDER_1_MS = parseInt(process.env.REMINDER_1_MS ?? String(24 * 60 * 60 * 1000), 10);
const REMINDER_2_MS = parseInt(process.env.REMINDER_2_MS ?? String(12 * 60 * 60 * 1000), 10);
const ESCALATION_MS = parseInt(process.env.ESCALATION_MS ?? String(12 * 60 * 60 * 1000), 10);

export interface ActionContext {
  featureName: string;
  track: string;
  ownerSlackId: string;
  ownerName: string;
  ownerMention: string;
  round: string;
  channelId: string;
  parentThreadTs: string;
  threadTs: string;
  msgTs: string;
  pmSlackId: string;
  pmDmChannel: string;
  prdUrl: string;
}

// ── Block Kit builders ─────────────────────────────────────────────────────────

function prdReviewBlocks(ctx: ActionContext): Record<string, unknown>[] {
  const prdLine = ctx.prdUrl ? `\n*PRD:* <${ctx.prdUrl}|View PRD>` : '';
  const ctxStr = JSON.stringify(ctx);
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${ctx.featureName} — Sign-off request*\n${ctx.ownerMention}, you're the *${ctx.track}* owner.\n\n*Step 1 of 2 — PRD Review*\nHave you reviewed the PRD?${prdLine}`,
      },
    },
    {
      type: 'actions',
      elements: [
        { type: 'button', action_id: 'prd_reviewed_yes', style: 'primary',
          text: { type: 'plain_text', text: '✅  Yes, I\'ve reviewed it' },
          value: ctxStr },
        { type: 'button', action_id: 'prd_reviewed_wait',
          text: { type: 'plain_text', text: '⏳  Need more time' },
          value: ctxStr },
      ],
    },
  ];
}

function scopeReviewBlocks(ctx: ActionContext): Record<string, unknown>[] {
  const ctxStr = JSON.stringify(ctx);
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `PRD reviewed ✓\n\n*Step 2 of 2 — Scope Sign-off*\nBy confirming below, you are signing off on the scope defined in the PRD. This means:\n• You commit to building what is documented\n• You will flag any scope deviations before or during implementation\n• You will deliver within the timeline you provide below\n\n*Do you sign off on this scope?*`,
      },
    },
    {
      type: 'actions',
      elements: [
        { type: 'button', action_id: 'scope_signoff_yes', style: 'primary',
          text: { type: 'plain_text', text: '✅  I sign off' },
          value: ctxStr },
        { type: 'button', action_id: 'scope_signoff_concerns', style: 'danger',
          text: { type: 'plain_text', text: '⚠️  I have concerns' },
          value: ctxStr },
      ],
    },
  ];
}

function reminder1Blocks(ownerMention: string, featureName: string, track: string, round: string): Record<string, unknown>[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔔 *Reminder — sign-off pending*\n${ownerMention}, your sign-off for *${featureName}* is still pending. Please respond in this thread when you get a chance.`,
      },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${track} · Round ${round} · 24h since request was sent` }],
    },
  ];
}

function reminder2Blocks(ownerMention: string, featureName: string, track: string, round: string): Record<string, unknown>[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ *Second reminder — sign-off still needed*\n${ownerMention}, this is your second reminder for *${featureName}*. If there's no response soon, the PM will be notified to escalate.`,
      },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${track} · Round ${round} · 48h since request was sent` }],
    },
  ];
}

function escalationBlocks(ctx: ActionContext, ownerName: string): Record<string, unknown>[] {
  const ctxStr = JSON.stringify(ctx);
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ *${ownerName}* hasn't responded to the sign-off request for *${ctx.featureName}* (${ctx.track}) after 2 reminders over 48 hours.\n\nWhat would you like to do?`,
      },
    },
    {
      type: 'actions',
      elements: [
        { type: 'button', action_id: 'escalate_to_manager',
          text: { type: 'plain_text', text: '📢  Escalate to manager' }, value: ctxStr },
        { type: 'button', action_id: 'escalate_resend',
          text: { type: 'plain_text', text: '🔁  Resend request' }, value: ctxStr },
        { type: 'button', action_id: 'escalate_direct',
          text: { type: 'plain_text', text: '✋  I\'ll handle it directly' }, value: ctxStr },
      ],
    },
  ];
}

// ── Feature name fuzzy resolver ────────────────────────────────────────────────

function normFeat(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function featMatchScore(input: string, candidate: string): number {
  const a = normFeat(input);
  const b = normFeat(candidate);
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.9;
  const aWords = new Set(a.split(' '));
  const bWords = b.split(' ');
  const hits = bWords.filter(w => aWords.has(w)).length;
  return hits / Math.max(aWords.size, bWords.length);
}

// Returns the canonical feature name from sheet/signoffs that best matches the
// user's input, or null if nothing scores above 0.4.
async function resolveFeatureName(input: string): Promise<{ name: string; close: boolean } | null> {
  const [signoffEntries, { initiatives }] = await Promise.all([
    getAllSignoffEntries(),
    fetchInitiatives(),
  ]);
  const candidates = new Set<string>();
  for (const e of signoffEntries) if (e.featureName) candidates.add(e.featureName);
  for (const i of initiatives) if (i.title) candidates.add(i.title);

  let best: string | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = featMatchScore(input, c);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (!best || bestScore < 0.4) return null;
  return { name: best, close: bestScore < 1 };
}

// ── Initiate sign-off ──────────────────────────────────────────────────────────

export async function startSignoff(
  featureName: string,
  initiatorSlackId: string,
  isQA = false,
  responseUrl?: string,
): Promise<void> {
  await initSignoffTabs();

  const postError = async (msg: string) => {
    if (responseUrl) await postToResponseUrl(responseUrl, msg, true);
    else {
      const dmCh = await getDMChannel(initiatorSlackId);
      if (dmCh) await postMessage(dmCh, msg);
    }
  };

  const resolved = await resolveFeatureName(featureName);
  if (!resolved) {
    await postError(`Couldn't find a feature matching *${featureName}* in the sheet. Check the name and try again.`);
    return;
  }
  if (resolved.close) {
    await postError(`_Interpreted as *${resolved.name}* — proceeding…_`);
  }
  featureName = resolved.name;

  if (await hasActiveSignoff(featureName)) {
    await postError(`A sign-off flow is already active for *${featureName}*. Use \`/archie-rescope\` to restart it.`);
    return;
  }

  const featureData = await getFeatureRow(featureName);
  if (!featureData) {
    await postError(`Couldn't find *${featureName}* in the sheet. Check the exact name and try again.`);
    return;
  }

  const tracks: Array<{ track: string; ownerName: string }> = [];
  if (!isQA) {
    if (featureData.designOwner) tracks.push({ track: 'Design', ownerName: featureData.designOwner });
    if (featureData.beOwner) tracks.push({ track: 'BE', ownerName: featureData.beOwner });
    if (featureData.feOwner) tracks.push({ track: 'FE', ownerName: featureData.feOwner });
  }
  if (featureData.qaOwner) tracks.push({ track: 'QA', ownerName: featureData.qaOwner });

  if (tracks.length === 0) {
    await postError(`No owners found for *${featureName}* in the sheet. Please fill in the owner columns first.`);
    return;
  }

  await updateFeatureStatus(featureName, 'Ready for Eng Review');

  const channel = SIGNOFF_CHANNEL();
  if (!channel) {
    await postError('`SIGNOFF_CHANNEL` env var is not set. Ask your admin to configure it.');
    return;
  }

  if (isQA) {
    const round = String(await getCurrentRound(featureName) + 1);
    const parentTs = await postMessage(channel, `Dev is complete on *${featureName}*. Initiating QA sign-off.`);
    if (!parentTs) return;
    await postOwnerThreads(featureName, tracks, round, channel, parentTs, initiatorSlackId, featureData.prdUrl);
    return;
  }

  // Save COORDINATOR row
  const round = String((await getCurrentRound(featureName)) + 1);
  const coordinator: SignoffEntry = {
    featureName, track: 'COORDINATOR',
    ownerName: tracks.map(t => t.ownerName).join(', '),
    ownerSlackId: '', status: 'Awaiting PM Confirmation',
    manDays: '', committedDate: '', signoffDate: '', concerns: '',
    round, channelId: channel,
    parentThreadTs: '', ownerThreadTs: '', pmSlackId: initiatorSlackId,
    pmDmChannel: '', pmDmThreadTs: '',
    initiatedAt: new Date().toISOString(), lastRemindedAt: '',
    reminderCount: '0', awaitingInput: '',
    metadata: JSON.stringify({ prdUrl: featureData.prdUrl, tracks }),
    rowIndex: 0,
  };
  await addSignoffEntry(coordinator);

  // Post ephemeral confirmation in channel (only visible to PM)
  const ownerLines = tracks.map(t => `— *${t.track}:* ${t.ownerName}`).join('\n');
  const prdLine = featureData.prdUrl ? `\n— *PRD:* <${featureData.prdUrl}|View PRD>` : '';
  const confirmCtx = JSON.stringify({ featureName, round, pmSlackId: initiatorSlackId, channelId: channel, prdUrl: featureData.prdUrl, tracks });
  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `📋 *Starting sign-off for: ${featureName}*\n\nHere's who I'll send sign-off requests to:\n${ownerLines}${prdLine}\n\nConfirm to proceed.` },
    },
    {
      type: 'actions',
      elements: [
        { type: 'button', action_id: 'confirm_signoff', style: 'primary',
          text: { type: 'plain_text', text: '✅  Confirm & send' }, value: confirmCtx },
        { type: 'button', action_id: 'cancel_signoff',
          text: { type: 'plain_text', text: '✖  Cancel' }, value: confirmCtx },
      ],
    },
  ];

  if (responseUrl) {
    await postToResponseUrl(responseUrl, '', false, blocks);
  } else {
    // Fallback: ephemeral via API
    const token = process.env.SLACK_BOT_TOKEN;
    await fetch('https://slack.com/api/chat.postEphemeral', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, user: initiatorSlackId, text: `Sign-off confirmation for ${featureName}`, blocks }),
    });
  }
}

async function postToResponseUrl(
  url: string,
  text: string,
  isError = false,
  blocks?: Record<string, unknown>[],
): Promise<void> {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      response_type: 'ephemeral',
      replace_original: false,
      text: text || undefined,
      blocks: blocks || undefined,
      ...(isError ? { text } : {}),
    }),
  });
}

export async function handleConfirmSignoff(rawCtx: string): Promise<void> {
  let data: { featureName: string; round: string; pmSlackId: string; channelId: string; prdUrl: string; tracks: Array<{ track: string; ownerName: string }> };
  try { data = JSON.parse(rawCtx); } catch { return; }

  // Update coordinator to Confirmed
  const entries = await import('./signoffSheet').then(m => m.getAllSignoffEntries());
  const coordinator = entries.find(e =>
    e.featureName.toLowerCase() === data.featureName.toLowerCase() &&
    e.track === 'COORDINATOR' && e.round === data.round
  );
  if (coordinator) {
    coordinator.status = 'Confirmed';
    await import('./signoffSheet').then(m => m.saveSignoffEntry(coordinator));
  }

  const parentTs = await postMessage(data.channelId,
    `📋 *Sign-off initiated: ${data.featureName}*\nRequesting sign-off from ${data.tracks.map(t => t.ownerName).join(', ')}\nEach owner has a dedicated thread below.`,
  );
  if (!parentTs) return;

  if (coordinator) {
    coordinator.parentThreadTs = parentTs;
    await import('./signoffSheet').then(m => m.saveSignoffEntry(coordinator));
  }

  await postOwnerThreads(data.featureName, data.tracks, data.round, data.channelId, parentTs, data.pmSlackId, data.prdUrl);
}

export async function handleCancelSignoff(rawCtx: string): Promise<void> {
  let data: { featureName: string; round: string };
  try { data = JSON.parse(rawCtx); } catch { return; }
  const entries = await import('./signoffSheet').then(m => m.getAllSignoffEntries());
  const coordinator = entries.find(e =>
    e.featureName.toLowerCase() === data.featureName.toLowerCase() &&
    e.track === 'COORDINATOR' && e.round === data.round
  );
  if (coordinator) {
    coordinator.status = 'Cancelled';
    await import('./signoffSheet').then(m => m.saveSignoffEntry(coordinator));
  }
}

// ── PM Confirmation ────────────────────────────────────────────────────────────

export async function handlePMConfirmation(
  pmDmChannel: string,
  pmDmThreadTs: string,
  replyText: string,
): Promise<boolean> {
  const coordinator = await findByPMThread(pmDmChannel, pmDmThreadTs);
  if (!coordinator) return false; // not a sign-off confirmation thread

  if (coordinator.status === 'Confirmed') {
    await postMessage(pmDmChannel, '_Already confirmed — sign-off is underway._', { threadTs: pmDmThreadTs });
    return true;
  }

  let parsed: { swaps: Array<{ track: string; newOwner: string }>; additions: Array<{ track: string; ownerName: string }>; updateSheet: boolean } = {
    swaps: [], additions: [], updateSheet: false,
  };

  const systemPrompt = `You parse PM replies about engineering sign-off approvals.
Return ONLY valid JSON — no markdown, no explanation:
{
  "swaps": [{"track": "BE", "newOwner": "Arun"}],
  "additions": [{"track": "Cross-team", "ownerName": "Ravi Sharma"}],
  "updateSheet": false
}
Track values: Design, BE, FE, QA, Cross-team.
If the message is just a confirmation (ok / confirmed / proceed / yes / go ahead), return exactly: {"swaps":[],"additions":[],"updateSheet":false}`;

  try {
    const raw = await askAI(systemPrompt, replyText, 300);
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    // Non-parseable reply — treat as plain confirmation
  }

  // Apply swaps to metadata
  let meta: { prdUrl: string; tracks: Array<{ track: string; ownerName: string }> };
  try { meta = JSON.parse(coordinator.metadata); } catch { meta = { prdUrl: '', tracks: [] }; }

  for (const swap of (parsed.swaps ?? [])) {
    const idx = meta.tracks.findIndex(t => t.track.toLowerCase() === swap.track.toLowerCase());
    if (idx >= 0) meta.tracks[idx].ownerName = swap.newOwner;
  }
  for (const add of (parsed.additions ?? [])) {
    meta.tracks.push({ track: add.track || 'Cross-team', ownerName: add.ownerName });
  }

  // Update coordinator
  coordinator.status = 'Confirmed';
  coordinator.metadata = JSON.stringify(meta);
  await saveSignoffEntry(coordinator);

  await postMessage(pmDmChannel, `✓ Confirmed. Posting sign-off requests for *${coordinator.featureName}*.`, { threadTs: pmDmThreadTs });

  // Post the sign-off thread
  const channel = coordinator.channelId || SIGNOFF_CHANNEL();
  if (!channel) { console.error('[Signoff] No SIGNOFF_CHANNEL'); return true; }

  const parentTs = await postMessage(
    channel,
    `📋 *Sign-off initiated: ${coordinator.featureName}*\nRequesting sign-off from ${meta.tracks.map(t => t.ownerName).join(', ')}\nEach owner has a dedicated thread below.`,
  );
  if (!parentTs) return true;

  // Update coordinator with parentThreadTs
  coordinator.parentThreadTs = parentTs;
  await saveSignoffEntry(coordinator);

  await postOwnerThreads(
    coordinator.featureName, meta.tracks, coordinator.round,
    channel, parentTs, coordinator.pmSlackId, meta.prdUrl,
  );
  return true;
}

// ── Post per-owner threads ─────────────────────────────────────────────────────

async function postOwnerThreads(
  featureName: string,
  tracks: Array<{ track: string; ownerName: string }>,
  round: string,
  channelId: string,
  parentThreadTs: string,
  pmSlackId: string,
  prdUrl: string,
): Promise<void> {
  const pmDmChannel = await getDMChannel(pmSlackId);

  for (const { track, ownerName } of tracks) {
    // 1. Check Escalation Matrix for explicit Slack handle/ID mapping
    const mappings = await getOwnerMappings(ownerName);
    let resolvedId: string | null = null;
    if (mappings.slackHandle) {
      const handle = mappings.slackHandle.trim();
      // If it's already a Slack user ID (starts with U + alphanumeric), use directly
      if (/^U[A-Z0-9]+$/i.test(handle)) {
        resolvedId = handle;
      } else {
        resolvedId = await resolveUserIdByName(handle.replace('@', ''));
      }
    }
    // 2. Fall back to fuzzy name match
    if (!resolvedId) resolvedId = await resolveUserIdByName(ownerName);
    const ownerSlackId = resolvedId ?? ownerName;
    const ownerMention = resolvedId ? `<@${resolvedId}>` : ownerName;

    const ctx: ActionContext = {
      featureName, track, ownerSlackId, ownerName, ownerMention, round,
      channelId, parentThreadTs, threadTs: '', msgTs: '',
      pmSlackId, pmDmChannel: pmDmChannel ?? '',
      prdUrl: prdUrl ?? '',
    };

    // Post into the parent thread — this reply's ts becomes the owner's sub-thread ts
    const threadLabel = `Sign-off request — ${ownerMention} (${track})`;
    const ownerTs = await postMessage(channelId, threadLabel, {
      blocks: prdReviewBlocks({ ...ctx, threadTs: parentThreadTs, msgTs: '' }),
      threadTs: parentThreadTs,
    });
    if (!ownerTs) continue;

    ctx.threadTs = ownerTs;
    ctx.msgTs = ownerTs;

    // Update button values with correct threadTs/msgTs by editing the message
    await updateMessage(channelId, ownerTs, threadLabel,
      prdReviewBlocks({ ...ctx, msgTs: ownerTs }),
    );

    const entry: SignoffEntry = {
      featureName, track, ownerName, ownerSlackId, status: 'PRD Review',
      manDays: '', committedDate: '', signoffDate: '', concerns: '',
      round, channelId, parentThreadTs, ownerThreadTs: ownerTs,
      pmSlackId, pmDmChannel: pmDmChannel ?? '',
      pmDmThreadTs: '',
      initiatedAt: new Date().toISOString(), lastRemindedAt: '',
      reminderCount: '0', awaitingInput: '',
      metadata: JSON.stringify({ prdUrl }),
      rowIndex: 0,
    };
    await addSignoffEntry(entry);
  }
}

// ── Handle interactive button clicks ──────────────────────────────────────────

export async function handleButtonAction(
  actionId: string,
  rawCtx: string,
  triggerId: string,
): Promise<void> {
  let ctx: ActionContext;
  try { ctx = JSON.parse(rawCtx); } catch { return; }
  // Back-compat: ownerMention may be missing in old button payloads
  if (!ctx.ownerMention) ctx.ownerMention = ctx.ownerSlackId?.startsWith('U') ? `<@${ctx.ownerSlackId}>` : ctx.ownerName;

  if (actionId === 'prd_reviewed_yes') {
    await updateMessage(ctx.channelId, ctx.msgTs, `${ctx.ownerMention} (${ctx.track}) — PRD reviewed ✓`, scopeReviewBlocks({ ...ctx, msgTs: ctx.msgTs }));
    const entry = await findOwnerEntry(ctx.featureName, ctx.ownerSlackId, ctx.round) ?? entryFromCtx(ctx);
    entry.status = 'Scope Review';
    await saveSignoffEntry(entry);

  } else if (actionId === 'prd_reviewed_wait') {
    await updateMessage(ctx.channelId, ctx.msgTs,
      `${ctx.ownerMention} (${ctx.track}) — ⏳ No problem, I'll check back in 24 hours.`,
    );
    const entry = await findOwnerEntry(ctx.featureName, ctx.ownerSlackId, ctx.round) ?? entryFromCtx(ctx);
    entry.status = 'PRD Wait';
    await saveSignoffEntry(entry);

  } else if (actionId === 'scope_signoff_yes') {
    // Open modal to collect man-days + date
    await openModal(triggerId, {
      type: 'modal',
      callback_id: 'signoff_mandays_modal',
      private_metadata: JSON.stringify(ctx),
      title: { type: 'plain_text', text: 'Sign Off Details' },
      submit: { type: 'plain_text', text: 'Submit' },
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*Sign off on scope recorded ✓*\n\nTwo questions before we\'re done:' },
        },
        {
          type: 'input', block_id: 'man_days_block',
          label: { type: 'plain_text', text: 'Man-days estimate' },
          hint: { type: 'plain_text', text: 'Account for sprint workload and QA buffer — do not use sprint end date without factoring these in.' },
          element: { type: 'plain_text_input', action_id: 'man_days_input', placeholder: { type: 'plain_text', text: 'e.g. 8' } },
        },
        {
          type: 'input', block_id: 'committed_date_block',
          label: { type: 'plain_text', text: 'Committed delivery date' },
          hint: { type: 'plain_text', text: 'DD Mon, e.g. 28 Apr — includes QA handoff buffer.' },
          element: { type: 'plain_text_input', action_id: 'committed_date_input', placeholder: { type: 'plain_text', text: '28 Apr' } },
        },
      ],
    });

  } else if (actionId === 'scope_signoff_concerns') {
    await openModal(triggerId, {
      type: 'modal',
      callback_id: 'signoff_concern_modal',
      private_metadata: JSON.stringify(ctx),
      title: { type: 'plain_text', text: 'Raise a Concern' },
      submit: { type: 'plain_text', text: 'Submit' },
      blocks: [
        {
          type: 'input', block_id: 'concern_block',
          label: { type: 'plain_text', text: 'Describe your concern' },
          element: { type: 'plain_text_input', action_id: 'concern_input', multiline: true,
            placeholder: { type: 'plain_text', text: 'I\'m concerned about...' } },
        },
      ],
    });

  } else if (actionId === 'escalate_to_manager') {
    const matrix = await import('./signoffSheet').then(m => m.readEscalationMatrix());
    const managerHandle = matrix[ctx.ownerName.toLowerCase()] ?? null;
    const entry = await findOwnerEntry(ctx.featureName, ctx.ownerSlackId, ctx.round);
    if (entry) { entry.status = 'Escalated'; await saveSignoffEntry(entry); }

    if (managerHandle) {
      const managerId = await resolveUserIdByName(managerHandle.replace('@', '')) ?? managerHandle;
      await postMessage(ctx.channelId,
        `⚠️ Escalated to <@${managerId}>.\n<@${managerHandle}> — this sign-off request has been escalated to you. <@${ctx.ownerSlackId}> has not responded after 2 reminders over 48 hours.\n<@${ctx.ownerSlackId}> please complete your sign-off in this thread when ready — the button is still active above.`,
        { threadTs: ctx.threadTs },
      );
    } else {
      await postMessage(ctx.channelId, `⚠️ Escalated — no manager found in Escalation Matrix for ${ctx.ownerName}.`, { threadTs: ctx.threadTs });
    }

    // Notify PM
    if (ctx.pmDmChannel) {
      await postMessage(ctx.pmDmChannel, `Escalated *${ctx.featureName}* (${ctx.track}) to ${managerHandle ?? 'unknown manager'}.`);
    }

  } else if (actionId === 'escalate_resend') {
    const entry = await findOwnerEntry(ctx.featureName, ctx.ownerSlackId, ctx.round);
    if (entry) {
      entry.lastRemindedAt = '';
      entry.reminderCount = '0';
      entry.status = 'PRD Review';
      await saveSignoffEntry(entry);
    }
    const newMsgTs = await postMessage(ctx.channelId, `Sign-off request resent for ${ctx.ownerName} (${ctx.track})`, {
      blocks: prdReviewBlocks({ ...ctx, msgTs: '' }),
      threadTs: ctx.threadTs,
    });
    if (newMsgTs) {
      await updateMessage(ctx.channelId, newMsgTs, `Sign-off request for ${ctx.ownerName} (${ctx.track})`,
        prdReviewBlocks({ ...ctx, msgTs: newMsgTs }),
      );
    }

  } else if (actionId === 'escalate_direct') {
    if (ctx.pmDmChannel) await postMessage(ctx.pmDmChannel, `Got it — you'll handle *${ctx.featureName}* (${ctx.track}) with ${ctx.ownerName} directly. I'll stop following up.`);
    const entry = await findOwnerEntry(ctx.featureName, ctx.ownerSlackId, ctx.round);
    if (entry) { entry.status = 'Awaiting Escalation Decision'; await saveSignoffEntry(entry); }
  }
}

function entryFromCtx(ctx: ActionContext): SignoffEntry {
  return {
    featureName: ctx.featureName, track: ctx.track,
    ownerName: ctx.ownerName, ownerSlackId: ctx.ownerSlackId,
    status: '', manDays: '', committedDate: '', signoffDate: '', concerns: '',
    round: ctx.round, channelId: ctx.channelId,
    parentThreadTs: ctx.parentThreadTs, ownerThreadTs: ctx.threadTs,
    pmSlackId: ctx.pmSlackId, pmDmChannel: ctx.pmDmChannel, pmDmThreadTs: '',
    initiatedAt: new Date().toISOString(), lastRemindedAt: '',
    reminderCount: '0', awaitingInput: '',
    metadata: JSON.stringify({ prdUrl: ctx.prdUrl }),
    rowIndex: 0,
  };
}

// ── Handle modal submissions ───────────────────────────────────────────────────

export async function handleModalSubmit(
  callbackId: string,
  viewValues: Record<string, Record<string, { value?: string; selected_date?: string }>>,
  privateMeta: string,
): Promise<void> {
  let ctx: ActionContext;
  try { ctx = JSON.parse(privateMeta); } catch { return; }
  if (!ctx.ownerMention) ctx.ownerMention = ctx.ownerSlackId?.startsWith('U') ? `<@${ctx.ownerSlackId}>` : ctx.ownerName;

  if (callbackId === 'signoff_mandays_modal') {
    const manDays = viewValues['man_days_block']?.['man_days_input']?.value?.trim() ?? '';
    const date = viewValues['committed_date_block']?.['committed_date_input']?.value?.trim() ?? '';

    let entry = await findOwnerEntry(ctx.featureName, ctx.ownerSlackId, ctx.round);
    if (!entry) entry = entryFromCtx(ctx);
    entry.manDays = manDays;
    entry.committedDate = date;
    entry.signoffDate = new Date().toISOString().split('T')[0];
    entry.status = 'Signed Off';
    await saveSignoffEntry(entry);

    // Replace the scope sign-off buttons with a static completion state
    await updateMessage(ctx.channelId, ctx.msgTs, `${ctx.ownerMention} (${ctx.track}) — Scope signed off ✅\nLogged — *${manDays}* man-days, delivery by *${date}*.`);
    await checkCompletion(ctx.featureName, ctx.round, ctx.channelId, ctx.parentThreadTs, ctx.pmSlackId, ctx.pmDmChannel);

  } else if (callbackId === 'signoff_concern_modal') {
    const concernText = viewValues['concern_block']?.['concern_input']?.value?.trim() ?? '';

    let entry = await findOwnerEntry(ctx.featureName, ctx.ownerSlackId, ctx.round);
    if (!entry) entry = entryFromCtx(ctx);
    entry.concerns = concernText;
    entry.status = 'Concern Raised';
    await saveSignoffEntry(entry);

    // Replace the scope sign-off buttons with a static paused state
    await updateMessage(ctx.channelId, ctx.msgTs,
      `${ctx.ownerMention} (${ctx.track}) — ⚠️ Concern raised. Sign-off is paused until resolved.\n_"${concernText}"_\nThe PM has been notified — you'll complete sign-off here once it's sorted.`,
    );

    await updateFeatureStatus(ctx.featureName, 'Concern Raised');

    if (ctx.pmDmChannel) {
      await postMessage(ctx.pmDmChannel,
        `<@${ctx.pmSlackId}> — <@${ctx.ownerSlackId}> has raised a concern on *${ctx.featureName}* (${ctx.track}):\n\n_"${concernText}"_\n\nSign-off is paused for this owner. Reply here to resolve, or discuss directly with them first.`,
      );
    }
  }
}

// ── Check completion ───────────────────────────────────────────────────────────

async function checkCompletion(
  featureName: string,
  round: string,
  channelId: string,
  parentThreadTs: string,
  pmSlackId: string,
  pmDmChannel: string,
): Promise<void> {
  const entries = await getEntriesForFeature(featureName, round);
  const ownerEntries = entries.filter(e => e.track !== 'COORDINATOR');
  if (ownerEntries.length === 0) return;

  // Deduplicate by track — use the latest entry (highest rowIndex) per track
  const latestByTrack = new Map<string, SignoffEntry>();
  for (const e of ownerEntries) {
    const existing = latestByTrack.get(e.track);
    if (!existing || e.rowIndex > existing.rowIndex) latestByTrack.set(e.track, e);
  }
  const latest = Array.from(latestByTrack.values());

  const allSigned = latest.every(e => e.status === 'Signed Off');
  if (!allSigned) return;

  const summary = latest
    .map(e => `— *${e.track}:* ${e.ownerName} · ${e.manDays} days · delivery ${e.committedDate} ✓`)
    .join('\n');

  await postMessage(channelId,
    `✅ *Sign-off complete: ${featureName}*\n${summary}\n\nFeature is cleared for dev. Sheet updated.`,
    { threadTs: parentThreadTs },
  );

  await updateFeatureStatus(featureName, 'Eng Signed Off');

  if (pmDmChannel) {
    await postMessage(pmDmChannel,
      `Sign-off complete for *${featureName}*. All owners confirmed. Sheet updated to Eng Signed Off.`,
    );
  }
}

// ── Rescope ────────────────────────────────────────────────────────────────────

export async function handleRescope(featureName: string, reason: string, tracksFilter?: string[]): Promise<void> {
  const resolved = await resolveFeatureName(featureName);
  if (resolved) featureName = resolved.name;

  const entries = await getEntriesForFeature(featureName);
  // Use the most recent coordinator (highest round)
  const coordinator = entries
    .filter(e => e.track === 'COORDINATOR')
    .sort((a, b) => parseInt(b.round, 10) - parseInt(a.round, 10))[0];
  if (!coordinator) return;

  const oldRound = coordinator.round;
  const newRound = String(parseInt(oldRound, 10) + 1);

  // Mark old entries as Superseded
  for (const e of entries.filter(e => e.track !== 'COORDINATOR' && e.round === oldRound)) {
    e.status = 'Superseded';
    await saveSignoffEntry(e);
  }

  // Post notice in parent thread
  if (coordinator.channelId && coordinator.parentThreadTs) {
    await postMessage(coordinator.channelId,
      `⚠️ *Scope revision: ${featureName}*\nReason: ${reason}\n${tracksFilter ? `Tracks affected: ${tracksFilter.join(', ')}` : 'All previous sign-offs are now void'}. A fresh sign-off round will begin — owners will be re-requested in their existing threads.`,
      { threadTs: coordinator.parentThreadTs },
    );
  }

  // Re-initiate for existing owners in their existing threads
  let meta: { prdUrl: string; tracks: Array<{ track: string; ownerName: string }> };
  try { meta = JSON.parse(coordinator.metadata); } catch { meta = { prdUrl: '', tracks: [] }; }

  // If metadata tracks are missing or incomplete, rebuild from the feature sheet
  if (!meta.tracks || meta.tracks.length === 0) {
    const featureData = await getFeatureRow(featureName);
    if (featureData) {
      meta.tracks = [];
      if (featureData.designOwner) meta.tracks.push({ track: 'Design', ownerName: featureData.designOwner });
      if (featureData.beOwner) meta.tracks.push({ track: 'BE', ownerName: featureData.beOwner });
      if (featureData.feOwner) meta.tracks.push({ track: 'FE', ownerName: featureData.feOwner });
      if (featureData.qaOwner) meta.tracks.push({ track: 'QA', ownerName: featureData.qaOwner });
      if (!meta.prdUrl) meta.prdUrl = featureData.prdUrl;
    }
  }

  coordinator.round = newRound;
  coordinator.status = 'Confirmed';
  await saveSignoffEntry(coordinator);
  await updateFeatureStatus(featureName, 'Ready for Eng Review');

  // Build lookup of existing sheet entries by track for ownerThreadTs/channelId
  const allOwnerEntries = entries.filter(e => e.track !== 'COORDINATOR');
  const latestByTrack = new Map<string, SignoffEntry>();
  for (const e of allOwnerEntries) {
    const existing = latestByTrack.get(e.track);
    if (!existing || e.rowIndex > existing.rowIndex) latestByTrack.set(e.track, e);
  }

  // Use meta.tracks as the source of truth — ensures all owners are included even if sheet entries are missing
  const tracksToRescope = meta.tracks.filter(t =>
    !tracksFilter || tracksFilter.map(f => f.toLowerCase()).includes(t.track.toLowerCase())
  );

  for (const { track, ownerName } of tracksToRescope) {
    const old = latestByTrack.get(track);
    const mappings = await getOwnerMappings(ownerName);
    let resolvedId: string | null = null;
    if (mappings.slackHandle) {
      const handle = mappings.slackHandle.trim();
      resolvedId = /^U[A-Z0-9]+$/i.test(handle) ? handle : await resolveUserIdByName(handle.replace('@', ''));
    }
    if (!resolvedId && old?.ownerSlackId.startsWith('U')) resolvedId = old.ownerSlackId;
    const ownerSlackId = resolvedId ?? ownerName;
    const ownerMention = resolvedId ? `<@${resolvedId}>` : ownerName;
    const channelId = old?.channelId || coordinator.channelId;
    const parentThreadTs = old?.parentThreadTs || coordinator.parentThreadTs;
    const ownerThreadTs = old?.ownerThreadTs || '';
    const ctx: ActionContext = {
      featureName, track, ownerSlackId, ownerName,
      ownerMention,
      round: newRound, channelId, parentThreadTs,
      threadTs: ownerThreadTs, msgTs: '', pmSlackId: coordinator.pmSlackId,
      pmDmChannel: coordinator.pmDmChannel, prdUrl: meta.prdUrl,
    };
    const newMsgTs = await postMessage(channelId,
      `Round ${newRound} sign-off request for ${ownerName} (${track})`,
      { blocks: prdReviewBlocks({ ...ctx, msgTs: '' }), threadTs: ownerThreadTs || parentThreadTs },
    );
    if (newMsgTs) {
      await updateMessage(channelId, newMsgTs, `Sign-off request for ${ownerName} (${track})`,
        prdReviewBlocks({ ...ctx, msgTs: newMsgTs }),
      );
    }
    const newEntry: SignoffEntry = {
      ...(old ?? entryFromCtx(ctx)), round: newRound, status: 'PRD Review',
      manDays: '', committedDate: '', signoffDate: '', concerns: '',
      initiatedAt: new Date().toISOString(), lastRemindedAt: '', reminderCount: '0',
      rowIndex: 0,
    };
    await addSignoffEntry(newEntry);
  }
}

// ── Resolve concern ────────────────────────────────────────────────────────────

export async function handleResolve(featureName: string, ownerName: string): Promise<void> {
  const resolved = await resolveFeatureName(featureName);
  if (resolved) featureName = resolved.name;

  const entries = await getEntriesForFeature(featureName);
  // Accept either a Slack mention (<@U123>) or a plain name
  const slackIdMatch = ownerName.match(/^<@([A-Z0-9]+)>$/i);
  const entry = slackIdMatch
    ? entries.find(e => e.ownerSlackId === slackIdMatch[1] && e.status === 'Concern Raised')
    : entries.find(e => e.ownerName.toLowerCase() === ownerName.toLowerCase() && e.status === 'Concern Raised');
  if (!entry) {
    // Give feedback — find any entry for this feature to give a better error
    const allEntries = entries.filter(e => e.track !== 'COORDINATOR');
    const concerned = entries.filter(e => e.status === 'Concern Raised');
    const dmCh = concerned[0]?.pmDmChannel || allEntries[0]?.pmDmChannel;
    if (dmCh) {
      if (allEntries.length === 0) {
        await postMessage(dmCh, `No active sign-off found for *${featureName}*.`);
      } else if (concerned.length === 0) {
        await postMessage(dmCh, `No concerns raised for *${featureName}* — nothing to resolve.`);
      } else {
        await postMessage(dmCh, `Couldn't find a concern for *${featureName}* matching owner \`${ownerName}\`. Concerns are raised by: ${concerned.map(e => e.ownerName).join(', ')}`);
      }
    }
    return;
  }

  entry.status = 'Scope Review';
  entry.concerns = '';
  await saveSignoffEntry(entry);

  const ctx: ActionContext = {
    featureName, track: entry.track, ownerSlackId: entry.ownerSlackId, ownerName: entry.ownerName,
    ownerMention: entry.ownerSlackId.startsWith('U') ? `<@${entry.ownerSlackId}>` : entry.ownerName,
    round: entry.round, channelId: entry.channelId, parentThreadTs: entry.parentThreadTs,
    threadTs: entry.ownerThreadTs, msgTs: '', pmSlackId: entry.pmSlackId,
    pmDmChannel: entry.pmDmChannel, prdUrl: '',
  };
  const newMsgTs = await postMessage(entry.channelId,
    `The PM has resolved the concern. ${ctx.ownerMention} please proceed with your sign-off below.`,
    { blocks: scopeReviewBlocks({ ...ctx, msgTs: '' }), threadTs: entry.ownerThreadTs },
  );
  if (newMsgTs) {
    await updateMessage(entry.channelId, newMsgTs, `Scope sign-off for ${entry.ownerName}`,
      scopeReviewBlocks({ ...ctx, msgTs: newMsgTs }),
    );
  }
}

// ── Polling: reminders + auto-initiation ──────────────────────────────────────

export async function checkAndSendReminders(): Promise<void> {
  const now = Date.now();
  const entries = await getAllSignoffEntries();

  for (const entry of entries) {
    if (entry.track === 'COORDINATOR') continue;
    if (!['PRD Review', 'PRD Wait', 'Scope Review'].includes(entry.status)) continue;
    if (!entry.initiatedAt) continue;

    const initiated = new Date(entry.initiatedAt).getTime();
    const lastReminded = entry.lastRemindedAt ? new Date(entry.lastRemindedAt).getTime() : 0;
    const rc = parseInt(entry.reminderCount, 10);

    const ownerMention = entry.ownerSlackId.startsWith('U') ? `<@${entry.ownerSlackId}>` : entry.ownerName;

    if (rc === 0 && now - initiated >= REMINDER_1_MS) {
      await postMessage(entry.channelId, `Reminder: sign-off still pending for ${entry.featureName} (${entry.track})`,
        { blocks: reminder1Blocks(ownerMention, entry.featureName, entry.track, entry.round), threadTs: entry.ownerThreadTs },
      );
      entry.reminderCount = '1';
      entry.lastRemindedAt = new Date().toISOString();
      await saveSignoffEntry(entry);

    } else if (rc === 1 && lastReminded && now - lastReminded >= REMINDER_2_MS) {
      await postMessage(entry.channelId, `Second reminder: sign-off still needed for ${entry.featureName} (${entry.track})`,
        { blocks: reminder2Blocks(ownerMention, entry.featureName, entry.track, entry.round), threadTs: entry.ownerThreadTs },
      );
      entry.reminderCount = '2';
      entry.lastRemindedAt = new Date().toISOString();
      await saveSignoffEntry(entry);

    } else if (rc === 2 && lastReminded && now - lastReminded >= ESCALATION_MS) {
      // DM PM with escalation options
      if (entry.pmDmChannel) {
        const ctx: ActionContext = {
          featureName: entry.featureName, track: entry.track,
          ownerSlackId: entry.ownerSlackId, ownerName: entry.ownerName,
          ownerMention: entry.ownerSlackId.startsWith('U') ? `<@${entry.ownerSlackId}>` : entry.ownerName,
          round: entry.round, channelId: entry.channelId,
          parentThreadTs: entry.parentThreadTs, threadTs: entry.ownerThreadTs, msgTs: '',
          pmSlackId: entry.pmSlackId, pmDmChannel: entry.pmDmChannel, prdUrl: '',
        };
        await postMessage(entry.pmDmChannel,
          `<@${entry.pmSlackId}> — ${entry.ownerName} hasn't responded to the sign-off request for *${entry.featureName}* (${entry.track}) after 2 reminders over 48 hours.\n\nWhat would you like to do?`,
          { blocks: escalationBlocks(ctx, entry.ownerName) },
        );
        entry.status = 'Awaiting Escalation Decision';
        await saveSignoffEntry(entry);
      }
    }
  }
}

export async function checkNewSignoffs(): Promise<void> {
  const pmSlackId = PM_SLACK_ID();
  const channel = SIGNOFF_CHANNEL();
  if (!pmSlackId || !channel) return;

  const readyFeatures = await getFeaturesByStatus(['ready for eng review']);
  for (const featureName of readyFeatures) {
    if (await hasActiveSignoff(featureName)) continue;
    await startSignoff(featureName, pmSlackId);
  }
}
