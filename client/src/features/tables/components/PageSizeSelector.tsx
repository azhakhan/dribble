import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

interface PageSizeSelectorProps {
  currentPageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  startIndex: number;
  endIndex: number;
  disabled?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 100, 250, 500, 1000];

export const PageSizeSelector = ({
  currentPageSize,
  onPageSizeChange,
  startIndex,
  endIndex,
  disabled = false
}: PageSizeSelectorProps) => {
  const displayRange =
    startIndex === 0 && endIndex === 0 ? "0-0" : `${startIndex + 1}-${endIndex + 1}`;

  return (
    <Select
      value={currentPageSize.toString()}
      onValueChange={(value) => onPageSizeChange(parseInt(value, 10))}
      disabled={disabled}
    >
      <SelectTrigger className="h-auto w-auto p-0 border-0 bg-transparent text-xs text-muted-foreground hover:text-foreground focus:ring-0 focus:ring-offset-0 cursor-pointer">
        {displayRange}
      </SelectTrigger>
      <SelectContent>
        {PAGE_SIZE_OPTIONS.map((size) => (
          <SelectItem key={size} value={size.toString()}>
            {size} rows
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
