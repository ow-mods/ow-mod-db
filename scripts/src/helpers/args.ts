import {
  parseArgs,
  type ParseArgsConfig,
  type ParseArgsOptionsConfig,
} from "node:util";

type RequiredValues<
  O extends ParseArgsOptionsConfig,
  R extends readonly (keyof O & string)[],
> = {
  [K in R[number]]: O[K] extends { type: "boolean" }
    ? O[K] extends { multiple: true }
      ? boolean[]
      : boolean
    : O[K] extends { multiple: true }
      ? string[]
      : string;
};

type RequiredArgsConfig<
  O extends ParseArgsOptionsConfig,
  R extends readonly (keyof O & string)[],
> = Omit<ParseArgsConfig, "options"> & {
  options: O;
  required: R;
};

export function parseRequiredArgs<
  O extends ParseArgsOptionsConfig,
  R extends readonly (keyof O & string)[],
>(config: RequiredArgsConfig<O, R>): RequiredValues<O, R> {
  const { values } = parseArgs(config);
  const rawValues = values as Record<string, unknown>;

  const missing = config.required.filter(
    (name) => rawValues[name] === undefined,
  );

  if (missing.length > 0) {
    console.error(
      `Missing required arguments: ${missing.map((name) => `--${name}`).join(", ")}`,
    );
    process.exit(1);
  }

  return values as unknown as RequiredValues<O, R>;
}
