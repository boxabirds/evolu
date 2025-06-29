import "./App.css";
import { EvoluExample } from "./components/EvoluDemo.tsx";
import { GroupsDemo } from "./components/GroupsDemo.tsx";
import PWABadge from "./PWABadge.tsx";
import { EvoluProvider } from "@evolu/react";
import { evolu } from "./components/EvoluDemo.tsx";

function App() {
  return (
    <EvoluProvider value={evolu}>
      <h1>evolu/react-vite-pwa</h1>
      <div
        style={{
          textAlign: "left",
        }}
      >
        <EvoluExample />
        <hr style={{ margin: "40px 0" }} />
        <GroupsDemo />
      </div>
      <PWABadge />
    </EvoluProvider>
  );
}

export default App;
