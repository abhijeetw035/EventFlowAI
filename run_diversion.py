import json
import pandas as pd

from diversion_planner import (
    Incident,
    DiversionPlanner
)

API_KEY = "YOUR_API_KEY"

df = pd.read_csv("processed_data.csv")

row = df.iloc[1]

print(row[[
    "latitude",
    "longitude",
    "endlatitude",
    "endlongitude",
    "affected_radius",
    "severity"
]])

incident = Incident(
    latitude=float(row["latitude"]),
    longitude=float(row["longitude"]),
    end_latitude=float(row["endlatitude"]),
    end_longitude=float(row["endlongitude"]),
    affected_radius_km=float(row["affected_radius"]),
    duration_minutes=float(row["duration_minutes"]),
    severity=row["severity"],
    corridor=row["corridor"],
    junction=row["junction"]
)

planner = DiversionPlanner(API_KEY)

plan = planner.generate_plan(incident)

with open("diversion_plan.json", "w") as f:
    json.dump(plan, f, indent=2)

print("Saved diversion_plan.json")
print(json.dumps(plan, indent=2)[:2000])