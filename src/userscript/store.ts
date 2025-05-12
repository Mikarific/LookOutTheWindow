import { createStore } from 'solid-js/store';
import { Direction, Store } from './model';
import { loadSettings, saveSettings } from './settings';
import { effect } from 'solid-js/web';

export const [store, setStore] = createStore<Store>({
  currentPano: null,
  currentHeading: 0,
  facingDirection: Direction.FRONT,
  settings: loadSettings(),
});

effect(() => {
  if (!store.settings) {
    return;
  }

  saveSettings(store.settings);
});
