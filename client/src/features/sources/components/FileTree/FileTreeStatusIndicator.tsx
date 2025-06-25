import React from "react";
import { AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSourceStatusQuery } from "@/shared/hooks/useSourceStatusQuery";

interface FileTreeStatusIndicatorProps {
  hasError: boolean;
  isConnected: boolean;
  sourceErrors?: Record<string, string>;
  nodeId?: string;
  sourceStatuses?: Record<string, string>;
}

export const FileTreeStatusIndicator: React.FC<FileTreeStatusIndicatorProps> = ({
  hasError,
  isConnected,
  sourceErrors,
  nodeId,
  sourceStatuses
}) => {
  // Get source status if this is a source node AND it's connected
  const { data: sourceStatus } = useSourceStatusQuery(isConnected && nodeId ? nodeId : undefined);

  // Get status from props or from query
  const currentStatus = nodeId
    ? (sourceStatuses && sourceStatuses[nodeId]) || sourceStatus
    : undefined;

  return (
    <div className="flex items-center">
      {/* Show error icon if there's an error */}
      {hasError && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="ml-1">
                <AlertCircle className="h-3.5 w-3.5 text-destructive" strokeWidth={1.5} />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{sourceErrors && nodeId ? sourceErrors[nodeId] : "Error loading schema"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Show status indicator */}
      {isConnected && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`ml-1 w-2 h-2 rounded-full ${
                  currentStatus === "running"
                    ? "bg-green-500"
                    : currentStatus === "unhealthy"
                      ? "bg-red-500"
                      : "bg-yellow-500"
                }`}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {currentStatus === "running"
                  ? "Connected"
                  : currentStatus === "unhealthy"
                    ? "Connection error"
                    : "Connecting..."}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};
