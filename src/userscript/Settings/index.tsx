import { createSignal } from 'solid-js';
import { CarIcon } from '../icons/CarIcon';
import styles from '../index.module.css';
import { setStore, store } from '../store';

export function Settings() {
  const [isOpen, setIsOpen] = createSignal(false);

  const inputId = (id: string) => `look-out-the-window-setting--${id}`;

  return (
    <div
      classList={{
        [styles['settings-panel']]: true,
        [styles['settings-panel--open']]: isOpen(),
      }}
    >
      <div class={styles['settings-panel__content']}>
        <div class={styles['setting-group']}>
          <div class={styles['setting-group__heading']}>
            <span>Vehicle</span>
            <div class={styles['setting']}>
              <input
                id={inputId('vehicle-show')}
                type="checkbox"
                checked={store.settings.showVehicle}
                on:change={(event) =>
                  setStore({
                    settings: {
                      ...store.settings,
                      showVehicle: event.currentTarget.checked,
                    },
                  })
                }
              />
              <label for={inputId('vehicle-show')}>Show</label>
            </div>
          </div>
        </div>
        <div class={styles['setting-group']}>
          <div class={styles['setting-group__heading']}>
            <span>Ambient noise</span>
            <div class={styles['setting']}>
              <input
                id={inputId('ambient-noise-play')}
                type="checkbox"
                checked={!store.settings.ambientNoise.play}
                on:change={(event) =>
                  setStore({
                    settings: {
                      ...store.settings,
                      ambientNoise: {
                        ...store.settings.ambientNoise,
                        play: !event.currentTarget.checked,
                      },
                    },
                  })
                }
              />
              <label for={inputId('ambient-noise-play')}>Mute</label>
            </div>
          </div>
          <div class={styles['setting']}>
            <label for={inputId('ambient-noise-volume')}>Volume</label>
            <input
              id={inputId('ambient-noise-volume')}
              type="range"
              min={0}
              max={1}
              step={0.005}
              title={`${Math.floor(store.settings.ambientNoise.volume * 100)}%`}
              value={store.settings.ambientNoise.volume}
              on:input={(event) =>
                setStore({
                  settings: {
                    ...store.settings,
                    ambientNoise: {
                      ...store.settings.ambientNoise,
                      volume: parseFloat(event.currentTarget.value),
                    },
                  },
                })
              }
            />
          </div>
        </div>
      </div>
      <div
        class={styles['settings-panel__toggle']}
        on:click={() => setIsOpen(!isOpen())}
      >
        <CarIcon size="100%" />
      </div>
    </div>
  );
}
