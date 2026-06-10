import mongoose from 'mongoose';
import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { User } from '../../models/User.js';
import { ConflictError, NotFoundError } from '../../utils/AppError.js';
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
  reason?: 'room_not_ranked' | 'already_applied' | 'missing_winner' | 'room_not_completed' | 'missing_debaters';
  winner?: Team | 'draw';
  winnerTeam?: Team | 'draw';
  format?: string;
  teamElo?: {
    proposition: number;
    opposition: number;
  };
  updates?: Array<{
    userId: string;
    username: string;
    team: Team;
    previousElo: number;
    newElo: number;
    eloDelta: number;
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

function averageElo(users: Array<{ ranking: { elo: number } }>) {
  if (users.length === 0) return BASE_ELO;
  return Math.round(
    users.reduce((total, user) => total + (user.ranking.elo || BASE_ELO), 0) / users.length,
  );
}

function getActualScore(winner: Team | 'draw', team: Team) {
  if (winner === 'draw') return 0.5;
  return winner === team ? 1 : 0;
}

function getMatchResult(actualScore: number): 'win' | 'loss' | 'draw' {
  if (actualScore === 1) return 'win';
  if (actualScore === 0.5) return 'draw';
  return 'loss';
}

function getSeasonPoints(actualScore: number) {
  if (actualScore === 1) return 3;
  if (actualScore === 0.5) return 1;
  return 0;
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

  if (room.status !== 'completed') {
    return { applied: false, reason: 'room_not_completed' };
  }

  if (room.eloApplied) {
    return { applied: false, reason: 'already_applied' };
  }

  const session = await DebateSession.findOne({ roomId: room._id }).select('finalScores');
  if (!session) throw new NotFoundError('Session not found');

  const winner = (session.finalScores as any)?.winnerTeam || session.finalScores?.winner as Team | 'draw' | undefined;
  if (!winner || (winner !== 'proposition' && winner !== 'opposition' && winner !== 'draw')) {
    return { applied: false, reason: 'missing_winner' };
  }

  const propositionParticipants = room.participants.filter(
    (participant) => participant.roomRole === 'debater' && participant.team === 'proposition',
  );
  const oppositionParticipants = room.participants.filter(
    (participant) => participant.roomRole === 'debater' && participant.team === 'opposition',
  );

  if (propositionParticipants.length === 0 || oppositionParticipants.length === 0) {
    return { applied: false, reason: 'missing_debaters' };
  }

  const propositionUsers = await User.find({
    _id: { $in: propositionParticipants.map((participant) => participant.userId) },
  });
  const oppositionUsers = await User.find({
    _id: { $in: oppositionParticipants.map((participant) => participant.userId) },
  });

  if (
    propositionUsers.length !== propositionParticipants.length ||
    oppositionUsers.length !== oppositionParticipants.length
  ) {
    throw new NotFoundError('Debater not found');
  }

  const propositionTeamElo = averageElo(propositionUsers);
  const oppositionTeamElo = averageElo(oppositionUsers);
  const propositionActualScore = getActualScore(winner, 'proposition');
  const oppositionActualScore = getActualScore(winner, 'opposition');
  const allUpdates: NonNullable<RankingApplicationResult['updates']> = [];

  const applyUserElo = (
    user: typeof propositionUsers[number],
    team: Team,
    opponentTeamElo: number,
    actualScore: number,
  ) => {
    const previousElo = user.ranking.elo || BASE_ELO;
    const newElo = calculateUpdatedElo(previousElo, opponentTeamElo, actualScore);

    user.ranking.elo = newElo;
    user.ranking.tier = getTierFromElo(newElo);
    user.ranking.seasonPoints += getSeasonPoints(actualScore);
    user.stats.totalDebates += 1;

    if (actualScore === 1) {
      user.stats.wins += 1;
    } else if (actualScore === 0) {
      user.stats.losses += 1;
    }

    allUpdates.push({
      userId: user._id.toString(),
      username: user.username,
      team,
      previousElo,
      newElo,
      eloDelta: newElo - previousElo,
      tier: user.ranking.tier as RankTier,
      result: getMatchResult(actualScore),
    });
  };

  propositionUsers.forEach((user) =>
    applyUserElo(user, 'proposition', oppositionTeamElo, propositionActualScore),
  );
  oppositionUsers.forEach((user) =>
    applyUserElo(user, 'opposition', propositionTeamElo, oppositionActualScore),
  );

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
      await Promise.all([
        ...propositionUsers.map((user) => user.save({ session: mongoSession })),
        ...oppositionUsers.map((user) => user.save({ session: mongoSession })),
      ]);
    });
  } finally {
    await mongoSession.endSession();
  }

  return {
    applied: true,
    winner,
    winnerTeam: winner,
    format: room.format,
    teamElo: {
      proposition: propositionTeamElo,
      opposition: oppositionTeamElo,
    },
    updates: allUpdates,
  };
}
