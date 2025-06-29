import "./App.css";
import { EvoluExample } from "./components/EvoluDemo.tsx";
import { GroupsDemo } from "./components/GroupsDemo.tsx";
import PWABadge from "./PWABadge.tsx";

function App() {
  return (
    <>
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
    </>
  );
}

export default App;
