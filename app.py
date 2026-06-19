import osmnx as ox
import networkx as nx
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import math

# ==========================================
# 1. THE LOCAL GRAPH ENGINE
# ==========================================
class LocalDiversionEngine:
    def __init__(self, lat, lon, dist=12000):
        print(f"🤖 Booting Local Graph Engine (Radius: {dist}m around BLR City Center)...")
        print("⏳ This might take 20-30 seconds to download and process the OSM graph...")
        # Load the physical road network into RAM
        self.G = ox.graph_from_point((lat, lon), dist=dist, network_type='drive')
        self.G = ox.add_edge_speeds(self.G)
        self.G = ox.add_edge_travel_times(self.G)
        self.original_G = self.G.copy()
        print(f"✅ Graph locked and loaded: {len(self.G.nodes)} nodes, {len(self.G.edges)} edges.")

    def reset_graph(self):
        """Clears all previous temporary roadblocks."""
        self.G = self.original_G.copy()

    def calculate_incident_diversions(self, incident_lat, incident_lon):
        try:
            nearest_edge = ox.nearest_edges(self.G, incident_lon, incident_lat)
            u_node, v_node, key = nearest_edge
            
            # Sever the specific road segment
            if self.G.has_edge(u_node, v_node): self.G.remove_edge(u_node, v_node)
            if self.G.has_edge(v_node, u_node): self.G.remove_edge(v_node, u_node)

            # Find all traffic heading into this exact intersection
            approaching_edges = self.original_G.in_edges(u_node, data=True)
            diversion_manifest = []

            # Route every incoming street around the block
            for source_node, _, data in approaching_edges:
                if source_node == v_node: continue
                incoming_road_name = data.get('name', 'Local Street')
                
                try:
                    # Dijkstra's Algorithm for instant local bypass
                    diversion_path = nx.shortest_path(self.G, source=source_node, target=v_node, weight='travel_time')
                    coords = [[self.G.nodes[n]['y'], self.G.nodes[n]['x']] for n in diversion_path]
                    
                    diversion_manifest.append({
                        "from_road": incoming_road_name,
                        "coordinates": coords,
                        "status": "success"
                    })
                except nx.NetworkXNoPath:
                    diversion_manifest.append({
                        "from_road": incoming_road_name,
                        "status": "gridlock"
                    })

            return diversion_manifest
        except Exception as e:
            return [{"from_road": "System", "status": f"Error: Out of graph bounds or unconnected node."}]

# ==========================================
# 2. THE FASTAPI SERVER
# ==========================================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize global engine centered near Bengaluru city center with a 12km radius
engine = LocalDiversionEngine(12.9716, 77.5946, dist=12000)

@app.get("/get-dataset")
def get_dataset():
    """Reads the CSV and sends the raw incident data to the frontend."""
    try:
        df = pd.read_csv("Data/Dataset.csv")
        
        # Filter out rows missing core coordinates
        df = df.dropna(subset=['latitude', 'longitude'])
        
        # THE BULLETPROOF FIX: Force all NaNs, Nulls, and missing data to be empty strings
        df = df.fillna("")
        
        # Convert to dictionary format for JSON response
        incidents = df.to_dict(orient="records")
        return {"status": "success", "data": incidents}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/get-local-diversions")
def get_local_diversions(incident_lat: float, incident_lon: float):
    print(f"\n🚨 Computing Diversions for Incident at [{incident_lat}, {incident_lon}]")
    engine.reset_graph()
    manifest = engine.calculate_incident_diversions(incident_lat, incident_lon)
    
    return {
        "incident_point": {"lat": incident_lat, "lon": incident_lon},
        "total_diversions": len([m for m in manifest if m.get('status') == 'success']),
        "diversions": manifest
    }

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)