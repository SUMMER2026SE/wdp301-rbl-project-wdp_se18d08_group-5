import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { HomeFinalCTA } from './HomeFinalCTA';

const ChapterButton = Button as any;

interface HomeStoryChapterProps {
  isAuthenticated: boolean;
}

export function HomeStoryChapter({ isAuthenticated }: HomeStoryChapterProps) {
  const primaryCta = isAuthenticated
    ? { to: '/matchmaking', label: 'Enter Ranked Queue', icon: 'bi bi-lightning' }
    : { to: '/register', label: 'Get Started', icon: 'bi bi-rocket-takeoff' };

  return (
    <div className="story-content-overlay">
      {/* ── CHAPTER 1: THE MOTION ── */}
      <section className="story-chapter story-chapter-hero">
        <motion.div 
          className="story-chapter-content story-layout-center story-interactive"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <span className="story-kicker">Academic Debate Platform</span>
          <h1 className="story-title">FROM MOTION TO VERDICT</h1>
          <p className="story-desc">
            Turn a question into a battle of ideas. Engage in structured real-time debates judged by artificial intelligence.
          </p>
          <div className="story-actions">
            <ChapterButton 
              as={Link as any} 
              to={primaryCta.to} 
              variant="primary" 
              className="story-btn-large landing-interactive-lift"
            >
              <i className={`${primaryCta.icon} me-2`} />
              {primaryCta.label}
            </ChapterButton>
            <ChapterButton 
              as={Link as any} 
              to="/matches" 
              variant="outline-primary" 
              className="story-btn-large landing-interactive-lift"
            >
              <i className="bi bi-broadcast me-2" />
              Watch Live Matches
            </ChapterButton>
          </div>
        </motion.div>
      </section>

      {/* ── CHAPTER 2: CHOOSE A SIDE ── */}
      <section className="story-chapter">
        <motion.div 
          className="story-chapter-content story-layout-center story-interactive"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <span className="story-kicker">Choose a stance</span>
          <h2 className="story-title">
            Every motion has <span className="story-highlight-cyan">more</span> than <span className="story-highlight-magenta">one truth</span>
          </h2>
          <p className="story-desc">
            Align with your perspective. Formulate core arguments and prepare to substantiate your stance under opposition scrutiny.
          </p>
          
          <div className="story-side-by-side">
            <div className="story-side-pane story-side-pane-proposition">
              <h3 className="story-pane-title story-highlight-cyan">PROPOSITION</h3>
              <p className="story-pane-desc">
                Affirmative case files. Defend the motion using logical deductions, structured frameworks, and empirical warrants.
              </p>
            </div>
            <div className="story-side-pane story-side-pane-opposition">
              <h3 className="story-pane-title story-highlight-magenta">OPPOSITION</h3>
              <p className="story-pane-desc">
                Negative refutations. Challenge assumptions, expose logical inconsistencies, and construct a compelling counter-case.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── CHAPTER 3: BUILD THE ARGUMENT ── */}
      <section className="story-chapter">
        <motion.div 
          className="story-chapter-content story-layout-left story-interactive"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <span className="story-kicker">Structure is everything</span>
          <h2 className="story-title">
            Build your reasoning.<br />
            Challenge assumptions.
          </h2>
          <p className="story-desc">
            Connect logic nodes to formulate a compelling, coherent debate framework that withstands interrogation.
          </p>

          <div className="story-indicators">
            <div className="story-indicator-tag">
              <span style={{ color: '#00f5ff' }}>Logic:</span> Coherent Structure
            </div>
            <div className="story-indicator-tag">
              <span style={{ color: '#00f5ff' }}>Evidence:</span> Empirical Warrants
            </div>
            <div className="story-indicator-tag">
              <span style={{ color: '#ff006e' }}>Rebuttal:</span> Direct Clashes
            </div>
            <div className="story-indicator-tag">
              <span style={{ color: '#ff006e' }}>Delivery:</span> Retorical Clarity
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── CHAPTER 4: THE LIVE DEBATE ── */}
      <section className="story-chapter">
        <motion.div 
          className="story-chapter-content story-layout-right story-interactive"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <span className="story-kicker">Real-time Clashing</span>
          <h2 className="story-title">
            Speak live. Respond under pressure.
          </h2>
          <p className="story-desc">
            Step onto the digital podium. Express reasoning clearly, adapt to cross-examinations, and manage your clock in real time.
          </p>
          <div className="story-actions">
            <ChapterButton 
              as={Link as any} 
              to="/matches" 
              variant="outline-primary" 
              className="story-btn-large landing-interactive-lift"
            >
              <i className="bi bi-broadcast me-2" />
              Watch Live Matches
            </ChapterButton>
          </div>
        </motion.div>
      </section>

      {/* ── CHAPTER 5: AI JUDGEMENT ── */}
      <section className="story-chapter">
        <motion.div 
          className="story-chapter-content story-layout-center story-interactive"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <span className="story-kicker">Intelligent Analytics</span>
          <h2 className="story-title">
            Judged by <span className="story-highlight-yellow">reasoning</span>, not volume
          </h2>
          <p className="story-desc">
            Our AI analysis engine processes speech recordings, detects fallacies, dissects arguments, and scores based on substance.
          </p>
          
          <div className="story-side-by-side">
            <div className="story-side-pane">
              <h3 className="story-pane-title">Fallacy Detection</h3>
              <p className="story-pane-desc">
                Identifies circular reasoning, ad hominem attacks, strawman fallacies, and structural invalidity automatically.
              </p>
            </div>
            <div className="story-side-pane">
              <h3 className="story-pane-title">Speech Dissection</h3>
              <p className="story-pane-desc">
                Evaluates key claims, responses, cross-examination value, and communication clarity to provide objective verdicts.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── CHAPTER 6: THE VERDICT ── */}
      <HomeFinalCTA isAuthenticated={isAuthenticated} />
    </div>
  );
}
export default HomeStoryChapter;
