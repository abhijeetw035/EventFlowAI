"""
app_integrated.py
===================
EventFlow AI — Stage 3: one FastAPI backend serving everything.

This is your existing app.py (diversion-cluster engine + /get-dataset),
UNCHANGED in its routing logic, with the new manpower/barricade model
mounted alongside it via deployment_service.py. One process, one port,
one set of models loaded once at startup -- so the React frontend (see the
react-frontend Codex prompt) only ever talks to ONE backend.

Run with:
    uvicorn app_integrated:app --host 127.0.0.1 --port 8000 --reload

Before running this for the first time:
    1. python preprocess.py                     (your existing script)
    2. python prepare_deployment_dataset.py      (produces model_artifacts/)
    3. python train_deployment_models.py         (fills in the *.joblib files)

New endpoint added beyond your original app.py:
    POST /predict-deployment   -> see deployment_service.py

Everything else (/get-dataset, /calculate-cluster-diversion) is identical
to your original app.py.
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

# --- Data Models (unchanged from your app.py) ---
class Point(BaseModel):
    lat: float
    lon: float


class ClusterRequest(BaseModel):
    target: Point
    active_cluster: List[Point]
    radius_km: float  # Dynamic radius from frontend


# ==========================================
# 1. OPTIMIZED GRAPH ENGINE (unchanged from your app.py)
# ==========================================
class LocalDiversionEngine:
    def __init__(self, lat, lon, dist=50000):
        print(f"🤖 Booting Advanced Cluster Graph Engine (Radius: {dist}m)...")
        self.G = ox.graph_from_point((lat, lon), dist=dist, network_type='drive')
        self.G = ox.add_edge_speeds(self.G)
        self.G = ox.add_edge_travel_times(self.G)
        print(f"✅ Engine Online: {len(self.G.nodes)} nodes, {len(self.G.edges)} edges.")

    def calculate_cluster_diversions(self, target_lat, target_lon, active_cluster_coords, radius_km):
        diversion_manifest = []
        modified_edges = {}

        try:
            if active_cluster_coords:
                lons = [pt.lon for pt in active_cluster_coords]
                lats = [pt.lat for pt in active_cluster_coords]
                severed_edges = ox.nearest_edges(self.G, lons, lats)
            else:
                severed_edges = []

            for u, v, key in severed_edges:
                if self.G.has_edge(u, v, key):
                    modified_edges[(u, v, key)] = self.G[u][v][key].get('travel_time', 1)
                    self.G[u][v][key]['travel_time'] = float('inf')
                if self.G.has_edge(v, u, key):
                    modified_edges[(v, u, key)] = self.G[v][u][key].get('travel_time', 1)
                    self.G[v][u][key]['travel_time'] = float('inf')

            u_target, v_target, _ = ox.nearest_edges(self.G, target_lon, target_lat)
            approaching_edges = self.G.in_edges(u_target, data=True)

            for source_node, _, data in approaching_edges:
                if source_node == v_target:
                    continue

                raw_name = data.get('name', 'Local Street')
                incoming_road = raw_name[0] if isinstance(raw_name, list) else raw_name

                bypass_path = None
                search_depths = [1, 5, 15, 30]
                downstream_targets = []
                for depth in search_depths:
                    downstream_targets.extend(list(nx.ego_graph(self.G, v_target, radius=depth).nodes))
                downstream_targets = list(dict.fromkeys(downstream_targets))

                for potential_target in downstream_targets:
                    if source_node == potential_target:
                        continue
                    try:
                        bypass_path = nx.shortest_path(self.G, source=source_node, target=potential_target, weight='travel_time')
                        path_weight = nx.path_weight(self.G, bypass_path, 'travel_time')
                        if path_weight == float('inf'):
                            bypass_path = None
                            continue
                        break
                    except nx.NetworkXNoPath:
                        continue

                if bypass_path:
                    coords = [[self.G.nodes[n]['y'], self.G.nodes[n]['x']] for n in bypass_path]
                    diversion_manifest.append({"from_road": incoming_road, "coordinates": coords, "status": "success"})
                else:
                    diversion_manifest.append({"from_road": incoming_road, "status": "gridlock"})

        except Exception as e:
            print(f"Routing Error: {e}")
            return [{"from_road": "System", "status": f"Graph Error: {str(e)}"}]

        finally:
            for (u, v, key), original_time in modified_edges.items():
                self.G[u][v][key]['travel_time'] = original_time

        return diversion_manifest


# ==========================================
# 2. FASTAPI SERVER
# ==========================================
app = FastAPI(title="EventFlow AI Backend")

app.add_middleware(
    CORSMiddleware,
    # Hackathon demo default: scope this to the real frontend origin before any real deployment.
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
    try:
        df = pd.read_csv("Data/Dataset.csv")
        df = df.dropna(subset=['latitude', 'longitude']).fillna("")
        return {"status": "success", "data": df.to_dict(orient="records")}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/calculate-cluster-diversion")
def calculate_cluster_diversion(req: ClusterRequest):
    manifest = engine.calculate_cluster_diversions(req.target.lat, req.target.lon, req.active_cluster, req.radius_km)
    return {
        "total_diversions": len([m for m in manifest if m.get('status') == 'success']),
        "diversions": manifest
    }


@app.get("/health")
def health():
    return {"status": "ok", "diversion_engine": "loaded", "deployment_models": "loaded"}


if __name__ == "__main__":
    uvicorn.run("app_integrated:app", host="127.0.0.1", port=8000, reload=True)
