import { Suspense, useEffect, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { type StoryScrollData } from '@hooks/useStoryScroll';
import { MotionCore } from './MotionCore';
import { DebateArenaScene } from './DebateArenaScene';

interface HomeStorySceneProps {
  scrollRef: React.MutableRefObject<StoryScrollData>;
}

// Camera Rig to smoothly drive position/target based on scroll & mouse pointer
function CameraRig({ scrollRef }: { scrollRef: React.MutableRefObject<StoryScrollData> }) {
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((state) => {
    const data = scrollRef.current;
    const scroll = data.smoothedScroll;

    let targetZ = 5;
    let targetY = 0;
    let targetLookAtY = 0;

    if (data.isReducedMotion) {
      // Reduced motion: very basic scroll tracking, no translation
      targetZ = 5.0;
      targetY = -scroll * 0.8;
      targetLookAtY = -scroll * 0.8;
      
      state.camera.position.set(0, targetY, targetZ);
      state.camera.lookAt(0, targetLookAtY, -0.5);
      return;
    }

    // Scroll mapping for camera paths
    if (scroll <= 0.35) {
      // Chapters 1 & 2: Center view on Motion Core
      targetZ = 5.0;
      targetY = 0;
      targetLookAtY = 0;
    } else if (scroll <= 0.55) {
      // Chapter 3: Shift down slightly to focus on argument nodes
      const p = (scroll - 0.35) / 0.20;
      targetZ = 5.0;
      targetY = -p * 0.5;
      targetLookAtY = -p * 0.5;
    } else if (scroll <= 0.75) {
      // Chapter 4: Move forward and lower into Arena
      const p = (scroll - 0.55) / 0.20;
      targetZ = 5.0 - p * 1.5; // Zoom in closer
      targetY = -0.5 - p * 0.6; // Get low
      targetLookAtY = -0.5 - p * 0.3; // Focus center
    } else if (scroll <= 0.90) {
      // Chapter 5: Re-frame to look at the scanning AI Judge core
      const p = (scroll - 0.75) / 0.15;
      targetZ = 3.5;
      targetY = -1.1 + p * 0.4; // Raise camera slightly
      targetLookAtY = -0.8 + p * 0.6; // Tilt upwards to look at Judge (Y=1.3)
    } else {
      // Chapter 6: Final Stage wide overview
      const p = (scroll - 0.90) / 0.10;
      targetZ = 3.5 + p * 0.5; // Zoom out slightly
      targetY = -0.7 + p * 0.3;
      targetLookAtY = -0.2 + p * 0.4;
    }

    // Mouse drift factor for parallax (Chapter 1 Hero view mostly)
    const mouseIntensity = (1 - Math.min(1, scroll / 0.35)) * 0.35;
    const mouseXDrift = data.smoothedMouseX * mouseIntensity;
    const mouseYDrift = data.smoothedMouseY * mouseIntensity;

    // Apply smooth lerping to positions
    state.camera.position.x += (mouseXDrift - state.camera.position.x) * 0.08;
    state.camera.position.y += ((targetY + mouseYDrift) - state.camera.position.y) * 0.08;
    state.camera.position.z += (targetZ - state.camera.position.z) * 0.08;

    // Smooth target lookAt
    const targetLookAt = new THREE.Vector3(0, targetLookAtY, -0.5);
    currentLookAt.current.lerp(targetLookAt, 0.08);
    state.camera.lookAt(currentLookAt.current);
  });

  return null;
}

export function HomeStoryScene({ scrollRef }: HomeStorySceneProps) {
  const [webglAvailable, setWebglAvailable] = useState<boolean>(true);

  // WebGL detection
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const isAvailable = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
      setWebglAvailable(isAvailable);
    } catch (e) {
      setWebglAvailable(false);
    }
  }, []);

  if (!webglAvailable) {
    // Elegant CSS Fallback if WebGL isn't supported
    return (
      <div className="story-fallback-bg" aria-hidden="true">
        <div className="story-fallback-grid" />
      </div>
    );
  }

  return (
    <div className="story-canvas-container" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        dpr={[1, 1.5]} // Limit pixel ratio for performance
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#030305']} />
        
        {/* Futuristic Space depth */}
        <Stars 
          radius={80} 
          depth={40} 
          count={300} 
          factor={4} 
          saturation={0} 
          fade 
          speed={0.8} 
        />

        {/* Ambient & directional lighting */}
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={1.5} color="#00f5ff" />
        <pointLight position={[-5, -5, -5]} intensity={0.5} color="#ff006e" />
        
        {/* Dynamic spot lighting for stage layout */}
        <spotLight 
          position={[0, 5, -2]} 
          angle={0.6} 
          penumbra={1} 
          intensity={2.0} 
          color="#ffd60a" 
        />

        {/* Scene Components */}
        <Suspense fallback={null}>
          <MotionCore scrollRef={scrollRef} />
          <DebateArenaScene scrollRef={scrollRef} />
          <CameraRig scrollRef={scrollRef} />
        </Suspense>
      </Canvas>
    </div>
  );
}
export default HomeStoryScene;
