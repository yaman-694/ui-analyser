import axios, { AxiosInstance, AxiosResponse } from "axios";
import { getAuthContent } from "../helpers/functions";

const apiClient: AxiosInstance = axios.create({
	baseURL: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1`,
	headers: {
		"Content-Type": "application/json",
	}
});

apiClient.interceptors.request.use(async (config) => {
	// Server-side SSR support: attach cookie-derived token if available
	const authContent = await getAuthContent();
	if (authContent) config.headers.Authorization = authContent;
	return config;
});

export const analyzeWebsite = (
	payload: { url: string },
	opts?: { token?: string }
): Promise<AxiosResponse> =>
	apiClient.post("/ai/analyze-ui", payload, {
		headers: opts?.token ? { Authorization: `Bearer ${opts.token}` } : undefined,
	});

export const getCurrentUser = (opts?: { token?: string }): Promise<AxiosResponse> =>
	apiClient.get("/user/get-current-user", {
		headers: opts?.token ? { Authorization: `Bearer ${opts.token}` } : undefined,
	});