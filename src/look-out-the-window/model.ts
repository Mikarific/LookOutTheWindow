export enum Direction {
  FRONT = 0,
  RIGHT = 1,
  BACK = 2,
  LEFT = 3,
}

export interface StoreModel {
  currentPano: string | null;
  currentHeading: number;
  facingDirection: Direction;
}
