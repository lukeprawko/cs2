import { BombSite } from '../game/BombLogic';
import { Team } from '../game/WeaponsDB';

export type SurfaceMaterialType =
  | 'sandstone'
  | 'brick'
  | 'concrete'
  | 'wood_crate'
  | 'metal_container'
  | 'asphalt'
  | 'sand_ground'
  | 'plaster_trim'
  | 'dark_metal';

export interface MapBox {
  id: string;
  x: number; // center X
  y: number; // center Y
  z: number; // center Z
  w: number; // size X
  h: number; // size Y
  d: number; // size Z
  material: SurfaceMaterialType;
  penetrable?: boolean; // true for wood crates / double doors
  isRamp?: boolean; // if true, top surface slopes along rampAxis
  rampDir?: '+z' | '-z' | '+x' | '-x'; // direction going UP
  noCollide?: boolean; // decorative trim
}

export interface MapDecalSign {
  id: string;
  text: 'A' | 'B' | 'MID' | 'ARROW_LEFT' | 'ARROW_RIGHT';
  position: [number, number, number];
  rotationY: number;
  width: number;
  height: number;
  color: string;
}

export interface ZoneBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface PropInstance {
  id: string;
  type: 'palm' | 'barrel' | 'lamp' | 'arch' | 'antenna' | 'cable' | 'pipe' | 'pallet' | 'sandbags';
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}

export const PLAYER_DIMENSIONS = {
  HEIGHT_STAND: 1.8,
  EYE_STAND: 1.65,
  HEIGHT_CROUCH: 1.38,
  EYE_CROUCH: 1.26,
  RADIUS: 0.36,
  STEP_HEIGHT: 0.45,
};

export const MAP_HALF_SIZE = 31.2; // 62.4m x 62.4m spacious tactical arena (1.3x scaled blueprint)

/**
 * Spacious 62.4m x 62.4m tactical arena modeled directly on the reference blueprint:
 * - North (-Z): CT Spawn alcove (top-left-of-center)
 * - South (+Z): T Spawn area (bottom-right-of-center)
 * - North-West (-X, -Z): Bombsite B (red square on left)
 * - North-East (+X, -Z): Bombsite A (red square on right)
 */
export const BUY_ZONES: Record<Team, ZoneBounds> = {
  CT: { minX: -13.6, maxX: -0.6, minZ: -30.5, maxZ: -19.5, y: 0 },
  T: { minX: -4.5, maxX: 13.6, minZ: 20.1, maxZ: 30.5, y: 0 },
};

export const BOMBSITE_ZONES: Record<BombSite, ZoneBounds> = {
  B: { minX: -27.5, maxX: -14.2, minZ: -20.5, maxZ: -7.5, y: 0 },
  A: { minX: 10.5, maxX: 23.8, minZ: -20.5, maxZ: -7.5, y: 0 },
};

export const CT_SPAWNS: SpawnPoint[] = [
  { x: -7.15, y: 0, z: -26.6, yaw: Math.PI },
  { x: -9.75, y: 0, z: -27.5, yaw: Math.PI },
  { x: -4.55, y: 0, z: -27.5, yaw: Math.PI },
  { x: -10.6, y: 0, z: -24.7, yaw: Math.PI + 0.15 },
  { x: -3.65, y: 0, z: -24.7, yaw: Math.PI - 0.15 },
];

export const T_SPAWNS: SpawnPoint[] = [
  { x: 4.55, y: 0, z: 26.2, yaw: 0 },
  { x: 1.55, y: 0, z: 27.3, yaw: 0 },
  { x: 7.55, y: 0, z: 27.3, yaw: 0 },
  { x: -1.3, y: 0, z: 25.3, yaw: -0.15 },
  { x: 10.4, y: 0, z: 25.3, yaw: 0.15 },
];

const S = 1.3; // 1.3x spatial scale factor for spacious corridors and fluid gunfights

const RAW_BOXES: MapBox[] = [
  // ================= OUTER PERIMETER BOUNDARY WALLS =================
  { id: 'wall_north', x: 0, y: 2.5, z: -24.0, w: 49.6, h: 5.0, d: 1.4, material: 'concrete' },
  { id: 'wall_south', x: 0, y: 2.5, z: 24.0, w: 49.6, h: 5.0, d: 1.4, material: 'concrete' },
  { id: 'wall_west', x: -24.0, y: 2.5, z: 0, w: 1.4, h: 5.0, d: 49.6, material: 'concrete' },
  { id: 'wall_east', x: 24.0, y: 2.5, z: 0, w: 1.4, h: 5.0, d: 49.6, material: 'concrete' },

  // Outer perimeter top metallic trim
  { id: 'trim_north', x: 0, y: 5.1, z: -24.0, w: 49.8, h: 0.25, d: 1.6, material: 'dark_metal', noCollide: true },
  { id: 'trim_south', x: 0, y: 5.1, z: 24.0, w: 49.8, h: 0.25, d: 1.6, material: 'dark_metal', noCollide: true },
  { id: 'trim_west', x: -24.0, y: 5.1, z: 0, w: 1.6, h: 0.25, d: 49.8, material: 'dark_metal', noCollide: true },
  { id: 'trim_east', x: 24.0, y: 5.1, z: 0, w: 1.6, h: 0.25, d: 49.8, material: 'dark_metal', noCollide: true },

  // 4 Corner Fortress Towers with Battlements (matching reference map)
  { id: 'tower_nw', x: -24.0, y: 2.8, z: -24.0, w: 3.2, h: 5.6, d: 3.2, material: 'concrete' },
  { id: 'tower_nw_cap', x: -24.0, y: 5.8, z: -24.0, w: 3.5, h: 0.4, d: 3.5, material: 'dark_metal', noCollide: true },
  { id: 'tower_ne', x: 24.0, y: 2.8, z: -24.0, w: 3.2, h: 5.6, d: 3.2, material: 'concrete' },
  { id: 'tower_ne_cap', x: 24.0, y: 5.8, z: -24.0, w: 3.5, h: 0.4, d: 3.5, material: 'dark_metal', noCollide: true },
  { id: 'tower_sw', x: -24.0, y: 2.8, z: 24.0, w: 3.2, h: 5.6, d: 3.2, material: 'concrete' },
  { id: 'tower_sw_cap', x: -24.0, y: 5.8, z: 24.0, w: 3.5, h: 0.4, d: 3.5, material: 'dark_metal', noCollide: true },
  { id: 'tower_se', x: 24.0, y: 2.8, z: 24.0, w: 3.2, h: 5.6, d: 3.2, material: 'concrete' },
  { id: 'tower_se_cap', x: 24.0, y: 5.8, z: 24.0, w: 3.5, h: 0.4, d: 3.5, material: 'dark_metal', noCollide: true },

  // ================= CT SPAWN ALCOVE (TOP NORTH-LEFT) =================
  { id: 'ct_alcove_w', x: -10.2, y: 2.1, z: -20.2, w: 1.0, h: 4.2, d: 6.2, material: 'concrete' },
  { id: 'ct_alcove_e', x: -1.0, y: 2.1, z: -20.2, w: 1.0, h: 4.2, d: 6.2, material: 'concrete' },
  { id: 'ct_front_wall', x: -5.2, y: 2.0, z: -14.2, w: 10.6, h: 4.0, d: 1.1, material: 'asphalt' },
  { id: 'ct_front_trim', x: -5.2, y: 4.05, z: -14.2, w: 10.8, h: 0.18, d: 1.25, material: 'dark_metal', noCollide: true },

  // ================= NORTH-EAST WALL (ABOVE A SITE) =================
  { id: 'ne_top_wall', x: 11.5, y: 2.0, z: -17.6, w: 23.0, h: 4.0, d: 1.1, material: 'asphalt' },
  { id: 'ne_top_trim', x: 11.5, y: 4.05, z: -17.6, w: 23.2, h: 0.18, d: 1.25, material: 'dark_metal', noCollide: true },

  // ================= NORTH-WEST WALLS (AROUND B SITE) =================
  { id: 'nw_short_wall', x: -20.8, y: 2.0, z: -17.6, w: 4.8, h: 4.0, d: 1.1, material: 'asphalt' },
  { id: 'nw_short_trim', x: -20.8, y: 4.05, z: -17.6, w: 5.0, h: 0.18, d: 1.25, material: 'dark_metal', noCollide: true },

  { id: 'b_east_t_top', x: -12.0, y: 2.0, z: -17.8, w: 4.6, h: 4.0, d: 1.1, material: 'asphalt' },
  { id: 'b_east_t_stem', x: -11.5, y: 2.0, z: -12.6, w: 1.1, h: 4.0, d: 9.8, material: 'asphalt' },
  { id: 'b_east_t_trim', x: -11.5, y: 4.05, z: -12.6, w: 1.25, h: 0.18, d: 10.0, material: 'dark_metal', noCollide: true },

  // ================= WEST / B-LANE WALLS =================
  { id: 'west_edge_wall', x: -20.6, y: 2.0, z: -2.0, w: 1.1, h: 4.0, d: 7.2, material: 'asphalt' },
  { id: 'west_edge_trim', x: -20.6, y: 4.05, z: -2.0, w: 1.25, h: 0.18, d: 7.4, material: 'dark_metal', noCollide: true },

  { id: 'b_south_wall', x: -11.2, y: 2.0, z: -3.2, w: 10.2, h: 4.0, d: 1.1, material: 'asphalt' },
  { id: 'b_south_trim', x: -11.2, y: 4.05, z: -3.2, w: 10.4, h: 0.18, d: 1.25, material: 'dark_metal', noCollide: true },

  { id: 'sw_horiz_wall', x: -15.4, y: 2.0, z: 7.2, w: 8.2, h: 4.0, d: 1.1, material: 'asphalt' },
  { id: 'sw_horiz_trim', x: -15.4, y: 4.05, z: 7.2, w: 8.4, h: 0.18, d: 1.25, material: 'dark_metal', noCollide: true },

  { id: 'sw_stub_wall', x: -15.5, y: 2.0, z: 19.8, w: 1.1, h: 4.0, d: 6.8, material: 'asphalt' },
  { id: 'sw_stub_trim', x: -15.5, y: 4.05, z: 19.8, w: 1.25, h: 0.18, d: 7.0, material: 'dark_metal', noCollide: true },

  // ================= CENTRAL MID DIVIDER WALLS =================
  { id: 'mid_left_wall', x: -7.2, y: 2.0, z: 7.4, w: 1.1, h: 4.0, d: 14.2, material: 'asphalt' },
  { id: 'mid_left_trim', x: -7.2, y: 4.05, z: 7.4, w: 1.25, h: 0.18, d: 14.4, material: 'dark_metal', noCollide: true },

  { id: 'mid_right_wall', x: 3.5, y: 2.0, z: -1.8, w: 1.1, h: 4.0, d: 16.4, material: 'asphalt' },
  { id: 'mid_right_trim', x: 3.5, y: 4.05, z: -1.8, w: 1.25, h: 0.18, d: 16.6, material: 'dark_metal', noCollide: true },

  // ================= EAST / A-LANE T-WALL =================
  { id: 'a_south_horiz', x: 9.6, y: 2.0, z: -1.6, w: 7.6, h: 4.0, d: 1.1, material: 'asphalt' },
  { id: 'a_south_vert', x: 13.4, y: 2.0, z: -0.6, w: 1.1, h: 4.0, d: 9.2, material: 'asphalt' },
  { id: 'a_south_trim', x: 13.4, y: 4.05, z: -0.6, w: 1.25, h: 0.18, d: 9.4, material: 'dark_metal', noCollide: true },

  // ================= T SPAWN SHIELD WALL (SOUTH) =================
  { id: 't_front_wall', x: 3.2, y: 2.0, z: 15.8, w: 15.0, h: 4.0, d: 1.1, material: 'asphalt' },
  { id: 't_front_trim', x: 3.2, y: 4.05, z: 15.8, w: 15.2, h: 0.18, d: 1.25, material: 'dark_metal', noCollide: true },
  { id: 't_north_stub', x: 3.5, y: 2.0, z: 11.8, w: 1.1, h: 4.0, d: 4.4, material: 'asphalt' },

  // ================= BOMBSITE B CRATES (UPPER LEFT) =================
  { id: 'b_site_crate_sw1', x: -18.2, y: 0.65, z: -8.6, w: 1.35, h: 1.3, d: 1.35, material: 'wood_crate', penetrable: true },
  { id: 'b_site_crate_sw2', x: -18.2, y: 0.65, z: -10.3, w: 1.3, h: 1.3, d: 1.3, material: 'wood_crate', penetrable: true },
  { id: 'b_site_crate_sw_top', x: -18.2, y: 1.85, z: -9.4, w: 1.2, h: 1.1, d: 1.2, material: 'wood_crate', penetrable: true },
  { id: 'b_site_crate_ne', x: -13.8, y: 0.65, z: -12.8, w: 1.45, h: 1.3, d: 1.45, material: 'wood_crate', penetrable: true },
  { id: 'b_outer_crate_nw', x: -21.5, y: 0.7, z: -15.5, w: 1.5, h: 1.4, d: 1.5, material: 'wood_crate', penetrable: true },

  // ================= BOMBSITE A CRATES (UPPER RIGHT) =================
  { id: 'a_site_crate_ne1', x: 15.2, y: 0.65, z: -12.8, w: 1.45, h: 1.3, d: 1.45, material: 'wood_crate', penetrable: true },
  { id: 'a_site_crate_ne2', x: 13.4, y: 0.65, z: -12.8, w: 1.35, h: 1.3, d: 1.35, material: 'wood_crate', penetrable: true },
  { id: 'a_site_crate_top', x: 14.3, y: 1.85, z: -12.8, w: 1.2, h: 1.1, d: 1.2, material: 'wood_crate', penetrable: true },
  { id: 'a_north_crate_1', x: 2.2, y: 0.65, z: -16.1, w: 1.35, h: 1.3, d: 1.3, material: 'wood_crate', penetrable: true },
  { id: 'a_north_crate_2', x: 3.9, y: 0.65, z: -16.1, w: 1.35, h: 1.3, d: 1.3, material: 'wood_crate', penetrable: true },
  { id: 'a_north_crate_e', x: 18.2, y: 0.65, z: -15.8, w: 1.45, h: 1.3, d: 1.35, material: 'wood_crate', penetrable: true },

  // ================= MID & LANE TACTICAL COVER CRATES =================
  { id: 'mid_crate_upper_w', x: 2.1, y: 0.65, z: -5.2, w: 1.3, h: 1.3, d: 1.3, material: 'wood_crate', penetrable: true },
  { id: 'mid_crate_center_e', x: 4.9, y: 0.65, z: 5.6, w: 1.35, h: 1.3, d: 1.35, material: 'wood_crate', penetrable: true },
  { id: 'mid_crate_lower_e', x: -5.8, y: 0.65, z: 5.5, w: 1.35, h: 1.3, d: 2.0, material: 'wood_crate', penetrable: true },
  { id: 'mid_crate_t_stub', x: 2.2, y: 0.65, z: 13.2, w: 1.3, h: 1.3, d: 1.3, material: 'wood_crate', penetrable: true },
  { id: 'mid_crate_t_front', x: 3.5, y: 0.65, z: 14.5, w: 1.35, h: 1.3, d: 1.2, material: 'wood_crate', penetrable: true },

  // Crates in East lane (below A Site T-wall)
  { id: 'east_t_crate_1', x: 11.9, y: 0.65, z: 0.4, w: 1.45, h: 1.3, d: 1.45, material: 'wood_crate', penetrable: true },
  { id: 'east_t_crate_2', x: 9.2, y: 0.55, z: -2.6, w: 2.0, h: 1.1, d: 1.0, material: 'wood_crate', penetrable: true },
  { id: 'east_wall_crate', x: 22.2, y: 0.65, z: 5.2, w: 1.3, h: 1.3, d: 1.6, material: 'wood_crate', penetrable: true },
  { id: 'se_corner_crate', x: 21.8, y: 0.65, z: 21.6, w: 1.5, h: 1.3, d: 1.5, material: 'wood_crate', penetrable: true },

  // Crates in West lane (below B Site)
  { id: 'sw_crate_under', x: -17.8, y: 0.65, z: 8.6, w: 1.35, h: 1.3, d: 1.35, material: 'wood_crate', penetrable: true },
  { id: 'sw_crate_tip', x: -11.9, y: 0.65, z: 5.9, w: 1.2, h: 1.3, d: 1.2, material: 'wood_crate', penetrable: true },
  { id: 'sw_wall_crate', x: -22.2, y: 0.65, z: 15.2, w: 1.2, h: 1.3, d: 1.8, material: 'wood_crate', penetrable: true },
  { id: 'sw_bottom_crate_l', x: -17.1, y: 0.65, z: 21.6, w: 1.45, h: 1.3, d: 1.45, material: 'wood_crate', penetrable: true },
  { id: 'sw_bottom_crate_r', x: -13.8, y: 0.65, z: 21.6, w: 1.5, h: 1.3, d: 1.5, material: 'wood_crate', penetrable: true },

  // CT front low cover crate
  { id: 'ct_front_crate', x: -8.6, y: 0.55, z: -15.3, w: 2.0, h: 1.1, d: 0.95, material: 'wood_crate', penetrable: true },

  // ================= NEW TACTICAL MID & LANE COVER (ELIMINATING EMPTY DEAD-SPACES) =================
  // Mid courtyard central cover cluster
  { id: 'mid_center_block_l', x: -1.8, y: 0.65, z: 1.2, w: 1.4, h: 1.3, d: 1.4, material: 'wood_crate', penetrable: true },
  { id: 'mid_center_block_r', x: -0.3, y: 0.65, z: 1.2, w: 1.3, h: 1.3, d: 1.3, material: 'wood_crate', penetrable: true },
  { id: 'mid_center_block_top', x: -1.0, y: 1.85, z: 1.2, w: 1.2, h: 1.1, d: 1.2, material: 'wood_crate', penetrable: true },
  // Mid connector low barrier
  { id: 'mid_concrete_barrier', x: 2.2, y: 0.55, z: 1.8, w: 1.8, h: 1.1, d: 0.9, material: 'concrete' },

  // A Long approach connector cover
  { id: 'a_long_cover_crate', x: 17.5, y: 0.65, z: -4.5, w: 1.4, h: 1.3, d: 1.4, material: 'wood_crate', penetrable: true },
  { id: 'a_site_cover_crate_sw', x: 11.2, y: 0.65, z: -10.5, w: 1.45, h: 1.3, d: 1.4, material: 'wood_crate', penetrable: true },
  { id: 'a_site_cover_crate_se', x: 20.8, y: 0.65, z: -9.5, w: 1.4, h: 1.3, d: 1.4, material: 'wood_crate', penetrable: true },
  { id: 'a_site_sandbags', x: 16.5, y: 0.45, z: -7.6, w: 2.2, h: 0.9, d: 0.8, material: 'concrete' },

  // B site approach & interior extra tactical positions
  { id: 'b_site_cover_crate_se', x: -15.5, y: 0.65, z: -8.8, w: 1.4, h: 1.3, d: 1.4, material: 'wood_crate', penetrable: true },
  { id: 'b_site_cover_crate_nw', x: -22.8, y: 0.65, z: -11.5, w: 1.4, h: 1.3, d: 1.4, material: 'wood_crate', penetrable: true },
  { id: 'b_site_sandbags', x: -17.2, y: 0.45, z: -7.2, w: 2.2, h: 0.9, d: 0.8, material: 'concrete' },

  // T spawn forward lane cover
  { id: 't_lane_cover_w', x: -3.8, y: 0.65, z: 18.2, w: 1.4, h: 1.3, d: 1.4, material: 'wood_crate', penetrable: true },
  { id: 't_lane_cover_mid', x: 8.5, y: 0.65, z: 12.0, w: 1.5, h: 1.3, d: 1.4, material: 'wood_crate', penetrable: true },
  { id: 'b_lane_connector_crate', x: -11.2, y: 0.65, z: 12.8, w: 1.4, h: 1.3, d: 1.4, material: 'wood_crate', penetrable: true },

  // ================= ENRICHED TACTICAL COVERS (CLEAN MATCH TO REFERENCE BLUEPRINT) =================
  // 1. T Spawn Logistics Depot & Courtyard (Blue container + tactical wooden crate stacks)
  { id: 't_spawn_shipping_cont', x: 8.5, y: 1.3, z: 22.8, w: 2.5, h: 2.6, d: 5.2, material: 'metal_container' },
  { id: 't_spawn_ammo_crate_1', x: -3.5, y: 0.65, z: 24.2, w: 1.4, h: 1.3, d: 1.4, material: 'wood_crate', penetrable: true },

  // 2. Mid Courtyard Central Cover
  { id: 'mid_catwalk_crate', x: 2.2, y: 0.65, z: 9.5, w: 1.35, h: 1.3, d: 1.35, material: 'wood_crate', penetrable: true },
  { id: 'mid_window_cover', x: -4.5, y: 0.65, z: 0.5, w: 1.4, h: 1.3, d: 1.4, material: 'wood_crate', penetrable: true },

  // 3. Long A Corridor (East Lane - Blue shipping container + crates)
  { id: 'long_a_container', x: 22.4, y: 1.3, z: 8.5, w: 2.4, h: 2.6, d: 5.4, material: 'metal_container' },
  { id: 'long_a_corner_sandbags', x: 21.2, y: 0.5, z: -1.2, w: 2.2, h: 1.0, d: 1.1, material: 'concrete' },
  { id: 'long_a_pit_crates', x: 16.5, y: 0.65, z: 12.5, w: 1.4, h: 1.3, d: 1.4, material: 'wood_crate', penetrable: true },

  // 4. Bombsite A Platform
  { id: 'a_site_ramp_stack', x: 12.0, y: 0.65, z: -8.0, w: 1.4, h: 1.3, d: 1.4, material: 'wood_crate', penetrable: true },

  // 5. Bombsite B Platform (Blue shipping container + crates)
  { id: 'b_site_container', x: -22.5, y: 1.3, z: -10.5, w: 2.4, h: 2.6, d: 5.2, material: 'metal_container' },
];

export const DUST_ALLEY_BOXES: MapBox[] = RAW_BOXES.map((b) => ({
  ...b,
  x: Number((b.x * S).toFixed(2)),
  z: Number((b.z * S).toFixed(2)),
  w: Number((b.w * (b.material === 'wood_crate' ? 1.12 : S)).toFixed(2)),
  d: Number((b.d * (b.material === 'wood_crate' ? 1.12 : S)).toFixed(2)),
}));

export const DUST_ALLEY_SIGNS: MapDecalSign[] = [];

export const DUST_ALLEY_PROPS: PropInstance[] = [
  // Oil Drum Clusters & Hazard Barrels
  { id: 'barrel_a_1', type: 'barrel', position: [17.8 * S, 0, -9.2 * S], scale: 1.05 },
  { id: 'barrel_a_2', type: 'barrel', position: [18.7 * S, 0, -9.8 * S], scale: 1.05 },
  { id: 'barrel_a_3', type: 'barrel', position: [17.9 * S, 0, -10.5 * S], scale: 1.05 },
  { id: 'barrel_mid_1', type: 'barrel', position: [2.2 * S, 0, -3.6 * S], scale: 1.05 },
  { id: 'barrel_mid_2', type: 'barrel', position: [2.2 * S, 0, -2.5 * S], scale: 1.05 },
  { id: 'barrel_ne_1', type: 'barrel', position: [20.2 * S, 0, -15.8 * S], scale: 1.05 },
  { id: 'barrel_b_cluster1', type: 'barrel', position: [-22.5 * S, 0, -8.5 * S], scale: 1.08 },
  { id: 'barrel_b_cluster2', type: 'barrel', position: [-21.8 * S, 0, -9.2 * S], scale: 1.08 },
  { id: 'barrel_t_spawn', type: 'barrel', position: [-5.2 * S, 0, 23.5 * S], scale: 1.05 },

  // Sandbag Parapets & Fortifications
  { id: 'sandbags_a_site', type: 'sandbags', position: [16.2 * S, 0, -8.2 * S], rotationY: 0.15, scale: 1.1 },
  { id: 'sandbags_b_site', type: 'sandbags', position: [-17.5 * S, 0, -7.8 * S], rotationY: -0.2, scale: 1.1 },
  { id: 'sandbags_mid_nest', type: 'sandbags', position: [-1.8 * S, 0, 8.2 * S], rotationY: 0, scale: 1.15 },
  { id: 'sandbags_long_a', type: 'sandbags', position: [21.5 * S, 0, 0.8 * S], rotationY: Math.PI / 2, scale: 1.1 },

  // Tactical Wall Sconce Lamps with Warm Night/Dusk Glow Pools matching reference map 1:1
  // North Perimeter Wall
  { id: 'lamp_n_1', type: 'lamp', position: [-16.0 * S, 0, -23.4 * S], rotationY: 0 },
  { id: 'lamp_n_2', type: 'lamp', position: [-4.0 * S, 0, -23.4 * S], rotationY: 0 },
  { id: 'lamp_n_3', type: 'lamp', position: [7.0 * S, 0, -23.4 * S], rotationY: 0 },
  { id: 'lamp_n_4', type: 'lamp', position: [18.0 * S, 0, -23.4 * S], rotationY: 0 },
  // West Perimeter Wall
  { id: 'lamp_w_1', type: 'lamp', position: [-23.4 * S, 0, -12.5 * S], rotationY: Math.PI / 2 },
  { id: 'lamp_w_2', type: 'lamp', position: [-23.4 * S, 0, 7.5 * S], rotationY: Math.PI / 2 },
  // East Perimeter Wall
  { id: 'lamp_e_1', type: 'lamp', position: [23.4 * S, 0, -11.0 * S], rotationY: -Math.PI / 2 },
  { id: 'lamp_e_2', type: 'lamp', position: [23.4 * S, 0, 16.0 * S], rotationY: -Math.PI / 2 },
  // South Perimeter Wall
  { id: 'lamp_s_1', type: 'lamp', position: [-5.0 * S, 0, 23.4 * S], rotationY: Math.PI },
  { id: 'lamp_s_2', type: 'lamp', position: [17.0 * S, 0, 23.4 * S], rotationY: Math.PI },
  // Interior Tactical Points
  { id: 'lamp_b_site', type: 'lamp', position: [-12.0 * S, 0, -8.0 * S], rotationY: 0 },
  { id: 'lamp_b_tunnel', type: 'lamp', position: [-15.5 * S, 0, 6.8 * S], rotationY: Math.PI },
  { id: 'lamp_mid_center', type: 'lamp', position: [-1.8 * S, 0, 4.5 * S], rotationY: 0 },
  { id: 'lamp_mid_t_wall', type: 'lamp', position: [3.5 * S, 0, 6.5 * S], rotationY: -Math.PI / 2 },
  { id: 'lamp_long_a_corner', type: 'lamp', position: [10.2 * S, 0, -1.2 * S], rotationY: 0 },
  { id: 'lamp_t_courtyard', type: 'lamp', position: [1.5 * S, 0, 16.5 * S], rotationY: Math.PI },
];

export function isPointInZone(x: number, z: number, zone: ZoneBounds): boolean {
  return x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ;
}

export function getActiveBombSite(x: number, z: number): BombSite | null {
  if (isPointInZone(x, z, BOMBSITE_ZONES.A)) return 'A';
  if (isPointInZone(x, z, BOMBSITE_ZONES.B)) return 'B';
  return null;
}
