const JSON_INDENT = 2;

export function toJsonString(value: any) {
  return JSON.stringify(value, null, JSON_INDENT);
}
