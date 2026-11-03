// server.ts
import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocket, WebSocketServer } from "ws";

// src/engine/NavGraph.ts
var S = 1.3;
var RAW_WAYPOINTS = [
  // T Spawn (South)
  { id: "t_spawn_c", x: 3.5, y: 0, z: 20.2, neighbors: ["t_spawn_w", "t_spawn_e"], tag: "T_SPAWN" },
  { id: "t_spawn_w", x: -6.5, y: 0, z: 18.5, neighbors: ["t_spawn_c", "sw_lane", "mid_south"], tag: "T_SPAWN" },
  { id: "t_spawn_e", x: 13, y: 0, z: 18, neighbors: ["t_spawn_c", "se_lane", "mid_se"], tag: "T_SPAWN" },
  // Central / Mid Lanes
  { id: "mid_south", x: -2, y: 0, z: 11.5, neighbors: ["t_spawn_w", "mid_center", "mid_se"], tag: "MID" },
  { id: "mid_se", x: 7.5, y: 0, z: 10.5, neighbors: ["t_spawn_e", "mid_south", "short_a_s"], tag: "MID" },
  { id: "mid_center", x: -1.8, y: 0, z: 1.5, neighbors: ["mid_south", "mid_north", "b_mid_conn", "short_a_s"], tag: "MID" },
  { id: "mid_north", x: -1.8, y: 0, z: -9.5, neighbors: ["mid_center", "ct_mid_e", "b_ct_entry", "a_west_entry"], tag: "MID" },
  // East / A Lane
  { id: "se_lane", x: 18, y: 0, z: 11, neighbors: ["t_spawn_e", "long_a_mid"], tag: "LONG_A" },
  { id: "long_a_mid", x: 18.2, y: 0, z: 0, neighbors: ["se_lane", "long_a_north", "short_a_s"], tag: "LONG_A" },
  { id: "short_a_s", x: 8.5, y: 0, z: 3.5, neighbors: ["mid_se", "mid_center", "long_a_mid"], tag: "SHORT_A" },
  { id: "long_a_north", x: 18.5, y: 0, z: -6.5, neighbors: ["long_a_mid", "site_a_center", "site_a_east"], tag: "LONG_A" },
  // Bombsite A (Upper Right)
  { id: "a_west_entry", x: 7.5, y: 0, z: -10.5, neighbors: ["mid_north", "ct_mid_e", "site_a_center"], tag: "SITE_A" },
  { id: "site_a_center", x: 13.3, y: 0, z: -10.7, neighbors: ["a_west_entry", "long_a_north", "site_a_east"], tag: "SITE_A" },
  { id: "site_a_east", x: 15.5, y: 0, z: -9, neighbors: ["site_a_center", "long_a_north"], tag: "SITE_A" },
  // West / B Lane
  { id: "sw_lane", x: -11, y: 0, z: 13, neighbors: ["t_spawn_w", "west_outer_s", "b_mid_conn"], tag: "B_TUNNELS" },
  { id: "west_outer_s", x: -19.5, y: 0, z: 12.5, neighbors: ["sw_lane", "west_outer_n"], tag: "B_TUNNELS" },
  { id: "west_outer_n", x: -18, y: 0, z: 2.5, neighbors: ["west_outer_s", "b_south_entry", "b_mid_conn"], tag: "B_TUNNELS" },
  { id: "b_mid_conn", x: -10.5, y: 0, z: 2, neighbors: ["sw_lane", "west_outer_n", "mid_center"], tag: "B_TUNNELS" },
  { id: "b_south_entry", x: -17.5, y: 0, z: -5.2, neighbors: ["west_outer_n", "site_b_center"], tag: "SITE_B" },
  // Bombsite B (Upper Left)
  { id: "site_b_center", x: -16, y: 0, z: -10.7, neighbors: ["b_south_entry", "site_b_north", "b_ct_entry"], tag: "SITE_B" },
  { id: "site_b_north", x: -16, y: 0, z: -14.8, neighbors: ["site_b_center", "ct_west_exit"], tag: "SITE_B" },
  { id: "b_ct_entry", x: -8.5, y: 0, z: -9.5, neighbors: ["site_b_center", "mid_north", "ct_west_exit"], tag: "SITE_B" },
  // CT Spawn (North)
  { id: "ct_spawn_c", x: -5.5, y: 0, z: -20, neighbors: ["ct_west_exit", "ct_mid_e"], tag: "CT_SPAWN" },
  { id: "ct_west_exit", x: -12.5, y: 0, z: -20.5, neighbors: ["ct_spawn_c", "site_b_north", "b_ct_entry"], tag: "CT_SPAWN" },
  { id: "ct_mid_e", x: 2.5, y: 0, z: -13, neighbors: ["ct_spawn_c", "mid_north", "a_west_entry"], tag: "CT_SPAWN" }
];
var DUST_ALLEY_WAYPOINTS = RAW_WAYPOINTS.map((wp) => ({
  ...wp,
  x: Number((wp.x * S).toFixed(2)),
  z: Number((wp.z * S).toFixed(2))
}));
var NavGraph = class {
  constructor(waypoints = DUST_ALLEY_WAYPOINTS) {
    this.nodes = /* @__PURE__ */ new Map();
    for (const wp of waypoints) {
      this.nodes.set(wp.id, wp);
    }
  }
  getWaypoint(id) {
    return this.nodes.get(id);
  }
  findNearestWaypoint(x, z) {
    let best = DUST_ALLEY_WAYPOINTS[0];
    let bestDistSq = Infinity;
    for (const wp of this.nodes.values()) {
      const dx = wp.x - x;
      const dz = wp.z - z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = wp;
      }
    }
    return best;
  }
  /**
   * Standard A* shortest path between two positions on the Dust Alley graph.
   */
  findPath(startX, startZ, goalX, goalZ) {
    const startNode = this.findNearestWaypoint(startX, startZ);
    const goalNode = this.findNearestWaypoint(goalX, goalZ);
    if (startNode.id === goalNode.id) {
      return [[goalX, goalNode.y, goalZ]];
    }
    const openSet = /* @__PURE__ */ new Set([startNode.id]);
    const cameFrom = /* @__PURE__ */ new Map();
    const gScore = /* @__PURE__ */ new Map();
    const fScore = /* @__PURE__ */ new Map();
    for (const id of this.nodes.keys()) {
      gScore.set(id, Infinity);
      fScore.set(id, Infinity);
    }
    gScore.set(startNode.id, 0);
    fScore.set(startNode.id, this.heuristic(startNode, goalNode));
    while (openSet.size > 0) {
      let currentId = "";
      let lowestF = Infinity;
      for (const id of openSet) {
        const f = fScore.get(id) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          currentId = id;
        }
      }
      if (!currentId) break;
      if (currentId === goalNode.id) {
        return this.reconstructPath(cameFrom, currentId, goalX, goalZ);
      }
      openSet.delete(currentId);
      const current = this.nodes.get(currentId);
      for (const neighborId of current.neighbors) {
        const neighbor = this.nodes.get(neighborId);
        if (!neighbor) continue;
        const tentativeG = (gScore.get(currentId) ?? Infinity) + this.heuristic(current, neighbor);
        if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
          cameFrom.set(neighborId, currentId);
          gScore.set(neighborId, tentativeG);
          fScore.set(
            neighborId,
            tentativeG + this.heuristic(neighbor, goalNode)
          );
          openSet.add(neighborId);
        }
      }
    }
    return [[goalX, 0, goalZ]];
  }
  heuristic(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }
  reconstructPath(cameFrom, currentId, finalX, finalZ) {
    const path2 = [];
    let curr = currentId;
    while (curr) {
      const node = this.nodes.get(curr);
      if (node) {
        path2.unshift([node.x, node.y, node.z]);
      }
      curr = cameFrom.get(curr);
    }
    path2.push([finalX, 0, finalZ]);
    return path2;
  }
};
var defaultNavGraph = new NavGraph();

// src/world/DustAlleyMap.ts
var PLAYER_DIMENSIONS = {
  HEIGHT_STAND: 1.8,
  EYE_STAND: 1.65,
  HEIGHT_CROUCH: 1.38,
  EYE_CROUCH: 1.26,
  RADIUS: 0.36,
  STEP_HEIGHT: 0.45
};
var BOMBSITE_ZONES = {
  B: { minX: -27.5, maxX: -14.2, minZ: -20.5, maxZ: -7.5, y: 0 },
  A: { minX: 10.5, maxX: 23.8, minZ: -20.5, maxZ: -7.5, y: 0 }
};
var CT_SPAWNS = [
  { x: -7.15, y: 0, z: -26.6, yaw: Math.PI },
  { x: -9.75, y: 0, z: -27.5, yaw: Math.PI },
  { x: -4.55, y: 0, z: -27.5, yaw: Math.PI },
  { x: -10.6, y: 0, z: -24.7, yaw: Math.PI + 0.15 },
  { x: -3.65, y: 0, z: -24.7, yaw: Math.PI - 0.15 }
];
var T_SPAWNS = [
  { x: 4.55, y: 0, z: 26.2, yaw: 0 },
  { x: 1.55, y: 0, z: 27.3, yaw: 0 },
  { x: 7.55, y: 0, z: 27.3, yaw: 0 },
  { x: -1.3, y: 0, z: 25.3, yaw: -0.15 },
  { x: 10.4, y: 0, z: 25.3, yaw: 0.15 }
];
var S2 = 1.3;
var RAW_BOXES = [
  // ================= OUTER PERIMETER BOUNDARY WALLS =================
  { id: "wall_north", x: 0, y: 2.5, z: -24, w: 49.6, h: 5, d: 1.4, material: "concrete" },
  { id: "wall_south", x: 0, y: 2.5, z: 24, w: 49.6, h: 5, d: 1.4, material: "concrete" },
  { id: "wall_west", x: -24, y: 2.5, z: 0, w: 1.4, h: 5, d: 49.6, material: "concrete" },
  { id: "wall_east", x: 24, y: 2.5, z: 0, w: 1.4, h: 5, d: 49.6, material: "concrete" },
  // Outer perimeter top metallic trim
  { id: "trim_north", x: 0, y: 5.1, z: -24, w: 49.8, h: 0.25, d: 1.6, material: "dark_metal", noCollide: true },
  { id: "trim_south", x: 0, y: 5.1, z: 24, w: 49.8, h: 0.25, d: 1.6, material: "dark_metal", noCollide: true },
  { id: "trim_west", x: -24, y: 5.1, z: 0, w: 1.6, h: 0.25, d: 49.8, material: "dark_metal", noCollide: true },
  { id: "trim_east", x: 24, y: 5.1, z: 0, w: 1.6, h: 0.25, d: 49.8, material: "dark_metal", noCollide: true },
  // 4 Corner Fortress Towers with Battlements (matching reference map)
  { id: "tower_nw", x: -24, y: 2.8, z: -24, w: 3.2, h: 5.6, d: 3.2, material: "concrete" },
  { id: "tower_nw_cap", x: -24, y: 5.8, z: -24, w: 3.5, h: 0.4, d: 3.5, material: "dark_metal", noCollide: true },
  { id: "tower_ne", x: 24, y: 2.8, z: -24, w: 3.2, h: 5.6, d: 3.2, material: "concrete" },
  { id: "tower_ne_cap", x: 24, y: 5.8, z: -24, w: 3.5, h: 0.4, d: 3.5, material: "dark_metal", noCollide: true },
  { id: "tower_sw", x: -24, y: 2.8, z: 24, w: 3.2, h: 5.6, d: 3.2, material: "concrete" },
  { id: "tower_sw_cap", x: -24, y: 5.8, z: 24, w: 3.5, h: 0.4, d: 3.5, material: "dark_metal", noCollide: true },
  { id: "tower_se", x: 24, y: 2.8, z: 24, w: 3.2, h: 5.6, d: 3.2, material: "concrete" },
  { id: "tower_se_cap", x: 24, y: 5.8, z: 24, w: 3.5, h: 0.4, d: 3.5, material: "dark_metal", noCollide: true },
  // ================= CT SPAWN ALCOVE (TOP NORTH-LEFT) =================
  { id: "ct_alcove_w", x: -10.2, y: 2.1, z: -20.2, w: 1, h: 4.2, d: 6.2, material: "concrete" },
  { id: "ct_alcove_e", x: -1, y: 2.1, z: -20.2, w: 1, h: 4.2, d: 6.2, material: "concrete" },
  { id: "ct_front_wall", x: -5.2, y: 2, z: -14.2, w: 10.6, h: 4, d: 1.1, material: "asphalt" },
  { id: "ct_front_trim", x: -5.2, y: 4.05, z: -14.2, w: 10.8, h: 0.18, d: 1.25, material: "dark_metal", noCollide: true },
  // ================= NORTH-EAST WALL (ABOVE A SITE) =================
  { id: "ne_top_wall", x: 11.5, y: 2, z: -17.6, w: 23, h: 4, d: 1.1, material: "asphalt" },
  { id: "ne_top_trim", x: 11.5, y: 4.05, z: -17.6, w: 23.2, h: 0.18, d: 1.25, material: "dark_metal", noCollide: true },
  // ================= NORTH-WEST WALLS (AROUND B SITE) =================
  { id: "nw_short_wall", x: -20.8, y: 2, z: -17.6, w: 4.8, h: 4, d: 1.1, material: "asphalt" },
  { id: "nw_short_trim", x: -20.8, y: 4.05, z: -17.6, w: 5, h: 0.18, d: 1.25, material: "dark_metal", noCollide: true },
  { id: "b_east_t_top", x: -12, y: 2, z: -17.8, w: 4.6, h: 4, d: 1.1, material: "asphalt" },
  { id: "b_east_t_stem", x: -11.5, y: 2, z: -12.6, w: 1.1, h: 4, d: 9.8, material: "asphalt" },
  { id: "b_east_t_trim", x: -11.5, y: 4.05, z: -12.6, w: 1.25, h: 0.18, d: 10, material: "dark_metal", noCollide: true },
  // ================= WEST / B-LANE WALLS =================
  { id: "west_edge_wall", x: -20.6, y: 2, z: -2, w: 1.1, h: 4, d: 7.2, material: "asphalt" },
  { id: "west_edge_trim", x: -20.6, y: 4.05, z: -2, w: 1.25, h: 0.18, d: 7.4, material: "dark_metal", noCollide: true },
  { id: "b_south_wall", x: -11.2, y: 2, z: -3.2, w: 10.2, h: 4, d: 1.1, material: "asphalt" },
  { id: "b_south_trim", x: -11.2, y: 4.05, z: -3.2, w: 10.4, h: 0.18, d: 1.25, material: "dark_metal", noCollide: true },
  { id: "sw_horiz_wall", x: -15.4, y: 2, z: 7.2, w: 8.2, h: 4, d: 1.1, material: "asphalt" },
  { id: "sw_horiz_trim", x: -15.4, y: 4.05, z: 7.2, w: 8.4, h: 0.18, d: 1.25, material: "dark_metal", noCollide: true },
  { id: "sw_stub_wall", x: -15.5, y: 2, z: 19.8, w: 1.1, h: 4, d: 6.8, material: "asphalt" },
  { id: "sw_stub_trim", x: -15.5, y: 4.05, z: 19.8, w: 1.25, h: 0.18, d: 7, material: "dark_metal", noCollide: true },
  // ================= CENTRAL MID DIVIDER WALLS =================
  { id: "mid_left_wall", x: -7.2, y: 2, z: 7.4, w: 1.1, h: 4, d: 14.2, material: "asphalt" },
  { id: "mid_left_trim", x: -7.2, y: 4.05, z: 7.4, w: 1.25, h: 0.18, d: 14.4, material: "dark_metal", noCollide: true },
  { id: "mid_right_wall", x: 3.5, y: 2, z: -1.8, w: 1.1, h: 4, d: 16.4, material: "asphalt" },
  { id: "mid_right_trim", x: 3.5, y: 4.05, z: -1.8, w: 1.25, h: 0.18, d: 16.6, material: "dark_metal", noCollide: true },
  // ================= EAST / A-LANE T-WALL =================
  { id: "a_south_horiz", x: 9.6, y: 2, z: -1.6, w: 7.6, h: 4, d: 1.1, material: "asphalt" },
  { id: "a_south_vert", x: 13.4, y: 2, z: -0.6, w: 1.1, h: 4, d: 9.2, material: "asphalt" },
  { id: "a_south_trim", x: 13.4, y: 4.05, z: -0.6, w: 1.25, h: 0.18, d: 9.4, material: "dark_metal", noCollide: true },
  // ================= T SPAWN SHIELD WALL (SOUTH) =================
  { id: "t_front_wall", x: 3.2, y: 2, z: 15.8, w: 15, h: 4, d: 1.1, material: "asphalt" },
  { id: "t_front_trim", x: 3.2, y: 4.05, z: 15.8, w: 15.2, h: 0.18, d: 1.25, material: "dark_metal", noCollide: true },
  { id: "t_north_stub", x: 3.5, y: 2, z: 11.8, w: 1.1, h: 4, d: 4.4, material: "asphalt" },
  // ================= BOMBSITE B CRATES (UPPER LEFT) =================
  { id: "b_site_crate_sw1", x: -18.2, y: 0.65, z: -8.6, w: 1.35, h: 1.3, d: 1.35, material: "wood_crate", penetrable: true },
  { id: "b_site_crate_sw2", x: -18.2, y: 0.65, z: -10.3, w: 1.3, h: 1.3, d: 1.3, material: "wood_crate", penetrable: true },
  { id: "b_site_crate_sw_top", x: -18.2, y: 1.85, z: -9.4, w: 1.2, h: 1.1, d: 1.2, material: "wood_crate", penetrable: true },
  { id: "b_site_crate_ne", x: -13.8, y: 0.65, z: -12.8, w: 1.45, h: 1.3, d: 1.45, material: "wood_crate", penetrable: true },
  { id: "b_outer_crate_nw", x: -21.5, y: 0.7, z: -15.5, w: 1.5, h: 1.4, d: 1.5, material: "wood_crate", penetrable: true },
  // ================= BOMBSITE A CRATES (UPPER RIGHT) =================
  { id: "a_site_crate_ne1", x: 15.2, y: 0.65, z: -12.8, w: 1.45, h: 1.3, d: 1.45, material: "wood_crate", penetrable: true },
  { id: "a_site_crate_ne2", x: 13.4, y: 0.65, z: -12.8, w: 1.35, h: 1.3, d: 1.35, material: "wood_crate", penetrable: true },
  { id: "a_site_crate_top", x: 14.3, y: 1.85, z: -12.8, w: 1.2, h: 1.1, d: 1.2, material: "wood_crate", penetrable: true },
  { id: "a_north_crate_1", x: 2.2, y: 0.65, z: -16.1, w: 1.35, h: 1.3, d: 1.3, material: "wood_crate", penetrable: true },
  { id: "a_north_crate_2", x: 3.9, y: 0.65, z: -16.1, w: 1.35, h: 1.3, d: 1.3, material: "wood_crate", penetrable: true },
  { id: "a_north_crate_e", x: 18.2, y: 0.65, z: -15.8, w: 1.45, h: 1.3, d: 1.35, material: "wood_crate", penetrable: true },
  // ================= MID & LANE TACTICAL COVER CRATES =================
  { id: "mid_crate_upper_w", x: 2.1, y: 0.65, z: -5.2, w: 1.3, h: 1.3, d: 1.3, material: "wood_crate", penetrable: true },
  { id: "mid_crate_center_e", x: 4.9, y: 0.65, z: 5.6, w: 1.35, h: 1.3, d: 1.35, material: "wood_crate", penetrable: true },
  { id: "mid_crate_lower_e", x: -5.8, y: 0.65, z: 5.5, w: 1.35, h: 1.3, d: 2, material: "wood_crate", penetrable: true },
  { id: "mid_crate_t_stub", x: 2.2, y: 0.65, z: 13.2, w: 1.3, h: 1.3, d: 1.3, material: "wood_crate", penetrable: true },
  { id: "mid_crate_t_front", x: 3.5, y: 0.65, z: 14.5, w: 1.35, h: 1.3, d: 1.2, material: "wood_crate", penetrable: true },
  // Crates in East lane (below A Site T-wall)
  { id: "east_t_crate_1", x: 11.9, y: 0.65, z: 0.4, w: 1.45, h: 1.3, d: 1.45, material: "wood_crate", penetrable: true },
  { id: "east_t_crate_2", x: 9.2, y: 0.55, z: -2.6, w: 2, h: 1.1, d: 1, material: "wood_crate", penetrable: true },
  { id: "east_wall_crate", x: 22.2, y: 0.65, z: 5.2, w: 1.3, h: 1.3, d: 1.6, material: "wood_crate", penetrable: true },
  { id: "se_corner_crate", x: 21.8, y: 0.65, z: 21.6, w: 1.5, h: 1.3, d: 1.5, material: "wood_crate", penetrable: true },
  // Crates in West lane (below B Site)
  { id: "sw_crate_under", x: -17.8, y: 0.65, z: 8.6, w: 1.35, h: 1.3, d: 1.35, material: "wood_crate", penetrable: true },
  { id: "sw_crate_tip", x: -11.9, y: 0.65, z: 5.9, w: 1.2, h: 1.3, d: 1.2, material: "wood_crate", penetrable: true },
  { id: "sw_wall_crate", x: -22.2, y: 0.65, z: 15.2, w: 1.2, h: 1.3, d: 1.8, material: "wood_crate", penetrable: true },
  { id: "sw_bottom_crate_l", x: -17.1, y: 0.65, z: 21.6, w: 1.45, h: 1.3, d: 1.45, material: "wood_crate", penetrable: true },
  { id: "sw_bottom_crate_r", x: -13.8, y: 0.65, z: 21.6, w: 1.5, h: 1.3, d: 1.5, material: "wood_crate", penetrable: true },
  // CT front low cover crate
  { id: "ct_front_crate", x: -8.6, y: 0.55, z: -15.3, w: 2, h: 1.1, d: 0.95, material: "wood_crate", penetrable: true },
  // ================= NEW TACTICAL MID & LANE COVER (ELIMINATING EMPTY DEAD-SPACES) =================
  // Mid courtyard central cover cluster
  { id: "mid_center_block_l", x: -1.8, y: 0.65, z: 1.2, w: 1.4, h: 1.3, d: 1.4, material: "wood_crate", penetrable: true },
  { id: "mid_center_block_r", x: -0.3, y: 0.65, z: 1.2, w: 1.3, h: 1.3, d: 1.3, material: "wood_crate", penetrable: true },
  { id: "mid_center_block_top", x: -1, y: 1.85, z: 1.2, w: 1.2, h: 1.1, d: 1.2, material: "wood_crate", penetrable: true },
  // Mid connector low barrier
  { id: "mid_concrete_barrier", x: 2.2, y: 0.55, z: 1.8, w: 1.8, h: 1.1, d: 0.9, material: "concrete" },
  // A Long approach connector cover
  { id: "a_long_cover_crate", x: 17.5, y: 0.65, z: -4.5, w: 1.4, h: 1.3, d: 1.4, material: "wood_crate", penetrable: true },
  { id: "a_site_cover_crate_sw", x: 11.2, y: 0.65, z: -10.5, w: 1.45, h: 1.3, d: 1.4, material: "wood_crate", penetrable: true },
  { id: "a_site_cover_crate_se", x: 20.8, y: 0.65, z: -9.5, w: 1.4, h: 1.3, d: 1.4, material: "wood_crate", penetrable: true },
  { id: "a_site_sandbags", x: 16.5, y: 0.45, z: -7.6, w: 2.2, h: 0.9, d: 0.8, material: "concrete" },
  // B site approach & interior extra tactical positions
  { id: "b_site_cover_crate_se", x: -15.5, y: 0.65, z: -8.8, w: 1.4, h: 1.3, d: 1.4, material: "wood_crate", penetrable: true },
  { id: "b_site_cover_crate_nw", x: -22.8, y: 0.65, z: -11.5, w: 1.4, h: 1.3, d: 1.4, material: "wood_crate", penetrable: true },
  { id: "b_site_sandbags", x: -17.2, y: 0.45, z: -7.2, w: 2.2, h: 0.9, d: 0.8, material: "concrete" },
  // T spawn forward lane cover
  { id: "t_lane_cover_w", x: -3.8, y: 0.65, z: 18.2, w: 1.4, h: 1.3, d: 1.4, material: "wood_crate", penetrable: true },
  { id: "t_lane_cover_mid", x: 8.5, y: 0.65, z: 12, w: 1.5, h: 1.3, d: 1.4, material: "wood_crate", penetrable: true },
  { id: "b_lane_connector_crate", x: -11.2, y: 0.65, z: 12.8, w: 1.4, h: 1.3, d: 1.4, material: "wood_crate", penetrable: true },
  // ================= ENRICHED TACTICAL COVERS (CLEAN MATCH TO REFERENCE BLUEPRINT) =================
  // 1. T Spawn Logistics Depot & Courtyard (Blue container + tactical wooden crate stacks)
  { id: "t_spawn_shipping_cont", x: 8.5, y: 1.3, z: 22.8, w: 2.5, h: 2.6, d: 5.2, material: "metal_container" },
  { id: "t_spawn_ammo_crate_1", x: -3.5, y: 0.65, z: 24.2, w: 1.4, h: 1.3, d: 1.4, material: "wood_crate", penetrable: true },
  // 2. Mid Courtyard Central Cover
  { id: "mid_catwalk_crate", x: 2.2, y: 0.65, z: 9.5, w: 1.35, h: 1.3, d: 1.35, material: "wood_crate", penetrable: true },
  { id: "mid_window_cover", x: -4.5, y: 0.65, z: 0.5, w: 1.4, h: 1.3, d: 1.4, material: "wood_crate", penetrable: true },
  // 3. Long A Corridor (East Lane - Blue shipping container + crates)
  { id: "long_a_container", x: 22.4, y: 1.3, z: 8.5, w: 2.4, h: 2.6, d: 5.4, material: "metal_container" },
  { id: "long_a_corner_sandbags", x: 21.2, y: 0.5, z: -1.2, w: 2.2, h: 1, d: 1.1, material: "concrete" },
  { id: "long_a_pit_crates", x: 16.5, y: 0.65, z: 12.5, w: 1.4, h: 1.3, d: 1.4, material: "wood_crate", penetrable: true },
  // 4. Bombsite A Platform
  { id: "a_site_ramp_stack", x: 12, y: 0.65, z: -8, w: 1.4, h: 1.3, d: 1.4, material: "wood_crate", penetrable: true },
  // 5. Bombsite B Platform (Blue shipping container + crates)
  { id: "b_site_container", x: -22.5, y: 1.3, z: -10.5, w: 2.4, h: 2.6, d: 5.2, material: "metal_container" }
];
var DUST_ALLEY_BOXES = RAW_BOXES.map((b) => ({
  ...b,
  x: Number((b.x * S2).toFixed(2)),
  z: Number((b.z * S2).toFixed(2)),
  w: Number((b.w * (b.material === "wood_crate" ? 1.12 : S2)).toFixed(2)),
  d: Number((b.d * (b.material === "wood_crate" ? 1.12 : S2)).toFixed(2))
}));
var DUST_ALLEY_PROPS = [
  // Oil Drum Clusters & Hazard Barrels
  { id: "barrel_a_1", type: "barrel", position: [17.8 * S2, 0, -9.2 * S2], scale: 1.05 },
  { id: "barrel_a_2", type: "barrel", position: [18.7 * S2, 0, -9.8 * S2], scale: 1.05 },
  { id: "barrel_a_3", type: "barrel", position: [17.9 * S2, 0, -10.5 * S2], scale: 1.05 },
  { id: "barrel_mid_1", type: "barrel", position: [2.2 * S2, 0, -3.6 * S2], scale: 1.05 },
  { id: "barrel_mid_2", type: "barrel", position: [2.2 * S2, 0, -2.5 * S2], scale: 1.05 },
  { id: "barrel_ne_1", type: "barrel", position: [20.2 * S2, 0, -15.8 * S2], scale: 1.05 },
  { id: "barrel_b_cluster1", type: "barrel", position: [-22.5 * S2, 0, -8.5 * S2], scale: 1.08 },
  { id: "barrel_b_cluster2", type: "barrel", position: [-21.8 * S2, 0, -9.2 * S2], scale: 1.08 },
  { id: "barrel_t_spawn", type: "barrel", position: [-5.2 * S2, 0, 23.5 * S2], scale: 1.05 },
  // Sandbag Parapets & Fortifications
  { id: "sandbags_a_site", type: "sandbags", position: [16.2 * S2, 0, -8.2 * S2], rotationY: 0.15, scale: 1.1 },
  { id: "sandbags_b_site", type: "sandbags", position: [-17.5 * S2, 0, -7.8 * S2], rotationY: -0.2, scale: 1.1 },
  { id: "sandbags_mid_nest", type: "sandbags", position: [-1.8 * S2, 0, 8.2 * S2], rotationY: 0, scale: 1.15 },
  { id: "sandbags_long_a", type: "sandbags", position: [21.5 * S2, 0, 0.8 * S2], rotationY: Math.PI / 2, scale: 1.1 },
  // Tactical Wall Sconce Lamps with Warm Night/Dusk Glow Pools matching reference map 1:1
  // North Perimeter Wall
  { id: "lamp_n_1", type: "lamp", position: [-16 * S2, 0, -23.4 * S2], rotationY: 0 },
  { id: "lamp_n_2", type: "lamp", position: [-4 * S2, 0, -23.4 * S2], rotationY: 0 },
  { id: "lamp_n_3", type: "lamp", position: [7 * S2, 0, -23.4 * S2], rotationY: 0 },
  { id: "lamp_n_4", type: "lamp", position: [18 * S2, 0, -23.4 * S2], rotationY: 0 },
  // West Perimeter Wall
  { id: "lamp_w_1", type: "lamp", position: [-23.4 * S2, 0, -12.5 * S2], rotationY: Math.PI / 2 },
  { id: "lamp_w_2", type: "lamp", position: [-23.4 * S2, 0, 7.5 * S2], rotationY: Math.PI / 2 },
  // East Perimeter Wall
  { id: "lamp_e_1", type: "lamp", position: [23.4 * S2, 0, -11 * S2], rotationY: -Math.PI / 2 },
  { id: "lamp_e_2", type: "lamp", position: [23.4 * S2, 0, 16 * S2], rotationY: -Math.PI / 2 },
  // South Perimeter Wall
  { id: "lamp_s_1", type: "lamp", position: [-5 * S2, 0, 23.4 * S2], rotationY: Math.PI },
  { id: "lamp_s_2", type: "lamp", position: [17 * S2, 0, 23.4 * S2], rotationY: Math.PI },
  // Interior Tactical Points
  { id: "lamp_b_site", type: "lamp", position: [-12 * S2, 0, -8 * S2], rotationY: 0 },
  { id: "lamp_b_tunnel", type: "lamp", position: [-15.5 * S2, 0, 6.8 * S2], rotationY: Math.PI },
  { id: "lamp_mid_center", type: "lamp", position: [-1.8 * S2, 0, 4.5 * S2], rotationY: 0 },
  { id: "lamp_mid_t_wall", type: "lamp", position: [3.5 * S2, 0, 6.5 * S2], rotationY: -Math.PI / 2 },
  { id: "lamp_long_a_corner", type: "lamp", position: [10.2 * S2, 0, -1.2 * S2], rotationY: 0 },
  { id: "lamp_t_courtyard", type: "lamp", position: [1.5 * S2, 0, 16.5 * S2], rotationY: Math.PI }
];
function isPointInZone(x, z, zone) {
  return x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ;
}
function getActiveBombSite(x, z) {
  if (isPointInZone(x, z, BOMBSITE_ZONES.A)) return "A";
  if (isPointInZone(x, z, BOMBSITE_ZONES.B)) return "B";
  return null;
}

// src/engine/Physics.ts
var PhysicsWorld = class {
  constructor(boxes = DUST_ALLEY_BOXES) {
    this.colliders = [];
    this.cellSize = 8;
    this.grid = /* @__PURE__ */ new Map();
    this.buildFromBoxes(boxes);
  }
  buildFromBoxes(boxes) {
    this.colliders = [];
    this.grid.clear();
    for (const b of boxes) {
      if (b.noCollide) continue;
      const aabb = {
        id: b.id,
        minX: b.x - b.w * 0.5,
        maxX: b.x + b.w * 0.5,
        minY: b.y - b.h * 0.5,
        maxY: b.y + b.h * 0.5,
        minZ: b.z - b.d * 0.5,
        maxZ: b.z + b.d * 0.5,
        penetrable: Boolean(b.penetrable),
        isRamp: Boolean(b.isRamp),
        rampDir: b.rampDir
      };
      this.colliders.push(aabb);
      const minCellX = Math.floor(aabb.minX / this.cellSize);
      const maxCellX = Math.floor(aabb.maxX / this.cellSize);
      const minCellZ = Math.floor(aabb.minZ / this.cellSize);
      const maxCellZ = Math.floor(aabb.maxZ / this.cellSize);
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        for (let cz = minCellZ; cz <= maxCellZ; cz++) {
          const key = `${cx},${cz}`;
          let cell = this.grid.get(key);
          if (!cell) {
            cell = [];
            this.grid.set(key, cell);
          }
          cell.push(aabb);
        }
      }
    }
  }
  getNearbyColliders(x, z, radius) {
    const minCellX = Math.floor((x - radius) / this.cellSize);
    const maxCellX = Math.floor((x + radius) / this.cellSize);
    const minCellZ = Math.floor((z - radius) / this.cellSize);
    const maxCellZ = Math.floor((z + radius) / this.cellSize);
    const result = [];
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const cell = this.grid.get(`${cx},${cz}`);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            const c = cell[i];
            if (!result.includes(c)) {
              result.push(c);
            }
          }
        }
      }
    }
    return result;
  }
  /**
   * Computes exact ground height at (x, z) including ramps and platforms.
   */
  getGroundHeightAt(x, z, currentY = 0) {
    let highest = 0;
    const nearby = this.getNearbyColliders(x, z, 0.5);
    for (let i = 0; i < nearby.length; i++) {
      const c = nearby[i];
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
        if (c.isRamp && c.rampDir) {
          let t = 0;
          if (c.rampDir === "+z") t = (z - c.minZ) / (c.maxZ - c.minZ);
          else if (c.rampDir === "-z") t = (c.maxZ - z) / (c.maxZ - c.minZ);
          else if (c.rampDir === "+x") t = (x - c.minX) / (c.maxX - c.minX);
          else if (c.rampDir === "-x") t = (c.maxX - x) / (c.maxX - c.minX);
          const rampY = c.minY + Math.max(0, Math.min(1, t)) * (c.maxY - c.minY);
          if (rampY <= currentY + PLAYER_DIMENSIONS.STEP_HEIGHT + 0.35 && rampY > highest) {
            highest = rampY;
          }
        } else if (c.maxY <= currentY + PLAYER_DIMENSIONS.STEP_HEIGHT + 0.25 && c.maxY > highest) {
          highest = c.maxY;
        }
      }
    }
    return highest;
  }
  /**
   * FPS Kinematic Character Controller with friction, acceleration, air-strafe,
   * gravity, jump, crouch, auto-step on stairs/ramps, and smooth slide collision.
   */
  stepCharacter(state, wishDirX, wishDirZ, maxSpeed, jumpPressed, dt) {
    const gravity = 20.5;
    const groundFriction = 10.5;
    const groundAccel = 14;
    const airAccel = 4.2;
    const jumpVelocity = 6.9;
    const radius = PLAYER_DIMENSIONS.RADIUS;
    const height = state.crouching ? PLAYER_DIMENSIONS.HEIGHT_CROUCH : PLAYER_DIMENSIONS.HEIGHT_STAND;
    let [px, py, pz] = state.position;
    let [vx, vy, vz] = state.velocity;
    if (state.grounded) {
      const speed = Math.hypot(vx, vz);
      if (speed > 1e-3) {
        const drop = speed * groundFriction * dt;
        const newSpeed = Math.max(0, speed - drop) / speed;
        vx *= newSpeed;
        vz *= newSpeed;
      } else {
        vx = 0;
        vz = 0;
      }
    }
    const wishLen = Math.hypot(wishDirX, wishDirZ);
    if (wishLen > 1e-3) {
      const nx = wishDirX / wishLen;
      const nz = wishDirZ / wishLen;
      const currentSpeedInWish = vx * nx + vz * nz;
      const effectiveMax = state.grounded ? maxSpeed : Math.min(maxSpeed, 4.2);
      const addSpeed = effectiveMax - currentSpeedInWish;
      if (addSpeed > 0) {
        const accel = state.grounded ? groundAccel : airAccel;
        const accelSpeed = Math.min(addSpeed, accel * maxSpeed * dt);
        vx += accelSpeed * nx;
        vz += accelSpeed * nz;
      }
    }
    if (state.grounded && jumpPressed) {
      vy = jumpVelocity;
      state.grounded = false;
    }
    vy -= gravity * dt;
    px += vx * dt;
    pz += vz * dt;
    const nearby = this.getNearbyColliders(px, pz, radius + 1.2);
    for (let i = 0; i < nearby.length; i++) {
      const c = nearby[i];
      if (c.isRamp && c.rampDir) {
        if (px >= c.minX - radius * 0.4 && px <= c.maxX + radius * 0.4 && pz >= c.minZ - radius * 0.4 && pz <= c.maxZ + radius * 0.4) {
          let t = 0;
          if (c.rampDir === "+z") t = (pz - c.minZ) / (c.maxZ - c.minZ);
          else if (c.rampDir === "-z") t = (c.maxZ - pz) / (c.maxZ - c.minZ);
          else if (c.rampDir === "+x") t = (px - c.minX) / (c.maxX - c.minX);
          else if (c.rampDir === "-x") t = (c.maxX - px) / (c.maxX - c.minX);
          const rampY = c.minY + Math.max(0, Math.min(1, t)) * (c.maxY - c.minY);
          if (py >= rampY - 0.55 && py <= rampY + 0.35 && vy <= 0.1) {
            py = rampY;
            vy = 0;
            state.grounded = true;
          }
          continue;
        }
      }
      if (py + height <= c.minY + 0.02 || py >= c.maxY - 0.02) {
        continue;
      }
      const closestX = Math.max(c.minX, Math.min(px, c.maxX));
      const closestZ = Math.max(c.minZ, Math.min(pz, c.maxZ));
      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        const stepDelta = c.maxY - py;
        if (stepDelta > 0 && stepDelta <= PLAYER_DIMENSIONS.STEP_HEIGHT && vy <= 0.5) {
          py = c.maxY;
          vy = 0;
          state.grounded = true;
          continue;
        }
        const dist = Math.sqrt(distSq);
        if (dist > 1e-4) {
          const overlap = radius - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          px += nx * overlap;
          pz += nz * overlap;
          const vn = vx * nx + vz * nz;
          if (vn < 0) {
            vx -= vn * nx;
            vz -= vn * nz;
          }
        } else {
          const penLeft = px - c.minX + radius;
          const penRight = c.maxX - px + radius;
          const penBack = pz - c.minZ + radius;
          const penFront = c.maxZ - pz + radius;
          const minPen = Math.min(penLeft, penRight, penBack, penFront);
          if (minPen === penLeft) {
            px = c.minX - radius;
            vx = Math.min(0, vx);
          } else if (minPen === penRight) {
            px = c.maxX + radius;
            vx = Math.max(0, vx);
          } else if (minPen === penBack) {
            pz = c.minZ - radius;
            vz = Math.min(0, vz);
          } else {
            pz = c.maxZ + radius;
            vz = Math.max(0, vz);
          }
        }
      }
    }
    py += vy * dt;
    let floorY = 0;
    for (let i = 0; i < nearby.length; i++) {
      const c = nearby[i];
      if (c.isRamp) continue;
      const closestX = Math.max(c.minX, Math.min(px, c.maxX));
      const closestZ = Math.max(c.minZ, Math.min(pz, c.maxZ));
      const dx = px - closestX;
      const dz = pz - closestZ;
      if (dx * dx + dz * dz < radius * 0.85 * (radius * 0.85)) {
        if (py >= c.maxY - 0.35 && py <= c.maxY + 0.15 && vy <= 0) {
          if (c.maxY > floorY) floorY = c.maxY;
        }
        if (py + height > c.minY && py < c.minY && vy > 0) {
          py = c.minY - height;
          vy = 0;
        }
      }
    }
    const rampFloor = this.getGroundHeightAt(px, pz, py);
    if (rampFloor > floorY) {
      floorY = rampFloor;
    }
    if (py <= floorY) {
      py = floorY;
      vy = 0;
      state.grounded = true;
    } else {
      state.grounded = false;
    }
    state.position[0] = px;
    state.position[1] = py;
    state.position[2] = pz;
    state.velocity[0] = vx;
    state.velocity[1] = vy;
    state.velocity[2] = vz;
  }
  /**
   * Fast slab-method Ray vs AABB intersection for hitscan weapons,
   * line-of-sight checks, and wallbang penetration.
   */
  raycastWorld(ox, oy, oz, dx, dy, dz, maxDist) {
    const hits = [];
    const invX = Math.abs(dx) > 1e-6 ? 1 / dx : 1e9;
    const invY = Math.abs(dy) > 1e-6 ? 1 / dy : 1e9;
    const invZ = Math.abs(dz) > 1e-6 ? 1 / dz : 1e9;
    if (dy < -1e-5 && oy > 0) {
      const tGround = -oy / dy;
      if (tGround > 0 && tGround <= maxDist) {
        hits.push({
          distance: tGround,
          point: [ox + dx * tGround, 0, oz + dz * tGround],
          normal: [0, 1, 0],
          boxId: "ground",
          penetrable: false
        });
      }
    }
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      const t1 = (c.minX - ox) * invX;
      const t2 = (c.maxX - ox) * invX;
      const t3 = (c.minY - oy) * invY;
      const t4 = (c.maxY - oy) * invY;
      const t5 = (c.minZ - oz) * invZ;
      const t6 = (c.maxZ - oz) * invZ;
      const tmin = Math.max(
        Math.min(t1, t2),
        Math.min(t3, t4),
        Math.min(t5, t6)
      );
      const tmax = Math.min(
        Math.max(t1, t2),
        Math.max(t3, t4),
        Math.max(t5, t6)
      );
      if (tmax >= 0 && tmin <= tmax && tmin <= maxDist) {
        const hitDist = tmin >= 0 ? tmin : 0;
        const hx = ox + dx * hitDist;
        const hy = oy + dy * hitDist;
        const hz = oz + dz * hitDist;
        let nx = 0;
        let ny = 0;
        let nz = 0;
        const eps = 2e-3;
        if (Math.abs(hx - c.minX) < eps) nx = -1;
        else if (Math.abs(hx - c.maxX) < eps) nx = 1;
        else if (Math.abs(hy - c.minY) < eps) ny = -1;
        else if (Math.abs(hy - c.maxY) < eps) ny = 1;
        else if (Math.abs(hz - c.minZ) < eps) nz = -1;
        else nz = 1;
        hits.push({
          distance: hitDist,
          point: [hx, hy, hz],
          normal: [nx, ny, nz],
          boxId: c.id,
          penetrable: c.penetrable
        });
      }
    }
    hits.sort((a, b) => a.distance - b.distance);
    return hits;
  }
  /**
   * Checks clear line of sight between two 3D points, also checking active smoke clouds.
   */
  hasLineOfSight(ax, ay, az, bx, by, bz, smokeClouds = []) {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.01) return true;
    const nx = dx / dist;
    const ny = dy / dist;
    const nz = dz / dist;
    for (let i = 0; i < smokeClouds.length; i++) {
      const s = smokeClouds[i];
      const sx = s.position[0] - ax;
      const sy = s.position[1] - ay;
      const sz = s.position[2] - az;
      const proj = sx * nx + sy * ny + sz * nz;
      if (proj > 0 && proj < dist) {
        const perpSq = sx * sx + sy * sy + sz * sz - proj * proj;
        if (perpSq < s.radius * s.radius) {
          return false;
        }
      }
    }
    const hits = this.raycastWorld(ax, ay, az, nx, ny, nz, dist - 0.05);
    return hits.length === 0;
  }
};

// src/game/BombLogic.ts
var BOMB_CONSTANTS = {
  PLANT_TIME: 3.2,
  // seconds
  BOMB_TIMER: 40,
  // seconds after plant
  DEFUSE_TIME_NO_KIT: 10,
  // seconds
  DEFUSE_TIME_WITH_KIT: 5,
  // seconds
  EXPLOSION_MAX_DAMAGE: 500,
  EXPLOSION_RADIUS: 38,
  // meters
  INTERACTION_RADIUS: 2.6
  // meters to pick up or defuse C4
};
function createInitialBombData(carrierId, spawnPos) {
  return {
    state: carrierId ? "carried" : "dropped",
    carrierId,
    position: [...spawnPos],
    site: null,
    plantProgress: 0,
    planterId: null,
    timeRemaining: BOMB_CONSTANTS.BOMB_TIMER,
    defuseProgress: 0,
    defuserId: null,
    defuserHasKit: false,
    beepTimer: 0
  };
}

// src/game/WeaponsDB.ts
var EQUIPMENT_DB = {
  kevlar: {
    id: "kevlar",
    name: "Kamizelka Kevlar",
    price: 650,
    team: "BOTH",
    description: "Redukuje obra\u017Cenia w tu\u0142\xF3w i brzuch o 50%.",
    hotkey: "E1"
  },
  kevlar_helmet: {
    id: "kevlar_helmet",
    name: "Kamizelka + He\u0142m",
    price: 1e3,
    team: "BOTH",
    description: "Pe\u0142na ochrona balistyczna tu\u0142owia oraz g\u0142owy przed strza\u0142em.",
    hotkey: "E2"
  },
  defuse_kit: {
    id: "defuse_kit",
    name: "Zestaw do rozbrajania",
    price: 400,
    team: "CT",
    description: "Skraca czas rozbrajania \u0142adunku C4 z 10 s do 5 s.",
    hotkey: "E3"
  }
};
var WEAPONS_DB = {
  glock: {
    id: "glock",
    name: "Glock-18",
    shortName: "GLOCK-18",
    category: "pistol",
    slot: 2,
    team: "T",
    price: 200,
    killReward: 300,
    damage: 30,
    armorPenetration: 0.49,
    wallPenetration: 0.25,
    fireRate: 480,
    automatic: false,
    canSpamHold: true,
    pellets: 1,
    magSize: 20,
    reserveAmmo: 120,
    reloadTime: 2.1,
    deployTime: 0.42,
    moveSpeed: 5,
    baseSpread: 9e-3,
    crouchSpreadMult: 0.68,
    moveSpreadBonus: 0.028,
    jumpSpreadBonus: 0.13,
    spamSpreadPerShot: 0.015,
    recoilVertical: 0.017,
    recoilHorizontal: 9e-3,
    recoilRecoveryRate: 7.8,
    range: 85,
    hotkey: "1"
  },
  usp: {
    id: "usp",
    name: "USP-S Tactical",
    shortName: "USP-S",
    category: "pistol",
    slot: 2,
    team: "CT",
    price: 200,
    killReward: 300,
    damage: 35,
    armorPenetration: 0.52,
    wallPenetration: 0.28,
    fireRate: 400,
    automatic: false,
    canSpamHold: true,
    pellets: 1,
    magSize: 12,
    reserveAmmo: 36,
    reloadTime: 2.15,
    deployTime: 0.42,
    moveSpeed: 5,
    baseSpread: 55e-4,
    crouchSpreadMult: 0.62,
    moveSpreadBonus: 0.032,
    jumpSpreadBonus: 0.14,
    spamSpreadPerShot: 0.018,
    recoilVertical: 0.021,
    recoilHorizontal: 8e-3,
    recoilRecoveryRate: 8.2,
    range: 95,
    hotkey: "1"
  },
  p250: {
    id: "p250",
    name: "P250 Compact",
    shortName: "P250",
    category: "pistol",
    slot: 2,
    team: "BOTH",
    price: 300,
    killReward: 300,
    damage: 38,
    armorPenetration: 0.64,
    wallPenetration: 0.32,
    fireRate: 440,
    automatic: false,
    canSpamHold: true,
    pellets: 1,
    magSize: 13,
    reserveAmmo: 26,
    reloadTime: 2.1,
    deployTime: 0.42,
    moveSpeed: 4.95,
    baseSpread: 8e-3,
    crouchSpreadMult: 0.65,
    moveSpreadBonus: 0.034,
    jumpSpreadBonus: 0.15,
    spamSpreadPerShot: 0.019,
    recoilVertical: 0.023,
    recoilHorizontal: 0.01,
    recoilRecoveryRate: 7.6,
    range: 90,
    hotkey: "2"
  },
  cz75: {
    id: "cz75",
    name: "CZ75-Auto",
    shortName: "CZ75-AUTO",
    category: "pistol",
    slot: 2,
    team: "BOTH",
    price: 500,
    killReward: 300,
    damage: 31,
    armorPenetration: 0.77,
    wallPenetration: 0.3,
    fireRate: 600,
    automatic: true,
    canSpamHold: true,
    pellets: 1,
    magSize: 12,
    reserveAmmo: 24,
    reloadTime: 2.5,
    deployTime: 0.6,
    moveSpeed: 4.95,
    baseSpread: 0.013,
    crouchSpreadMult: 0.7,
    moveSpreadBonus: 0.042,
    jumpSpreadBonus: 0.17,
    spamSpreadPerShot: 0.022,
    recoilVertical: 0.026,
    recoilHorizontal: 0.016,
    recoilRecoveryRate: 6.5,
    range: 75,
    hotkey: "3"
  },
  deagle: {
    id: "deagle",
    name: "Desert Eagle .50 AE",
    shortName: "DEAGLE",
    category: "pistol",
    slot: 2,
    team: "BOTH",
    price: 700,
    killReward: 300,
    damage: 63,
    armorPenetration: 0.93,
    wallPenetration: 0.7,
    fireRate: 285,
    automatic: false,
    canSpamHold: true,
    pellets: 1,
    magSize: 7,
    reserveAmmo: 35,
    reloadTime: 2.2,
    deployTime: 0.52,
    moveSpeed: 4.75,
    baseSpread: 5e-3,
    crouchSpreadMult: 0.55,
    moveSpreadBonus: 0.085,
    jumpSpreadBonus: 0.25,
    spamSpreadPerShot: 0.048,
    recoilVertical: 0.056,
    recoilHorizontal: 0.022,
    recoilRecoveryRate: 4.4,
    range: 110,
    hotkey: "4"
  },
  mp9: {
    id: "mp9",
    name: "MP9 Tactical",
    shortName: "MP9",
    category: "smg",
    slot: 1,
    team: "CT",
    price: 1250,
    killReward: 600,
    damage: 26,
    armorPenetration: 0.6,
    wallPenetration: 0.25,
    fireRate: 857,
    automatic: true,
    pellets: 1,
    magSize: 30,
    reserveAmmo: 120,
    reloadTime: 2.1,
    deployTime: 0.45,
    moveSpeed: 5,
    baseSpread: 0.012,
    crouchSpreadMult: 0.72,
    moveSpreadBonus: 0.024,
    jumpSpreadBonus: 0.085,
    spamSpreadPerShot: 0.012,
    recoilVertical: 0.018,
    recoilHorizontal: 0.012,
    recoilRecoveryRate: 8.4,
    range: 80,
    hotkey: "1"
  },
  mac10: {
    id: "mac10",
    name: "MAC-10 Ingram",
    shortName: "MAC-10",
    category: "smg",
    slot: 1,
    team: "T",
    price: 1050,
    killReward: 600,
    damage: 29,
    armorPenetration: 0.57,
    wallPenetration: 0.25,
    fireRate: 800,
    automatic: true,
    pellets: 1,
    magSize: 30,
    reserveAmmo: 100,
    reloadTime: 2.35,
    deployTime: 0.45,
    moveSpeed: 5,
    baseSpread: 0.015,
    crouchSpreadMult: 0.75,
    moveSpreadBonus: 0.025,
    jumpSpreadBonus: 0.09,
    spamSpreadPerShot: 0.014,
    recoilVertical: 0.02,
    recoilHorizontal: 0.014,
    recoilRecoveryRate: 8,
    range: 75,
    hotkey: "1"
  },
  ump45: {
    id: "ump45",
    name: "UMP-45 Tactical",
    shortName: "UMP-45",
    category: "smg",
    slot: 1,
    team: "BOTH",
    price: 1200,
    killReward: 600,
    damage: 35,
    armorPenetration: 0.65,
    wallPenetration: 0.35,
    fireRate: 666,
    automatic: true,
    pellets: 1,
    magSize: 25,
    reserveAmmo: 100,
    reloadTime: 2.5,
    deployTime: 0.5,
    moveSpeed: 4.85,
    baseSpread: 0.011,
    crouchSpreadMult: 0.68,
    moveSpreadBonus: 0.03,
    jumpSpreadBonus: 0.11,
    spamSpreadPerShot: 0.015,
    recoilVertical: 0.022,
    recoilHorizontal: 0.011,
    recoilRecoveryRate: 7.5,
    range: 85,
    hotkey: "2"
  },
  nova: {
    id: "nova",
    name: "Benelli Nova",
    shortName: "NOVA",
    category: "heavy",
    slot: 1,
    team: "BOTH",
    price: 1050,
    killReward: 900,
    damage: 26,
    // per pellet (8 pellets)
    armorPenetration: 0.5,
    wallPenetration: 0.15,
    fireRate: 75,
    automatic: false,
    canSpamHold: true,
    pellets: 8,
    magSize: 8,
    reserveAmmo: 32,
    reloadTime: 2.8,
    deployTime: 0.55,
    moveSpeed: 4.65,
    baseSpread: 0.045,
    crouchSpreadMult: 0.85,
    moveSpreadBonus: 0.028,
    jumpSpreadBonus: 0.065,
    spamSpreadPerShot: 0.025,
    recoilVertical: 0.052,
    recoilHorizontal: 0.018,
    recoilRecoveryRate: 5.5,
    range: 55,
    hotkey: "3"
  },
  galil: {
    id: "galil",
    name: "Galil AR",
    shortName: "GALIL AR",
    category: "rifle",
    slot: 1,
    team: "T",
    price: 1800,
    killReward: 300,
    damage: 30,
    armorPenetration: 0.775,
    wallPenetration: 0.48,
    fireRate: 666,
    automatic: true,
    pellets: 1,
    magSize: 35,
    reserveAmmo: 90,
    reloadTime: 2.45,
    deployTime: 0.55,
    moveSpeed: 4.6,
    baseSpread: 7e-3,
    crouchSpreadMult: 0.64,
    moveSpreadBonus: 0.082,
    jumpSpreadBonus: 0.21,
    spamSpreadPerShot: 0.016,
    recoilVertical: 0.026,
    recoilHorizontal: 0.013,
    recoilRecoveryRate: 6.8,
    range: 125,
    hotkey: "1"
  },
  famas: {
    id: "famas",
    name: "FAMAS F1",
    shortName: "FAMAS",
    category: "rifle",
    slot: 1,
    team: "CT",
    price: 2050,
    killReward: 300,
    damage: 30,
    armorPenetration: 0.7,
    wallPenetration: 0.45,
    fireRate: 666,
    automatic: true,
    pellets: 1,
    magSize: 25,
    reserveAmmo: 90,
    reloadTime: 2.5,
    deployTime: 0.55,
    moveSpeed: 4.65,
    baseSpread: 65e-4,
    crouchSpreadMult: 0.62,
    moveSpreadBonus: 0.076,
    jumpSpreadBonus: 0.2,
    spamSpreadPerShot: 0.015,
    recoilVertical: 0.024,
    recoilHorizontal: 0.011,
    recoilRecoveryRate: 7.1,
    range: 125,
    hotkey: "1"
  },
  ak47: {
    id: "ak47",
    name: "AK-47 Kalashnikov",
    shortName: "AK-47",
    category: "rifle",
    slot: 1,
    team: "T",
    price: 2700,
    killReward: 300,
    damage: 36,
    armorPenetration: 0.78,
    wallPenetration: 0.58,
    fireRate: 600,
    automatic: true,
    pellets: 1,
    magSize: 30,
    reserveAmmo: 90,
    reloadTime: 2.43,
    deployTime: 0.58,
    moveSpeed: 4.5,
    baseSpread: 55e-4,
    crouchSpreadMult: 0.6,
    moveSpreadBonus: 0.095,
    jumpSpreadBonus: 0.24,
    spamSpreadPerShot: 0.019,
    recoilVertical: 0.031,
    recoilHorizontal: 0.014,
    recoilRecoveryRate: 6.3,
    range: 140,
    hotkey: "2"
  },
  m4a1s: {
    id: "m4a1s",
    name: "M4A1-S Silenced",
    shortName: "M4A1-S",
    category: "rifle",
    slot: 1,
    team: "CT",
    price: 2900,
    killReward: 300,
    damage: 38,
    armorPenetration: 0.7,
    wallPenetration: 0.52,
    fireRate: 600,
    automatic: true,
    pellets: 1,
    magSize: 25,
    reserveAmmo: 75,
    reloadTime: 2.38,
    deployTime: 0.55,
    moveSpeed: 4.65,
    baseSpread: 42e-4,
    crouchSpreadMult: 0.58,
    moveSpreadBonus: 0.075,
    jumpSpreadBonus: 0.2,
    spamSpreadPerShot: 0.014,
    recoilVertical: 0.022,
    recoilHorizontal: 9e-3,
    recoilRecoveryRate: 7.4,
    range: 140,
    hotkey: "2"
  },
  ssg08: {
    id: "ssg08",
    name: "SSG 08 Scout",
    shortName: "SSG 08",
    category: "rifle",
    slot: 1,
    team: "BOTH",
    price: 1700,
    killReward: 300,
    damage: 88,
    armorPenetration: 0.85,
    wallPenetration: 0.78,
    fireRate: 48,
    automatic: false,
    pellets: 1,
    magSize: 10,
    reserveAmmo: 90,
    reloadTime: 2.9,
    deployTime: 0.65,
    moveSpeed: 4.8,
    baseSpread: 0.042,
    crouchSpreadMult: 0.65,
    moveSpreadBonus: 0.08,
    jumpSpreadBonus: 0.06,
    spamSpreadPerShot: 0.03,
    recoilVertical: 0.065,
    recoilHorizontal: 0.012,
    recoilRecoveryRate: 5.5,
    zoomLevels: [30, 12],
    scopedSpreadMult: 0.04,
    range: 200,
    hotkey: "3"
  },
  aug: {
    id: "aug",
    name: "AUG A3 Scoped",
    shortName: "AUG",
    category: "rifle",
    slot: 1,
    team: "BOTH",
    price: 3300,
    killReward: 300,
    damage: 32,
    armorPenetration: 0.9,
    wallPenetration: 0.55,
    fireRate: 600,
    automatic: true,
    pellets: 1,
    magSize: 30,
    reserveAmmo: 90,
    reloadTime: 2.75,
    deployTime: 0.6,
    moveSpeed: 4.55,
    baseSpread: 48e-4,
    crouchSpreadMult: 0.56,
    moveSpreadBonus: 0.082,
    jumpSpreadBonus: 0.22,
    spamSpreadPerShot: 0.015,
    recoilVertical: 0.024,
    recoilHorizontal: 0.01,
    recoilRecoveryRate: 7,
    zoomLevels: [40],
    scopedSpreadMult: 0.42,
    range: 150,
    hotkey: "4"
  },
  awp: {
    id: "awp",
    name: "AWP Magnum Sniper",
    shortName: "AWP",
    category: "heavy",
    slot: 1,
    team: "BOTH",
    price: 4750,
    killReward: 100,
    damage: 115,
    armorPenetration: 0.975,
    wallPenetration: 0.92,
    fireRate: 41,
    automatic: false,
    pellets: 1,
    magSize: 5,
    reserveAmmo: 30,
    reloadTime: 3.55,
    deployTime: 0.82,
    moveSpeed: 4.15,
    baseSpread: 0.08,
    crouchSpreadMult: 0.7,
    moveSpreadBonus: 0.15,
    jumpSpreadBonus: 0.35,
    spamSpreadPerShot: 0.05,
    recoilVertical: 0.09,
    recoilHorizontal: 0.02,
    recoilRecoveryRate: 4,
    zoomLevels: [28, 10],
    scopedSpreadMult: 0.012,
    range: 240,
    hotkey: "5"
  },
  knife: {
    id: "knife",
    name: "N\xF3\u017C Taktyczny M9",
    shortName: "N\xD3\u017B M9",
    category: "melee",
    slot: 3,
    team: "BOTH",
    price: 0,
    killReward: 1500,
    damage: 40,
    // LPM 40, PPM 65
    armorPenetration: 0.85,
    wallPenetration: 0,
    fireRate: 150,
    automatic: false,
    canSpamHold: true,
    pellets: 1,
    magSize: 1,
    reserveAmmo: 0,
    reloadTime: 0,
    deployTime: 0.85,
    moveSpeed: 5.2,
    baseSpread: 0,
    crouchSpreadMult: 1,
    moveSpreadBonus: 0,
    jumpSpreadBonus: 0,
    spamSpreadPerShot: 0,
    recoilVertical: 0,
    recoilHorizontal: 0,
    recoilRecoveryRate: 10,
    range: 2.45
  },
  he_grenade: {
    id: "he_grenade",
    name: "Granat Od\u0142amkowy HE",
    shortName: "HE",
    category: "grenade",
    slot: 4,
    team: "BOTH",
    price: 300,
    killReward: 300,
    damage: 98,
    armorPenetration: 0.6,
    wallPenetration: 0,
    fireRate: 60,
    automatic: false,
    pellets: 1,
    magSize: 1,
    reserveAmmo: 0,
    reloadTime: 0,
    deployTime: 0.38,
    moveSpeed: 5.1,
    baseSpread: 0,
    crouchSpreadMult: 1,
    moveSpreadBonus: 0,
    jumpSpreadBonus: 0,
    spamSpreadPerShot: 0,
    recoilVertical: 0,
    recoilHorizontal: 0,
    recoilRecoveryRate: 10,
    range: 38,
    hotkey: "1"
  },
  flashbang: {
    id: "flashbang",
    name: "Granat B\u0142yskowy Flash",
    shortName: "FLASH",
    category: "grenade",
    slot: 4,
    team: "BOTH",
    price: 200,
    killReward: 300,
    damage: 1,
    armorPenetration: 1,
    wallPenetration: 0,
    fireRate: 60,
    automatic: false,
    pellets: 1,
    magSize: 1,
    reserveAmmo: 0,
    reloadTime: 0,
    deployTime: 0.38,
    moveSpeed: 5.1,
    baseSpread: 0,
    crouchSpreadMult: 1,
    moveSpreadBonus: 0,
    jumpSpreadBonus: 0,
    spamSpreadPerShot: 0,
    recoilVertical: 0,
    recoilHorizontal: 0,
    recoilRecoveryRate: 10,
    range: 48,
    hotkey: "2"
  },
  smoke_grenade: {
    id: "smoke_grenade",
    name: "Granat Dymny Smoke",
    shortName: "SMOKE",
    category: "grenade",
    slot: 4,
    team: "BOTH",
    price: 300,
    killReward: 300,
    damage: 0,
    armorPenetration: 1,
    wallPenetration: 0,
    fireRate: 60,
    automatic: false,
    pellets: 1,
    magSize: 1,
    reserveAmmo: 0,
    reloadTime: 0,
    deployTime: 0.38,
    moveSpeed: 5.1,
    baseSpread: 0,
    crouchSpreadMult: 1,
    moveSpreadBonus: 0,
    jumpSpreadBonus: 0,
    spamSpreadPerShot: 0,
    recoilVertical: 0,
    recoilHorizontal: 0,
    recoilRecoveryRate: 10,
    range: 42,
    hotkey: "3"
  },
  c4: {
    id: "c4",
    name: "\u0141adunek Wybuchowy C4",
    shortName: "C4",
    category: "melee",
    slot: 5,
    team: "T",
    price: 0,
    killReward: 0,
    damage: 0,
    armorPenetration: 1,
    wallPenetration: 0,
    fireRate: 60,
    automatic: false,
    pellets: 1,
    magSize: 1,
    reserveAmmo: 0,
    reloadTime: 0,
    deployTime: 0.4,
    moveSpeed: 5.1,
    baseSpread: 0,
    crouchSpreadMult: 1,
    moveSpreadBonus: 0,
    jumpSpreadBonus: 0,
    spamSpreadPerShot: 0,
    recoilVertical: 0,
    recoilHorizontal: 0,
    recoilRecoveryRate: 10,
    range: 2
  }
};
function getStartingPistol(team) {
  return team === "CT" ? "usp" : "glock";
}

// src/game/BotAI.ts
var DIFFICULTY_PARAMS = {
  easy: {
    reactionDelay: 0.52,
    aimSpreadRad: 0.085,
    burstLength: 3,
    recoilCompensation: 0.35,
    turnSpeed: 4.5
  },
  medium: {
    reactionDelay: 0.34,
    aimSpreadRad: 0.048,
    burstLength: 5,
    recoilCompensation: 0.6,
    turnSpeed: 7
  },
  hard: {
    reactionDelay: 0.21,
    aimSpreadRad: 0.025,
    burstLength: 7,
    recoilCompensation: 0.8,
    turnSpeed: 10.5
  },
  expert: {
    reactionDelay: 0.125,
    aimSpreadRad: 0.012,
    burstLength: 9,
    recoilCompensation: 0.94,
    turnSpeed: 15
  }
};
var BOT_NAMES_CT = ["Phoenix", "Valkyrie", "Sentinel", "Cipher", "Aegis"];
var BOT_NAMES_T = ["Kobra", "mirage", "Viper", "Sabre", "Nomad"];
function pickRoundStrategyT() {
  const r = Math.random();
  if (r < 0.28) return "RUSH_A";
  if (r < 0.54) return "RUSH_B";
  if (r < 0.74) return "MID_TO_A_SPLIT";
  if (r < 0.88) return "MID_CONTROL";
  return "SLOW_DEFAULT";
}
function updateBotAI(bot, allActors, bomb, roundPhase, tStrategy, difficulty, physics, nav, smokeClouds, nowSec, dt, actions) {
  if (!bot.alive) return;
  if (roundPhase === "buy") {
    const desiredWeapon = bot.primaryWeapon || bot.secondaryWeapon;
    if (bot.activeWeapon !== desiredWeapon) {
      bot.activeWeapon = desiredWeapon;
    }
    physics.stepCharacter(bot, 0, 0, 0, false, dt);
    return;
  }
  const params = DIFFICULTY_PARAMS[difficulty];
  bot.utilityCooldown = Math.max(0, bot.utilityCooldown - dt);
  const activeSpec = WEAPONS_DB[bot.activeWeapon];
  if (activeSpec.category !== "melee" && activeSpec.category !== "grenade" && bot.ammoMag[bot.activeWeapon] <= 0 && bot.ammoReserve[bot.activeWeapon] > 0 && bot.reloadTimer <= 0) {
    bot.reloadTimer = activeSpec.reloadTime;
  }
  const isBlinded = bot.flashBlindTimer > 0.35;
  let visibleEnemy = null;
  let closestDist = Infinity;
  const eyeY = bot.position[1] + (bot.crouching ? PLAYER_DIMENSIONS.EYE_CROUCH : PLAYER_DIMENSIONS.EYE_STAND);
  const lookX = -Math.sin(bot.yaw);
  const lookZ = -Math.cos(bot.yaw);
  if (!isBlinded) {
    for (let i = 0; i < allActors.length; i++) {
      const other = allActors[i];
      if (!other.alive || other.team === bot.team) continue;
      const dx = other.position[0] - bot.position[0];
      const dy = other.position[1] + 1.2 - eyeY;
      const dz = other.position[2] - bot.position[2];
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 68) continue;
      const dot = (dx * lookX + dz * lookZ) / Math.max(1e-3, Math.hypot(dx, dz));
      const otherSpeed = Math.hypot(other.velocity[0], other.velocity[2]);
      const heardClose = dist < 12 && otherSpeed > 2.8 && !other.walking;
      if (dot > -0.15 || heardClose) {
        if (physics.hasLineOfSight(
          bot.position[0],
          eyeY,
          bot.position[2],
          other.position[0],
          other.position[1] + 1.25,
          other.position[2],
          smokeClouds
        )) {
          other.spottedUntil = Math.max(other.spottedUntil, nowSec + 3.5);
          if (dist < closestDist) {
            closestDist = dist;
            visibleEnemy = other;
          }
        }
      }
    }
  }
  if (visibleEnemy) {
    if (bot.targetEnemyId !== visibleEnemy.id) {
      bot.targetEnemyId = visibleEnemy.id;
      bot.reactionTimer = params.reactionDelay * (0.85 + Math.random() * 0.3);
      if (Math.random() < 0.25 && bot.utilityCooldown <= 0) {
        const spotLoc = visibleEnemy.position[0] > 14 ? "A" : visibleEnemy.position[0] < -14 ? "B" : "Mid";
        actions.onRadioCallout(bot, `Wr\xF3g zauwa\u017Cony na ${spotLoc}!`);
        bot.utilityCooldown = 6;
      }
    }
    bot.lastKnownEnemyPos = [
      visibleEnemy.position[0],
      visibleEnemy.position[1],
      visibleEnemy.position[2]
    ];
    bot.reactionTimer = Math.max(0, bot.reactionTimer - dt);
    if (bot.grenades.length > 0 && bot.utilityCooldown <= 0 && closestDist > 13 && closestDist < 32 && Math.random() < 0.015) {
      const nade = bot.grenades[0];
      bot.UtilityThrowInternal?.();
      actions.onThrowGrenade(bot, nade, [
        visibleEnemy.position[0],
        visibleEnemy.position[1] + 0.5,
        visibleEnemy.position[2]
      ]);
      bot.utilityCooldown = 8;
    }
    const aimHeight = difficulty === "expert" || difficulty === "hard" ? 1.48 : 1.18;
    const tx = visibleEnemy.position[0] - bot.position[0];
    const ty = visibleEnemy.position[1] + aimHeight - eyeY;
    const tz = visibleEnemy.position[2] - bot.position[2];
    const desiredYaw = Math.atan2(-tx, -tz);
    const desiredPitch = Math.atan2(ty, Math.hypot(tx, tz));
    let yawDiff = desiredYaw - bot.yaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    const turnStep = Math.min(1, params.turnSpeed * dt);
    bot.yaw += yawDiff * turnStep;
    bot.pitch += (desiredPitch - bot.pitch) * turnStep;
    if (bot.reactionTimer <= 0 && Math.abs(yawDiff) < 0.26 && bot.reloadTimer <= 0 && bot.deployTimer <= 0 && bot.fireCooldown <= 0) {
      if (bot.activeWeapon === "c4" || WEAPONS_DB[bot.activeWeapon].category === "grenade") {
        bot.activeWeapon = bot.primaryWeapon || bot.secondaryWeapon;
      } else {
        actions.onFireWeapon(bot);
      }
    }
  } else {
    bot.targetEnemyId = null;
  }
  if (bot.team === "T" && bot.hasC4 && bomb.state === "carried" && !visibleEnemy) {
    const siteZone = bot.assignedSite === "B" ? BOMBSITE_ZONES.B : BOMBSITE_ZONES.A;
    const centerA = [
      (BOMBSITE_ZONES.A.minX + BOMBSITE_ZONES.A.maxX) * 0.5,
      (BOMBSITE_ZONES.A.minZ + BOMBSITE_ZONES.A.maxZ) * 0.5
    ];
    const centerB = [
      (BOMBSITE_ZONES.B.minX + BOMBSITE_ZONES.B.maxX) * 0.5,
      (BOMBSITE_ZONES.B.minZ + BOMBSITE_ZONES.B.maxZ) * 0.5
    ];
    const targetSiteCenter = bot.assignedSite === "B" ? centerB : centerA;
    const distToSite = Math.hypot(
      bot.position[0] - targetSiteCenter[0],
      bot.position[2] - targetSiteCenter[1]
    );
    if (distToSite < 3 && bot.position[0] >= siteZone.minX && bot.position[0] <= siteZone.maxX && bot.position[2] >= siteZone.minZ && bot.position[2] <= siteZone.maxZ) {
      bot.crouching = true;
      physics.stepCharacter(bot, 0, 0, 0, false, dt);
      if (bomb.planterId === null || bomb.planterId === bot.id) {
        if (bomb.planterId !== bot.id) {
          bomb.planterId = bot.id;
          bomb.plantProgress = 0;
          actions.onRadioCallout(bot, "Podk\u0142adam \u0142adunek C4!");
        }
        bomb.plantProgress += dt / BOMB_CONSTANTS.PLANT_TIME;
      }
      return;
    }
  }
  if (bot.team === "CT" && bomb.state === "planted") {
    const distToBomb = Math.hypot(
      bot.position[0] - bomb.position[0],
      bot.position[2] - bomb.position[2]
    );
    if (distToBomb < BOMB_CONSTANTS.INTERACTION_RADIUS && !visibleEnemy) {
      if (bomb.defuserId === null || bomb.defuserId === bot.id) {
        bot.crouching = true;
        physics.stepCharacter(bot, 0, 0, 0, false, dt);
        if (bomb.defuserId !== bot.id) {
          bomb.defuserId = bot.id;
          bomb.defuserHasKit = bot.hasDefuseKit;
          bomb.defuseProgress = 0;
          actions.onRadioCallout(bot, "Rozbrajam bomb\u0119! Os\u0142aniajcie mnie!");
        }
        const reqTime = bot.hasDefuseKit ? BOMB_CONSTANTS.DEFUSE_TIME_WITH_KIT : BOMB_CONSTANTS.DEFUSE_TIME_NO_KIT;
        bomb.defuseProgress += dt / reqTime;
        return;
      }
    }
  }
  bot.repathTimer -= dt;
  if (bot.repathTimer <= 0 || bot.path.length === 0) {
    bot.repathTimer = 1.6 + Math.random() * 0.8;
    const goal = computeBotGoal(bot, bomb, tStrategy);
    bot.path = nav.findPath(bot.position[0], bot.position[2], goal[0], goal[1]);
    bot.pathCursor = 0;
  }
  let wishX = 0;
  let wishZ = 0;
  if (visibleEnemy && closestDist < 26) {
    bot.strafeTimer -= dt;
    if (bot.strafeTimer <= 0) {
      bot.strafeTimer = 0.55 + Math.random() * 0.65;
      bot.strafeDir = Math.random() < 0.5 ? -1 : 1;
      bot.crouching = Math.random() < 0.32;
    }
    const rightX = Math.cos(bot.yaw);
    const rightZ = -Math.sin(bot.yaw);
    wishX = rightX * bot.strafeDir;
    wishZ = rightZ * bot.strafeDir;
  } else if (bot.pathCursor < bot.path.length) {
    bot.crouching = false;
    const targetWp = bot.path[bot.pathCursor];
    const dx = targetWp[0] - bot.position[0];
    const dz = targetWp[2] - bot.position[2];
    const dist = Math.hypot(dx, dz);
    if (dist < 1.35) {
      bot.pathCursor++;
    } else {
      wishX = dx / dist;
      wishZ = dz / dist;
      if (!visibleEnemy) {
        const moveYaw = Math.atan2(-wishX, -wishZ);
        let diff = moveYaw - bot.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        bot.yaw += diff * Math.min(1, 6.5 * dt);
        bot.pitch += (0 - bot.pitch) * Math.min(1, 5 * dt);
      }
    }
  }
  const maxSpeed = WEAPONS_DB[bot.activeWeapon].moveSpeed * (bot.crouching ? 0.52 : 0.92);
  physics.stepCharacter(bot, wishX, wishZ, maxSpeed, false, dt);
  const horizSpeed = Math.hypot(bot.velocity[0], bot.velocity[2]);
  bot.walkCycle += horizSpeed * dt * 1.9;
}
function computeBotGoal(bot, bomb, tStrategy) {
  if (bomb.state === "planted") {
    const jitterX = (Math.random() - 0.5) * 3.5;
    const jitterZ = (Math.random() - 0.5) * 3.5;
    if (bot.team === "CT") {
      return [bomb.position[0], bomb.position[2]];
    }
    return [bomb.position[0] + jitterX, bomb.position[2] + jitterZ];
  }
  if (bot.team === "T" && bomb.state === "dropped") {
    return [bomb.position[0], bomb.position[2]];
  }
  const siteACenter = [
    (BOMBSITE_ZONES.A.minX + BOMBSITE_ZONES.A.maxX) * 0.5,
    (BOMBSITE_ZONES.A.minZ + BOMBSITE_ZONES.A.maxZ) * 0.5
  ];
  const siteBCenter = [
    (BOMBSITE_ZONES.B.minX + BOMBSITE_ZONES.B.maxX) * 0.5,
    (BOMBSITE_ZONES.B.minZ + BOMBSITE_ZONES.B.maxZ) * 0.5
  ];
  if (bot.team === "T") {
    if (tStrategy === "RUSH_A") {
      bot.assignedSite = "A";
      return [
        siteACenter[0] + (Math.random() - 0.5) * 2.5,
        siteACenter[1] + (Math.random() - 0.5) * 2.5
      ];
    }
    if (tStrategy === "RUSH_B") {
      bot.assignedSite = "B";
      return [
        siteBCenter[0] + (Math.random() - 0.5) * 2.5,
        siteBCenter[1] + (Math.random() - 0.5) * 2.5
      ];
    }
    if (tStrategy === "MID_TO_A_SPLIT") {
      bot.assignedSite = "A";
      return bot.role === "lurker" || bot.role === "support" ? [7.5, -10.5] : [siteACenter[0], siteACenter[1]];
    }
    if (bot.assignedSite === "B") return [siteBCenter[0], siteBCenter[1]];
    return [siteACenter[0], siteACenter[1]];
  }
  if (bot.assignedSite === "A") {
    return bot.role === "anchor" ? [siteACenter[0] + 1.5, siteACenter[1] - 1.2] : [8.5, -10.5];
  }
  if (bot.assignedSite === "B") {
    return bot.role === "anchor" ? [siteBCenter[0] - 1.2, siteBCenter[1] - 1.2] : [-15.5, -6.5];
  }
  return [-1.8 + (Math.random() - 0.5) * 2.5, -9.5];
}

// src/game/Economy.ts
var ECONOMY_CONSTANTS = {
  START_MONEY: 800,
  MAX_MONEY: 16e3,
  WIN_REWARD_ELIMINATION: 3250,
  WIN_REWARD_BOMB_DEFUSED: 3500,
  WIN_REWARD_BOMB_EXPLODED: 3500,
  WIN_REWARD_TIME_EXPIRED: 3250,
  LOSS_BONUSES: [1400, 1900, 2400, 2900, 3400],
  BOMB_PLANT_INDIVIDUAL: 300,
  BOMB_PLANT_TEAM_BONUS_ON_LOSS: 800,
  BOMB_DEFUSE_INDIVIDUAL: 300,
  MAX_GRENADES: 4
};
function clampMoney(amount) {
  return Math.max(0, Math.min(ECONOMY_CONSTANTS.MAX_MONEY, Math.round(amount)));
}
function getLossBonus(consecutiveLosses) {
  const idx = Math.max(
    0,
    Math.min(
      ECONOMY_CONSTANTS.LOSS_BONUSES.length - 1,
      consecutiveLosses - 1
    )
  );
  return ECONOMY_CONSTANTS.LOSS_BONUSES[idx];
}
function calculateHitDamage(weaponId, zone, distance, targetArmor, targetHasHelmet, penetratedWallThickness = 0) {
  const spec = WEAPONS_DB[weaponId];
  let base = spec.damage;
  const falloff = Math.pow(0.98, distance / 10);
  base *= falloff;
  if (penetratedWallThickness > 0) {
    const ratio = Math.min(
      0.7,
      penetratedWallThickness / Math.max(0.1, spec.wallPenetration)
    );
    base *= 1 - ratio * 0.65;
  }
  let mult = 1;
  if (zone === "head") mult = 4;
  else if (zone === "stomach") mult = 1.25;
  else if (zone === "legs") mult = 0.75;
  const rawDamage = base * mult;
  const isProtected = targetArmor > 0 && (zone === "chest" || zone === "stomach" || zone === "head" && targetHasHelmet);
  if (!isProtected) {
    return {
      healthDamage: Math.max(1, Math.round(rawDamage)),
      armorDamage: 0,
      isHeadshot: zone === "head"
    };
  }
  const penetratedDamage = rawDamage * spec.armorPenetration;
  const absorbedByArmor = (rawDamage - penetratedDamage) * 0.5;
  const actualArmorCost = Math.min(targetArmor, Math.ceil(absorbedByArmor));
  return {
    healthDamage: Math.max(1, Math.round(penetratedDamage)),
    armorDamage: actualArmorCost,
    isHeadshot: zone === "head"
  };
}
function executeBotAutoBuy(state, preferSniper = false) {
  const next = {
    ...state,
    grenades: [...state.grenades]
  };
  if (next.money >= 3700) {
    if (!next.hasHelmet && next.money >= EQUIPMENT_DB.kevlar_helmet.price) {
      const cost = next.armor >= 50 ? 350 : EQUIPMENT_DB.kevlar_helmet.price;
      next.money -= cost;
      next.armor = 100;
      next.hasHelmet = true;
    }
    if (!next.primary) {
      if (preferSniper && next.money >= WEAPONS_DB.awp.price) {
        next.primary = "awp";
        next.money -= WEAPONS_DB.awp.price;
      } else {
        const rifle = next.team === "CT" ? "m4a1s" : "ak47";
        if (next.money >= WEAPONS_DB[rifle].price) {
          next.primary = rifle;
          next.money -= WEAPONS_DB[rifle].price;
        }
      }
    }
    if (next.team === "CT" && !next.hasDefuseKit && next.money >= EQUIPMENT_DB.defuse_kit.price) {
      next.hasDefuseKit = true;
      next.money -= EQUIPMENT_DB.defuse_kit.price;
    }
    const desiredNades = ["smoke_grenade", "flashbang", "he_grenade"];
    for (const nade of desiredNades) {
      if (next.grenades.length < ECONOMY_CONSTANTS.MAX_GRENADES && !next.grenades.includes(nade) && next.money >= WEAPONS_DB[nade].price) {
        next.grenades.push(nade);
        next.money -= WEAPONS_DB[nade].price;
      }
    }
    return next;
  }
  if (next.money >= 2e3) {
    if (next.armor < 50 && next.money >= EQUIPMENT_DB.kevlar.price) {
      next.armor = 100;
      next.money -= EQUIPMENT_DB.kevlar.price;
    }
    if (!next.primary) {
      const smg = next.team === "CT" ? "mp9" : "mac10";
      if (next.money >= WEAPONS_DB[smg].price) {
        next.primary = smg;
        next.money -= WEAPONS_DB[smg].price;
      }
    }
    if (next.grenades.length < 2 && next.money >= WEAPONS_DB.flashbang.price) {
      next.grenades.push("flashbang");
      next.money -= WEAPONS_DB.flashbang.price;
    }
    return next;
  }
  if (next.money === 800 && next.armor === 0) {
    next.armor = 100;
    next.money -= EQUIPMENT_DB.kevlar.price;
  } else if (next.money >= 1450 && next.secondary !== "deagle") {
    next.secondary = "deagle";
    next.money -= WEAPONS_DB.deagle.price;
  }
  return next;
}

// server.ts
process.on("uncaughtException", (err) => {
  console.error("[DustAlley Server SAFEGUARD] Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[DustAlley Server SAFEGUARD] Unhandled Rejection:", reason);
});
var MAX_GLOBAL_ROOMS = 40;
var MAX_CONCURRENT_PER_IP = 8;
var MAX_ROOM_CREATES_PER_MIN = 3;
var MAX_WS_MSG_PER_SEC = 35;
var ipConnections = /* @__PURE__ */ new Map();
var ipRoomCreates = /* @__PURE__ */ new Map();
var rooms = /* @__PURE__ */ new Map();
var clientToRoom = /* @__PURE__ */ new Map();
var serverPhysics = new PhysicsWorld(DUST_ALLEY_BOXES);
var serverNav = new NavGraph();
var nextClientSeq = 1;
function sendToSocket(ws, type, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}
function broadcastToRoom(room, type, payload) {
  const raw = JSON.stringify({ type, payload });
  for (const ws of room.sockets.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    }
  }
}
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return "VK6LS";
}
function createServerActor(id, name, team, isBot, role, assignedSite) {
  const starterPistol = getStartingPistol(team);
  const ammoMag = {};
  const ammoReserve = {};
  for (const wKey of Object.keys(WEAPONS_DB)) {
    ammoMag[wKey] = WEAPONS_DB[wKey].magSize;
    ammoReserve[wKey] = WEAPONS_DB[wKey].reserveAmmo;
  }
  return {
    id,
    name,
    team,
    isBot,
    role,
    alive: true,
    hp: 100,
    armor: 0,
    hasHelmet: false,
    hasDefuseKit: false,
    hasC4: false,
    money: ECONOMY_CONSTANTS.START_MONEY,
    kills: 0,
    deaths: 0,
    assists: 0,
    mvps: 0,
    ping: isBot ? 0 : 18,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    yaw: team === "CT" ? Math.PI : 0,
    pitch: 0,
    grounded: true,
    crouching: false,
    walking: false,
    walkCycle: 0,
    activeWeapon: starterPistol,
    primaryWeapon: null,
    secondaryWeapon: starterPistol,
    grenades: [],
    ammoMag,
    ammoReserve,
    fireCooldown: 0,
    reloadTimer: 0,
    deployTimer: 0,
    recoilPitch: 0,
    recoilYaw: 0,
    zoomLevel: 0,
    flashBlindTimer: 0,
    hitFlashTimer: 0,
    koTimer: 0,
    spottedUntil: 0,
    path: [],
    pathCursor: 0,
    repathTimer: 0,
    targetEnemyId: null,
    reactionTimer: 0,
    lastKnownEnemyPos: null,
    assignedSite,
    strafeDir: 1,
    strafeTimer: 1,
    utilityCooldown: 0
  };
}
function setupServerRound(room, isPistolRound) {
  room.roundPhase = "buy";
  room.phaseTimer = 5;
  room.tStrategy = pickRoundStrategyT();
  room.spawnPositions.clear();
  let ctIdx = 0;
  let tIdx = 0;
  const tActors = [];
  for (const actor of room.actors) {
    const survivedPrevious = actor.alive && !isPistolRound;
    actor.alive = true;
    actor.hp = 100;
    actor.velocity = [0, 0, 0];
    actor.crouching = false;
    actor.hasC4 = false;
    if (isPistolRound || !survivedPrevious) {
      actor.armor = 0;
      actor.hasHelmet = false;
      actor.hasDefuseKit = false;
      actor.primaryWeapon = null;
      actor.secondaryWeapon = getStartingPistol(actor.team);
      actor.activeWeapon = actor.secondaryWeapon;
      actor.grenades = [];
      if (isPistolRound) {
        actor.money = ECONOMY_CONSTANTS.START_MONEY;
      }
    }
    if (actor.isBot) {
      const bought = executeBotAutoBuy(
        {
          money: actor.money,
          team: actor.team,
          primary: actor.primaryWeapon,
          secondary: actor.secondaryWeapon,
          grenades: actor.grenades,
          armor: actor.armor,
          hasHelmet: actor.hasHelmet,
          hasDefuseKit: actor.hasDefuseKit
        },
        actor.role === "sniper"
      );
      actor.money = bought.money;
      actor.primaryWeapon = bought.primary;
      actor.secondaryWeapon = bought.secondary;
      actor.grenades = bought.grenades;
      actor.armor = bought.armor;
      actor.hasHelmet = bought.hasHelmet;
      actor.hasDefuseKit = bought.hasDefuseKit;
    }
    for (const wKey of Object.keys(WEAPONS_DB)) {
      actor.ammoMag[wKey] = WEAPONS_DB[wKey].magSize;
      actor.ammoReserve[wKey] = WEAPONS_DB[wKey].reserveAmmo;
    }
    actor.activeWeapon = actor.primaryWeapon || actor.secondaryWeapon;
    if (actor.team === "CT") {
      const sp = CT_SPAWNS[ctIdx % CT_SPAWNS.length];
      ctIdx++;
      actor.position = [sp.x, sp.y, sp.z];
      actor.yaw = sp.yaw;
      room.spawnPositions.set(actor.id, { x: sp.x, y: sp.y, z: sp.z });
    } else {
      const sp = T_SPAWNS[tIdx % T_SPAWNS.length];
      tIdx++;
      actor.position = [sp.x, sp.y, sp.z];
      actor.yaw = sp.yaw;
      room.spawnPositions.set(actor.id, { x: sp.x, y: sp.y, z: sp.z });
      tActors.push(actor);
    }
  }
  if (tActors.length > 0) {
    const humanT = tActors.find((a) => !a.isBot);
    const carrier = humanT || tActors[Math.floor(Math.random() * tActors.length)];
    carrier.hasC4 = true;
    room.bomb = createInitialBombData(carrier.id, carrier.position);
  } else {
    room.bomb = createInitialBombData(null, [3.5, 0, 20.2]);
  }
}
function buildSnapshot(room) {
  return {
    roundPhase: room.roundPhase,
    roundNumber: room.roundNumber,
    ctScore: room.ctScore,
    tScore: room.tScore,
    phaseTimeRemaining: room.phaseTimer,
    bomb: room.bomb,
    actors: room.actors.map((a) => ({
      id: a.id,
      name: a.name,
      team: a.team,
      isBot: a.isBot,
      alive: a.alive,
      hp: a.hp,
      armor: a.armor,
      hasHelmet: a.hasHelmet,
      hasDefuseKit: a.hasDefuseKit,
      hasC4: a.hasC4,
      money: a.money,
      kills: a.kills,
      deaths: a.deaths,
      assists: a.assists,
      mvps: a.mvps,
      position: a.position,
      velocity: a.velocity,
      yaw: a.yaw,
      pitch: a.pitch,
      crouching: a.crouching,
      activeWeapon: a.activeWeapon,
      primaryWeapon: a.primaryWeapon,
      secondaryWeapon: a.secondaryWeapon,
      grenades: a.grenades
    }))
  };
}
function emitRoomLobbyState(room) {
  broadcastToRoom(room, "room:state", {
    roomCode: room.code,
    hostId: room.hostId,
    fillWithBots: room.fillWithBots,
    players: Array.from(room.players.values())
  });
}
function handleServerHitscan(room, shooter, origin, dir) {
  const spec = WEAPONS_DB[shooter.activeWeapon];
  const worldHits = serverPhysics.raycastWorld(
    origin[0],
    origin[1],
    origin[2],
    dir[0],
    dir[1],
    dir[2],
    spec.range
  );
  const firstWall = worldHits[0] || null;
  const maxSolidDist = firstWall && !firstWall.penetrable ? firstWall.distance : spec.range;
  let hitActor = null;
  let hitDist = maxSolidDist;
  let hitZone = "chest";
  for (const target of room.actors) {
    if (!target.alive || target.id === shooter.id || target.team === shooter.team) {
      continue;
    }
    const actorHeight = target.crouching ? PLAYER_DIMENSIONS.HEIGHT_CROUCH : PLAYER_DIMENSIONS.HEIGHT_STAND;
    const radius = 0.42;
    const toX = target.position[0] - origin[0];
    const toZ = target.position[2] - origin[2];
    const proj = toX * dir[0] + toZ * dir[2];
    if (proj < 0 || proj > hitDist) continue;
    const closestX = origin[0] + dir[0] * proj;
    const closestY = origin[1] + dir[1] * proj;
    const closestZ = origin[2] + dir[2] * proj;
    const distSqXZ = (closestX - target.position[0]) ** 2 + (closestZ - target.position[2]) ** 2;
    if (distSqXZ <= radius * radius && closestY >= target.position[1] && closestY <= target.position[1] + actorHeight) {
      hitActor = target;
      hitDist = proj;
      const relY = (closestY - target.position[1]) / actorHeight;
      if (relY > 0.78) hitZone = "head";
      else if (relY > 0.52) hitZone = "chest";
      else if (relY > 0.34) hitZone = "stomach";
      else hitZone = "legs";
    }
  }
  const endTarget = [
    origin[0] + dir[0] * hitDist,
    origin[1] + dir[1] * hitDist,
    origin[2] + dir[2] * hitDist
  ];
  broadcastToRoom(room, "match:shot", {
    shooterId: shooter.id,
    weaponId: shooter.activeWeapon,
    origin,
    target: endTarget
  });
  if (!hitActor) return;
  const isWallbang = Boolean(firstWall && firstWall.distance < hitDist);
  const dmg = calculateHitDamage(
    shooter.activeWeapon,
    hitZone,
    hitDist,
    hitActor.armor,
    hitActor.hasHelmet,
    isWallbang ? 0.32 : 0
  );
  hitActor.hp = Math.max(0, hitActor.hp - dmg.healthDamage);
  hitActor.armor = Math.max(0, hitActor.armor - dmg.armorDamage);
  broadcastToRoom(room, "match:hit", {
    shooterId: shooter.id,
    victimId: hitActor.id,
    isHeadshot: dmg.isHeadshot
  });
  if (hitActor.hp <= 0) {
    hitActor.alive = false;
    hitActor.deaths += 1;
    hitActor.primaryWeapon = null;
    hitActor.secondaryWeapon = getStartingPistol(hitActor.team);
    hitActor.activeWeapon = hitActor.secondaryWeapon;
    hitActor.grenades = [];
    hitActor.armor = 0;
    hitActor.hasHelmet = false;
    hitActor.hasDefuseKit = false;
    shooter.kills += 1;
    shooter.money = clampMoney(shooter.money + spec.killReward);
    if (hitActor.hasC4) {
      hitActor.hasC4 = false;
      room.bomb.state = "dropped";
      room.bomb.carrierId = null;
      room.bomb.position = [
        hitActor.position[0],
        hitActor.position[1] + 0.05,
        hitActor.position[2]
      ];
    }
    broadcastToRoom(room, "match:kill", {
      id: `${Date.now()}_${Math.random()}`,
      killerName: shooter.name,
      killerTeam: shooter.team,
      victimName: hitActor.name,
      victimTeam: hitActor.team,
      weaponId: shooter.activeWeapon,
      isHeadshot: dmg.isHeadshot,
      isWallbang,
      timestamp: Date.now()
    });
    checkServerTeamElimination(room);
  }
}
function checkServerTeamElimination(room) {
  if (room.roundPhase !== "live" && room.roundPhase !== "planted") return;
  const ctTotal = room.actors.filter((a) => a.team === "CT").length;
  const tTotal = room.actors.filter((a) => a.team === "T").length;
  if (ctTotal > 0 && tTotal > 0) {
    const ctAlive = room.actors.filter((a) => a.team === "CT" && a.alive).length;
    const tAlive = room.actors.filter((a) => a.team === "T" && a.alive).length;
    if (ctAlive === 0) {
      endServerRound(room, "T", "Oddzia\u0142 antyterroryst\xF3w wyeliminowany");
    } else if (tAlive === 0 && room.bomb.state !== "planted") {
      endServerRound(room, "CT", "Oddzia\u0142 terroryst\xF3w wyeliminowany");
    }
  }
}
function endServerRound(room, winner, reason) {
  if (room.roundPhase === "round_end" || room.roundPhase === "match_end") return;
  room.roundPhase = "round_end";
  room.phaseTimer = 5;
  if (winner === "CT") {
    room.ctScore += 1;
    room.ctLossStreak = 0;
    room.tLossStreak += 1;
  } else {
    room.tScore += 1;
    room.tLossStreak = 0;
    room.ctLossStreak += 1;
  }
  const winReward = room.bomb.state === "defused" ? ECONOMY_CONSTANTS.WIN_REWARD_BOMB_DEFUSED : room.bomb.state === "exploded" ? ECONOMY_CONSTANTS.WIN_REWARD_BOMB_EXPLODED : ECONOMY_CONSTANTS.WIN_REWARD_ELIMINATION;
  const lossBonus = winner === "CT" ? getLossBonus(room.tLossStreak) + (room.bomb.state === "defused" ? ECONOMY_CONSTANTS.BOMB_PLANT_TEAM_BONUS_ON_LOSS : 0) : getLossBonus(room.ctLossStreak);
  for (const a of room.actors) {
    if (a.team === winner) {
      a.money = clampMoney(a.money + winReward);
    } else {
      a.money = clampMoney(a.money + lossBonus);
    }
  }
  const winningActors = room.actors.filter((a) => a.team === winner);
  const mvp = winningActors[0] || room.actors[0];
  if (mvp) mvp.mvps += 1;
  broadcastToRoom(room, "match:round_end", {
    winner,
    reason,
    mvpName: mvp ? mvp.name : "Operator",
    mvpReason: "Najwi\u0119kszy wk\u0142ad w wygran\u0105 rundy"
  });
}
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}
async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });
  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = request.url ? request.url.split("?")[0] : "";
    if (pathname !== "/ws-game") {
      socket.destroy();
      return;
    }
    const ip = getClientIp(request);
    const currentIpConns = ipConnections.get(ip) || 0;
    if (currentIpConns >= MAX_CONCURRENT_PER_IP) {
      socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      rooms: rooms.size,
      uptime: Math.round(process.uptime())
    });
  });
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
      if (room.players.size === 0 || now - room.lastActivity > 6e5) {
        rooms.delete(code);
      }
    }
  }, 3e4);
  wss.on("connection", (ws, req) => {
    const ip = getClientIp(req);
    ipConnections.set(ip, (ipConnections.get(ip) || 0) + 1);
    const clientId = `player_${nextClientSeq++}_${Math.random().toString(36).slice(2, 6)}`;
    sendToSocket(ws, "welcome", { clientId });
    let msgCountInSec = 0;
    let secWindowStart = Date.now();
    let violationStrikes = 0;
    const cleanupClient = () => {
      const cur = ipConnections.get(ip) || 1;
      if (cur <= 1) ipConnections.delete(ip);
      else ipConnections.set(ip, cur - 1);
      removeClientFromCurrentRoom();
    };
    const removeClientFromCurrentRoom = () => {
      const code = clientToRoom.get(clientId);
      if (!code) return;
      clientToRoom.delete(clientId);
      const room = rooms.get(code);
      if (!room) return;
      room.players.delete(clientId);
      room.sockets.delete(clientId);
      room.playerInputs.delete(clientId);
      if (room.players.size === 0) {
        rooms.delete(code);
      } else {
        if (room.hostId === clientId) {
          const first = room.players.values().next().value;
          if (first) {
            room.hostId = first.id;
            first.isHost = true;
          }
        }
        emitRoomLobbyState(room);
      }
    };
    ws.on("close", cleanupClient);
    ws.on("error", cleanupClient);
    ws.on("message", (rawBuf) => {
      const now = Date.now();
      if (now - secWindowStart >= 1e3) {
        secWindowStart = now;
        msgCountInSec = 0;
      }
      msgCountInSec++;
      if (msgCountInSec > MAX_WS_MSG_PER_SEC) {
        violationStrikes++;
        if (violationStrikes > 3) {
          try {
            ws.close(1008, "Rate limit exceeded");
          } catch {
          }
        }
        return;
      }
      let packet;
      try {
        packet = JSON.parse(String(rawBuf));
      } catch {
        return;
      }
      if (!packet || typeof packet !== "object") return;
      const { type, payload = {} } = packet;
      if (type === "room:create") {
        if (rooms.size >= MAX_GLOBAL_ROOMS) {
          sendToSocket(ws, "room:error", {
            message: "Serwer osi\u0105gn\u0105\u0142 limit aktywnych pokoj\xF3w. Spr\xF3buj za chwil\u0119."
          });
          return;
        }
        const createTimes = (ipRoomCreates.get(ip) || []).filter(
          (t) => now - t < 6e4
        );
        if (createTimes.length >= MAX_ROOM_CREATES_PER_MIN) {
          sendToSocket(ws, "room:error", {
            message: "Zbyt cz\u0119ste tworzenie pokoj\xF3w. Odczekaj chwil\u0119."
          });
          return;
        }
        createTimes.push(now);
        ipRoomCreates.set(ip, createTimes);
        removeClientFromCurrentRoom();
        const code = generateRoomCode();
        const name = String(payload.name || "Gracz").trim().slice(0, 18);
        const team = payload.team === "T" ? "T" : "CT";
        const fillWithBots = Boolean(payload.fillWithBots);
        const player = {
          id: clientId,
          name: name || "Gracz",
          team,
          isHost: true
        };
        const room = {
          code,
          hostId: clientId,
          fillWithBots,
          players: /* @__PURE__ */ new Map([[clientId, player]]),
          sockets: /* @__PURE__ */ new Map([[clientId, ws]]),
          started: false,
          roundPhase: "buy",
          roundNumber: 1,
          ctScore: 0,
          tScore: 0,
          ctLossStreak: 0,
          tLossStreak: 0,
          phaseTimer: 5,
          tStrategy: "RUSH_A",
          bomb: createInitialBombData(null, [3.5, 0, 20.2]),
          actors: [],
          spawnPositions: /* @__PURE__ */ new Map(),
          playerInputs: /* @__PURE__ */ new Map(),
          lastActivity: Date.now()
        };
        rooms.set(code, room);
        clientToRoom.set(clientId, code);
        emitRoomLobbyState(room);
        return;
      }
      if (type === "room:join") {
        const code = String(payload.roomCode || "").toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          sendToSocket(ws, "room:error", {
            message: "Nie znaleziono pokoju o podanym kodzie."
          });
          return;
        }
        removeClientFromCurrentRoom();
        const player = {
          id: clientId,
          name: String(payload.name || "Operator").slice(0, 18),
          team: payload.team === "T" ? "T" : "CT",
          isHost: false
        };
        room.players.set(clientId, player);
        room.sockets.set(clientId, ws);
        clientToRoom.set(clientId, code);
        emitRoomLobbyState(room);
        if (room.started && !room.actors.some((a) => a.id === clientId)) {
          const spList = player.team === "CT" ? CT_SPAWNS : T_SPAWNS;
          const sp = spList[room.actors.length % spList.length];
          const newActor = createServerActor(
            player.id,
            player.name,
            player.team,
            false,
            "entry",
            "A"
          );
          newActor.position = [sp.x, sp.y, sp.z];
          newActor.yaw = sp.yaw;
          room.spawnPositions.set(newActor.id, { x: sp.x, y: sp.y, z: sp.z });
          room.actors.push(newActor);
          sendToSocket(ws, "match:start", buildSnapshot(room));
        }
        return;
      }
      if (type === "room:team") {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room) return;
        const p = room.players.get(clientId);
        if (p) {
          p.team = payload.team === "T" ? "T" : "CT";
          emitRoomLobbyState(room);
        }
        return;
      }
      if (type === "room:bot_toggle") {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || room.hostId !== clientId) return;
        room.fillWithBots = Boolean(payload.fillWithBots);
        emitRoomLobbyState(room);
        return;
      }
      if (type === "room:start") {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || room.hostId !== clientId) return;
        if (typeof payload.fillWithBots === "boolean") {
          room.fillWithBots = payload.fillWithBots;
        }
        room.started = true;
        room.actors = [];
        const roles = ["entry", "support", "sniper", "lurker", "anchor"];
        const sites = ["A", "A", "MID", "B", "B"];
        const ctHumans = Array.from(room.players.values()).filter((p) => p.team === "CT");
        const tHumans = Array.from(room.players.values()).filter((p) => p.team === "T");
        if (room.fillWithBots) {
          for (let i = 0; i < 5; i++) {
            const h = ctHumans[i];
            if (h) {
              room.actors.push(
                createServerActor(h.id, h.name, "CT", false, roles[i], sites[i])
              );
            } else {
              room.actors.push(
                createServerActor(
                  `bot_ct_${i}`,
                  BOT_NAMES_CT[i],
                  "CT",
                  true,
                  roles[i],
                  sites[i]
                )
              );
            }
          }
          for (let i = 0; i < 5; i++) {
            const h = tHumans[i];
            if (h) {
              room.actors.push(
                createServerActor(h.id, h.name, "T", false, roles[i], sites[i])
              );
            } else {
              room.actors.push(
                createServerActor(
                  `bot_t_${i}`,
                  BOT_NAMES_T[i],
                  "T",
                  true,
                  roles[i],
                  sites[i]
                )
              );
            }
          }
        } else {
          ctHumans.forEach((h, i) => {
            room.actors.push(
              createServerActor(
                h.id,
                h.name,
                "CT",
                false,
                roles[i % roles.length],
                sites[i % sites.length]
              )
            );
          });
          tHumans.forEach((h, i) => {
            room.actors.push(
              createServerActor(
                h.id,
                h.name,
                "T",
                false,
                roles[i % roles.length],
                sites[i % sites.length]
              )
            );
          });
        }
        setupServerRound(room, true);
        broadcastToRoom(room, "match:start", buildSnapshot(room));
        return;
      }
      if (type === "player:skip_buy") {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started) return;
        if (room.roundPhase === "buy") {
          room.roundPhase = "live";
          room.phaseTimer = 115;
          broadcastToRoom(room, "match:snapshot", buildSnapshot(room));
        }
        return;
      }
      if (type === "player:input") {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started) return;
        room.lastActivity = Date.now();
        const actor = room.actors.find((a) => a.id === clientId);
        if (!actor || !actor.alive) return;
        const pos = payload.position;
        const vel = payload.velocity;
        if (room.roundPhase === "buy") {
          const sp = room.spawnPositions.get(actor.id);
          if (sp) {
            actor.position = [sp.x, sp.y, sp.z];
          }
          actor.velocity = [0, 0, 0];
        } else if (pos && vel && Array.isArray(pos) && Array.isArray(vel) && Number.isFinite(pos[0]) && Number.isFinite(pos[1]) && Number.isFinite(pos[2])) {
          actor.position = [pos[0], pos[1], pos[2]];
          actor.velocity = [vel[0], vel[1], vel[2]];
        }
        if (typeof payload.yaw === "number" && Number.isFinite(payload.yaw)) {
          actor.yaw = payload.yaw;
        }
        if (typeof payload.pitch === "number" && Number.isFinite(payload.pitch)) {
          actor.pitch = payload.pitch;
        }
        actor.crouching = Boolean(payload.crouching);
        if (typeof payload.activeWeapon === "string" && payload.activeWeapon in WEAPONS_DB) {
          actor.activeWeapon = payload.activeWeapon;
        }
        room.playerInputs.set(clientId, {
          planting: Boolean(payload.planting),
          defusing: Boolean(payload.defusing)
        });
        if (actor.hasC4 && room.bomb.state === "carried") {
          room.bomb.position = [...actor.position];
        }
        return;
      }
      if (type === "player:fire") {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started || room.roundPhase === "buy") return;
        room.lastActivity = Date.now();
        const actor = room.actors.find((a) => a.id === clientId);
        if (!actor || !actor.alive) return;
        if (actor.fireCooldown > 0) return;
        const spec = WEAPONS_DB[actor.activeWeapon];
        actor.fireCooldown = spec ? Math.max(0.05, 60 / spec.fireRate * 0.75) : 0.08;
        if (typeof payload.weaponId === "string" && payload.weaponId in WEAPONS_DB) {
          actor.activeWeapon = payload.weaponId;
        }
        const origin = payload.origin;
        const dir = payload.dir;
        if (origin && dir && Array.isArray(origin) && Array.isArray(dir) && Number.isFinite(origin[0]) && Number.isFinite(dir[0])) {
          handleServerHitscan(room, actor, origin, dir);
        }
        return;
      }
      if (type === "player:throw_grenade") {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started || room.roundPhase === "buy") return;
        room.lastActivity = Date.now();
        const actor = room.actors.find((a) => a.id === clientId);
        if (!actor || !actor.alive) return;
        const nadeId = String(payload.nadeId || "");
        const idx = actor.grenades.indexOf(nadeId);
        if (idx === -1) return;
        if (actor.utilityCooldown > 0) return;
        actor.utilityCooldown = 0.5;
        actor.grenades.splice(idx, 1);
        actor.activeWeapon = actor.primaryWeapon || actor.secondaryWeapon;
        const origin = payload.origin;
        const velocity = payload.velocity;
        if (origin && velocity) {
          for (const [sId, sWs] of room.sockets.entries()) {
            if (sId !== clientId && sWs.readyState === WebSocket.OPEN) {
              sWs.send(
                JSON.stringify({
                  type: "match:throw_grenade",
                  payload: {
                    throwerId: clientId,
                    throwerTeam: actor.team,
                    nadeId,
                    origin,
                    velocity
                  }
                })
              );
            }
          }
        }
        return;
      }
      if (type === "player:buy") {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || room.roundPhase !== "buy") return;
        room.lastActivity = Date.now();
        const actor = room.actors.find((a) => a.id === clientId);
        if (!actor || !actor.alive) return;
        const itemId = String(payload.itemId || "");
        if (itemId in EQUIPMENT_DB) {
          const eq = EQUIPMENT_DB[itemId];
          if (eq.team !== "BOTH" && eq.team !== actor.team) return;
          if (itemId === "kevlar") {
            if (actor.armor >= 100 || actor.money < eq.price) return;
            actor.money -= eq.price;
            actor.armor = 100;
            return;
          }
          if (itemId === "kevlar_helmet") {
            const upgradeCost = actor.armor >= 100 && !actor.hasHelmet ? 350 : eq.price;
            if (actor.armor >= 100 && actor.hasHelmet || actor.money < upgradeCost) return;
            actor.money -= upgradeCost;
            actor.armor = 100;
            actor.hasHelmet = true;
            return;
          }
          if (itemId === "defuse_kit") {
            if (actor.team !== "CT" || actor.hasDefuseKit || actor.money < eq.price) return;
            actor.money -= eq.price;
            actor.hasDefuseKit = true;
            return;
          }
        }
        if (itemId in WEAPONS_DB) {
          const spec = WEAPONS_DB[itemId];
          if (spec.team !== "BOTH" && spec.team !== actor.team) return;
          if (spec.price <= 0 || actor.money < spec.price) return;
          if (spec.category === "grenade") {
            if (actor.grenades.length >= ECONOMY_CONSTANTS.MAX_GRENADES) return;
            const sameCount = actor.grenades.filter((g) => g === spec.id).length;
            const maxSame = spec.id === "flashbang" ? 2 : 1;
            if (sameCount >= maxSame) return;
            actor.money -= spec.price;
            actor.grenades.push(spec.id);
            actor.activeWeapon = spec.id;
            return;
          }
          if (spec.slot === 1) {
            if (actor.primaryWeapon === spec.id) return;
            actor.money -= spec.price;
            actor.primaryWeapon = spec.id;
          } else if (spec.slot === 2) {
            if (actor.secondaryWeapon === spec.id) return;
            actor.money -= spec.price;
            actor.secondaryWeapon = spec.id;
          }
          actor.ammoMag[spec.id] = spec.magSize;
          actor.ammoReserve[spec.id] = spec.reserveAmmo;
          actor.activeWeapon = spec.id;
        }
        return;
      }
      if (type === "room:leave") {
        cleanupClient();
      }
    });
    ws.on("close", cleanupClient);
  });
  const TICK_DT = 0.05;
  setInterval(() => {
    const nowSec = performance.now() / 1e3;
    for (const [code, room] of rooms.entries()) {
      try {
        if (!room.started) continue;
        room.phaseTimer -= TICK_DT;
        if (room.roundPhase === "buy" && room.phaseTimer <= 0) {
          room.roundPhase = "live";
          room.phaseTimer = 115;
        } else if (room.roundPhase === "live" && room.phaseTimer <= 0) {
          endServerRound(room, "CT", "Czas rundy dobieg\u0142 ko\u0144ca \u2014 obrona CT");
        } else if (room.roundPhase === "round_end" && room.phaseTimer <= 0) {
          broadcastToRoom(room, "match:round_end", null);
          room.roundNumber += 1;
          setupServerRound(room, false);
        }
        for (const actor of room.actors) {
          actor.fireCooldown = Math.max(0, actor.fireCooldown - TICK_DT);
          actor.utilityCooldown = Math.max(0, actor.utilityCooldown - TICK_DT);
          if (actor.isBot && actor.alive) {
            actor.reloadTimer = Math.max(0, actor.reloadTimer - TICK_DT);
            updateBotAI(
              actor,
              room.actors,
              room.bomb,
              room.roundPhase,
              room.tStrategy,
              "medium",
              serverPhysics,
              serverNav,
              [],
              nowSec,
              TICK_DT,
              {
                onFireWeapon: (bot) => {
                  if (bot.fireCooldown > 0) return;
                  const spec = WEAPONS_DB[bot.activeWeapon];
                  bot.fireCooldown = 60 / spec.fireRate;
                  const origin = [
                    bot.position[0],
                    bot.position[1] + 1.5,
                    bot.position[2]
                  ];
                  const dir = [
                    -Math.sin(bot.yaw) * Math.cos(bot.pitch),
                    Math.sin(bot.pitch),
                    -Math.cos(bot.yaw) * Math.cos(bot.pitch)
                  ];
                  handleServerHitscan(room, bot, origin, dir);
                },
                onThrowGrenade: () => {
                },
                onRadioCallout: () => {
                }
              }
            );
          }
        }
        if (room.bomb.state === "dropped") {
          for (const actor of room.actors) {
            if (actor.alive && actor.team === "T") {
              const dist = Math.hypot(
                actor.position[0] - room.bomb.position[0],
                actor.position[2] - room.bomb.position[2]
              );
              if (dist < 1.8) {
                actor.hasC4 = true;
                room.bomb.state = "carried";
                room.bomb.carrierId = actor.id;
                break;
              }
            }
          }
        }
        if (room.roundPhase === "live" && room.bomb.state === "carried") {
          let planter;
          let activeSite = null;
          for (const actor of room.actors) {
            if (!actor.alive || actor.team !== "T" || !actor.hasC4) continue;
            const site = getActiveBombSite(actor.position[0], actor.position[2]);
            const inp = room.playerInputs.get(actor.id);
            const wantsPlant = actor.isBot ? Boolean(
              site && Math.hypot(actor.velocity[0], actor.velocity[2]) < 0.6
            ) : Boolean(site && inp?.planting);
            if (wantsPlant && site) {
              planter = actor;
              activeSite = site;
              break;
            }
          }
          if (planter && activeSite) {
            room.bomb.planterId = planter.id;
            room.bomb.plantProgress += TICK_DT / BOMB_CONSTANTS.PLANT_TIME;
            if (room.bomb.plantProgress >= 1) {
              room.bomb.state = "planted";
              room.bomb.site = activeSite;
              room.bomb.carrierId = null;
              room.bomb.planterId = null;
              room.bomb.plantProgress = 0;
              room.bomb.timeRemaining = BOMB_CONSTANTS.BOMB_TIMER;
              room.bomb.position = [
                planter.position[0],
                planter.position[1] + 0.05,
                planter.position[2]
              ];
              planter.hasC4 = false;
              planter.money = clampMoney(
                planter.money + ECONOMY_CONSTANTS.BOMB_PLANT_INDIVIDUAL
              );
              room.roundPhase = "planted";
              room.phaseTimer = BOMB_CONSTANTS.BOMB_TIMER;
            }
          } else {
            room.bomb.planterId = null;
            room.bomb.plantProgress = 0;
          }
        }
        if (room.roundPhase === "planted" && room.bomb.state === "planted") {
          room.bomb.timeRemaining = Math.max(0, room.bomb.timeRemaining - TICK_DT);
          room.phaseTimer = room.bomb.timeRemaining;
          let defuser;
          for (const actor of room.actors) {
            if (!actor.alive || actor.team !== "CT") continue;
            const dist = Math.hypot(
              actor.position[0] - room.bomb.position[0],
              actor.position[2] - room.bomb.position[2]
            );
            const inp = room.playerInputs.get(actor.id);
            const wantsDefuse = actor.isBot ? dist <= BOMB_CONSTANTS.INTERACTION_RADIUS && Math.hypot(actor.velocity[0], actor.velocity[2]) < 0.6 : dist <= BOMB_CONSTANTS.INTERACTION_RADIUS && Boolean(inp?.defusing);
            if (wantsDefuse) {
              defuser = actor;
              break;
            }
          }
          if (defuser) {
            room.bomb.defuserId = defuser.id;
            room.bomb.defuserHasKit = defuser.hasDefuseKit;
            const defuseDur = defuser.hasDefuseKit ? BOMB_CONSTANTS.DEFUSE_TIME_WITH_KIT : BOMB_CONSTANTS.DEFUSE_TIME_NO_KIT;
            room.bomb.defuseProgress += TICK_DT / defuseDur;
            if (room.bomb.defuseProgress >= 1) {
              room.bomb.state = "defused";
              room.bomb.defuserId = null;
              room.bomb.defuseProgress = 0;
              defuser.money = clampMoney(
                defuser.money + ECONOMY_CONSTANTS.BOMB_DEFUSE_INDIVIDUAL
              );
              endServerRound(room, "CT", "\u0141adunek C4 zosta\u0142 rozbrojony!");
            }
          } else {
            room.bomb.defuserId = null;
            room.bomb.defuseProgress = 0;
          }
          if (room.bomb.state === "planted" && room.bomb.timeRemaining <= 0) {
            room.bomb.state = "exploded";
            endServerRound(room, "T", "\u0141adunek C4 eksplodowa\u0142!");
          }
        }
        checkServerTeamElimination(room);
        broadcastToRoom(room, "match:snapshot", buildSnapshot(room));
      } catch (err) {
        console.error(`[SIMULATION ERROR in room ${code}]:`, err);
      }
    }
  }, 50);
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  const PORT = Number(process.env.PORT) || 3e3;
  httpServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `
[B\u0141\u0104D] Port ${PORT} jest ju\u017C zaj\u0119ty przez inny proces node.exe!
Zamknij inne okno terminala lub uruchom: npx kill-port ${PORT}
`
      );
    } else {
      console.error("Server error:", err);
    }
  });
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Dust Alley Server listening on http://localhost:${PORT}`);
  });
}
startServer();
