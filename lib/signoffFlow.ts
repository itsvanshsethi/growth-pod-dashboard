import { askAI } from './aiClient';
import { getFeatureRow, updateFeatureStatus, getFeaturesByStatus } from './googleAuth';
import {
  SignoffEntry, getAllSignoffEntries, addSignoffEntry, saveSignoffEntry,
  getEntriesForFeature, findByPMThread, findOwnerEntry, getCurrentRound,
  hasActiveSignoff, getManagerHandle, initSignoffTabs,
} from './signoffSheet';
import {
  postMessage, updateMessage, openModal, getDMChannel, resolveUserIdByName, slackPost,
} from './slackClient';

const SIGNOFF_CHANNEL = () => process.env.SIGNOFF_CHANNEL ?? '';
const PM_SLACK_ID = () => process.env.PM_SLACK_HANDLE ?? '';

export interface ActionContext {
  featureName: string;
  track: string;
  ownerSlackId: string;
  ownerName: string;
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
        text: `*${ctx.featureName} — Sign-off request*\n<@${ctx.ownerSlackId}>, you're the *${ctx.track}* owner for this feature.\n\n*Step 1 of 2 — PRD Review*\nHave you reviewed the PRD?${prdLine}`,
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

// ── Initiate sign-off ──────────────────────────────────────────────────────────

export async function startSignoff(
  featureName: string,
  initiatorSlackId: string,
  isQA = false,
): Promise<void> {
  await initSignoffTabs();

  if (await hasActiveSignoff(featureName)) {
    const dmCh = await getDMChannel(initiatorSlackId);
    if (dmCh) await postMessage(dmCh, `A sign-off flow is already active for *${featureName}*. Use \`/archie rescope\` to restart it.`);
    return;
  }

  const featureData = await getFeatureRow(featureName);
  if (!featureData) {
    const dmCh = await getDMChannel(initiatorSlackId);
    if (dmCh) await postMessage(dmCh, `Couldn't find *${featureName}* in the sheet. Check the exact name and try again.`);
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
    const dmCh = await getDMChannel(initiatorSlackId);
    if (dmCh) await postMessage(dmCh, `No owners found for *${featureName}* in the sheet. Please fill in the owner columns first.`);
    return;
  }

  await updateFeatureStatus(featureName, 'Ready for Eng Review');

  if (isQA) {
    // QA sign-off skips PM confirmation — go straight to posting
    const channel = SIGNOFF_CHANNEL();
    if (!channel) {
      console.error('[Signoff] SIGNOFF_CHANNEL env var not set');
      return;
    }
    const round = String(await getCurrentRound(featureName) + 1);
    const parentTs = await postMessage(channel, `Dev is complete on *${featureName}*. Initiating QA sign-off with <@${await resolveUserIdByName(featureData.qaOwner) ?? featureData.qaOwner}>.`);
    if (!parentTs) return;
    await postOwnerThreads(featureName, tracks, round, channel, parentTs, initiatorSlackId, featureData.prdUrl);
    return;
  }

  // Engineering sign-off — DM PM for confirmation
  const pmDmChannel = await getDMChannel(initiatorSlackId);
  if (!pmDmChannel) {
    console.error('[Signoff] Could not open DM with initiator', initiatorSlackId);
    return;
  }

  const ownerLines = tracks.map(t => `— *${t.track}:* ${t.ownerName}`).join('\n');
  const prdLine = featureData.prdUrl ? `\n— *PRD:* <${featureData.prdUrl}|View PRD>` : '';

  const dmText = `📋 *Starting sign-off for: ${featureName}*\n\nHere's who I'll send sign-off requests to based on the sheet:\n${ownerLines}${prdLine}\n\nReply to confirm, swap an owner ("BE → Arun"), or add cross-team owners ("add @ravi-payments"). You can do multiple in one reply.\n\nI'll send nothing until you confirm.`;

  const dmTs = await postMessage(pmDmChannel, dmText);
  if (!dmTs) return;

  const round = String((await getCurrentRound(featureName)) + 1);
  const coordinator: SignoffEntry = {
    featureName, track: 'COORDINATOR',
    ownerName: tracks.map(t => t.ownerName).join(', '),
    ownerSlackId: '', status: 'Awaiting PM Confirmation',
    manDays: '', committedDate: '', signoffDate: '', concerns: '',
    round, channelId: SIGNOFF_CHANNEL(),
    parentThreadTs: '', ownerThreadTs: '', pmSlackId: initiatorSlackId,
    pmDmChannel, pmDmThreadTs: dmTs,
    initiatedAt: new Date().toISOString(), lastRemindedAt: '',
    reminderCount: '0', awaitingInput: '',
    metadata: JSON.stringify({ prdUrl: featureData.prdUrl, tracks: tracks.map(t => ({ track: t.track, ownerName: t.ownerName })) }),
    rowIndex: 0,
  };
  await addSignoffEntry(coordinator);
}

// ── PM Confirmation ────────────────────────────────────────────────────────────

export async function handlePMConfirmation(
  pmDmChannel: string,
  pmDmThreadTs: string,
  replyText: string,
): Promise<void> {
  const coordinator = await findByPMThread(pmDmChannel, pmDmThreadTs);
  if (!coordinator) return; // not a sign-off confirmation thread

  if (coordinator.status === 'Confirmed') {
    await postMessage(pmDmChannel, '_Already confirmed — sign-off is underway._', { threadTs: pmDmThreadTs });
    return;
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
  if (!channel) { console.error('[Signoff] No SIGNOFF_CHANNEL'); return; }

  const parentTs = await postMessage(
    channel,
    `📋 *Sign-off initiated: ${coordinator.featureName}*\nRequesting sign-off from ${meta.tracks.map(t => t.ownerName).join(', ')}\nEach owner has a dedicated thread below.`,
  );
  if (!parentTs) return;

  // Update coordinator with parentThreadTs
  coordinator.parentThreadTs = parentTs;
  await saveSignoffEntry(coordinator);

  await postOwnerThreads(
    coordinator.featureName, meta.tracks, coordinator.round,
    channel, parentTs, coordinator.pmSlackId, meta.prdUrl,
  );
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
    const ownerSlackId = await resolveUserIdByName(ownerName) ?? ownerName;

    const ctx: ActionContext = {
      featureName, track, ownerSlackId, ownerName, round,
      channelId, parentThreadTs, threadTs: '', msgTs: '',
      pmSlackId, pmDmChannel: pmDmChannel ?? '',
      prdUrl: prdUrl ?? '',
    };

    // Post into the parent thread — this reply's ts becomes the owner's sub-thread ts
    const ownerTs = await postMessage(channelId, `Sign-off request for ${ownerName} (${track})`, {
      blocks: prdReviewBlocks({ ...ctx, threadTs: parentThreadTs, msgTs: '' }),
      threadTs: parentThreadTs,
    });
    if (!ownerTs) continue;

    ctx.threadTs = ownerTs;
    ctx.msgTs = ownerTs;

    // Update button values with correct threadTs/msgTs by editing the message
    await updateMessage(channelId, ownerTs, `Sign-off request for ${ownerName} (${track})`,
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

  if (actionId === 'prd_reviewed_yes') {
    await updateMessage(ctx.channelId, ctx.msgTs, `PRD reviewed ✓`, scopeReviewBlocks({ ...ctx, msgTs: ctx.msgTs }));
    const entry = await findOwnerEntry(ctx.featureName, ctx.ownerSlackId, ctx.round);
    if (entry) { entry.status = 'Scope Review'; await saveSignoffEntry(entry); }

  } else if (actionId === 'prd_reviewed_wait') {
    await updateMessage(ctx.channelId, ctx.msgTs,
      `No problem — I'll check back in 24 hours. <@${ctx.ownerSlackId}>`,
    );
    const entry = await findOwnerEntry(ctx.featureName, ctx.ownerSlackId, ctx.round);
    if (entry) { entry.status = 'PRD Wait'; await saveSignoffEntry(entry); }

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

// ── Handle modal submissions ───────────────────────────────────────────────────

export async function handleModalSubmit(
  callbackId: string,
  viewValues: Record<string, Record<string, { value?: string; selected_date?: string }>>,
  privateMeta: string,
): Promise<void> {
  let ctx: ActionContext;
  try { ctx = JSON.parse(privateMeta); } catch { return; }

  if (callbackId === 'signoff_mandays_modal') {
    const manDays = viewValues['man_days_block']?.['man_days_input']?.value?.trim() ?? '';
    const date = viewValues['committed_date_block']?.['committed_date_input']?.value?.trim() ?? '';

    const entry = await findOwnerEntry(ctx.featureName, ctx.ownerSlackId, ctx.round);
    if (entry) {
      entry.manDays = manDays;
      entry.committedDate = date;
      entry.signoffDate = new Date().toISOString().split('T')[0];
      entry.status = 'Signed Off';
      await saveSignoffEntry(entry);
    }

    await postMessage(ctx.channelId, `Logged — *${manDays}* man-days, delivery by *${date}*. ✓`, { threadTs: ctx.threadTs });
    await checkCompletion(ctx.featureName, ctx.round, ctx.channelId, ctx.parentThreadTs, ctx.pmSlackId, ctx.pmDmChannel);

  } else if (callbackId === 'signoff_concern_modal') {
    const concernText = viewValues['concern_block']?.['concern_input']?.value?.trim() ?? '';

    const entry = await findOwnerEntry(ctx.featureName, ctx.ownerSlackId, ctx.round);
    if (entry) {
      entry.concerns = concernText;
      entry.status = 'Concern Raised';
      await saveSignoffEntry(entry);
    }

    await postMessage(ctx.channelId,
      `Concern flagged to the PM. Your sign-off is paused until this is resolved. The thread will remain open — you'll complete sign-off here once it's sorted.`,
      { threadTs: ctx.threadTs },
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

  const allSigned = ownerEntries.every(e => e.status === 'Signed Off');
  if (!allSigned) return;

  const summary = ownerEntries
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

export async function handleRescope(featureName: string, reason: string): Promise<void> {
  const entries = await getEntriesForFeature(featureName);
  const coordinator = entries.find(e => e.track === 'COORDINATOR');
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
      `⚠️ *Scope revision: ${featureName}*\nReason: ${reason}\nAll previous sign-offs are now void. A fresh sign-off round will begin — owners will be re-requested in their existing threads.`,
      { threadTs: coordinator.parentThreadTs },
    );
  }

  // Re-initiate for existing owners in their existing threads
  let meta: { prdUrl: string; tracks: Array<{ track: string; ownerName: string }> };
  try { meta = JSON.parse(coordinator.metadata); } catch { meta = { prdUrl: '', tracks: [] }; }

  coordinator.round = newRound;
  coordinator.status = 'Confirmed';
  await saveSignoffEntry(coordinator);

  const ownerEntries = entries.filter(e => e.track !== 'COORDINATOR' && e.round === oldRound);
  for (const old of ownerEntries) {
    const ctx: ActionContext = {
      featureName, track: old.track, ownerSlackId: old.ownerSlackId, ownerName: old.ownerName,
      round: newRound, channelId: old.channelId, parentThreadTs: old.parentThreadTs,
      threadTs: old.ownerThreadTs, msgTs: '', pmSlackId: coordinator.pmSlackId,
      pmDmChannel: coordinator.pmDmChannel, prdUrl: meta.prdUrl,
    };
    const newMsgTs = await postMessage(old.channelId,
      `Round ${newRound} sign-off request for ${old.ownerName} (${old.track})`,
      { blocks: prdReviewBlocks({ ...ctx, msgTs: '' }), threadTs: old.ownerThreadTs },
    );
    if (newMsgTs) {
      await updateMessage(old.channelId, newMsgTs, `Sign-off request for ${old.ownerName} (${old.track})`,
        prdReviewBlocks({ ...ctx, msgTs: newMsgTs }),
      );
    }
    const newEntry: SignoffEntry = {
      ...old, round: newRound, status: 'PRD Review',
      manDays: '', committedDate: '', signoffDate: '', concerns: '',
      initiatedAt: new Date().toISOString(), lastRemindedAt: '', reminderCount: '0',
      rowIndex: 0,
    };
    await addSignoffEntry(newEntry);
  }
}

// ── Resolve concern ────────────────────────────────────────────────────────────

export async function handleResolve(featureName: string, ownerName: string): Promise<void> {
  const entries = await getEntriesForFeature(featureName);
  const entry = entries.find(e => e.ownerName.toLowerCase() === ownerName.toLowerCase() && e.status === 'Concern Raised');
  if (!entry) return;

  entry.status = 'Scope Review';
  entry.concerns = '';
  await saveSignoffEntry(entry);

  const ctx: ActionContext = {
    featureName, track: entry.track, ownerSlackId: entry.ownerSlackId, ownerName: entry.ownerName,
    round: entry.round, channelId: entry.channelId, parentThreadTs: entry.parentThreadTs,
    threadTs: entry.ownerThreadTs, msgTs: '', pmSlackId: entry.pmSlackId,
    pmDmChannel: entry.pmDmChannel, prdUrl: '',
  };
  const newMsgTs = await postMessage(entry.channelId,
    `The PM has resolved the concern. <@${entry.ownerSlackId}> please proceed with your sign-off below.`,
    { blocks: scopeReviewBlocks({ ...ctx, msgTs: '' }), threadTs: entry.ownerThreadTs },
  );
  if (newMsgTs) {
    await updateMessage(entry.channelId, newMsgTs, `Scope sign-off for ${entry.ownerName}`,
      scopeReviewBlocks({ ...ctx, msgTs: newMsgTs }),
    );
  }
}

// ── Polling: reminders + auto-initiation ──────────────────────────────────────

const REMINDER_1_MS = 24 * 60 * 60 * 1000;
const REMINDER_2_MS = 12 * 60 * 60 * 1000;
const ESCALATION_MS = 12 * 60 * 60 * 1000;

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

    if (rc === 0 && now - initiated >= REMINDER_1_MS) {
      await postMessage(entry.channelId,
        `Reminder: <@${entry.ownerSlackId}>, your sign-off is still pending for *${entry.featureName}* (${entry.track}). Please respond above when you get a chance.`,
        { threadTs: entry.ownerThreadTs },
      );
      entry.reminderCount = '1';
      entry.lastRemindedAt = new Date().toISOString();
      await saveSignoffEntry(entry);

    } else if (rc === 1 && lastReminded && now - lastReminded >= REMINDER_2_MS) {
      await postMessage(entry.channelId,
        `Second reminder: <@${entry.ownerSlackId}>, your sign-off is still needed for *${entry.featureName}* (${entry.track}). The PM has been notified if there's no response soon.`,
        { threadTs: entry.ownerThreadTs },
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
