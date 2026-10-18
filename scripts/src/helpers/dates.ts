const hourInMilliseconds = 1000 * 60 * 60;

export function getDateAgeInHours(dateText: string) {
  return (
    (new Date().valueOf() - new Date(dateText).valueOf()) / hourInMilliseconds
  );
}

export function getLatestDate(dateA: string, dateB: string) {
  return new Date(dateA) > new Date(dateB) ? dateA : dateB;
}
