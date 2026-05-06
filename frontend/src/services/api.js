import { API_URL } from "../utils/constants.js";

export { API_URL };

export function getApiHeaders(rdAdminCode) {
  const headers = { "Content-Type": "application/json" };
  if (rdAdminCode) {
    headers["x-admin-code"] = rdAdminCode;
  }
  return headers;
}
