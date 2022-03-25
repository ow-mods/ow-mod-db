export function getDiff(previousDatabase: Mod[], nextDatabase: Mod[]) {
  const addedMods: Mod[] = [];
  const removedMods: Mod[] = [];
  const updatedMods: Mod[] = [];

  for (const nextDatabaseMod of nextDatabase) {
    const previousDatabaseMod = previousDatabase.find(
      (mod) => mod.uniqueName === nextDatabaseMod.uniqueName
    );

    if (!previousDatabaseMod) {
      addedMods.push(nextDatabaseMod);
      continue;
    }

    if (previousDatabaseMod.version !== nextDatabaseMod.version) {
      updatedMods.push(nextDatabaseMod);
      continue;
    }
  }

  for (const previousDatabaseMod of previousDatabase) {
    const nextDatabaseMod = nextDatabase.find(
      (mod) => mod.uniqueName === previousDatabaseMod.uniqueName
    );

    if (!nextDatabaseMod) {
      removedMods.push(previousDatabaseMod);
      continue;
    }
  }

  for (const addedMod of addedMods) {
    console.log(`Mod ${addedMod.name} by ${addedMod.author} was added`);
  }
  for (const updatedMod of updatedMods) {
    console.log(
      `Mod ${updatedMod.name} by ${updatedMod.author} was updated to version ${updatedMod.version}`
    );
  }
  for (const removedMod of removedMods) {
    console.log(`Mod ${removedMod.name} by ${removedMod.author} was removed`);
  }
}
