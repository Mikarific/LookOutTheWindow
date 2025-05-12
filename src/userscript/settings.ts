import { Settings } from '../model';

const STORAGE_KEY = `internet-roadtrip/LookOutTheWindow/settings/v2`;

const DEFAULT_SETTINGS: Settings = {
  showVehicle: true,
};

export function loadSettings(): Settings {
  const rawStorageValue = localStorage.getItem(STORAGE_KEY);
  if (!rawStorageValue) {
    return DEFAULT_SETTINGS;
  }

  try {
    const storageValue = JSON.parse(rawStorageValue) as Settings;
    return storageValue;
  } catch (error) {
    console.error('Could not load LookOutTheWindow settings', error);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
