import osmnx as ox
import networkx as nx
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uvicorn

# --- Data Models for Cluster Payload ---
class Point(BaseModel):
    lat: float
    lon: float

class ClusterRequest(BaseModel):
    target: Point
    active_cluster: List[Point]

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

    def calculate_cluster_diversions(self, target_lat, target_lon, active_cluster_coords):
        # 1. Reset map to clean temporal state
        self.G = self.original_G.copy()
        
        # 2. MACRO-SEVERANCE: Obliterate every active incident edge in the cluster from the graph
        print(f"🧨 Severing {len(active_cluster_coords)} active incident edges in local cluster...")
        for pt in active_cluster_coords:
            try:
                u, v, key = ox.nearest_edges(self.G, pt.lon, pt.lat)
                if self.G.has_edge(u, v): self.G.remove_edge(u, v)
                if self.G.has_edge(v, u): self.G.remove_edge(v, u)
            except Exception:
                continue # Skip if node is unroutable or out of bounds

        # 3. Locate the specific target intersection the user clicked
        try:
            u_target, v_target, _ = ox.nearest_edges(self.original_G, target_lon, target_lat)
            approaching_edges = self.original_G.in_edges(u_target, data=True)
            diversion_manifest = []

            # 4. ITERATIVE RECOVERY ROUTING
            for source_node, _, data in approaching_edges:
                if source_node == v_target: continue
                incoming_road = data.get('name', 'Local Street')
                
                bypass_path = None
                
                # Expand search radius to find a safe downstream node not trapped in the dead zone
                # Depth 0 (Original node) up to Depth 5 (5 intersections away)
                for depth in range(6):
                    if bypass_path: break
                    
                    # Get all nodes at 'depth' intersections away from the original target
                    target_pool = list(nx.ego_graph(self.original_G, v_target, radius=depth).nodes)
                    
                    for potential_target in target_pool:
                        try:
                            # Attempt shortest path through the heavily severed graph
                            bypass_path = nx.shortest_path(self.G, source=source_node, target=potential_target, weight='travel_time')
                            break # Success! We cleared the cluster!
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

# ==========================================
# 2. FASTAPI SERVER
# ==========================================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = LocalDiversionEngine(12.9716, 77.5946, dist=12000)

@app.get("/get-dataset")
def get_dataset():
    """Reads the CSV and sends the raw incident data to the frontend."""
    try:
        df = pd.read_csv("Data/Dataset.csv")
        df = df.dropna(subset=['latitude', 'longitude'])
        df = df.fillna("") # Bulletproof fix for JSON NaN issues
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

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)