// Solmar Heat — configuration.
// Original values written for this game. No Rockstar / GTA assets.
(function () {
  var S = (globalThis.Solmar = globalThis.Solmar || {});
  S.Config = {
    WORLD_W: 3200,
    WORLD_H: 2400,
    ROAD_GAP: 400, // distance between parallel roads
    ROAD_W: 110, // road width
    SEA_W: 70, // western sea strip
    BEACH_W: 180, // western sand strip (includes sea)
    PLAYER_WALK: 205,
    PLAYER_RUN: 310,
    PLAYER_RADIUS: 14,
    CAR_ACCEL: 430,
    CAR_BRAKE: 780,
    CAR_MAX: 470,
    CAR_REVERSE_MAX: 160,
    CAR_TURN: 2.7, // rad/s at full steer
    CAR_GRIP: 2.4, // lateral damping
    CAR_RADIUS: 20,
    POLICE_MAX: 400,
    POLICE_ACCEL: 380,
    WANTED_MAX: 5,
    WANTED_DECAY_AFTER: 14, // seconds unseen before a star drops
    WANTED_DECAY_EVERY: 4, // seconds per star once decaying
    PLAYER_HEALTH: 100,
    HEALTH_REGEN: 2.5, // per second, after 3s without damage
    RAM_DAMAGE: 2,
    RAM_COOLDOWN: 1.5,
    BUST_TIME: 2.0, // seconds a cop must touch you on foot
    BUST_FINE: 100,
    WASTED_FINE: 150,
    START_CLOCK: 14.0, // 14:00, afternoon
    CLOCK_RATE: 1 / 60, // game hours per real second
    TRAFFIC_CARS: 7,
    PEDS: 14,
    PARKED_CARS: 10,
    COLORS: {
      grass: '#5d8a4a',
      grass2: '#547e43',
      road: '#3a3a40',
      roadLine: '#e8d44d',
      sidewalk: '#9a9a92',
      sea: '#2f6fb2',
      sand: '#e0c98f',
      building: ['#b0563a', '#4a6b8a', '#8a6b4a', '#6b4a8a', '#3a7a5d', '#a03a4a', '#7a7a3a'],
      roof: '#2e2e33'
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})();
