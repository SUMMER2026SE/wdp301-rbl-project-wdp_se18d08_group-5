# 07 — AI Integration Guide

**Phiên bản:** v1.0 | **Ngày:** 14/05/2026  
**Loại tài liệu:** Hướng dẫn kỹ thuật — OpenAI, AI Host / BGK  
**Tham chiếu:** [01_Debate_Rule.md](./01_Debate_Rule.md) §12–13 · [04_TRD](./04_TRD_Technical_Requirements.md) §4.4

---

## 1. TỔNG QUAN AI SYSTEM

Hệ thống AI trên **OpenAI GPT-4o API**:

| AI Feature | Trigger | Output |
|-----------|---------|--------|
| Speech Analysis | Sau mỗi speech (4') | Claims, evidence, weaknesses, score |
| Fallacy Detection | Per speech / realtime | Fallacy type, severity |
| Argument Scoring (BGK) | Sau speech + cuối trận | Score 0–100 theo Debate_rule §13 |
| Toxic Detection | Per chat message | Boolean + reason |
| AI Host | Rank / custom AI Host | Phase control, timer, Cross Exam flow |
| AI Judge (BGK) | Sau mỗi speaker + final | Nhận xét, điểm tạm, verdict |
| Debate Summary | Sau debate | Summary, conflicts, winner |
| Cross Exam validation | Mỗi câu hỏi CE | Hợp lệ / không (ngắn, đúng trọng tâm) |

---

## 2. PROMPT TEMPLATES

### 2.1 Speech Analysis Prompt

```typescript
const analyzeSpeechPrompt = (
  speaker: string,
  topic: string,
  transcript: string,
  turnNumber: number
) => `
You are an expert debate judge (BGK) analyzing a speech in an AI Debate Platform match (Proposition vs Opposition format per platform rules).

DEBATE TOPIC: "${topic}"
SPEAKER POSITION: ${speaker} (Turn ${turnNumber}/8)
SPEECH TRANSCRIPT:
"""
${transcript}
"""

Analyze this speech and return a JSON response with the following structure:
{
  "mainClaims": ["claim1", "claim2"],
  "evidence": ["evidence1", "evidence2"],
  "weaknesses": ["weakness1", "weakness2"],
  "fallacies": [
    {
      "type": "Ad Hominem | Strawman | False Dilemma | Slippery Slope | Appeal to Authority | Hasty Generalization | Circular Reasoning",
      "description": "specific description of the fallacy found",
      "severity": "low | medium | high",
      "quote": "the exact quote containing the fallacy"
    }
  ],
  "score": {
    "logic": 0-30,
    "rebuttal": 0-20,
    "evidence": 0-15,
    "crossExam": 0-15,
    "strategy": 0-10,
    "communication": 0-10,
    "overall": 0-100
  },
  "strengths": ["strength1", "strength2"],
  "summary": "2-3 sentence summary of the speech"
}

Return ONLY valid JSON, no additional text.
`;
```

### 2.2 Fallacy Detection Prompt

```typescript
const detectFallacyPrompt = (text: string, topic: string) => `
You are a logic expert. Analyze the following statement for logical fallacies.

DEBATE TOPIC: "${topic}"
STATEMENT: "${text}"

Common fallacies to check:
- Ad Hominem: Attacking the person instead of the argument
- Strawman: Misrepresenting opponent's argument
- False Dilemma: Presenting only two options when more exist
- Slippery Slope: Assuming extreme consequences without justification
- Appeal to Authority: Using irrelevant authority as evidence
- Hasty Generalization: Drawing broad conclusions from limited examples
- Circular Reasoning: Using conclusion as premise

Return JSON:
{
  "hasFallacy": true | false,
  "fallacies": [
    {
      "type": "fallacy name",
      "description": "explanation",
      "severity": "low | medium | high"
    }
  ]
}

Return ONLY valid JSON.
`;
```

### 2.3 Argument Scoring Prompt

```typescript
const scoreArgumentPrompt = (argument: string, topic: string, context: string) => `
You are an expert debate judge scoring an argument per AI Debate Platform criteria (Logic, Rebuttal, Evidence, Cross Examination, Strategy, Communication).

TOPIC: "${topic}"
CONTEXT (previous speeches): "${context}"
ARGUMENT: "${argument}"

Score this argument on the following criteria:
1. Logic & Reasoning (0-30): How logically sound is the argument?
2. Clarity & Structure (0-20): How clear and well-structured is it?
3. Evidence Quality (0-20): How strong and relevant is the evidence?
4. Rebuttal Effectiveness (0-20): How well does it address opposing arguments?
5. Delivery & Persuasion (0-10): How persuasive is the presentation?

Return JSON:
{
  "scores": {
    "logic": number,
    "clarity": number,
    "evidence": number,
    "rebuttal": number,
    "delivery": number,
    "overall": number
  },
  "feedback": {
    "logic": "brief feedback",
    "clarity": "brief feedback",
    "evidence": "brief feedback",
    "rebuttal": "brief feedback"
  },
  "topStrength": "the strongest aspect",
  "topWeakness": "the weakest aspect"
}
`;
```

### 2.4 Toxic Detection Prompt

```typescript
const detectToxicPrompt = (message: string) => `
You are a content moderator for an academic debate platform.

MESSAGE: "${message}"

Determine if this message contains:
- Personal attacks or insults
- Hate speech
- Harassment
- Spam
- Inappropriate content for academic setting

Return JSON:
{
  "isToxic": true | false,
  "reason": "explanation if toxic, null if clean",
  "severity": "low | medium | high | null"
}
`;
```

### 2.5 AI Host Announcement Prompt

```typescript
const aiHostAnnouncementPrompt = (
  event: string,
  context: DebateContext
) => `
You are an AI host moderating an AI Debate Platform match (motion, 7-min prep, 4-min speeches, cross-examination phases).

DEBATE TOPIC: "${context.topic}"
CURRENT EVENT: ${event}
CURRENT TURN: ${context.currentTurn}
TIME ELAPSED: ${context.timeElapsed}

Generate a brief, professional announcement for this event.
Keep it under 50 words. Be formal but engaging.

Events you handle:
- turn_start: Announce who is speaking and their role
- turn_end: Brief transition to next speaker
- cross_exam_start: Announce cross-examination phase
- cross_exam_pass_turn: Announce turn pass
- cross_exam_finish: Announce cross-examination end
- time_warning: 1 minute remaining warning
- rule_violation: Announce rule violation
- debate_end: Closing announcement

Return JSON:
{
  "announcement": "the announcement text",
  "type": "info | warning | transition"
}
`;
```

### 2.6 Debate Summary Prompt

```typescript
const debateSummaryPrompt = (
  topic: string,
  allSpeeches: SpeechRecord[]
) => `
You are an expert debate analyst. Summarize this AI Debate Platform match (Proposition vs Opposition).

TOPIC: "${topic}"

SPEECHES:
${allSpeeches.map(s => `
[${s.speaker}] (${s.duration}s):
${s.transcript}
`).join('\n---\n')}

Provide a comprehensive debate summary in JSON:
{
  "overview": "3-4 sentence overview of the debate",
  "teamPropositionStrengths": ["strength1", "strength2"],
  "teamOppositionStrengths": ["strength1", "strength2"],
  "teamPropositionWeaknesses": ["weakness1", "weakness2"],
  "teamOppositionWeaknesses": ["weakness1", "weakness2"],
  "keyConflicts": [
    {
      "issue": "the contested issue",
      "teamProPosition": "proposition stance",
      "teamOppPosition": "opposition stance",
      "resolution": "which team argued it better and why"
    }
  ],
  "verdict": {
    "winner": "proposition | opposition | draw",
    "confidence": "high | medium | low",
    "reasoning": "detailed explanation of the verdict",
    "scoreDifference": "estimated score difference"
  },
  "highlights": [
    {
      "speaker": "speaker position",
      "moment": "description of standout moment"
    }
  ]
}
`;
```

### 2.7 Cross Examination Question Validation Prompt

```typescript
const validateCrossExamPrompt = (
  question: string,
  topic: string,
  currentSpeech: string
) => `
You are a debate moderator. Evaluate if this cross-examination question is appropriate.

DEBATE TOPIC (motion): "${topic}"
CURRENT SPEECH CONTEXT: "${currentSpeech.substring(0, 500)}..."
QUESTION: "${question}"

A valid cross-examination question must:
1. Be relevant to the motion and current clash
2. Be short and direct (not a disguised speech)
3. Be a genuine question requiring a direct answer
4. Be respectful and academic in tone

Return JSON:
{
  "isValid": true | false,
  "reason": "explanation",
  "suggestion": "improved version if invalid, null if valid"
}
`;
```

---

## 3. AI SERVICE IMPLEMENTATION

### 3.1 Base AI Service

```typescript
// server/src/features/ai/ai.service.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class AIService {
  private async callOpenAI(
    prompt: string,
    maxTokens: number = 1000
  ): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.3, // Lower = more consistent
        response_format: { type: 'json_object' },
      });
      return response.choices[0].message.content || '{}';
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('AI service temporarily unavailable');
    }
  }

  async analyzeSpeech(
    speaker: string,
    topic: string,
    transcript: string,
    turnNumber: number
  ) {
    const prompt = analyzeSpeechPrompt(speaker, topic, transcript, turnNumber);
    const result = await this.callOpenAI(prompt, 1500);
    return JSON.parse(result);
  }

  async detectFallacy(text: string, topic: string) {
    const prompt = detectFallacyPrompt(text, topic);
    const result = await this.callOpenAI(prompt, 500);
    return JSON.parse(result);
  }

  async checkToxic(message: string) {
    const prompt = detectToxicPrompt(message);
    const result = await this.callOpenAI(prompt, 200);
    return JSON.parse(result);
  }

  async summarizeDebate(topic: string, speeches: SpeechRecord[]) {
    const prompt = debateSummaryPrompt(topic, speeches);
    const result = await this.callOpenAI(prompt, 2000);
    return JSON.parse(result);
  }

  async validateCrossExamQuestion(question: string, topic: string, context: string) {
    const prompt = validateCrossExamPrompt(question, topic, context);
    const result = await this.callOpenAI(prompt, 300);
    return JSON.parse(result);
  }
}
```

---

## 4. AI HOST MODE FLOW

```
Debate Start
     │
     ▼
AI Host announces: "Welcome to the debate on [topic]"
     │
     ▼
AI Host: "Proposition Speaker 1 - [name]. You may begin. You have 4 minutes."
     │
     ▼
Timer starts (server-side)
     │
     ├── At 3:00 → AI Host: "1 minute remaining"
     │
     └── At 4:00 → AI Host: "Time. Cross-examination."
          │
          ├── Pass Turn / Finish · 3 min per team · max 2 Q per team
          └── AI validates CE questions
          │
          ▼
     AI BGK feedback 3–5 min → prep 1 min
          │
          ▼
     AI analyzes speech (async)
          │
          ▼
     Next speaker (Opposition S1, … per Debate_rule)
          │
         ...
          │
     After all speakers + closing (S3, no cross exam):
          │
          ▼
     AI generates full summary + verdict
          │
          ▼
     AI Host announces winner
```

---

## 5. ERROR HANDLING & FALLBACKS

```typescript
// Fallback khi OpenAI không available
const fallbackAnalysis = {
  mainClaims: ['Analysis unavailable'],
  evidence: [],
  weaknesses: [],
  fallacies: [],
  score: {
    logic: 0, clarity: 0, evidence: 0, rebuttal: 0, delivery: 0, overall: 0
  },
  strengths: [],
  summary: 'AI analysis is temporarily unavailable. Please try again later.'
};

// Retry logic
async function callWithRetry(fn: () => Promise<any>, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) return fallbackAnalysis;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```

---

## 6. COST ESTIMATION

| Feature | Tokens/call (est.) | Calls/debate | Cost/debate (est.) |
|---------|-------------------|-------------|-------------------|
| Speech Analysis | ~1500 | 8 | ~$0.12 |
| Toxic Detection | ~200 | ~50 | ~$0.05 |
| Debate Summary | ~2000 | 1 | ~$0.03 |
| AI Host | ~300 | ~30 | ~$0.05 |
| **Total** | | | **~$0.25/debate** |

*Dựa trên GPT-4o pricing: ~$0.01/1K tokens*
