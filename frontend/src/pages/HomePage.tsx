import { useAuthStore } from '@stores/authStore';
import { useStoryScroll } from '@hooks/useStoryScroll';
import { HomeStoryScene } from '@components/home/HomeStoryScene';
import { HomeStoryChapter } from '@components/home/HomeStoryChapter';
import '@/styles/home-story.css';

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const scrollRef = useStoryScroll();

  return (
    <div className="story-page-wrapper">
      {/* 3D Canvas element in background */}
      <HomeStoryScene scrollRef={scrollRef} />

      {/* HTML layers scrolling on top */}
      <HomeStoryChapter isAuthenticated={isAuthenticated} />
    </div>
  );
}
