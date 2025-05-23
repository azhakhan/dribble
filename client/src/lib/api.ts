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

export const executeQuery = async (database_id: string, query: string) => {
  const response = await api.post<object[]>("query/execute/", {
    database_id,
    query
  });
  return response.data;
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

export interface UpdateSourceRequest {
  name?: string;
  dbtype?: string;
  creds?: PostgresCreds | MysqlCreds | SqliteCreds;
}

export const updateSource = async (
  sourceId: string,
  sourceData: UpdateSourceRequest
): Promise<Source> => {
  const response = await api.put<Source>(`/sources/${sourceId}/`, sourceData);
  return response.data;
};

export default api;
