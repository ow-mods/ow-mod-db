export type ModList = {
  $schema: string;
  mods: ModInfo[];
};

export type ModInfo = {
  name: string;
  uniqueName: string;
  repo: string;
  alpha?: boolean;
  required?: boolean;
  utility?: boolean;
  parent?: string;
  authorDisplay?: string;
  tags: string[];
  downloadCountOffset?: number;
  firstReleaseDateOverride?: string;
  repoVariations?: string[];
};
