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

export default api;
