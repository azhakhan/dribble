import { toast } from "sonner";

export enum ErrorContext {
  QUERY_EXECUTION = "Query Execution",
  QUERY_SAVING = "Query Saving",
  SOURCE_CONNECTION = "Source Connection",
  FILE_OPERATIONS = "File Operations",
  DATA_LOADING = "Data Loading",
  AUTHENTICATION = "Authentication",
  NAVIGATION = "Navigation",
  GENERAL = "General"
}

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical"
}

export interface ErrorDetails {
  originalError: Error | unknown;
  context: ErrorContext;
  severity: ErrorSeverity;
  userMessage?: string;
  technicalDetails?: Record<string, unknown>;
  correlationId?: string;
}

export interface ErrorReportingConfig {
  enableConsoleLogging: boolean;
  enableToastNotifications: boolean;
  enableRemoteReporting: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
}

export class ErrorService {
  private static config: ErrorReportingConfig = {
    enableConsoleLogging: true,
    enableToastNotifications: true,
    enableRemoteReporting: false, // Can be enabled later for monitoring
    logLevel: "error"
  };

  private static correlationIdCounter = 0;

  /**
   * Main error handling method
   */
  static handle(
    error: Error | unknown,
    context: ErrorContext,
    options?: {
      severity?: ErrorSeverity;
      userMessage?: string;
      technicalDetails?: Record<string, unknown>;
      showToast?: boolean;
    }
  ): string {
    const correlationId = this.generateCorrelationId();

    const errorDetails: ErrorDetails = {
      originalError: error,
      context,
      severity: options?.severity || ErrorSeverity.MEDIUM,
      userMessage: options?.userMessage,
      technicalDetails: options?.technicalDetails,
      correlationId
    };

    // Log to console with structured format
    if (this.config.enableConsoleLogging) {
      this.logToConsole(errorDetails);
    }

    // Show user-friendly toast notification
    if (this.config.enableToastNotifications && options?.showToast !== false) {
      this.showToast(errorDetails);
    }

    // Send to remote monitoring service (placeholder for future implementation)
    if (this.config.enableRemoteReporting) {
      this.reportToMonitoring(errorDetails);
    }

    return correlationId;
  }

  /**
   * Convenience methods for different error contexts
   */
  static handleQueryError(
    error: Error | unknown,
    operation: string,
    options?: {
      queryId?: string;
      sql?: string;
      userMessage?: string;
    }
  ) {
    return this.handle(error, ErrorContext.QUERY_EXECUTION, {
      severity: ErrorSeverity.HIGH,
      userMessage: options?.userMessage || `Failed to ${operation}`,
      technicalDetails: {
        operation,
        queryId: options?.queryId,
        sql: options?.sql ? options.sql.substring(0, 200) + "..." : undefined
      }
    });
  }

  static handleConnectionError(error: Error | unknown, sourceId: string, sourceName?: string) {
    return this.handle(error, ErrorContext.SOURCE_CONNECTION, {
      severity: ErrorSeverity.HIGH,
      userMessage: `Failed to connect to ${sourceName || "database"}`,
      technicalDetails: {
        sourceId,
        sourceName
      }
    });
  }

  static handleDataLoadingError(error: Error | unknown, dataType: string, id?: string) {
    return this.handle(error, ErrorContext.DATA_LOADING, {
      severity: ErrorSeverity.MEDIUM,
      userMessage: `Failed to load ${dataType}`,
      technicalDetails: {
        dataType,
        id
      }
    });
  }

  static handleValidationError(error: Error | unknown, field: string, value?: unknown) {
    return this.handle(error, ErrorContext.GENERAL, {
      severity: ErrorSeverity.LOW,
      userMessage: `Invalid ${field}`,
      technicalDetails: {
        field,
        value
      }
    });
  }

  static handleUnexpectedError(error: Error | unknown, operation?: string) {
    return this.handle(error, ErrorContext.GENERAL, {
      severity: ErrorSeverity.CRITICAL,
      userMessage: "An unexpected error occurred. Please try again.",
      technicalDetails: {
        operation
      }
    });
  }

  /**
   * Configuration methods
   */
  static configure(config: Partial<ErrorReportingConfig>) {
    this.config = { ...this.config, ...config };
  }

  static getConfig(): ErrorReportingConfig {
    return { ...this.config };
  }

  /**
   * Private helper methods
   */
  private static generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const counter = (++this.correlationIdCounter).toString(36);
    return `err_${timestamp}_${counter}`;
  }

  private static logToConsole(errorDetails: ErrorDetails) {
    const { originalError, context, severity, correlationId, technicalDetails } = errorDetails;

    const logLevel = this.getLogLevel(severity);
    const prefix = `[${context}] [${correlationId}]`;

    // Create structured log entry
    const logData = {
      correlationId,
      context,
      severity,
      error: originalError,
      technicalDetails,
      timestamp: new Date().toISOString()
    };

    // Log with appropriate level
    console[logLevel](prefix, this.getErrorMessage(originalError), logData);
  }

  private static showToast(errorDetails: ErrorDetails) {
    const message = this.getUserMessage(errorDetails);

    // Show toast based on severity
    switch (errorDetails.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        toast.error(message);
        break;
      case ErrorSeverity.MEDIUM:
        toast.error(message);
        break;
      case ErrorSeverity.LOW:
        toast.warning(message);
        break;
    }
  }

  private static getUserMessage(errorDetails: ErrorDetails): string {
    // Return custom user message if provided
    if (errorDetails.userMessage) {
      return errorDetails.userMessage;
    }

    // Generate context-appropriate message
    const contextMessages: Record<ErrorContext, string> = {
      [ErrorContext.QUERY_EXECUTION]:
        "Query execution failed. Please check your SQL and try again.",
      [ErrorContext.QUERY_SAVING]: "Failed to save query. Please try again.",
      [ErrorContext.SOURCE_CONNECTION]:
        "Database connection failed. Please check your connection settings.",
      [ErrorContext.FILE_OPERATIONS]: "File operation failed. Please try again.",
      [ErrorContext.DATA_LOADING]: "Failed to load data. Please refresh and try again.",
      [ErrorContext.AUTHENTICATION]: "Authentication failed. Please log in again.",
      [ErrorContext.NAVIGATION]: "Navigation failed. Please try again.",
      [ErrorContext.GENERAL]: "An error occurred. Please try again."
    };

    return contextMessages[errorDetails.context];
  }

  private static getErrorMessage(error: Error | unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return "Unknown error occurred";
  }

  private static getLogLevel(severity: ErrorSeverity): "error" | "warn" | "info" {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return "error";
      case ErrorSeverity.MEDIUM:
        return "warn";
      case ErrorSeverity.LOW:
        return "info";
      default:
        return "error";
    }
  }

  private static async reportToMonitoring(errorDetails: ErrorDetails) {
    // Placeholder for future monitoring integration
    // Could integrate with services like Sentry, Datadog, etc.
    try {
      // Example: await sendToMonitoringService(errorDetails);
      console.debug("Would report to monitoring service:", errorDetails.correlationId);
    } catch (monitoringError) {
      console.error("Failed to report error to monitoring service:", monitoringError);
    }
  }

  /**
   * Utility methods for common error patterns
   */
  static async wrapAsync<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    options?: {
      userMessage?: string;
      onError?: (correlationId: string) => void;
    }
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      const correlationId = this.handle(error, context, {
        userMessage: options?.userMessage
      });
      options?.onError?.(correlationId);
      return null;
    }
  }

  static wrapSync<T>(
    operation: () => T,
    context: ErrorContext,
    options?: {
      userMessage?: string;
      onError?: (correlationId: string) => void;
    }
  ): T | null {
    try {
      return operation();
    } catch (error) {
      const correlationId = this.handle(error, context, {
        userMessage: options?.userMessage
      });
      options?.onError?.(correlationId);
      return null;
    }
  }
}
