// Should match mods/mod.schema.json

export type ModInfo = {
  $schema?: string;
  name: string;
  uniqueName: string;
  repo: string;
  thumbnailUrl?: string;
  alpha?: boolean;
  required?: boolean;
  utility?: boolean;
  parent?: string;
  recommendedMods?: string[];
  authorDisplay?: string;
  tags: string[];
  downloadCountOffset?: number;
  firstReleaseDateOverride?: string;
  repoVariations?: string[];
};
