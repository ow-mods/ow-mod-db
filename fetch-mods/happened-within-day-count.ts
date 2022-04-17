const dayInMilliseconds = 1000 * 60 * 60 * 24;

export function happenedWithinDayCount(dateText: string, dayCount: number) {
  return (
    new Date().valueOf() - new Date(dateText).valueOf() <
    dayCount * dayInMilliseconds
  );
}
