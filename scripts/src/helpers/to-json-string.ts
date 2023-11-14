const JSON_INDENT = 2;

export function toJsonString(value: object) {
  return JSON.stringify(value, null, JSON_INDENT);
}
