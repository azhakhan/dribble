import { Button } from "@/components/ui/button";
import { CheckIcon, XIcon } from "lucide-react";

interface ProposedChangesBarProps {
  onAccept: () => void;
  onReject: () => void | Promise<void>;
}

export function ProposedChangesBar({ onAccept, onReject }: ProposedChangesBarProps) {
  return (
    <div className="flex-shrink-0 border-t bg-muted/30 p-2 flex justify-center gap-2">
      <Button onClick={onAccept} size="xs" className="gap-1 text-xs" variant="default">
        <CheckIcon size={12} />
        Accept
      </Button>
      <Button onClick={onReject} size="xs" variant="outline" className="gap-1 text-xs">
        <XIcon size={12} />
        Reject
      </Button>
    </div>
  );
}
