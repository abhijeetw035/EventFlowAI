import pandas as pd

CSV_FILE = "processed_data.csv"

df = pd.read_csv(CSV_FILE)

# valid event rows
valid = df[
    df["latitude"].notna()
    & df["longitude"].notna()
]

row = valid.iloc[0]

print("INCIDENT:")
print(row[[
    "latitude",
    "longitude",
    "endlatitude",
    "endlongitude",
    "affected_radius",
    "severity",
    "corridor",
    "junction"
]])

event = {
    "latitude": float(row["latitude"]),
    "longitude": float(row["longitude"]),
    "end_latitude": (
        float(row["endlatitude"])
        if pd.notna(row["endlatitude"])
        else None
    ),
    "end_longitude": (
        float(row["endlongitude"])
        if pd.notna(row["endlongitude"])
        else None
    ),
    "affected_radius_km": float(row["affected_radius"]),
    "severity": row["severity"],
    "corridor": row["corridor"],
    "junction": row["junction"],
}

print("\nEVENT OBJECT:\n")
print(event)