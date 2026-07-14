import { useEffect, useRef } from 'react';

export interface StoryScrollData {
  scrollProgress: number;         // Target scroll progress (0 to 1)
  smoothedScroll: number;         // Smoothed scroll progress (0 to 1)
  mouseX: number;                 // Target mouse X (-1 to 1)
  mouseY: number;                 // Target mouse Y (-1 to 1)
  smoothedMouseX: number;         // Smoothed mouse X (-1 to 1)
  smoothedMouseY: number;         // Smoothed mouse Y (-1 to 1)
  isReducedMotion: boolean;       // User preference for reduced motion
}

const GLOBAL_SCROLL_DATA: StoryScrollData = {
  scrollProgress: 0,
  smoothedScroll: 0,
  mouseX: 0,
  mouseY: 0,
  smoothedMouseX: 0,
  smoothedMouseY: 0,
  isReducedMotion: false,
};

export function useStoryScroll() {
  const dataRef = useRef<StoryScrollData>(GLOBAL_SCROLL_DATA);

  useEffect(() => {
    // Check reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    dataRef.current.isReducedMotion = mediaQuery.matches;

    const handleReduceMotionChange = (e: MediaQueryListEvent) => {
      dataRef.current.isReducedMotion = e.matches;
    };
    mediaQuery.addEventListener('change', handleReduceMotionChange);

    // Scroll handler
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      
      if (scrollHeight > 0) {
        dataRef.current.scrollProgress = scrollTop / scrollHeight;
      } else {
        dataRef.current.scrollProgress = 0;
      }
    };

    // Mouse handler
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize to -1 to 1
      dataRef.current.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      dataRef.current.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    // Trigger initial calculation
    handleScroll();

    return () => {
      mediaQuery.removeEventListener('change', handleReduceMotionChange);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Return the ref containing the values
  return dataRef;
}
