type ModDB = {
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
};

type Release = {
  downloadUrl: string;
  downloadCount: number;
  version: string;
};

interface Mod extends Release {
  name: string;
  uniqueName: string;
  description: string;
  author: string;
  repo: string;
  latestReleaseDate: string;
  firstReleaseDate: string;
  latestReleaseDescription: string;
  latestPrereleaseDescription: string;
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
}
