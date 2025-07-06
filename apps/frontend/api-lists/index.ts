import axios, { AxiosInstance, AxiosResponse } from "axios";
import { getAuthContent } from "../helpers/functions";

const apiClient: AxiosInstance = axios.create({
	baseURL: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1`,
	headers: {
		"Content-Type": "application/json",
	}
});

apiClient.interceptors.request.use(async (config) => {
	const authContent = await getAuthContent();
	if (authContent) config.headers.Authorization = authContent;
	return config;
});

export const analyzeWebsite = (payload: { url: string }): Promise<AxiosResponse> =>
	apiClient.post("/ai/analyze-ui", payload);
