type ModDB = {
  $schema: string;
  mods: ModInfo[];
};

type ModInfo = {
  name: string;
  uniqueName: string;
  repo: string;
  alpha?: boolean;
  required?: boolean;
  utility?: boolean;
  parent?: string;
  authorDisplay?: string;
  tags: string[];
};

type Mod = {
  name: string;
  uniqueName: string;
  slug: string;
  description: string;
  author: string;
  repo: string;
  latestReleaseDate: string;
  firstReleaseDate: string;
  latestReleaseDescription: string;
  latestPrereleaseDescription: string;
  repoUpdatedAt: string;
  databaseEntryUpdatedAt: string;
  downloadUrl: string;
  downloadCount: number;
  version: string;
  alpha?: boolean;
  required?: boolean;
  utility?: boolean;
  parent?: string;
  authorDisplay?: string;
  readme?: {
    downloadUrl?: string;
    htmlUrl?: string;
  };
  prerelease?: {
    version: string;
    downloadUrl: string;
    date: string;
  };
  tags: string[];
  thumbnail: {
    main?: string;
    openGraph?: string;
  };
};
