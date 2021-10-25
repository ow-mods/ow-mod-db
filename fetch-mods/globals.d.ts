type ModInfo = {
  name: string;
  uniqueName: string;
  repo: string;
  required?: boolean;
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
  required?: boolean;
  prerelease?: {
    version: string;
    downloadUrl: string;
  };
}
