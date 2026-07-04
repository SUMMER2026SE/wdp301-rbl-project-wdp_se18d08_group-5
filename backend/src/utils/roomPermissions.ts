export function hasControlPanel(room: any, userId: string | { toString(): string }): boolean {
  if (!room || !room.participants) return false;
  
  const uid = typeof userId === 'string' ? userId : userId.toString();
  const participant = room.participants.find((p: any) => p.userId.toString() === uid);
  if (!participant) return false;

  const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;

  if (effectiveRole === 'host') return true;

  if (room.hostType !== 'human' && effectiveRole === 'judge') {
    const judgeSlot = participant.speakerSlot;
    if (judgeSlot === 'S1') return true;

    const judgesList = room.judges || [];
    const myJudgeIndex = judgesList.findIndex(
      (j: any) => (j.userId?.toString?.() || j.userId?.toString()) === uid
    );

    if (myJudgeIndex === 0) return true;

    if (participant.roomRole === 'owner' && myJudgeIndex === -1 && judgesList.length === 0) {
      return true;
    }
  }

  return false;
}

