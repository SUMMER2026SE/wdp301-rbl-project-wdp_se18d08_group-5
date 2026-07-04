export function hasHostControl(room: any, userId: string | undefined): boolean {
  if (!room || !room.participants || !userId) return false;
  
  const participant = room.participants.find((p: any) => (p.userId?._id?.toString() || p.userId?.toString()) === userId);
  if (!participant) return false;

  const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;

  if (effectiveRole === 'host') return true;

  if (room.hostType !== 'human' && effectiveRole === 'judge') {
    const judgeSlot = participant.speakerSlot;
    if (judgeSlot === 'S1') return true;

    const judgesList = room.judges || [];
    const myJudgeIndex = judgesList.findIndex(
      (j: any) => (j.userId?._id?.toString() || j.userId?.toString()) === userId
    );

    if (myJudgeIndex === 0) return true;

    if (participant.roomRole === 'owner' && myJudgeIndex === -1 && judgesList.length === 0) {
      return true;
    }
  }

  return false;
}

