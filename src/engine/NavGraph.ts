export interface Waypoint {
  id: string;
  x: number;
  y: number;
  z: number;
  neighbors: string[];
  tag?: 'T_SPAWN' | 'CT_SPAWN' | 'SITE_A' | 'SITE_B' | 'MID' | 'LONG_A' | 'SHORT_A' | 'B_TUNNELS';
}

const S = 1.3; // Matches 1.3x spacious Dust Alley map scale

const RAW_WAYPOINTS: Waypoint[] = [
  // T Spawn (South)
  { id: 't_spawn_c', x: 3.5, y: 0, z: 20.2, neighbors: ['t_spawn_w', 't_spawn_e'], tag: 'T_SPAWN' },
  { id: 't_spawn_w', x: -6.5, y: 0, z: 18.5, neighbors: ['t_spawn_c', 'sw_lane', 'mid_south'], tag: 'T_SPAWN' },
  { id: 't_spawn_e', x: 13.0, y: 0, z: 18.0, neighbors: ['t_spawn_c', 'se_lane', 'mid_se'], tag: 'T_SPAWN' },

  // Central / Mid Lanes
  { id: 'mid_south', x: -2.0, y: 0, z: 11.5, neighbors: ['t_spawn_w', 'mid_center', 'mid_se'], tag: 'MID' },
  { id: 'mid_se', x: 7.5, y: 0, z: 10.5, neighbors: ['t_spawn_e', 'mid_south', 'short_a_s'], tag: 'MID' },
  { id: 'mid_center', x: -1.8, y: 0, z: 1.5, neighbors: ['mid_south', 'mid_north', 'b_mid_conn', 'short_a_s'], tag: 'MID' },
  { id: 'mid_north', x: -1.8, y: 0, z: -9.5, neighbors: ['mid_center', 'ct_mid_e', 'b_ct_entry', 'a_west_entry'], tag: 'MID' },

  // East / A Lane
  { id: 'se_lane', x: 18.0, y: 0, z: 11.0, neighbors: ['t_spawn_e', 'long_a_mid'], tag: 'LONG_A' },
  { id: 'long_a_mid', x: 18.2, y: 0, z: 0.0, neighbors: ['se_lane', 'long_a_north', 'short_a_s'], tag: 'LONG_A' },
  { id: 'short_a_s', x: 8.5, y: 0, z: 3.5, neighbors: ['mid_se', 'mid_center', 'long_a_mid'], tag: 'SHORT_A' },
  { id: 'long_a_north', x: 18.5, y: 0, z: -6.5, neighbors: ['long_a_mid', 'site_a_center', 'site_a_east'], tag: 'LONG_A' },

  // Bombsite A (Upper Right)
  { id: 'a_west_entry', x: 7.5, y: 0, z: -10.5, neighbors: ['mid_north', 'ct_mid_e', 'site_a_center'], tag: 'SITE_A' },
  { id: 'site_a_center', x: 13.3, y: 0, z: -10.7, neighbors: ['a_west_entry', 'long_a_north', 'site_a_east'], tag: 'SITE_A' },
  { id: 'site_a_east', x: 15.5, y: 0, z: -9.0, neighbors: ['site_a_center', 'long_a_north'], tag: 'SITE_A' },

  // West / B Lane
  { id: 'sw_lane', x: -11.0, y: 0, z: 13.0, neighbors: ['t_spawn_w', 'west_outer_s', 'b_mid_conn'], tag: 'B_TUNNELS' },
  { id: 'west_outer_s', x: -19.5, y: 0, z: 12.5, neighbors: ['sw_lane', 'west_outer_n'], tag: 'B_TUNNELS' },
  { id: 'west_outer_n', x: -18.0, y: 0, z: 2.5, neighbors: ['west_outer_s', 'b_south_entry', 'b_mid_conn'], tag: 'B_TUNNELS' },
  { id: 'b_mid_conn', x: -10.5, y: 0, z: 2.0, neighbors: ['sw_lane', 'west_outer_n', 'mid_center'], tag: 'B_TUNNELS' },
  { id: 'b_south_entry', x: -17.5, y: 0, z: -5.2, neighbors: ['west_outer_n', 'site_b_center'], tag: 'SITE_B' },

  // Bombsite B (Upper Left)
  { id: 'site_b_center', x: -16.0, y: 0, z: -10.7, neighbors: ['b_south_entry', 'site_b_north', 'b_ct_entry'], tag: 'SITE_B' },
  { id: 'site_b_north', x: -16.0, y: 0, z: -14.8, neighbors: ['site_b_center', 'ct_west_exit'], tag: 'SITE_B' },
  { id: 'b_ct_entry', x: -8.5, y: 0, z: -9.5, neighbors: ['site_b_center', 'mid_north', 'ct_west_exit'], tag: 'SITE_B' },

  // CT Spawn (North)
  { id: 'ct_spawn_c', x: -5.5, y: 0, z: -20.0, neighbors: ['ct_west_exit', 'ct_mid_e'], tag: 'CT_SPAWN' },
  { id: 'ct_west_exit', x: -12.5, y: 0, z: -20.5, neighbors: ['ct_spawn_c', 'site_b_north', 'b_ct_entry'], tag: 'CT_SPAWN' },
  { id: 'ct_mid_e', x: 2.5, y: 0, z: -13.0, neighbors: ['ct_spawn_c', 'mid_north', 'a_west_entry'], tag: 'CT_SPAWN' },
];

export const DUST_ALLEY_WAYPOINTS: Waypoint[] = RAW_WAYPOINTS.map((wp) => ({
  ...wp,
  x: Number((wp.x * S).toFixed(2)),
  z: Number((wp.z * S).toFixed(2)),
}));

export class NavGraph {
  private nodes: Map<string, Waypoint> = new Map();

  constructor(waypoints: Waypoint[] = DUST_ALLEY_WAYPOINTS) {
    for (const wp of waypoints) {
      this.nodes.set(wp.id, wp);
    }
  }

  public getWaypoint(id: string): Waypoint | undefined {
    return this.nodes.get(id);
  }

  public findNearestWaypoint(x: number, z: number): Waypoint {
    let best: Waypoint = DUST_ALLEY_WAYPOINTS[0];
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
  public findPath(
    startX: number,
    startZ: number,
    goalX: number,
    goalZ: number
  ): Array<[number, number, number]> {
    const startNode = this.findNearestWaypoint(startX, startZ);
    const goalNode = this.findNearestWaypoint(goalX, goalZ);

    if (startNode.id === goalNode.id) {
      return [[goalX, goalNode.y, goalZ]];
    }

    const openSet = new Set<string>([startNode.id]);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    for (const id of this.nodes.keys()) {
      gScore.set(id, Infinity);
      fScore.set(id, Infinity);
    }

    gScore.set(startNode.id, 0);
    fScore.set(startNode.id, this.heuristic(startNode, goalNode));

    while (openSet.size > 0) {
      let currentId = '';
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
      const current = this.nodes.get(currentId)!;

      for (const neighborId of current.neighbors) {
        const neighbor = this.nodes.get(neighborId);
        if (!neighbor) continue;

        const tentativeG =
          (gScore.get(currentId) ?? Infinity) + this.heuristic(current, neighbor);

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

  private heuristic(a: Waypoint, b: Waypoint): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  private reconstructPath(
    cameFrom: Map<string, string>,
    currentId: string,
    finalX: number,
    finalZ: number
  ): Array<[number, number, number]> {
    const path: Array<[number, number, number]> = [];
    let curr: string | undefined = currentId;
    while (curr) {
      const node = this.nodes.get(curr);
      if (node) {
        path.unshift([node.x, node.y, node.z]);
      }
      curr = cameFrom.get(curr);
    }
    path.push([finalX, 0, finalZ]);
    return path;
  }
}

const defaultNavGraph = new NavGraph();

export function findPathAStar(
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number
): Array<[number, number, number]> {
  return defaultNavGraph.findPath(startX, startZ, goalX, goalZ);
}
