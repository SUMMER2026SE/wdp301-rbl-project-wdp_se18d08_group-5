import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { type StoryScrollData } from '@hooks/useStoryScroll';

interface DebateArenaSceneProps {
  scrollRef: React.MutableRefObject<StoryScrollData>;
}

export function DebateArenaScene({ scrollRef }: DebateArenaSceneProps) {
  const { viewport } = useThree();
  const arenaGroupRef = useRef<THREE.Group>(null);
  
  // Component refs
  const propPodiumRef = useRef<THREE.Mesh>(null);
  const oppPodiumRef = useRef<THREE.Mesh>(null);
  const judgeCoreRef = useRef<THREE.Mesh>(null);
  const timerRingRef = useRef<THREE.Mesh>(null);
  const scanPlaneRef = useRef<THREE.Mesh>(null);
  
  // Waveform heights
  const leftWaveformRefs = useRef<THREE.Mesh[]>([]);
  const rightWaveformRefs = useRef<THREE.Mesh[]>([]);

  // Spotlight refs
  const spotlight1Ref = useRef<THREE.Mesh>(null);
  const spotlight2Ref = useRef<THREE.Mesh>(null);

  const responsiveSpacing = Math.min(2.5, viewport.width * 0.25);

  useFrame((state) => {
    const data = scrollRef.current;
    const scroll = data.smoothedScroll;

    // Visibility range: fades in from 0.50, stays visible to 1.0
    let arenaAlpha = 0;
    if (scroll > 0.50) {
      arenaAlpha = Math.min(1, (scroll - 0.50) / 0.08);
    }

    if (arenaGroupRef.current) {
      arenaGroupRef.current.visible = scroll > 0.45;
      
      // Camera approach animation (Chapter 4 scroll 0.55 -> 0.75)
      // We simulate camera zoom by moving/scaling the arena slightly
      const zoomFactor = Math.min(1.3, 0.8 + (scroll - 0.50) * 0.8);
      arenaGroupRef.current.scale.setScalar(zoomFactor);
      
      // Float animation
      arenaGroupRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 0.8) * 0.05;
    }

    // Set standard emissive values according to arenaAlpha
    const propMat = propPodiumRef.current?.material as THREE.MeshStandardMaterial;
    if (propMat) {
      propMat.opacity = arenaAlpha;
      propMat.transparent = true;
    }
    const oppMat = oppPodiumRef.current?.material as THREE.MeshStandardMaterial;
    if (oppMat) {
      oppMat.opacity = arenaAlpha;
      oppMat.transparent = true;
    }

    // Holographic Timer rotation & pulse (Chapter 4)
    if (timerRingRef.current) {
      timerRingRef.current.rotation.y = state.clock.getElapsedTime() * 0.8;
      timerRingRef.current.rotation.x = state.clock.getElapsedTime() * 0.3;
      const ringScale = (1 + Math.sin(state.clock.getElapsedTime() * 4) * 0.08) * arenaAlpha;
      timerRingRef.current.scale.setScalar(ringScale);
    }

    // Waveform heights animation (microphone input indicators)
    const time = state.clock.getElapsedTime();
    leftWaveformRefs.current.forEach((bar, idx) => {
      if (bar) {
        const height = 0.1 + Math.abs(Math.sin(time * 5 + idx * 0.5)) * 0.6;
        bar.scale.y = height * arenaAlpha;
        bar.position.y = -1.2 + (height * arenaAlpha) / 2;
      }
    });
    rightWaveformRefs.current.forEach((bar, idx) => {
      if (bar) {
        const height = 0.1 + Math.abs(Math.cos(time * 5 + idx * 0.5)) * 0.6;
        bar.scale.y = height * arenaAlpha;
        bar.position.y = -1.2 + (height * arenaAlpha) / 2;
      }
    });

    // AI Judge Core Animation (Chapter 5: scroll 0.75 -> 0.90)
    if (judgeCoreRef.current) {
      judgeCoreRef.current.rotation.y = state.clock.getElapsedTime() * 0.4;
      
      // Evaluate pulse color: shifts from purple (default) to gold (verdict)
      const judgeColor = new THREE.Color('#bf00ff'); // Purple base
      if (scroll > 0.75) {
        // Interpolate to Gold in Chapters 5-6
        const blend = Math.min(1, (scroll - 0.75) / 0.15);
        judgeColor.lerp(new THREE.Color('#ffd60a'), blend); // Gold
      }
      
      const judgeMat = judgeCoreRef.current.material as THREE.MeshStandardMaterial;
      if (judgeMat) {
        judgeMat.color = judgeColor;
        judgeMat.emissive = judgeColor;
        judgeMat.emissiveIntensity = 1 + Math.sin(time * 8) * 0.3;
        judgeMat.opacity = arenaAlpha;
        judgeMat.transparent = true;
      }
    }

    // AI scan line sweep animation (Chapter 5)
    if (scanPlaneRef.current) {
      const isScanning = scroll >= 0.75 && scroll <= 0.90;
      scanPlaneRef.current.visible = isScanning;
      if (isScanning) {
        const scanProgress = (scroll - 0.75) / 0.15;
        // Sweep scan plane up and down
        scanPlaneRef.current.position.y = 1.8 - scanProgress * 3.0;
        const scanMat = scanPlaneRef.current.material as THREE.MeshBasicMaterial;
        if (scanMat) {
          scanMat.opacity = Math.sin(scanProgress * Math.PI) * 0.6;
        }
      }
    }

    // Stage Spotlights reveal in Chapter 6 (scroll 0.90 -> 1.0)
    let spotlightIntensity = 0;
    if (scroll > 0.88) {
      spotlightIntensity = Math.min(1, (scroll - 0.88) / 0.08);
    }
    
    if (spotlight1Ref.current) {
      const spotMat1 = spotlight1Ref.current.material as THREE.MeshBasicMaterial;
      if (spotMat1) {
        spotMat1.opacity = spotlightIntensity * 0.25;
      }
      spotlight1Ref.current.rotation.z = Math.sin(time * 0.5) * 0.15 - 0.3;
    }
    if (spotlight2Ref.current) {
      const spotMat2 = spotlight2Ref.current.material as THREE.MeshBasicMaterial;
      if (spotMat2) {
        spotMat2.opacity = spotlightIntensity * 0.25;
      }
      spotlight2Ref.current.rotation.z = -Math.sin(time * 0.5) * 0.15 + 0.3;
    }
  });

  const scrollVal = scrollRef.current.scrollProgress;
  if (scrollVal < 0.45) return null;

  // Waveform offsets
  const waveformOffsets = [-0.3, -0.15, 0, 0.15, 0.3];

  return (
    <group ref={arenaGroupRef}>
      {/* ── Podium Left (Proposition - Cyan) ── */}
      <group position={[-responsiveSpacing, 0, 0]}>
        <mesh ref={propPodiumRef}>
          <cylinderGeometry args={[0.3, 0.35, 2.4, 12, 1, true]} />
          <meshStandardMaterial 
            color="#00f5ff" 
            emissive="#00f5ff" 
            emissiveIntensity={0.8} 
            wireframe 
          />
        </mesh>
        
        {/* Waveform cylinder bars */}
        {waveformOffsets.map((offset, idx) => (
          <mesh 
            key={`left-wave-${idx}`} 
            position={[offset, 0, 0.4]}
            ref={(el) => { if (el) leftWaveformRefs.current[idx] = el; }}
          >
            <boxGeometry args={[0.04, 1, 0.04]} />
            <meshBasicMaterial color="#00f5ff" transparent opacity={0.6} />
          </mesh>
        ))}
      </group>

      {/* ── Podium Right (Opposition - Magenta) ── */}
      <group position={[responsiveSpacing, 0, 0]}>
        <mesh ref={oppPodiumRef}>
          <cylinderGeometry args={[0.3, 0.35, 2.4, 12, 1, true]} />
          <meshStandardMaterial 
            color="#ff006e" 
            emissive="#ff006e" 
            emissiveIntensity={0.8} 
            wireframe 
          />
        </mesh>

        {/* Waveform cylinder bars */}
        {waveformOffsets.map((offset, idx) => (
          <mesh 
            key={`right-wave-${idx}`} 
            position={[offset, 0, 0.4]}
            ref={(el) => { if (el) rightWaveformRefs.current[idx] = el; }}
          >
            <boxGeometry args={[0.04, 1, 0.04]} />
            <meshBasicMaterial color="#ff006e" transparent opacity={0.6} />
          </mesh>
        ))}
      </group>

      {/* ── Holographic Timer (Center) ── */}
      <mesh ref={timerRingRef} position={[0, -0.4, 0.2]}>
        <torusGeometry args={[0.45, 0.015, 6, 16]} />
        <meshBasicMaterial color="#00f5ff" wireframe />
      </mesh>
      
      {/* ── AI Judge Core (Rear Centre) ── */}
      <group position={[0, 1.3, -2]}>
        <mesh ref={judgeCoreRef}>
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshStandardMaterial 
            color="#bf00ff"
            emissive="#bf00ff"
            emissiveIntensity={1.5}
            wireframe 
          />
        </mesh>
        <points>
          <sphereGeometry args={[0.8, 16, 16]} />
          <pointsMaterial color="#bf00ff" size={0.03} />
        </points>

        {/* Outer Judge Shield Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.1, 0.01, 3, 16]} />
          <meshBasicMaterial color="#ffd60a" transparent opacity={0.4} />
        </mesh>
      </group>

      {/* ── Connecting Data Streams (Chapter 5) ── */}
      {scrollVal >= 0.70 && (
        <group>
          {/* Left stream to Judge */}
          <Line 
            points={[
              [-responsiveSpacing, 1.0, 0],
              [-responsiveSpacing * 0.5, 1.2, -1],
              [0, 1.3, -2]
            ]} 
            color="#00f5ff" 
            lineWidth={1.5} 
            opacity={Math.min(0.6, (scrollVal - 0.70) * 4)} 
            transparent
          />
          {/* Right stream to Judge */}
          <Line 
            points={[
              [responsiveSpacing, 1.0, 0],
              [responsiveSpacing * 0.5, 1.2, -1],
              [0, 1.3, -2]
            ]} 
            color="#ff006e" 
            lineWidth={1.5} 
            opacity={Math.min(0.6, (scrollVal - 0.70) * 4)} 
            transparent
          />
        </group>
      )}

      {/* ── AI Scanning Sweep Plane (Chapter 5) ── */}
      <mesh ref={scanPlaneRef} position={[0, 0, -1]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[responsiveSpacing * 2.5, 3]} />
        <meshBasicMaterial color="#ffd60a" transparent opacity={0.4} side={THREE.DoubleSide} wireframe />
      </mesh>

      {/* ── Stage Spotlight Cones (Chapter 6) ── */}
      <mesh ref={spotlight1Ref} position={[-2, 3, -1]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.01, 1.2, 5, 12, 1, true]} />
        <meshBasicMaterial color="#ffd60a" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      
      <mesh ref={spotlight2Ref} position={[2, 3, -1]} rotation={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.01, 1.2, 5, 12, 1, true]} />
        <meshBasicMaterial color="#ffd60a" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
