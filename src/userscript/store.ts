import { createStore } from 'solid-js/store';
import { Direction, StoreModel } from './model';

export const [store, setStore] = createStore<StoreModel>({
  currentPano: null,
  currentHeading: 0,
  facingDirection: Direction.FRONT,
});
