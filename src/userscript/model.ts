export enum Direction {
  FRONT = 0,
  RIGHT = 1,
  BACK = 2,
  LEFT = 3,
}

export interface Settings {
  showVehicle: boolean;
  ambientNoise: {
    play: boolean;
    volume: number;
  };
}

export interface Store {
  currentPano: string | null;
  currentHeading: number;
  facingDirection: Direction;
  settings: Settings;
}
