type ModInfo = {
  name: string;
  uniqueName: string;
  repo: string;
  alpha?: boolean;
  required?: boolean;
  utility?: boolean;
  parent?: string;
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
  alpha?: boolean;
  required?: boolean;
  utility?: boolean;
  parent?: string;
  readme?: {
    downloadUrl?: string;
    htmlUrl?: string;
  };
  prerelease?: {
    version: string;
    downloadUrl: string;
    date: string;
  };
  latestReleaseDate: string;
  firstReleaseDate: string;
  latestReleaseDescription: string;
  latestPrereleaseDescription: string;
}
