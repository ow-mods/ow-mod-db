type ModInfo = {
  name: string;
  uniqueName: string;
  repo: string;
  manifest: string;
  required?: boolean;
};

type Manifest = {
  name: string;
  author: string;
  uniqueName: string;
  version: string;
};

type Release = {
  downloadUrl: string;
  downloadCount: number;
  version: string;
};

interface Mod extends Release {
  name: string;
  uniqueName: string;
  repo: string;
  manifest: Manifest;
  required?: boolean;
  prerelease?: {
    version: string;
    downloadUrl: string;
  };
}
