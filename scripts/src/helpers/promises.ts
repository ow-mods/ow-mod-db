export const getSettledResult = <TResult>(
  results: PromiseSettledResult<TResult>
): TResult | undefined => {
  if (results.status == "rejected") return undefined;

  return results.value;
};
