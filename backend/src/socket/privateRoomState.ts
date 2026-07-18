export type PrivateRoomTeam = 'proposition' | 'opposition' | 'judge' | 'host';
export type JoinablePrivateRoomTeam = Exclude<PrivateRoomTeam, 'host'>;

export interface PrivateRoomState {
  roomId: string;
  team: JoinablePrivateRoomTeam;
  participants: Set<string>;
}

export const privateRooms = new Map<string, PrivateRoomState>();

export function privateRoomKey(roomId: string, team: PrivateRoomTeam): string {
  return `${roomId}::${team}`;
}

export function isUserInPrivateRoom(
  roomId: string,
  team: JoinablePrivateRoomTeam,
  userId: string,
): boolean {
  return privateRooms.get(privateRoomKey(roomId, team))?.participants.has(userId) ?? false;
}
