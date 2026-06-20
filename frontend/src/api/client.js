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
  return request("/calculate-cluster-diversion", {
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
