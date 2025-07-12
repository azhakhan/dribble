import axios from "axios";
import type { SchemaObject } from "@/shared/store/types";

// Create axios instance with base URL
const api = axios.create({
  baseURL: "/api", // Use the Vite proxy which will route to the correct server
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
export const getSourceSchemas = async (sourceId: string): Promise<Record<string, SchemaObject>> => {
  const response = await api.get<Record<string, SchemaObject>>(`/worker/schemas/${sourceId}/`);
  return response.data;
};

// Connect to a source
export const connectSource = async (sourceId: string): Promise<void> => {
  await api.get(`/worker/connect/${sourceId}/`);
};

// Disconnect from a source
export const disconnectSource = async (sourceId: string): Promise<void> => {
  await api.delete(`/worker/disconnect/${sourceId}/`);
};

// Execute query with direct streaming
export const executeQueryVersionTask = async (
  request: CreateQueryRunRequest,
  clientId?: string
): Promise<{ task_id: string; status: string; message: string }> => {
  const headers = clientId ? { "X-Client-ID": clientId } : {};
  const response = await api.post<{ task_id: string; status: string; message: string }>(
    "/execution/",
    request,
    { headers }
  );
  return response.data;
};

// Worker task result interface
export interface WorkerTaskResult {
  status: "success" | "error" | "running" | "cancelled";
  data?: Record<string, unknown>[];
  error?: string;
}

// Get task result from worker
export const getWorkerTaskResult = async (taskId: string): Promise<WorkerTaskResult> => {
  const response = await api.get<WorkerTaskResult>(`/worker/result/${taskId}/`);
  return response.data;
};

// Cancel a running query
export const cancelQueryRun = async (
  query_run_id: string,
  clientId?: string
): Promise<{
  query_run_id: string;
  status: string;
  message: string;
}> => {
  const headers = clientId ? { "X-Client-ID": clientId } : {};
  const response = await api.post(`/execution/cancel/${query_run_id}/`, {}, { headers });
  return response.data;
};

// Create a new database source
export interface CreateSourceRequest {
  name: string;
  dbtype: "postgres" | "mysql";
  creds: PostgresCreds | MysqlCreds;
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

export const createSource = async (sourceData: CreateSourceRequest): Promise<Source> => {
  const response = await api.post<Source>("/sources/", sourceData);
  return response.data;
};

export interface TestSourceResponse {
  status: "success" | "error";
  message: string;
}

export const testSource = async (sourceData: CreateSourceRequest): Promise<TestSourceResponse> => {
  const response = await api.post<TestSourceResponse>("/worker/test_db/", sourceData);
  return response.data;
};

export interface SourceCredentials {
  name: string;
  dbtype: string;
  creds: PostgresCreds | MysqlCreds;
}

export const getSourceCredentials = async (sourceId: string): Promise<SourceCredentials> => {
  const response = await api.get<SourceCredentials>(`/sources/credentials/${sourceId}/`);
  return response.data;
};

export interface UpdateCredentialsRequest {
  creds?: PostgresCreds | MysqlCreds;
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
  const response = await api.get<ConnectedSource[]>("/worker/connected/");
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
  const response = await api.get<LLM>(`/llms/${llmId}/`);
  return response.data;
};

export const createLLM = async (data: CreateLLMRequest): Promise<LLM> => {
  const response = await api.post<LLM>("/llms/", data);
  return response.data;
};

export const updateLLM = async ({
  llmId,
  data
}: {
  llmId: string;
  data: UpdateLLMRequest;
}): Promise<LLM> => {
  const response = await api.put<LLM>(`/llms/${llmId}/`, data);
  return response.data;
};

export const deleteLLM = async (llmId: string): Promise<void> => {
  await api.delete(`/llms/${llmId}/`);
};

// Chat LLM types and functions
export interface ChatContext {
  query_id: string;
  query_version_id?: string;
  active?: boolean;
}

export interface ChatLLMRequest {
  llm_id: string;
  message: string;
  session_id: string;
  context?: ChatContext[];
}

export interface ChatLLMResponse {
  content: string;
  sql_query?: string;
  metadata?: Record<string, unknown>;
  query_id?: string;
  updated_query_id?: string;
}

export const chatLLM = async (data: ChatLLMRequest): Promise<ChatLLMResponse> => {
  const response = await api.post<ChatLLMResponse>("/chat/", data);
  return response.data;
};

// Chat Messages types and functions
export interface ChatMessageResponse {
  role: "user" | "assistant";
  content: string;
  sql_query?: string;
  created_at: string;
  context?: ChatContext[];
}

export interface ChatMessagesResponse {
  messages: ChatMessageResponse[];
  session_id: string;
  total_count: number;
}

export interface ChatSessionResponse {
  id: string;
  name?: string;
  llm_id: string;
  created_at: string;
}

export interface ChatSessionsResponse {
  sessions: ChatSessionResponse[];
  total_count: number;
}

// Chat session types
export interface CreateChatSessionRequest {
  name?: string;
  llm_id: string;
}

export interface UpdateChatSessionRequest {
  name?: string;
}

export const getChatMessages = async (sessionId: string): Promise<ChatMessagesResponse> => {
  const response = await api.get<ChatMessagesResponse>(`/chat/messages/${sessionId}/`);
  return response.data;
};

export const getChatSessions = async (): Promise<ChatSessionsResponse> => {
  const response = await api.get<ChatSessionsResponse>("/chat/sessions/");
  return response.data;
};

export const getChatSession = async (sessionId: string): Promise<ChatSessionResponse> => {
  const response = await api.get<ChatSessionResponse>(`/chat/sessions/${sessionId}/`);
  return response.data;
};

export const createChatSession = async (
  data: CreateChatSessionRequest
): Promise<ChatSessionResponse> => {
  const response = await api.post<ChatSessionResponse>("/chat/sessions/", data);
  return response.data;
};

export const updateChatSession = async ({
  sessionId,
  data
}: {
  sessionId: string;
  data: UpdateChatSessionRequest;
}): Promise<ChatSessionResponse> => {
  const response = await api.put<ChatSessionResponse>(`/chat/sessions/${sessionId}/`, data);
  return response.data;
};

export const deleteChatSession = async (sessionId: string): Promise<void> => {
  await api.delete(`/chat/sessions/${sessionId}/`);
};

// ==================== QUERY, VERSION, RUN TYPES ====================

export type UUID = string;

export interface Query {
  id: UUID;
  name?: string;
  is_ephemeral?: boolean;
  preview_key?: string;
  source_id: UUID;
  created_at: string;
}

export interface CreateQueryRequest {
  source_id: UUID;
  name?: string;
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
  created_at: string;
}

export interface CreateQueryVersionRequest {
  sql: string;
  save_trigger: "manual" | "run" | "ai" | "on_exit";
  query_id: UUID;
}

export interface QueryRun {
  id: UUID;
  result_message?: string;
  error_message?: string;
  row_count?: number;
  execution_time_ms?: number;
  query_version_id: UUID;
  created_at: string;
}

export interface QueryRunModifiers {
  limit?: number;
  offset?: number;
  where?: string;
  order_by?: string;
}

export interface CreateQueryRunRequest {
  query_version_id: UUID;
  modifiers?: QueryRunModifiers;
}

export interface UpdateQueryRunRequest {
  result_message?: string;
  error_message?: string;
  row_count?: number;
  execution_time_ms?: number;
}

// ==================== QUERY API ====================

export const getQueries = async (): Promise<Record<string, Query[]>> => {
  const response = await api.get<Record<string, Query[]>>("/query/");
  return response.data;
};

export const getQueryById = async (queryId: string): Promise<Query> => {
  const response = await api.get<Query>(`/query/${queryId}/`);
  return response.data;
};

export const createQuery = async (data: CreateQueryRequest): Promise<Query> => {
  const response = await api.post<Query>("/query/", data);
  return response.data;
};

export const updateQuery = async (queryId: string, data: UpdateQueryRequest): Promise<Query> => {
  const response = await api.put<Query>(`/query/${queryId}/`, data);
  return response.data;
};

export const deleteQuery = async (queryId: string): Promise<void> => {
  await api.delete(`/query/${queryId}/`);
};

// ==================== EPHEMERAL QUERY API ====================

export const getOrCreateEphemeralQuery = async (
  sourceId: string,
  schema: string,
  table: string,
  nodeType: "table" | "view"
): Promise<Query> => {
  const previewKey = `${nodeType}-${sourceId}.${schema}.${table}`;
  const response = await api.post<Query>("/query/ephemeral/", {
    source_id: sourceId,
    preview_key: previewKey
  });
  return response.data;
};

export const convertEphemeralToRegular = async (queryId: string): Promise<Query> => {
  const response = await api.post<Query>(`/query/${queryId}/convert/`);
  return response.data;
};

// ==================== QUERY VERSION API ====================

export const getQueryVersions = async (queryId: string): Promise<QueryVersion[]> => {
  const response = await api.get<QueryVersion[]>(`/versions/query/${queryId}/`);
  return response.data;
};

export const getLatestQueryVersion = async (queryId: string): Promise<QueryVersion | null> => {
  const response = await api.get<QueryVersion>(`/versions/query/${queryId}/latest/`);
  return response.data;
};

export const getQueryVersionById = async (versionId: string): Promise<QueryVersion> => {
  const response = await api.get<QueryVersion>(`/versions/${versionId}/`);
  return response.data;
};

export const createQueryVersion = async (
  data: CreateQueryVersionRequest
): Promise<QueryVersion> => {
  const response = await api.post<QueryVersion>("/versions/", data);
  return response.data;
};

export const deleteQueryVersion = async (versionId: string): Promise<void> => {
  await api.delete(`/versions/${versionId}/`);
};

// ==================== QUERY RUN API ====================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export const getQueryRunsByQueryId = async (queryId: string): Promise<QueryRun[]> => {
  // Use the paginated endpoint but return just the items for backward compatibility
  const response = await api.get<PaginatedResponse<QueryRun>>(
    `/runs/query/${queryId}/?page=1&page_size=100`
  );
  return response.data.items;
};

export const getQueryRunsByQueryIdPaginated = async (
  queryId: string,
  page = 1,
  pageSize = 20
): Promise<PaginatedResponse<QueryRun>> => {
  const response = await api.get<PaginatedResponse<QueryRun>>(
    `/runs/query/${queryId}/?page=${page}&page_size=${pageSize}`
  );
  return response.data;
};

export const getQueryRunsByVersionId = async (versionId: string): Promise<QueryRun[]> => {
  const response = await api.get<QueryRun[]>(`/runs/version/${versionId}/`);
  return response.data;
};

export const getQueryRunById = async (runId: string): Promise<QueryRun> => {
  const response = await api.get<QueryRun>(`/runs/${runId}/`);
  return response.data;
};

export default api;
