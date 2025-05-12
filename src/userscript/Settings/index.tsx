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
        <div class={styles['setting']}>
          <input
            id={inputId('show-vehicle')}
            type="checkbox"
            checked={store.settings.showVehicle}
            on:change={(event) =>
              setStore({
                settings: { showVehicle: event.currentTarget.checked },
              })
            }
          />
          <label for={inputId('show-vehicle')}>Show vehicle</label>
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
