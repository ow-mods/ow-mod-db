export const getSettledResult = <TResult>(
  results: PromiseSettledResult<TResult>
): TResult | undefined => {
  if (results.status == "rejected") return undefined;

  return results.value;
};

export function filterFulfilledPromiseSettleResults<T>(
  result: PromiseSettledResult<T | null | undefined>
): result is PromiseFulfilledResult<T> {
  return (
    result.status === "fulfilled" &&
    result.value != null &&
    result.value != undefined
  );
}
