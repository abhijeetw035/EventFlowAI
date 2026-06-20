"""
deployment_service.py
=======================
EventFlow AI — Stage 2d: FastAPI router for manpower/barricade predictions.

Mount this into your existing app.py (see app_integrated.py for a full
example) so the diversion engine and the deployment model share one process
and one set of model artifacts loaded once at startup.

Endpoint:
    POST /predict-deployment
        body: DeploymentRequest (see below)
        returns: recommended_personnel, recommended_barricades,
                 deployment_tier, plus the derived severity/affected_radius
                 used internally and a "label_basis" note so the frontend
                 can be honest with the user that these are model estimates,
                 not measured facts.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

import joblib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from inference_features import DeploymentFeatureBuilder

router = APIRouter()

ARTIFACTS_DIR = Path("model_artifacts")
FEATURE_METADATA_PATH = Path("feature_metadata.json")

_builder: Optional[DeploymentFeatureBuilder] = None
_personnel_model = None
_barricade_model = None
_tier_model = None
_tier_encoder = None


class DeploymentRequest(BaseModel):
    lat: float
    lon: float
    event_type: str = Field(default="unplanned", description="'planned' or 'unplanned'")
    event_cause: str = Field(default="others")
    priority: str = Field(default="unknown")
    veh_type: str = Field(default="others")
    requires_road_closure: bool = False
    corridor: str = "unknown"
    junction: str = "unknown"
    zone: str = "unknown"
    description: str = ""
    start_datetime: Optional[str] = None
    expected_duration_minutes: float = 60.0


class DeploymentResponse(BaseModel):
    recommended_personnel: int
    recommended_barricades: int
    deployment_tier: str
    severity_encoded: int
    affected_radius_km: float
    is_major_corridor: bool
    location_cluster: int
    explanation: List[str]
    label_basis: str = (
        "Model estimate trained on weak-supervision proxy labels "
        "(no historical ground-truth deployment records exist yet). "
        "Treat as a starting recommendation, not a measured fact."
    )


def load_models() -> None:
    """Call once at app startup."""
    global _builder, _personnel_model, _barricade_model, _tier_model, _tier_encoder
    print(f"Loading deployment models from {ARTIFACTS_DIR} ...")
    _builder = DeploymentFeatureBuilder(ARTIFACTS_DIR, FEATURE_METADATA_PATH)
    _personnel_model = joblib.load(ARTIFACTS_DIR / "personnel_model.joblib")
    _barricade_model = joblib.load(ARTIFACTS_DIR / "barricade_model.joblib")
    _tier_model = joblib.load(ARTIFACTS_DIR / "tier_model.joblib")
    _tier_encoder = joblib.load(ARTIFACTS_DIR / "tier_label_encoder.joblib")
    print("Deployment models loaded.")


@router.post("/predict-deployment", response_model=DeploymentResponse)
def predict_deployment(req: DeploymentRequest) -> DeploymentResponse:
    if _builder is None:
        raise HTTPException(status_code=503, detail="Deployment models not loaded yet. Call load_models() at startup.")

    try:
        frame, extras = _builder.build(req.model_dump())
        personnel = float(_personnel_model.predict(frame)[0])
        barricades = float(_barricade_model.predict(frame)[0])
        tier_idx = _tier_model.predict(frame)[0]
        tier = str(_tier_encoder.inverse_transform([tier_idx])[0])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc

    recommended_personnel = max(2, round(personnel))
    recommended_barricades = max(2, round(barricades))

    return DeploymentResponse(
        recommended_personnel=recommended_personnel,
        recommended_barricades=recommended_barricades,
        deployment_tier=tier,
        severity_encoded=extras["severity_encoded"],
        affected_radius_km=extras["affected_radius"],
        is_major_corridor=bool(extras["is_major_corridor"]),
        location_cluster=extras["location_cluster"],
        explanation=build_explanation(req, extras, recommended_personnel, recommended_barricades),
    )


def build_explanation(req: DeploymentRequest, extras: dict, personnel: int, barricades: int) -> list[str]:
    reasons = [
        (
            f"The estimated {extras['affected_radius']:.2f} km impact radius is a primary sizing signal; "
            "larger affected areas require more coverage points and staff."
        )
    ]

    if req.requires_road_closure:
        reasons.append("A road closure increases both traffic-control staffing and barricade requirements.")
    if extras["is_major_corridor"]:
        reasons.append("The incident is on a major corridor, increasing control points and diversion complexity.")
    if req.priority.lower() == "high":
        reasons.append("High priority raises the inferred severity and the recommended response capacity.")

    text = f"{req.event_cause} {req.description}".lower()
    if any(token in text for token in ("rally", "protest", "procession", "crowd")):
        reasons.append("Crowd or procession language adds perimeter-control and public-safety demand.")
    if any(token in text for token in ("accident", "crash", "collision")):
        reasons.append("Accident language adds scene protection and traffic separation requirements.")

    if len(reasons) == 1:
        reasons.append(
            "No road closure, major-corridor, high-priority, crowd, or accident signal was supplied, "
            "so the recommendation remains near the model's lower operating range."
        )

    reasons.append(
        f"Combined model severity is {extras['severity_encoded']} on the encoded 0-2 scale; "
        f"learned interactions across these inputs and historical location patterns produced "
        f"{personnel} personnel and {barricades} barricades."
    )
    return reasons
