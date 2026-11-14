import { Canvas } from "@react-three/fiber";
import type { SceneModule } from "../../contracts/index.ts";

// Placeholder from the integrator: proves the 3D stack builds. The lane replaces this file.
function Scene() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <mesh>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshBasicMaterial color="#3d7bff" wireframe />
      </mesh>
    </Canvas>
  );
}

const scene: SceneModule = { id: "lunar", title: "lunar (placeholder)", caption: "Placeholder scene.", Component: Scene };
export default scene;
