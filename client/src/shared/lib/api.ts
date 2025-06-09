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
  const response = await api.post<{ query_id: string }>("/execution/", {
    source_id,
    query
  });
  return response.data.query_id;
};

export const getQueryResults = async (query_id: string) => {
  try {
    const response = await api.get<object[]>(`/execution/results/${query_id}`);
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
  default?: boolean;
  workspace_id: string;
  created_at: string;
}

export interface LLMListItem {
  id: string;
  name: "openai" | "anthropic" | "gemini" | "ollama";
  model: string;
  default?: boolean;
}

export interface CreateLLMRequest {
  name: "openai" | "anthropic" | "gemini" | "ollama";
  model: string;
  api_key?: string;
  base_url?: string;
  api_version?: string;
  settings?: Record<string, unknown>;
  default?: boolean;
}

export interface UpdateLLMRequest {
  name?: "openai" | "anthropic" | "gemini" | "ollama";
  model?: string;
  api_key?: string;
  base_url?: string;
  api_version?: string;
  settings?: Record<string, unknown>;
  default?: boolean;
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

// Chat LLM types and functions
export interface ChatLLMRequest {
  source_id: string;
  llm_id: string;
  message: string;
  session_id: string;
  query?: string;
}

export interface ChatLLMResponse {
  content: string;
  sql_query?: string;
  metadata?: Record<string, unknown>;
}

export const chatLLM = async (data: ChatLLMRequest): Promise<ChatLLMResponse> => {
  const response = await api.post<ChatLLMResponse>("/llms/chat", data);
  return response.data;
};

// Chat Messages types and functions
export interface ChatMessageResponse {
  role: "user" | "assistant";
  content: string;
  sql_query?: string;
  created_at: string;
}

export interface ChatMessagesResponse {
  messages: ChatMessageResponse[];
  session_id: string;
  total_count: number;
}

export interface ChatSessionResponse {
  id: string;
  name?: string;
  source_id: string;
  llm_id: string;
  workspace_id: string;
  created_at: string;
}

export interface ChatSessionsResponse {
  sessions: ChatSessionResponse[];
  total_count: number;
}

export const getChatMessages = async (sessionId: string): Promise<ChatMessagesResponse> => {
  const response = await api.get<ChatMessagesResponse>(`/chat/messages/${sessionId}`);
  return response.data;
};

export const getChatSessions = async (): Promise<ChatSessionsResponse> => {
  const response = await api.get<ChatSessionsResponse>("/chat/sessions");
  return response.data;
};

// ==================== QUERY, VERSION, RUN TYPES ====================

export type UUID = string;

export interface Query {
  id: UUID;
  name?: string;
  is_ephemeral?: boolean;
  preview_key?: string;
  source_id: UUID;
  created_by: UUID;
  created_at: string;
}

export interface CreateQueryRequest {
  source_id: UUID;
  is_ephemeral?: boolean;
  preview_key?: string;
}

export interface UpdateQueryRequest {
  name?: string;
  is_ephemeral?: boolean;
}

export interface QueryVersion {
  id: UUID;
  sql: string;
  save_trigger: "manual" | "run" | "ai" | "on_exit";
  query_id: UUID;
  created_by: UUID;
  created_at: string;
}

export interface CreateQueryVersionRequest {
  sql: string;
  save_trigger: "manual" | "run" | "ai" | "on_exit";
  query_id: UUID;
  created_by: UUID;
}

export interface QueryRun {
  id: UUID;
  result_message?: string;
  error_message?: string;
  row_count?: number;
  execution_time_ms?: number;
  query_version_id: UUID;
  created_by: UUID;
  created_at: string;
}

export interface CreateQueryRunRequest {
  result_message?: string;
  error_message?: string;
  row_count?: number;
  execution_time_ms?: number;
  query_version_id: UUID;
  created_by: UUID;
}

// ==================== QUERY API ====================

export const getQueries = async (): Promise<Record<string, Query[]>> => {
  const response = await api.get<Record<string, Query[]>>("/query/");
  return response.data;
};

export const getQueryById = async (queryId: string): Promise<Query> => {
  const response = await api.get<Query>(`/query/${queryId}`);
  return response.data;
};

export const createQuery = async (data: CreateQueryRequest): Promise<Query> => {
  const response = await api.post<Query>("/query/", data);
  return response.data;
};

export const updateQuery = async (queryId: string, data: UpdateQueryRequest): Promise<Query> => {
  const response = await api.put<Query>(`/query/${queryId}`, data);
  return response.data;
};

export const deleteQuery = async (queryId: string): Promise<void> => {
  await api.delete(`/query/${queryId}`);
};

// ==================== EPHEMERAL QUERY API ====================

export const getOrCreateEphemeralQuery = async (
  sourceId: string,
  schema: string,
  table: string
): Promise<Query> => {
  const previewKey = `${sourceId}.${schema}.${table}`;
  const response = await api.post<Query>("/query/ephemeral", {
    source_id: sourceId,
    preview_key: previewKey
  });
  return response.data;
};

export const convertEphemeralToRegular = async (queryId: string, name: string): Promise<Query> => {
  const response = await api.put<Query>(`/query/${queryId}/convert`, {
    name
  });
  return response.data;
};

// ==================== QUERY VERSION API ====================

export const getQueryVersions = async (queryId: string): Promise<QueryVersion[]> => {
  const response = await api.get<QueryVersion[]>(`/versions/query/${queryId}/`);
  return response.data;
};

export const getLatestQueryVersion = async (queryId: string): Promise<QueryVersion | null> => {
  const response = await api.get<QueryVersion | null>(`/versions/query/${queryId}/latest`);
  return response.data;
};

export const getQueryVersionById = async (versionId: string): Promise<QueryVersion> => {
  const response = await api.get<QueryVersion>(`/versions/${versionId}`);
  return response.data;
};

export const createQueryVersion = async (
  data: CreateQueryVersionRequest
): Promise<QueryVersion> => {
  const response = await api.post<QueryVersion>("/versions/", data);
  return response.data;
};

export const deleteQueryVersion = async (versionId: string): Promise<void> => {
  await api.delete(`/versions/${versionId}`);
};

// ==================== QUERY RUN API ====================

export const getQueryRunsByQueryId = async (queryId: string): Promise<QueryRun[]> => {
  const response = await api.get<QueryRun[]>(`/runs/query/${queryId}`);
  return response.data;
};

export const getQueryRunsByVersionId = async (versionId: string): Promise<QueryRun[]> => {
  const response = await api.get<QueryRun[]>(`/runs/version/${versionId}`);
  return response.data;
};

export const getQueryRunById = async (runId: string): Promise<QueryRun> => {
  const response = await api.get<QueryRun>(`/runs/${runId}`);
  return response.data;
};

export const deleteQueryRun = async (runId: string): Promise<void> => {
  await api.delete(`/runs/${runId}`);
};

export default api;
