const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return response.json();
}

export function getDataset() {
  return request("/get-dataset");
}

export function calculateClusterDiversion(payload) {
  // NOTE: radius_km is intentionally excluded from the payload.
  // The frontend already filters the cluster by radius before calling this.
  // The backend receives only the pre-filtered active_cluster list.
  return request("/calculate-cluster-diversion", {
    method: "POST",
    body: JSON.stringify({
      target: payload.target,
      active_cluster: payload.active_cluster,
    }),
  });
}

export function calculateRouteDiversion(payload) {
  return request("/calculate-route-diversion", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function predictDeployment(payload) {
  return request("/predict-deployment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
