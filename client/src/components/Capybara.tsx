import { useRive } from "@rive-app/react-canvas";
import { useTheme } from "@/components/theme-provider";

export const Capybara = () => {
  const { resolvedTheme } = useTheme();

  const { RiveComponent } = useRive({
    src: "/capybara.riv",
    artboard: resolvedTheme === "light" ? "capybara-light" : "capybara",
    stateMachines: "State Machine 1",
    autoplay: true
  });

  return (
    <div className="w-full h-20 overflow-hidden flex items-center justify-center">
      <RiveComponent key={resolvedTheme} className="w-full h-full" />
    </div>
  );
};
