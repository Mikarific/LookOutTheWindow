import styles from './index.module.css';
import { store } from './store';
import { Direction } from './model';

export function Window() {
  return (
    <div
      classList={{
        [styles['window']]: true,
        [styles['window--flip']]: store.facingDirection === Direction.LEFT,
        [styles['window--back']]: store.facingDirection === Direction.BACK,
        [styles['window--hide']]: store.facingDirection === Direction.FRONT,
      }}
    >
      {store.facingDirection}
    </div>
  );
}
