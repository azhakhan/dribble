import { FileText } from "lucide-react";
import { useQueryStore } from "@/shared/store";
import type { ChatContext } from "@/shared/lib/api";

interface MessageContextProps {
  context: ChatContext[] | undefined;
}

export function MessageContext({ context }: MessageContextProps) {
  const { queries } = useQueryStore();

  if (!context || context.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 mb-1">
      <div className="text-xs text-muted-foreground mb-1">Context:</div>
      <div className="flex flex-wrap gap-1">
        {context.map((ctx) => {
          const query = queries[ctx.query_id];
          const queryName = query?.name || `Query ${ctx.query_id.slice(0, 8)}`;

          return (
            <div
              key={ctx.query_id}
              className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                ctx.active
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted/50 text-muted-foreground"
              }`}
            >
              <FileText className="h-3 w-3 mr-1" />
              {queryName}
              {ctx.active && <span className="ml-1 text-xs">•</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
