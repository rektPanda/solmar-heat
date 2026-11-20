// Solmar Heat — tuning constants, one place. All times in seconds, speeds in px/s.
export const CFG = {
  WORLD: 3600,
  STREET_PITCH: 400,
  STREET_FIRST: 200,
  ROAD_HALF: 30,
  BLOCK_GAP: 30, // road edge to block edge is covered by sidewalk; buildings inset from block

  // on-foot player
  WALK_SPEED: 185,
  PLAYER_RADIUS: 13,

  // cars
  CAR_LENGTH: 46,
  CAR_WIDTH: 22,
  SEDAN_TOP: 320,
  SPORT_TOP: 445,
  POLICE_TOP: 400,
  CAR_ACCEL: 300,
  CAR_BRAKE: 420,
  CAR_REVERSE_TOP: 140,
  TURN_BASE: 2.6, // rad/s at full speed
  TURN_MIN: 0.45, // minimum turn rate while moving at all
  CAR_CRASH_HARD: 0.45, // speed multiplier on a deep impact
  CAR_CRASH_SOFT: 0.92, // speed multiplier on a light scrape

  // combat
  MAG_SIZE: 12,
  RELOAD_S: 1.0,
  SHOT_RANGE: 560,
  SHOT_SPREAD: 0.05,
  PISTOL_DAMAGE: 34,

  // wanted / police
  BUST_FINE: 150,
  WANTED_DECAY_AFTER_S: 20,
  WANTED_DECAY_STEP_S: 8,
  MAX_POLICE: 3,
  POLICE_RAM_DAMAGE: 3,
  POLICE_RAM_COOLDOWN_S: 1.5,
  POLICE_BUST_DIST: 58,
  POLICE_BUST_SLOW: 70, // player speed below this counts as "caught"
  POLICE_BUST_TIME_S: 1.2,
  WANTED_SHOOT_COOLDOWN_S: 2.0,
  WANTED_HIT_COOLDOWN_S: 2.0,

  // missions
  PICKUP_DIST: 58,
  DELIVER_DIST: 78,
  DIALOGUE_AUTO_ADVANCE_S: 6,
  HORN_COOLDOWN_S: 0.4,

  // traffic / pedestrians
  TRAFFIC_COUNT: 14,
  PED_COUNT: 18,
  TRAFFIC_SPEED_MIN: 110,
  TRAFFIC_SPEED_MAX: 230,
  PED_SPEED_MIN: 28,
  PED_SPEED_MAX: 62,

  // misc
  SAVE_KEY: 'solmar-heat-save-v1',
  MISSION_REWARDS: [150, 300, 250, 800],
};
