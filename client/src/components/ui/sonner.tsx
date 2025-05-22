import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
import type { ToasterProps } from "sonner";
import { CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      expand
      closeButton
      icons={{
        success: <CheckCircle size={16} className="text-success" />,
        error: <AlertCircle size={16} className="text-destructive" />,
        warning: <AlertTriangle size={16} className="text-warning" />,
      }}
      style={
        {
          "--normal-bg": "var(--background)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "white",
          "--border-width": "1px",
          "--success-bg": "var(--background)",
          "--success-text": "var(--foreground)",
          "--error-bg": "var(--background)",
          "--error-text": "var(--foreground)",
          "--warning-bg": "var(--background)",
          "--warning-text": "var(--foreground)",
          "--toast-radius": "var(--radius)",
          "--toast-shadow": "var(--shadow)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
