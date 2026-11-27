/** Milliseconds. */
export const TIMING = {
  /** First reminder, second reminder (with "one more minute"), then the turn is skipped. */
  reminder: 30_000,
  lastCall: 60_000,
  skip: 90_000,
  extra: 60_000,
  /** Secret choices by day (Devoted Servant, Stuttering Judge): short, the same length whatever the answer. */
  secretMin: 8_000,
  secretSkip: 20_000,
  /** Between a role going back to sleep and the next call. */
  sleep: 3_000,
  /** Reading a result or a message on the phone (held to see it, then OK): the beat ends sooner once everyone's OK. */
  look: 12_000,
  check: 15_000,
  candidacy: 30_000,
  ballot: 90_000,
  secondDebate: 60_000,
  card: 20_000,
};
