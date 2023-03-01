const dayInMilliseconds = 1000 * 60 * 60;

export function getDateAgeInHours(dateText: string) {
  return (
    (new Date().valueOf() - new Date(dateText).valueOf()) / dayInMilliseconds
  );
}

export function getLatestDate(dateA: string, dateB: string) {
  return new Date(dateA) > new Date(dateB) ? dateA : dateB;
}
