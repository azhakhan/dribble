import { useRive } from "@rive-app/react-canvas";

export const Capybara = () => {
  const { RiveComponent } = useRive({
    src: "/capybara.riv",
    artboard: "capybara",
    stateMachines: "State Machine 1",
    autoplay: true
  });

  return (
    <div className="w-full h-20 overflow-hidden flex items-center justify-center">
      <RiveComponent className="w-full h-full" />
    </div>
  );
};
