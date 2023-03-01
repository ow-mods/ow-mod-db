const dayInMilliseconds = 1000 * 60 * 60 * 24;

export function getDateAgeInDays(dateText: string) {
  return (
    (new Date().valueOf() - new Date(dateText).valueOf()) / dayInMilliseconds
  );
}
