import axios from "axios";

// Create axios instance with base URL
const api = axios.create({
  baseURL: "/api", // We'll use the Vite proxy which will route to the correct server
  headers: {
    "Content-Type": "application/json",
  },
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

export default api;
