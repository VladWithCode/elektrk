import * as migration_20260515_173454 from './20260515_173454';
import * as migration_20260516_055924 from './20260516_055924';
import * as migration_20260517_044621 from './20260517_044621';
import * as migration_20260517_050450 from './20260517_050450';
import * as migration_20260517_234713 from './20260517_234713';

export const migrations = [
  {
    up: migration_20260515_173454.up,
    down: migration_20260515_173454.down,
    name: '20260515_173454',
  },
  {
    up: migration_20260516_055924.up,
    down: migration_20260516_055924.down,
    name: '20260516_055924',
  },
  {
    up: migration_20260517_044621.up,
    down: migration_20260517_044621.down,
    name: '20260517_044621',
  },
  {
    up: migration_20260517_050450.up,
    down: migration_20260517_050450.down,
    name: '20260517_050450',
  },
  {
    up: migration_20260517_234713.up,
    down: migration_20260517_234713.down,
    name: '20260517_234713'
  },
];
