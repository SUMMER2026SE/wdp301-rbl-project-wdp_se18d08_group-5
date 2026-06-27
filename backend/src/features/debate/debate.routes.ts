import { Router, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { roomParticipantGuard, roomControllerGuard } from '../../middleware/roomGuard.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/AppError.js';
import { applyDebateResult } from '../ranking/ranking.service.js';
import { getIO } from '../../socket/index.js';
import { timerService } from '../../socket/timer.service.js';
import {
  advanceTurn,
  endDebate,
  finishCe,
  finishPhase,
  passCeTurn,
  requestDraw,
  surrenderDebate,
  triggerTransition,
  aggregateScores,
} from './debate.service.js';
import type { AuthRequest } from '../../types/index.js';

const router = Router();

// Param-aware guard for :roomId routes
const roomParticipantGuardById = (param: string) => roomParticipantGuard(param);
// Hosts and Judge S1 (in no-host rooms) can advance/end/pause the debate
const roomDebateControllerGuard = (param: string) => roomControllerGuard(param);

// POST /api/v1/debate/:roomId/next-turn — Advance turn using the debate flow
router.post(
  '/:roomId/next-turn',
  authenticate,
  roomDebateControllerGuard('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await advanceTurn(req.params.roomId, req.user!.userId, req.body.transcript || '');
    sendSuccess(res, result, 'Turn advanced');
  }),
);

// POST /api/v1/debate/:roomId/finish-phase — Finish current phase and enter the next one
router.post(
  '/:roomId/finish-phase',
  authenticate,
  roomParticipantGuardById('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await finishPhase(req.params.roomId, req.user!.userId, req.body.transcript || '');
    sendSuccess(res, result, 'Phase finished');
  }),
);

// POST /api/v1/debate/:roomId/ce/pass-turn — Pass CE turn for asking team
router.post(
  '/:roomId/ce/pass-turn',
  authenticate,
  roomParticipantGuardById('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await passCeTurn(req.params.roomId, req.user!.userId, req.body.content || '');
    sendSuccess(res, result, 'Cross-exam turn passed');
  }),
);

// POST /api/v1/debate/:roomId/ce/finish — Finish CE phase
router.post(
  '/:roomId/ce/finish',
  authenticate,
  roomParticipantGuardById('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await finishCe(req.params.roomId, req.user!.userId, req.body.transcript || '');
    sendSuccess(res, result, 'Cross-exam finished');
  }),
);

async function broadcastDebateCompleted(roomId: string, result: any, userId: string) {
  if (result.room?.status === 'completed') {
    const io = getIO();
    const aggregatedScores = result.session?.finalScores || {
      winner: 'draw',
      teamProposition: { total: 0 },
      teamOpposition: { total: 0 },
    };
    const winnerInfo = {
      roomId,
      winnerTeam: aggregatedScores.winner,
      propositionTotal: aggregatedScores.teamProposition.total,
      oppositionTotal: aggregatedScores.teamOpposition.total,
      finalScores: aggregatedScores,
    };
    io.to(roomId).emit('score:winner-determined', winnerInfo);
    io.to(roomId).emit('debate:ended', { roomId, result: winnerInfo });
    io.emit('debate:ended', { roomId, result: winnerInfo });
    io.emit('room:update', { action: 'completed', roomId });
    const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
    const state = await buildRoomStatePayload(roomId, userId);
    if (state) {
      io.to(roomId).emit('room:state-restore', state);
    }
  }
}

// POST /api/v1/debate/:roomId/end — Complete debate and apply ranking when eligible
router.post(
  '/:roomId/end',
  authenticate,
  roomDebateControllerGuard('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await endDebate(req.params.roomId, req.user!.userId, req.body.summary || '');
    await broadcastDebateCompleted(req.params.roomId, result, req.user!.userId);
    sendSuccess(res, result, 'Debate completed');
  }),
);

// POST /api/v1/debate/:roomId/surrender — Debater forfeits the match
router.post(
  '/:roomId/surrender',
  authenticate,
  roomParticipantGuardById('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await surrenderDebate(req.params.roomId, req.user!.userId);
    await broadcastDebateCompleted(req.params.roomId, result, req.user!.userId);
    sendSuccess(res, result, 'Debate surrendered');
  }),
);

// POST /api/v1/debate/:roomId/draw/request — Debater requests a draw
router.post(
  '/:roomId/draw/request',
  authenticate,
  roomParticipantGuardById('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await requestDraw(req.params.roomId, req.user!.userId);
    await broadcastDebateCompleted(req.params.roomId, result, req.user!.userId);
    sendSuccess(res, result, 'Draw requested');
  }),
);

const pauseTimeouts = new Map<string, NodeJS.Timeout>();

async function autoResumeDebate(roomId: string) {
  try {
    const room = await DebateRoom.findById(roomId);
    if (!room || room.status !== 'paused') return;

    const session = await DebateSession.findOne({ roomId: room._id });
    if (!session || !session.pauseType || session.pauseType === 'host') return;

    room.status = 'active';
    await room.save();

    session.pauseType = null;
    session.pausedAt = null;
    await session.save();

    const isCrossExam = session.currentTurn?.phase === 'cross_exam';
    if (isCrossExam) {
      const { ceTimerService } = await import('../../socket/ce.socket.js');
      ceTimerService.resume(roomId);
    } else {
      timerService.resume(roomId);
    }

    const io = getIO();
    io.to(roomId).emit('debate:resumed', {
      resumedAt: Date.now(),
      autoResumed: true,
    });
  } catch (error) {
    console.error('autoResumeDebate error:', error);
  }
}

// POST /api/v1/debate/:roomId/host/pause — Pause debate (UC-44)
router.post(
  '/:roomId/host/pause',
  authenticate,
  roomDebateControllerGuard('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;
    if (room.status !== 'active') throw new BadRequestError('Room is not active');

    room.status = 'paused';
    await room.save();

    // Determine correct timer based on active phase
    const session = await DebateSession.findOne({ roomId: room._id });
    if (session) {
      session.pauseType = 'host';
      session.pausedAt = new Date();
      await session.save();
    }

    const isCrossExam = session?.currentTurn?.phase === 'cross_exam';
    let timeRemaining = 0;
    if (isCrossExam) {
      const { ceTimerService } = await import('../../socket/ce.socket.js');
      ceTimerService.pause(room._id.toString());
      const ceState = ceTimerService.getState(room._id.toString());
      if (ceState) {
        timeRemaining = ceState.sharedRemaining;
      }
    } else {
      timerService.pause(room._id.toString());
      timeRemaining = timerService.getTimeRemaining(room._id.toString());
    }

    // Broadcast pause to every client so they show a synchronized overlay.
    const io = getIO();
    io.to(room._id.toString()).emit('debate:paused', {
      pausedAt: Date.now(),
      timeRemaining,
      pauseType: 'host',
      pausesUsed: session?.pausesUsed || { proposition: 0, opposition: 0 },
    });

    sendSuccess(res, { status: 'paused' }, 'Debate paused');
  }),
);

// POST /api/v1/debate/:roomId/host/resume — Resume debate
router.post(
  '/:roomId/host/resume',
  authenticate,
  roomDebateControllerGuard('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;
    if (room.status !== 'paused') throw new BadRequestError('Room is not paused');

    room.status = 'active';
    await room.save();

    // Determine correct timer based on active phase
    const session = await DebateSession.findOne({ roomId: room._id });
    if (session) {
      session.pauseType = null;
      session.pausedAt = null;
      await session.save();
    }

    // Clear auto-resume timeout
    const timeoutId = pauseTimeouts.get(room._id.toString());
    if (timeoutId) {
      clearTimeout(timeoutId);
      pauseTimeouts.delete(room._id.toString());
    }

    const isCrossExam = session?.currentTurn?.phase === 'cross_exam';
    if (isCrossExam) {
      const { ceTimerService } = await import('../../socket/ce.socket.js');
      ceTimerService.resume(room._id.toString());
    } else {
      timerService.resume(room._id.toString());
    }

    // Broadcast resume to every client
    const io = getIO();
    io.to(room._id.toString()).emit('debate:resumed', {
      resumedAt: Date.now(),
    });

    sendSuccess(res, { status: 'active' }, 'Debate resumed');
  }),
);

// POST /api/v1/debate/:roomId/debater/pause — Debater request pause
router.post(
  '/:roomId/debater/pause',
  authenticate,
  roomParticipantGuardById('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;
    if (room.status !== 'active') throw new BadRequestError('Room is not active');

    const participant = room.participants.find((p: any) => p.userId.toString() === req.user!.userId);
    if (!participant) {
      throw new ForbiddenError('Not a participant');
    }
    const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;
    if (effectiveRole !== 'debater') {
      throw new ForbiddenError('Only debaters can request team pause');
    }

    const team = participant.team as 'proposition' | 'opposition';
    if (!team) throw new BadRequestError('You are not assigned to a team');

    const session = await DebateSession.findOne({ roomId: room._id });
    if (!session) throw new NotFoundError('Session not found');

    const currentPausesUsed = session.pausesUsed?.[team] || 0;
    if (currentPausesUsed >= 3) {
      throw new BadRequestError('Your team has used all 3 pause turns');
    }

    room.status = 'paused';
    await room.save();

    session.pausedAt = new Date();
    session.pauseType = team;
    if (!session.pausesUsed) {
      session.pausesUsed = { proposition: 0, opposition: 0 };
    }
    session.pausesUsed[team] = currentPausesUsed + 1;
    await session.save();

    // Pause timers
    const isCrossExam = session.currentTurn?.phase === 'cross_exam';
    let timeRemaining = 0;
    if (isCrossExam) {
      const { ceTimerService } = await import('../../socket/ce.socket.js');
      ceTimerService.pause(room._id.toString());
      const ceState = ceTimerService.getState(room._id.toString());
      if (ceState) {
        timeRemaining = ceState.sharedRemaining;
      }
    } else {
      timerService.pause(room._id.toString());
      timeRemaining = timerService.getTimeRemaining(room._id.toString());
    }

    // Schedule auto-resume in 3 minutes (180,000 ms)
    const timeoutId = setTimeout(() => {
      autoResumeDebate(room._id.toString()).catch(console.error);
    }, 180000);

    const existingTimeout = pauseTimeouts.get(room._id.toString());
    if (existingTimeout) clearTimeout(existingTimeout);
    pauseTimeouts.set(room._id.toString(), timeoutId);

    // Broadcast pause to every client so they show a synchronized overlay.
    const io = getIO();
    io.to(room._id.toString()).emit('debate:paused', {
      pausedAt: Date.now(),
      timeRemaining,
      pauseType: team,
      pausesUsed: session.pausesUsed,
    });

    sendSuccess(res, {
      status: 'paused',
      pauseType: team,
      pausesUsed: session.pausesUsed
    }, 'Debate paused by team');
  }),
);

// POST /api/v1/debate/:roomId/debater/resume — Debater request resume
router.post(
  '/:roomId/debater/resume',
  authenticate,
  roomParticipantGuardById('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;
    if (room.status !== 'paused') throw new BadRequestError('Room is not paused');

    const participant = room.participants.find((p: any) => p.userId.toString() === req.user!.userId);
    if (!participant) throw new ForbiddenError('Not a participant');

    const session = await DebateSession.findOne({ roomId: room._id });
    if (!session) throw new NotFoundError('Session not found');

    const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;
    const isJudgeS1 = room.hostType !== 'human' && effectiveRole === 'judge' && (participant as any).speakerSlot === 'S1';
    const isHost = effectiveRole === 'host' || isJudgeS1;
    const isPauserTeam = session.pauseType === participant.team;

    if (!isHost && !isPauserTeam) {
      throw new ForbiddenError('Only the host, Judge S1, or the team that initiated the pause can resume it');
    }

    room.status = 'active';
    await room.save();

    session.pauseType = null;
    session.pausedAt = null;
    await session.save();

    // Clear auto-resume timeout
    const timeoutId = pauseTimeouts.get(room._id.toString());
    if (timeoutId) {
      clearTimeout(timeoutId);
      pauseTimeouts.delete(room._id.toString());
    }

    // Resume timers
    const isCrossExam = session.currentTurn?.phase === 'cross_exam';
    if (isCrossExam) {
      const { ceTimerService } = await import('../../socket/ce.socket.js');
      ceTimerService.resume(room._id.toString());
    } else {
      timerService.resume(room._id.toString());
    }

    // Broadcast resume to every client
    const io = getIO();
    io.to(room._id.toString()).emit('debate:resumed', {
      resumedAt: Date.now(),
    });

    sendSuccess(res, { status: 'active' }, 'Debate resumed');
  }),
);

// POST /api/v1/debate/:roomId/host/issue-card — Issue yellow card (UC-45)
router.post(
  '/:roomId/host/issue-card',
  authenticate,
  roomDebateControllerGuard('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, reason } = req.body;
    const room = (req as any).room;

    const session = await DebateSession.findOne({ roomId: room._id });
    if (session) {
      session.cards.push({
        type: 'yellow',
        issuedTo: userId,
        issuedBy: req.user!.userId as any,
        reason,
        timestamp: new Date(),
      });
      await session.save();
    }

    sendSuccess(res, { type: 'yellow', userId, reason }, 'Card issued');
  }),
);

// POST /api/v1/debate/:roomId/host/kick — Kick from active debate (UC-46)
router.post(
  '/:roomId/host/kick',
  authenticate,
  roomDebateControllerGuard('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.body;
    const room = (req as any).room;

    room.participants = room.participants.filter(
      (p: any) => p.userId.toString() !== userId,
    ) as any;
    await room.save();

    sendSuccess(res, null, 'Participant kicked');
  }),
);

// POST /api/v1/debate/:roomId/host/next-turn — Advance the debate turn (UC-45)
router.post(
  '/:roomId/host/next-turn',
  authenticate,
  roomDebateControllerGuard('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await triggerTransition(req.params.roomId, req.body.transcript || '');
    sendSuccess(res, { transitioning: true }, 'Turn advanced transition started');
  }),
);

// POST /api/v1/debate/:roomId/host/mute — Mute/unmute a participant (UC-47)
router.post(
  '/:roomId/host/mute',
  authenticate,
  roomDebateControllerGuard('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, action } = req.body;
    const room = (req as any).room;

    const participant = room.participants.find((p: any) => p.userId.toString() === userId);
    if (!participant) throw new NotFoundError('Participant not found');

    (participant as any).muted = action === 'mute';
    await room.save();

    sendSuccess(res, { userId, muted: action === 'mute' }, `Participant ${action === 'mute' ? 'muted' : 'unmuted'}`);
  }),
);

// POST /api/v1/debate/:roomId/judge/submit-score — Judge submit score (UC-48)
router.post(
  '/:roomId/judge/submit-score',
  authenticate,
  roomParticipantGuardById('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { speaker, score, notes } = req.body;
    const room = (req as any).room;

    const judge = (req as any).participant;
    const effectiveRole = judge.roomRole === 'owner' ? judge.primaryRole : judge.roomRole;
    if (effectiveRole !== 'judge') {
      throw new ForbiddenError('Only assigned judges can submit scores');
    }

    const session = await DebateSession.findOne({ roomId: req.params.roomId });
    if (!session) throw new NotFoundError('Session not found');

    if (!session.finalScores) {
      session.finalScores = {
        teamProposition: { total: 0, breakdown: {} },
        teamOpposition: { total: 0, breakdown: {} },
        winner: null,
        aiVerdict: null,
        judgeVerdicts: [],
      };
    }

    const finalScores = session.finalScores as any;
    finalScores.judgeVerdicts = finalScores.judgeVerdicts || [];
    
    // Remove duplicate entry for this judge & speaker if exists (upsert behavior)
    finalScores.judgeVerdicts = finalScores.judgeVerdicts.filter(
      (v: any) => !(v.judgeId.toString() === req.user!.userId && v.speaker === speaker)
    );

    finalScores.judgeVerdicts.push({
      judgeId: req.user!.userId as any,
      speaker,
      score,
      notes: notes || '',
      submittedAt: new Date(),
    });

    // Determine if we should automatically complete the debate
    const assignedJudges = room.participants.filter((p: any) => {
      const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
      return role === 'judge';
    });
    const isOPPS3 = speaker === 'OPP_S3';
    
    const OPP_S3_verdicts = finalScores.judgeVerdicts.filter((v: any) => v.speaker === 'OPP_S3');
    const uniqueJudgesSubmitted = new Set(OPP_S3_verdicts.map((v: any) => v.judgeId.toString()));
    const allJudgesSubmitted = assignedJudges.every((j: any) => uniqueJudgesSubmitted.has(j.userId.toString()));

    let autoCompleted = false;
    let winnerInfo = null;

    if (isOPPS3 && allJudgesSubmitted && assignedJudges.length > 0) {
      const aggregate = aggregateScores(finalScores.judgeVerdicts);
      
      finalScores.teamProposition = aggregate.teamProposition;
      finalScores.teamOpposition = aggregate.teamOpposition;
      finalScores.winner = aggregate.winner;
      finalScores.winnerTeam = aggregate.winner;

      session.currentTurn.status = 'completed';
      session.currentTurn.phase = 'completed';

      room.status = 'completed';
      room.currentPhase = 'completed';
      room.endedAt = new Date();

      await room.save();
      autoCompleted = true;

      winnerInfo = {
        roomId: req.params.roomId,
        winnerTeam: aggregate.winner,
        propositionTotal: aggregate.teamProposition.total,
        oppositionTotal: aggregate.teamOpposition.total,
        finalScores: session.finalScores,
      };
    }

    await session.save();

    if (autoCompleted && winnerInfo) {
      // Apply Elo/rankings result
      await applyDebateResult(req.params.roomId).catch((err) => {
        console.error('Failed to apply debate Elo result:', err);
      });

      const io = getIO();
      // Broadcast winner determined & ended
      io.to(req.params.roomId).emit('score:winner-determined', winnerInfo);
      io.to(req.params.roomId).emit('debate:ended', { roomId: req.params.roomId, result: winnerInfo });
      io.emit('debate:ended', { roomId: req.params.roomId, result: winnerInfo });
      io.emit('room:update', { action: 'completed', roomId: req.params.roomId });

      // Build and broadcast room state restore
      const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
      const state = await buildRoomStatePayload(req.params.roomId, req.user!.userId);
      if (state) {
        io.to(req.params.roomId).emit('room:state-restore', state);
      }
    }

    sendSuccess(res, { speaker, score, notes, autoCompleted }, 'Score submitted');
  }),
);

// GET /api/v1/debate/:roomId/scores — Get current scores for the room (UC-36)
router.get(
  '/:roomId/scores',
  asyncHandler(async (req, res: Response) => {
    const room = await DebateRoom.findById(req.params.roomId).select('participants judgeType');
    if (!room) throw new NotFoundError('Room not found');

    const session = await DebateSession.findOne({ roomId: req.params.roomId });
    if (!session) {
      throw new NotFoundError('Session not found');
    }

    const payload = {
      finalScores: session.finalScores,
      judgeVerdicts: session.finalScores?.judgeVerdicts || [],
      turnHistory: session.turnHistory,
      participants: room.participants,
    };

    sendSuccess(res, payload);
  }),
);

// POST /api/v1/debate/:roomId/cross-exam/pass-turn — Pass the cross-exam turn (UC-32)
router.post(
  '/:roomId/cross-exam/pass-turn',
  authenticate,
  roomParticipantGuardById('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { nextSpeaker } = req.body;
    const session = await DebateSession.findOne({ roomId: req.params.roomId });
    if (!session) throw new NotFoundError('Session not found');
    if (session.currentTurn.phase !== 'cross_exam') {
      throw new BadRequestError('Current phase is not cross-exam');
    }

    const now = new Date();
    const duration = now.getTime() - session.currentTurn.startTime.getTime();
    session.turnHistory.push({
      speaker: session.currentTurn.speaker,
      startTime: session.currentTurn.startTime,
      endTime: now,
      duration,
      transcript: req.body.transcript || '',
      crossExamination: null,
      aiAnalysis: null,
    });

    session.currentTurn = {
      speaker: nextSpeaker || session.currentTurn.speaker,
      phase: 'cross_exam',
      startTime: new Date(),
      timeLimit: session.currentTurn.timeLimit,
      timeRemaining: session.currentTurn.timeRemaining,
      status: 'active',
    };

    await session.save();
    sendSuccess(res, session.currentTurn, 'Cross-exam turn passed');
  }),
);

// POST /api/v1/debate/:roomId/cross-exam/finish — Finish cross-examination (UC-33)
router.post(
  '/:roomId/cross-exam/finish',
  authenticate,
  roomParticipantGuardById('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const session = await DebateSession.findOne({ roomId: req.params.roomId });
    if (!session) throw new NotFoundError('Session not found');
    if (session.currentTurn.phase !== 'cross_exam') {
      throw new BadRequestError('Current phase is not cross-exam');
    }

    session.currentTurn.status = 'completed';
    session.currentTurn.phase = 'judge_feedback';
    await session.save();

    sendSuccess(res, session.currentTurn, 'Cross-exam finished');
  }),
);

// POST /api/v1/debate/:roomId/result — Apply final result to ranking for rank rooms
router.post(
  '/:roomId/result',
  authenticate,
  roomDebateControllerGuard('roomId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const rankingResult = await applyDebateResult(req.params.roomId);
    sendSuccess(res, rankingResult, rankingResult.applied ? 'Result applied' : 'Result not applied');
  }),
);

// GET /api/v1/debate/:roomId/session — Get session data
router.get(
  '/:roomId/session',
  asyncHandler(async (req, res: Response) => {
    const session = await DebateSession.findOne({ roomId: req.params.roomId });
    if (!session) throw new NotFoundError('Session not found');
    sendSuccess(res, session);
  }),
);

// GET /api/v1/debate/:roomId/replay — Get replay data (UC-66)
router.get(
  '/:roomId/replay',
  asyncHandler(async (req, res: Response) => {
    const session = await DebateSession.findOne({ roomId: req.params.roomId });
    if (!session) throw new NotFoundError('Session not found');

    const room = await DebateRoom.findById(req.params.roomId).select('title motion format participants');

    sendSuccess(res, { room, session });
  }),
);

export default router;
