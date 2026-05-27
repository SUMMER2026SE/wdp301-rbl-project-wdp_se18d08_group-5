import mongoose from 'mongoose';
import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { User } from '../../models/User.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/AppError.js';
import type { RankTier, Team } from '../../types/index.js';

const BASE_ELO = 1000;
const K_FACTOR = 32;

const tierThresholds: Array<{ minElo: number; tier: RankTier }> = [
  { minElo: 1600, tier: 'GrandMaster' },
  { minElo: 1450, tier: 'Master' },
  { minElo: 1300, tier: 'Expert' },
  { minElo: 1150, tier: 'Advanced' },
  { minElo: 1000, tier: 'Debater' },
  { minElo: 0, tier: 'Novice' },
];

interface RankingApplicationResult {
  applied: boolean;
  reason?: 'room_not_ranked' | 'already_applied' | 'missing_winner';
  winner?: Team | 'draw';
  updates?: Array<{
    userId: string;
    previousElo: number;
    newElo: number;
    tier: RankTier;
    result: 'win' | 'loss' | 'draw';
  }>;
}

function calculateExpectedScore(playerElo: number, opponentElo: number) {
  return 1 / (1 + 10 ** ((opponentElo - playerElo) / 400));
}

function calculateUpdatedElo(playerElo: number, opponentElo: number, actualScore: number) {
  const expectedScore = calculateExpectedScore(playerElo, opponentElo);
  return Math.max(Math.round(playerElo + K_FACTOR * (actualScore - expectedScore)), 0);
}

export function getTierFromElo(elo: number): RankTier {
  return tierThresholds.find((threshold) => elo >= threshold.minElo)?.tier ?? 'Novice';
}

export async function applyDebateResult(roomId: string): Promise<RankingApplicationResult> {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');

  if (room.roomType !== 'rank') {
    return { applied: false, reason: 'room_not_ranked' };
  }

  if (room.eloApplied) {
    return { applied: false, reason: 'already_applied' };
  }

  const session = await DebateSession.findOne({ roomId: room._id }).select('finalScores');
  if (!session) throw new NotFoundError('Session not found');

  const winner = session.finalScores?.winner as Team | 'draw' | undefined;
  if (!winner || (winner !== 'proposition' && winner !== 'opposition' && winner !== 'draw')) {
    return { applied: false, reason: 'missing_winner' };
  }

  const propositionParticipant = room.participants.find(
    (participant) => participant.roomRole === 'debater' && participant.team === 'proposition',
  );
  const oppositionParticipant = room.participants.find(
    (participant) => participant.roomRole === 'debater' && participant.team === 'opposition',
  );

  if (!propositionParticipant || !oppositionParticipant) {
    throw new BadRequestError('Ranked room must have proposition and opposition debaters');
  }

  const [propositionUser, oppositionUser] = await Promise.all([
    User.findById(propositionParticipant.userId),
    User.findById(oppositionParticipant.userId),
  ]);

  if (!propositionUser || !oppositionUser) {
    throw new NotFoundError('Debater not found');
  }

  const propositionActualScore = winner === 'draw' ? 0.5 : winner === 'proposition' ? 1 : 0;
  const oppositionActualScore = winner === 'draw' ? 0.5 : winner === 'opposition' ? 1 : 0;

  const propositionPreviousElo = propositionUser.ranking.elo || BASE_ELO;
  const oppositionPreviousElo = oppositionUser.ranking.elo || BASE_ELO;

  const propositionNewElo = calculateUpdatedElo(
    propositionPreviousElo,
    oppositionPreviousElo,
    propositionActualScore,
  );
  const oppositionNewElo = calculateUpdatedElo(
    oppositionPreviousElo,
    propositionPreviousElo,
    oppositionActualScore,
  );

  propositionUser.ranking.elo = propositionNewElo;
  propositionUser.ranking.tier = getTierFromElo(propositionNewElo);
  propositionUser.ranking.seasonPoints += propositionActualScore === 1 ? 3 : propositionActualScore === 0.5 ? 1 : 0;

  oppositionUser.ranking.elo = oppositionNewElo;
  oppositionUser.ranking.tier = getTierFromElo(oppositionNewElo);
  oppositionUser.ranking.seasonPoints += oppositionActualScore === 1 ? 3 : oppositionActualScore === 0.5 ? 1 : 0;

  propositionUser.stats.totalDebates += 1;
  oppositionUser.stats.totalDebates += 1;

  if (winner === 'proposition') {
    propositionUser.stats.wins += 1;
    oppositionUser.stats.losses += 1;
  } else if (winner === 'opposition') {
    oppositionUser.stats.wins += 1;
    propositionUser.stats.losses += 1;
  }

  const mongoSession = await mongoose.startSession();

  try {
    await mongoSession.withTransaction(async () => {
      const freshRoom = await DebateRoom.findOne({ _id: room._id }).session(mongoSession);
      if (!freshRoom) throw new NotFoundError('Room not found');
      if (freshRoom.eloApplied) {
        throw new ConflictError('ELO already applied');
      }

      freshRoom.eloApplied = true;
      await freshRoom.save({ session: mongoSession });
      await propositionUser.save({ session: mongoSession });
      await oppositionUser.save({ session: mongoSession });
    });
  } finally {
    await mongoSession.endSession();
  }

  return {
    applied: true,
    winner,
    updates: [
      {
        userId: propositionUser._id.toString(),
        previousElo: propositionPreviousElo,
        newElo: propositionNewElo,
        tier: propositionUser.ranking.tier as RankTier,
        result: propositionActualScore === 1 ? 'win' : propositionActualScore === 0.5 ? 'draw' : 'loss',
      },
      {
        userId: oppositionUser._id.toString(),
        previousElo: oppositionPreviousElo,
        newElo: oppositionNewElo,
        tier: oppositionUser.ranking.tier as RankTier,
        result: oppositionActualScore === 1 ? 'win' : oppositionActualScore === 0.5 ? 'draw' : 'loss',
      },
    ],
  };
}
