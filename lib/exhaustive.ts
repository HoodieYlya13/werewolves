/** Ends a switch that covers every case: a case added later and not handled doesn't compile. */
export function unreachable(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}

/** Ends a switch over messages from elsewhere: every known one handled, and one from a newer version ignored. */
export function ignoreUnknown(value: never): void {
  void value;
}
