import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { History, Plus } from "lucide-react";
import { useChatSessionsQuery } from "@/shared/hooks/useChatQuery";
import { formatSessionDate } from "./utils";

interface ChatHeaderProps {
  currentSessionName: string;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
}

export function ChatHeader({ currentSessionName, onSessionSelect, onNewSession }: ChatHeaderProps) {
  const { data: sessionsData } = useChatSessionsQuery();

  return (
    <div className="flex-shrink-0 h-10 px-3 font-semibold text-sm border-b border-border/50 bg-muted/10 flex items-center justify-between">
      <span>{currentSessionName}</span>

      {/* Actions on the right */}
      <div className="flex items-center gap-1">
        {/* History dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="p-0 h-auto w-auto cursor-pointer hover:text-foreground text-muted-foreground"
            >
              <History className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {sessionsData?.sessions && sessionsData.sessions.length > 0 ? (
              <>
                {sessionsData.sessions
                  .sort(
                    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  )
                  .map((session) => (
                    <DropdownMenuItem
                      key={session.id}
                      onClick={() => onSessionSelect(session.id)}
                      className="flex justify-between items-center"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {session.name || "Unnamed Chat"}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground ml-2">
                        {formatSessionDate(session.created_at)}
                      </div>
                    </DropdownMenuItem>
                  ))}
              </>
            ) : (
              <DropdownMenuItem disabled>
                <span className="text-muted-foreground">No previous sessions</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* New session button */}
        <Button
          variant="ghost"
          size="icon"
          className="p-0 h-auto w-auto cursor-pointer hover:text-foreground text-muted-foreground"
          onClick={onNewSession}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
