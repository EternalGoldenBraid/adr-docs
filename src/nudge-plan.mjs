// Which thread to nudge an idle agent about. Each agent a answers a nudge with probability p_a, learned from past nudges:
// Beta(1,1) prior, so p_a = (answered + 1) / (sent + 2). A thread closes only when every addressee who has not resolved answers,
// so nudging a on thread T closes it with probability p_a · ∏ p_b over the other missing addressees b. Slots are independent per
// agent, so ranking each agent's candidates by that closure probability maximises the expected number of closed threads.
export const ANSWER_WINDOW = 30 * 60_000;

export function answerRates(nudges, replyTimes, now = Date.now()) {
  const tally = new Map();
  for (const { at, slug, thread } of nudges) {
    const start = Date.parse(at);
    const answered = (replyTimes(slug, thread) ?? []).some(time => time > start && time - start <= ANSWER_WINDOW);
    if (!answered && now - start < ANSWER_WINDOW) continue;
    const row = tally.get(slug) ?? { sent: 0, answered: 0 };
    row.sent += 1;
    if (answered) row.answered += 1;
    tally.set(slug, row);
  }
  return slug => { const row = tally.get(slug) ?? { sent: 0, answered: 0 }; return (row.answered + 1) / (row.sent + 2); };
}

export function closureProbability(agent, missing, rate) {
  return missing.reduce((product, other) => product * (other === agent ? 1 : rate(other)), rate(agent));
}

// candidates: [{ missing: [slugs still to answer, including agent], ageMinutes? }]; best first, older first on a tie.
export function rank(agent, candidates, rate) {
  return candidates.map(candidate => ({ candidate, p: closureProbability(agent, candidate.missing, rate) }))
    .sort((a, b) => b.p - a.p || (b.candidate.ageMinutes ?? 0) - (a.candidate.ageMinutes ?? 0));
}
