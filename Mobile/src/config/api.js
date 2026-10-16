import Constants from "expo-constants";

function getApiOrigin() {
  const configuredUrl = Constants.expoConfig?.extra?.apiUrl;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const expoHost =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost;

  if (expoHost) {
    const host = new URL(
      expoHost.includes("://") ? expoHost : `http://${expoHost}`
    ).hostname;

    return `http://${host}:3000`;
  }

  throw new Error("Backend API address is not configured");
}

export const API_ORIGIN = getApiOrigin();