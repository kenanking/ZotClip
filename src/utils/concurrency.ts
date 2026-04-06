/**
 * Run async `map` over `input` with at most `concurrency` tasks in flight.
 * Results are returned in the same order as the input array.
 */
export async function mapWithConcurrencyLimit<Input, Output>(
  input: Input[],
  concurrency: number,
  map: (value: Input, index: number) => Promise<Output>,
): Promise<Output[]> {
  if (!input.length) {
    return [];
  }

  const results = new Array<Output>(input.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, input.length) },
    async () => {
      while (nextIndex < input.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await map(input[currentIndex], currentIndex);
      }
    },
  );

  await Promise.all(workers);
  return results;
}
