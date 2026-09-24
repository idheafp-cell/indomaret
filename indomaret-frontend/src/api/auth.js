import apiClient, { setToken } from "./client";

export async function login(email, password) {
  const { data } = await apiClient.post("/login", {
    email,
    password,
    device_name: "web-dashboard",
  });
  setToken(data.token);
  return data.user;
}

export async function logout() {
  try {
    await apiClient.post("/logout");
  } finally {
    setToken(null);
  }
}

export async function fetchMe() {
  const { data } = await apiClient.get("/me");
  return data.user;
}
