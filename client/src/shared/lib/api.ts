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
export type SourceStatus = "healthy" | "unhealthy" | "starting";

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
  sourceData: UpdateCredentialsRequest
): Promise<Source> => {
  const response = await api.put<Source>(`/sources/credentials/${sourceId}/`, sourceData);
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

export default api;
