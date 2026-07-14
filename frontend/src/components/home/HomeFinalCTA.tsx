import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { motion } from 'framer-motion';

interface HomeFinalCTAProps {
  isAuthenticated: boolean;
}

const CtaButton = Button as any;

export function HomeFinalCTA({ isAuthenticated }: HomeFinalCTAProps) {
  const primaryCta = isAuthenticated
    ? { to: '/matchmaking', label: 'Enter Ranked Queue', icon: 'bi bi-lightning' }
    : { to: '/register', label: 'Create Free Account', icon: 'bi bi-rocket-takeoff' };

  const secondaryCta = isAuthenticated
    ? { to: '/rooms/create', label: 'Create Custom Room', icon: 'bi bi-plus-circle' }
    : { to: '/matches', label: 'Watch Live Matches', icon: 'bi bi-play-circle' };

  return (
    <section className="story-chapter">
      <motion.div 
        className="story-chapter-content story-layout-center story-interactive"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.3 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <span className="story-kicker">Elevate your mind</span>
        <h2 className="story-title">
          Your argument <span className="story-highlight-yellow">changes here</span>.
        </h2>
        <p className="story-desc">
          Enter the matchmaking queue, host private debate rounds with customized structures, and receive actionable insights to hone your speech.
        </p>
        
        <div className="story-actions justify-content-center">
          <CtaButton 
            as={Link as any} 
            to={primaryCta.to} 
            variant="primary" 
            className="story-btn-large landing-interactive-lift"
          >
            <i className={`${primaryCta.icon} me-2`} />
            {primaryCta.label}
          </CtaButton>
          <CtaButton 
            as={Link as any} 
            to={secondaryCta.to} 
            variant="outline-primary" 
            className="story-btn-large landing-interactive-lift"
          >
            <i className={`${secondaryCta.icon} me-2`} />
            {secondaryCta.label}
          </CtaButton>
        </div>
      </motion.div>
    </section>
  );
}

export default HomeFinalCTA;
