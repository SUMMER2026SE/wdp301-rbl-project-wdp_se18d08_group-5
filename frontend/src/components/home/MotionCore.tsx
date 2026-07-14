import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { type StoryScrollData } from '@hooks/useStoryScroll';

interface MotionCoreProps {
  scrollRef: React.MutableRefObject<StoryScrollData>;
}

interface ArgumentNode {
  name: string;
  label: string;
  pos: [number, number, number];
  startScroll: number;
  endScroll: number;
  metric: string;
}

const PROP_NODES: ArgumentNode[] = [
  { name: 'logic', label: 'Logic', pos: [-1.2, 1.0, 0], startScroll: 0.35, endScroll: 0.40, metric: '94%' },
  { name: 'evidence', label: 'Evidence', pos: [-1.6, 0.2, 0], startScroll: 0.40, endScroll: 0.45, metric: '88%' },
  { name: 'rebuttal', label: 'Rebuttal', pos: [-1.4, -0.6, 0], startScroll: 0.45, endScroll: 0.50, metric: '91%' },
  { name: 'delivery', label: 'Delivery', pos: [-0.8, -1.4, 0], startScroll: 0.50, endScroll: 0.55, metric: '85%' },
];

const OPP_NODES: ArgumentNode[] = [
  { name: 'logic', label: 'Logic', pos: [1.2, 1.0, 0], startScroll: 0.35, endScroll: 0.40, metric: '92%' },
  { name: 'evidence', label: 'Evidence', pos: [1.6, 0.2, 0], startScroll: 0.40, endScroll: 0.45, metric: '90%' },
  { name: 'rebuttal', label: 'Rebuttal', pos: [1.4, -0.6, 0], startScroll: 0.45, endScroll: 0.50, metric: '89%' },
  { name: 'delivery', label: 'Delivery', pos: [0.8, -1.4, 0], startScroll: 0.50, endScroll: 0.55, metric: '93%' },
];

export function MotionCore({ scrollRef }: MotionCoreProps) {
  const { viewport } = useThree();
  const propGroupRef = useRef<THREE.Group>(null);
  const oppGroupRef = useRef<THREE.Group>(null);
  const centralRingRef = useRef<THREE.Mesh>(null);
  const propCoreRef = useRef<THREE.Mesh>(null);
  const oppCoreRef = useRef<THREE.Mesh>(null);

  // Keep track of node scale refs
  const propNodeRefs = useRef<THREE.Group[]>([]);
  const oppNodeRefs = useRef<THREE.Group[]>([]);

  // Adjust placement distance dynamically based on screen width
  const responsiveSpacing = Math.min(2.8, viewport.width * 0.28);

  useFrame((state) => {
    const data = scrollRef.current;
    
    // Smooth the scroll progress (lerp)
    if (data.isReducedMotion) {
      data.smoothedScroll = data.scrollProgress;
      data.smoothedMouseX = 0;
      data.smoothedMouseY = 0;
    } else {
      data.smoothedScroll += (data.scrollProgress - data.smoothedScroll) * 0.1;
      data.smoothedMouseX += (data.mouseX - data.smoothedMouseX) * 0.08;
      data.smoothedMouseY += (data.mouseY - data.smoothedMouseY) * 0.08;
    }

    const scroll = data.smoothedScroll;

    // Chapter 1 -> 2: Motion Core splits (scroll 0.0 to 0.35)
    // 0.0 -> 0.15: fully merged
    // 0.15 -> 0.35: splitting apart
    let splitFactor = 0;
    if (scroll > 0.15) {
      splitFactor = Math.min(1, (scroll - 0.15) / 0.20);
    }

    const propTargetX = -responsiveSpacing * splitFactor;
    const oppTargetX = responsiveSpacing * splitFactor;

    if (propGroupRef.current) {
      propGroupRef.current.position.x = propTargetX;
    }
    if (oppGroupRef.current) {
      oppGroupRef.current.position.x = oppTargetX;
    }

    // Parallax reaction to mouse pointer (Chapter 1 Hero view mostly)
    const mouseParallaxIntensity = (1 - Math.min(1, scroll / 0.35)) * 0.4;
    const targetGroupRotationY = data.smoothedMouseX * mouseParallaxIntensity;
    const targetGroupRotationX = -data.smoothedMouseY * mouseParallaxIntensity;

    if (propGroupRef.current && oppGroupRef.current) {
      // Base continuous rotation + mouse reactivity
      const baseRotation = state.clock.getElapsedTime() * 0.15;
      propGroupRef.current.rotation.y = baseRotation + targetGroupRotationY;
      propGroupRef.current.rotation.x = targetGroupRotationX;

      oppGroupRef.current.rotation.y = -baseRotation - targetGroupRotationY;
      oppGroupRef.current.rotation.x = -targetGroupRotationX;
    }

    // Fade out central ring as core splits
    if (centralRingRef.current) {
      const ringOpacity = Math.max(0, 1 - splitFactor * 2);
      const mat = centralRingRef.current.material as THREE.Material;
      mat.opacity = ringOpacity;
      mat.transparent = true;
      centralRingRef.current.rotation.z = state.clock.getElapsedTime() * 0.5;
      centralRingRef.current.scale.setScalar(1 + Math.sin(state.clock.getElapsedTime() * 2) * 0.05);
    }

    // Scale up the Proposition & Opposition cores based on scroll and maintain pulse
    const basePulse = 1 + Math.sin(state.clock.getElapsedTime() * 3) * 0.03;
    if (propCoreRef.current) {
      propCoreRef.current.scale.setScalar(basePulse);
    }
    if (oppCoreRef.current) {
      oppCoreRef.current.scale.setScalar(basePulse);
    }

    // Fade entire MotionCore out as we approach Chapter 4 (Live Debate: scroll > 0.55)
    // 0.55 -> 0.65: fade out
    let coreAlpha = 1;
    if (scroll > 0.55) {
      coreAlpha = Math.max(0, 1 - (scroll - 0.55) / 0.10);
    }

    // Set group visibilities/opacities based on coreAlpha
    if (propGroupRef.current && oppGroupRef.current) {
      propGroupRef.current.position.y = (scroll > 0.55) ? -(scroll - 0.55) * 5 : 0;
      oppGroupRef.current.position.y = (scroll > 0.55) ? -(scroll - 0.55) * 5 : 0;
    }

    // Animate argument nodes scaling based on scroll
    PROP_NODES.forEach((node, i) => {
      const nodeRef = propNodeRefs.current[i];
      if (nodeRef) {
        let nodeScale = 0;
        if (scroll >= node.startScroll) {
          nodeScale = Math.min(1, (scroll - node.startScroll) / (node.endScroll - node.startScroll));
        }
        // Multiply by coreAlpha to fade out with parent
        const finalScale = nodeScale * coreAlpha;
        nodeRef.scale.setScalar(finalScale);
      }
    });

    OPP_NODES.forEach((node, i) => {
      const nodeRef = oppNodeRefs.current[i];
      if (nodeRef) {
        let nodeScale = 0;
        if (scroll >= node.startScroll) {
          nodeScale = Math.min(1, (scroll - node.startScroll) / (node.endScroll - node.startScroll));
        }
        const finalScale = nodeScale * coreAlpha;
        nodeRef.scale.setScalar(finalScale);
      }
    });
  });

  const scrollVal = scrollRef.current.scrollProgress;
  const isCoreVisible = scrollVal < 0.65;

  if (!isCoreVisible) return null;

  return (
    <group>
      {/* Chapter 1 Central Orbits/Rings (visible only when merged) */}
      <mesh ref={centralRingRef} position={[0, 0, 0]}>
        <torusGeometry args={[1.5, 0.02, 8, 24]} />
        <meshBasicMaterial color="#bf00ff" wireframe />
      </mesh>

      {/* PROPOSITION GROUP (Cyan) */}
      <group ref={propGroupRef}>
        {/* Core sphere */}
        <mesh ref={propCoreRef}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial 
            color="#00f5ff" 
            emissive="#00f5ff" 
            emissiveIntensity={1.2}
            wireframe 
          />
        </mesh>
        
        {/* Outer particle aura */}
        <points>
          <sphereGeometry args={[0.7, 16, 16]} />
          <pointsMaterial color="#00f5ff" size={0.03} sizeAttenuation />
        </points>

        {/* Argument Nodes for Prop (Chapter 3) */}
        {PROP_NODES.map((node, idx) => (
          <group 
            key={`prop-node-${node.name}`} 
            position={node.pos}
            ref={(el) => { if (el) propNodeRefs.current[idx] = el; }}
          >
            {/* Connecting line to core */}
            <Line 
              points={[[0, 0, 0], [-node.pos[0], -node.pos[1], -node.pos[2]]]} 
              color="#00f5ff" 
              lineWidth={1} 
              opacity={0.3} 
              transparent
            />

            {/* Node representation */}
            <mesh>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshStandardMaterial color="#00f5ff" emissive="#00f5ff" emissiveIntensity={0.8} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.22, 8, 8]} />
              <meshBasicMaterial color="#00f5ff" wireframe transparent opacity={0.4} />
            </mesh>

            {/* Floating label inside 3D arena */}
            <Html distanceFactor={6} position={[0, 0.4, 0]} center>
              <div className="story-3d-label" style={{
                background: 'rgba(10,10,15,0.85)',
                border: '1px solid rgba(0,245,255,0.4)',
                borderRadius: '4px',
                padding: '2px 6px',
                color: '#fff',
                fontSize: '10px',
                fontFamily: 'Orbitron, sans-serif',
                whiteSpace: 'nowrap',
                pointerEvents: 'none'
              }}>
                <span style={{ color: '#00f5ff', marginRight: '4px' }}>●</span>
                {node.label} <span style={{ color: '#a0a0c0', marginLeft: '4px' }}>{node.metric}</span>
              </div>
            </Html>
          </group>
        ))}
      </group>

      {/* OPPOSITION GROUP (Magenta) */}
      <group ref={oppGroupRef}>
        {/* Core sphere */}
        <mesh ref={oppCoreRef}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial 
            color="#ff006e" 
            emissive="#ff006e" 
            emissiveIntensity={1.2}
            wireframe 
          />
        </mesh>
        
        {/* Outer particle aura */}
        <points>
          <sphereGeometry args={[0.7, 16, 16]} />
          <pointsMaterial color="#ff006e" size={0.03} sizeAttenuation />
        </points>

        {/* Argument Nodes for Opp (Chapter 3) */}
        {OPP_NODES.map((node, idx) => (
          <group 
            key={`opp-node-${node.name}`} 
            position={node.pos}
            ref={(el) => { if (el) oppNodeRefs.current[idx] = el; }}
          >
            {/* Connecting line to core */}
            <Line 
              points={[[0, 0, 0], [-node.pos[0], -node.pos[1], -node.pos[2]]]} 
              color="#ff006e" 
              lineWidth={1} 
              opacity={0.3} 
              transparent
            />

            {/* Node representation */}
            <mesh>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshStandardMaterial color="#ff006e" emissive="#ff006e" emissiveIntensity={0.8} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.22, 8, 8]} />
              <meshBasicMaterial color="#ff006e" wireframe transparent opacity={0.4} />
            </mesh>

            {/* Floating label inside 3D arena */}
            <Html distanceFactor={6} position={[0, 0.4, 0]} center>
              <div className="story-3d-label" style={{
                background: 'rgba(10,10,15,0.85)',
                border: '1px solid rgba(255,0,110,0.4)',
                borderRadius: '4px',
                padding: '2px 6px',
                color: '#fff',
                fontSize: '10px',
                fontFamily: 'Orbitron, sans-serif',
                whiteSpace: 'nowrap',
                pointerEvents: 'none'
              }}>
                <span style={{ color: '#ff006e', marginRight: '4px' }}>●</span>
                {node.label} <span style={{ color: '#a0a0c0', marginLeft: '4px' }}>{node.metric}</span>
              </div>
            </Html>
          </group>
        ))}
      </group>
    </group>
  );
}
