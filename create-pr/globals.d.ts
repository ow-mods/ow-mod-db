// TODO avoid repeating type code between create-pr and fetch-mods actions.

type ModInfo = {
  name: string;
  uniqueName: string;
  repo: string;
  required?: boolean;
  utility?: boolean;
  parent?: string;
};
