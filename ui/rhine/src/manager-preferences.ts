export function managerPreferenceDefaults(stored: unknown, android: boolean) {
  const values = stored && typeof stored === "object" ? stored as Record<string, unknown> : {};
  const flag = (key: string, fallback: boolean) => typeof values[key] === "boolean" ? values[key] as boolean : fallback;
  return {
    music: flag("music", !android),
    reduced: flag("reduced", android),
    openingEnabled: flag("openingEnabled", true),
  };
}

export function openingAllowed(enabled: boolean, systemReduced: boolean): boolean {
  return enabled && !systemReduced;
}

export function sceneMotionReduced(boot: boolean, userReduced: boolean, systemReduced: boolean): boolean {
  return systemReduced || (!boot && userReduced);
}
