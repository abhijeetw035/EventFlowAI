"""
app_integrated.py
===================
EventFlow AI — Stage 3: one FastAPI backend serving everything.

This is the upgraded diversion-cluster engine + /get-dataset + new
/calculate-route-diversion endpoint, with the manpower/barricade model
mounted alongside it via deployment_service.py. One process, one port,
one set of models loaded once at startup -- so the React frontend only
ever talks to ONE backend.

Run with:
    uvicorn app_integrated:app --host 127.0.0.1 --port 8000 --reload

Before running this for the first time:
    1. python preprocess.py                     (your existing script)
    2. python prepare_deployment_dataset.py      (produces model_artifacts/)
    3. python train_deployment_models.py         (fills in the *.joblib files)

Endpoints:
    GET  /get-dataset               -> raw incident CSV as JSON
    POST /calculate-cluster-diversion -> localized macro-flank routing
    POST /calculate-route-diversion   -> point-to-point A->B diversion
    POST /predict-deployment          -> manpower/barricade recommendation
    GET  /health                    -> liveness probe
"""

import osmnx as ox
import networkx as nx
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uvicorn

import deployment_service

# ==========================================
# DATA MODELS
# ==========================================

class Point(BaseModel):
    lat: float
    lon: float


class ClusterRequest(BaseModel):
    target: Point
    active_cluster: List[Point]
    # NOTE: radius_km is intentionally NOT accepted here.
    # The frontend filters the local cluster by radius before sending
    # to the backend, so the backend simply receives the already-filtered list.


class RouteDiversionRequest(BaseModel):
    start: Point
    end: Point
    blocking_incidents: List[Point]


# ==========================================
# 1. THE ADVANCED LOCAL GRAPH ENGINE
# ==========================================
class LocalDiversionEngine:
    def __init__(self, lat, lon, dist=12000):
        print(f"🤖 Booting Advanced Cluster Graph Engine (Radius: {dist}m)...")
        print("⏳ Processing OSM graph into RAM (Takes ~20-30s)...")
        self.G = ox.graph_from_point((lat, lon), dist=dist, network_type='drive')
        self.G = ox.add_edge_speeds(self.G)
        self.G = ox.add_edge_travel_times(self.G)
        self.original_G = self.G.copy()
        print(f"✅ Maximum Computational Engine Online: {len(self.G.nodes)} nodes, {len(self.G.edges)} edges.")

    def _sever_incident_point(self, lat, lon):
        """
        Robustly blocks the road network at a single incident's location.

        A naive "remove only the single nearest edge" approach is NOT enough:
          - Incidents reported at/near an intersection: that node has several
            edges meeting at it. Severing only one leaves the others open, so
            a route can still pass straight through that exact point via a
            different edge/direction — it visually looks like it's driving
            right through the incident marker.
          - OSMnx graphs are MultiDiGraphs: divided/dual-carriageway roads can
            have more than one parallel edge between the same two nodes
            (different 'keys'). Removing one without specifying the key can
            leave a parallel edge intact.

        Fix: snap to the nearest NODE and remove every edge touching it (both
        directions, every parallel key) — i.e. fully seal that intersection —
        and also clear every parallel key of the nearest EDGE for mid-block
        incidents that don't snap cleanly to a node. Returns count severed.
        """
        severed = 0

        # 1. Seal the nearest node entirely (covers intersection-located incidents)
        try:
            node = ox.nearest_nodes(self.G, lon, lat)
            touching = list(self.G.out_edges(node, keys=True)) + list(self.G.in_edges(node, keys=True))
            for u, v, k in touching:
                if self.G.has_edge(u, v, k):
                    self.G.remove_edge(u, v, k)
                    severed += 1
        except Exception:
            pass

        # 2. Also clear every parallel key of the nearest edge, both directions
        #    (covers mid-block incidents that aren't right at a node)
        try:
            u, v, _ = ox.nearest_edges(self.G, lon, lat)
            for a, b in [(u, v), (v, u)]:
                edge_data = self.G.get_edge_data(a, b)
                if edge_data:
                    for k in list(edge_data.keys()):
                        if self.G.has_edge(a, b, k):
                            self.G.remove_edge(a, b, k)
                            severed += 1
        except Exception:
            pass

        return severed

    def calculate_cluster_diversions(self, target_lat, target_lon, active_cluster_coords):
        # 1. Reset map to clean temporal state
        self.G = self.original_G.copy()

        # 2. MACRO-SEVERANCE: Fully seal every active incident location in the cluster
        print(f"🧨 Severing {len(active_cluster_coords)} active incident locations in local cluster...")
        for pt in active_cluster_coords:
            self._sever_incident_point(pt.lat, pt.lon)

        # 3. Locate the specific target intersection the user clicked
        try:
            u_target, v_target, _ = ox.nearest_edges(self.original_G, target_lon, target_lat)
            approaching_edges = self.original_G.in_edges(u_target, data=True)
            diversion_manifest = []

            # 4. ITERATIVE RECOVERY ROUTING
            for source_node, _, data in approaching_edges:
                if source_node == v_target:
                    continue
                raw_name = data.get('name', 'Local Street')
                incoming_road = raw_name[0] if isinstance(raw_name, list) else raw_name

                bypass_path = None

                # Expand search radius to find a safe downstream node not trapped in the dead zone
                # Depth 0 (Original node) up to Depth 5 (5 intersections away)
                for depth in range(6):
                    if bypass_path:
                        break

                    # Get all nodes at 'depth' intersections away from the original target
                    target_pool = list(nx.ego_graph(self.original_G, v_target, radius=depth).nodes)

                    for potential_target in target_pool:
                        try:
                            # Attempt shortest path through the heavily severed graph
                            bypass_path = nx.shortest_path(self.G, source=source_node, target=potential_target, weight='travel_time')
                            break  # Success! We cleared the cluster!
                        except nx.NetworkXNoPath:
                            continue

                if bypass_path:
                    coords = [[self.G.nodes[n]['y'], self.G.nodes[n]['x']] for n in bypass_path]
                    diversion_manifest.append({"from_road": incoming_road, "coordinates": coords, "status": "success"})
                else:
                    diversion_manifest.append({"from_road": incoming_road, "status": "gridlock"})

            return diversion_manifest
        except Exception as e:
            return [{"from_road": "System", "status": f"Graph Error: {str(e)}"}]

    def calculate_point_to_point_route(self, start_lat, start_lon, end_lat, end_lon, blocking_points):
        """
        Computes a single shortest path between an arbitrary Point A and Point B,
        after severing every incident edge in `blocking_points` from the graph.
        This is the user-directed counterpart to calculate_cluster_diversions: instead of
        the engine auto-picking approaching roads and auto-discovering recovery nodes,
        the caller explicitly supplies the origin and destination.
        """
        # 1. Reset to a clean graph before applying this query's blockages
        self.G = self.original_G.copy()

        # 2. Fully seal every active incident location near the A-B corridor
        severed_count = 0
        print(f"🧨 Severing {len(blocking_points)} active incident locations near the A-B corridor...")
        for pt in blocking_points:
            severed_count += self._sever_incident_point(pt.lat, pt.lon)

        # 3. Snap the raw lat/lon click points to the nearest nodes on the (now-severed) graph
        try:
            start_node = ox.nearest_nodes(self.G, start_lon, start_lat)
            end_node = ox.nearest_nodes(self.G, end_lon, end_lat)
        except Exception as e:
            return {"status": "error", "message": f"Could not snap points to road network: {str(e)}"}

        # 4. Compute the single shortest path between the two snapped nodes
        try:
            path = nx.shortest_path(self.G, source=start_node, target=end_node, weight='travel_time')
            coords = [[self.G.nodes[n]['y'], self.G.nodes[n]['x']] for n in path]
            return {
                "status": "success",
                "coordinates": coords,
                "severed_edges": severed_count
            }
        except nx.NetworkXNoPath:
            return {
                "status": "gridlock",
                "message": "No path exists between these points once active incidents are removed.",
                "severed_edges": severed_count
            }
        except nx.NodeNotFound as e:
            return {"status": "error", "message": f"Node not found in graph: {str(e)}"}


# ==========================================
# 2. FASTAPI SERVER
# ==========================================
app = FastAPI(title="EventFlow AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = LocalDiversionEngine(12.9716, 77.5946, dist=12000)

# Load the manpower/barricade models ONCE, at startup, alongside the graph engine.
deployment_service.load_models()
app.include_router(deployment_service.router)


@app.get("/get-dataset")
def get_dataset():
    """Reads the CSV and sends the raw incident data to the frontend."""
    try:
        df = pd.read_csv("Data/Dataset.csv")
        df = df.dropna(subset=['latitude', 'longitude']).fillna("")
        return {"status": "success", "data": df.to_dict(orient="records")}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/calculate-cluster-diversion")
def calculate_cluster_diversion(req: ClusterRequest):
    print(f"\n🚨 Computing Localized Macro-Diversion for cluster centered at [{req.target.lat}, {req.target.lon}]")
    manifest = engine.calculate_cluster_diversions(req.target.lat, req.target.lon, req.active_cluster)
    return {
        "total_diversions": len([m for m in manifest if m.get('status') == 'success']),
        "diversions": manifest
    }


@app.post("/calculate-route-diversion")
def calculate_route_diversion(req: RouteDiversionRequest):
    """
    Point-to-point diversion query: given a user-clicked Point A and Point B,
    plus the active incidents the frontend has already determined are near that
    corridor (time-filtered + bounding-box-filtered), return a single route that
    avoids all of them.
    """
    print(f"\n🧭 Computing Point-to-Point Diversion: A=({req.start.lat}, {req.start.lon}) -> B=({req.end.lat}, {req.end.lon}) avoiding {len(req.blocking_incidents)} active incident(s)")
    result = engine.calculate_point_to_point_route(
        req.start.lat, req.start.lon,
        req.end.lat, req.end.lon,
        req.blocking_incidents
    )
    return result


@app.get("/health")
def health():
    return {"status": "ok", "diversion_engine": "loaded", "deployment_models": "loaded"}


if __name__ == "__main__":
    uvicorn.run("app_integrated:app", host="127.0.0.1", port=8000, reload=True)
