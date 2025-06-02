import axios from "axios";

// Create axios instance with base URL
const api = axios.create({
  baseURL: "/api", // We'll use the Vite proxy which will route to the correct server
  headers: {
    "Content-Type": "application/json"
  }
});

// Define types for our sources
export interface Source {
  id: string;
  name: string;
  dbtype: string;
}

// Source status type
export type SourceStatus = "healthy" | "unhealthy" | "starting" | "running";

// API functions
export const getSources = async (): Promise<Source[]> => {
  const response = await api.get<Source[]>("/sources/");
  return response.data;
};

// Get schemas for a specific source
export const getSourceSchemas = async (sourceId: string) => {
  const response = await api.get(`/sources/schemas/${sourceId}`);
  return response.data;
};

// Connect to a source
export const connectSource = async (sourceId: string): Promise<void> => {
  await api.get(`/sources/connect/${sourceId}`);
};

// Disconnect from a source
export const disconnectSource = async (sourceId: string): Promise<void> => {
  await api.delete(`/sources/disconnect/${sourceId}`);
};

// Get source status
export const getSourceStatus = async (sourceId: string): Promise<SourceStatus> => {
  const response = await api.get<{ status: SourceStatus }>(`/sources/status/${sourceId}`);
  return response.data.status;
};

export const executeQuery = async (source_id: string, query: string) => {
  const response = await api.post<{ query_id: string }>("query/execute/", {
    source_id,
    query
  });
  return response.data.query_id;
};

export const getQueryResults = async (query_id: string) => {
  try {
    const response = await api.get<object[]>(`query/results/${query_id}/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 202) {
      // Still processing, return a signal that we need to keep polling
      return null;
    }
    throw error;
  }
};

// Create a new database source
export interface CreateSourceRequest {
  name: string;
  dbtype: "postgres" | "mysql" | "sqlite";
  creds: PostgresCreds | MysqlCreds | SqliteCreds;
}

export interface PostgresCreds {
  host: string;
  port: number;
  user: string;
  password: string;
  dbname: string;
}

export interface MysqlCreds {
  host: string;
  port: number;
  user: string;
  password: string;
  dbname: string;
}

export interface SqliteCreds {
  path: string;
}

export const createSource = async (sourceData: CreateSourceRequest): Promise<Source> => {
  const response = await api.post<Source>("/sources/", sourceData);
  return response.data;
};

export interface TestSourceResponse {
  message: string;
}

export const testSource = async (sourceData: CreateSourceRequest): Promise<TestSourceResponse> => {
  const response = await api.post<TestSourceResponse>("/sources/test/", sourceData);
  return response.data;
};

export interface SourceCredentials {
  name: string;
  dbtype: string;
  creds: PostgresCreds | MysqlCreds | SqliteCreds;
}

export const getSourceCredentials = async (sourceId: string): Promise<SourceCredentials> => {
  const response = await api.get<SourceCredentials>(`/sources/credentials/${sourceId}/`);
  return response.data;
};

export interface UpdateCredentialsRequest {
  creds?: PostgresCreds | MysqlCreds | SqliteCreds;
}

export const updateSourceCredentials = async (
  sourceId: string,
  credentials: Partial<SourceCredentials>
): Promise<SourceCredentials> => {
  const response = await api.put<SourceCredentials>(
    `/sources/credentials/${sourceId}/`,
    credentials
  );
  return response.data;
};

export const renameSource = async (sourceId: string, name: string): Promise<Source> => {
  const response = await api.put<Source>(`/sources/rename/${sourceId}/`, { name });
  return response.data;
};

export const deleteSource = async (sourceId: string): Promise<void> => {
  await api.delete(`/sources/${sourceId}/`);
};

// Get connected sources
export interface ConnectedSource {
  id: string;
  source_id: string;
}

export const getConnectedSources = async (): Promise<ConnectedSource[]> => {
  const response = await api.get<ConnectedSource[]>("/sources/connected/");
  return response.data;
};

// LLM Types
export interface LLM {
  id: string;
  name: "openai" | "anthropic" | "gemini" | "ollama";
  model: string;
  base_url?: string;
  api_version?: string;
  settings?: Record<string, unknown>;
  workspace_id: string;
  created_at: string;
}

export interface LLMListItem {
  id: string;
  name: "openai" | "anthropic" | "gemini" | "ollama";
  model: string;
}

export interface CreateLLMRequest {
  name: "openai" | "anthropic" | "gemini" | "ollama";
  model: string;
  api_key?: string;
  base_url?: string;
  api_version?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateLLMRequest {
  name?: "openai" | "anthropic" | "gemini" | "ollama";
  model?: string;
  api_key?: string;
  base_url?: string;
  api_version?: string;
  settings?: Record<string, unknown>;
}

// LLM API functions
export const getLLMs = async (): Promise<LLMListItem[]> => {
  const response = await api.get<LLMListItem[]>("/llms/");
  return response.data;
};

export const getLLM = async (llmId: string): Promise<LLM> => {
  const response = await api.get<LLM>(`/llms/${llmId}`);
  return response.data;
};

export const createLLM = async (data: CreateLLMRequest): Promise<LLM> => {
  const response = await api.post<LLM>("/llms/", data);
  return response.data;
};

export const updateLLM = async (llmId: string, data: UpdateLLMRequest): Promise<LLM> => {
  const response = await api.put<LLM>(`/llms/${llmId}`, data);
  return response.data;
};

export const deleteLLM = async (llmId: string): Promise<void> => {
  await api.delete(`/llms/${llmId}`);
};

export default api;
