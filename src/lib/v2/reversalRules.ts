/**
 * Any customer return, restocked or damaged, closes a later full reversal.
 * The original sale stays in place. Stock is not restored again.
 */
export function fullReversalClosed(partialReturnExists: boolean): boolean {
  return partialReturnExists;
}
