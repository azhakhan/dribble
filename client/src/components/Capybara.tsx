import { useRive } from "@rive-app/react-canvas";
import { useTheme } from "@/components/theme-provider";

export const Capybara = () => {
  const { theme } = useTheme();

  let themeColor = theme;
  if (theme === "system") {
    themeColor = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  const { RiveComponent } = useRive({
    src: "/capybara.riv",
    artboard: themeColor === "light" ? "capybara-light" : "capybara",
    stateMachines: "State Machine 1",
    autoplay: true
  });

  return (
    <div className="w-full h-20 overflow-hidden flex items-center justify-center">
      <RiveComponent key={theme} className="w-full h-full" />
    </div>
  );
};
