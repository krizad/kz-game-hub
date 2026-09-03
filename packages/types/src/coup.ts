export enum CoupRole {
  DUKE = 'DUKE',
  ASSASSIN = 'ASSASSIN',
  CAPTAIN = 'CAPTAIN',
  AMBASSADOR = 'AMBASSADOR',
  CONTESSA = 'CONTESSA',
}

export enum CoupPhase {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  AWAITING_CHALLENGE = 'AWAITING_CHALLENGE',
  AWAITING_BLOCK = 'AWAITING_BLOCK',
  AWAITING_EXCHANGE = 'AWAITING_EXCHANGE',
  AWAITING_REVEAL = 'AWAITING_REVEAL',
  RESULT = 'RESULT',
}

export enum CoupActionType {
  INCOME = 'INCOME',
  FOREIGN_AID = 'FOREIGN_AID',
  COUP = 'COUP',
  TAX = 'TAX',
  ASSASSINATE = 'ASSASSINATE',
  STEAL = 'STEAL',
  EXCHANGE = 'EXCHANGE',
}

export interface CoupPlayerPublic {
  id: string;
  coins: number;
  influenceCount: number;
  revealed: CoupRole[];
  isAlive: boolean;
}

export interface CoupState {
  phase: CoupPhase;
  deck: CoupRole[];
  deadPile: CoupRole[];
  coins: Record<string, number>;
  influences: Record<string, { count: number; revealed: CoupRole[] }>;
  currentTurn: string | null;
  winnerId: string | null;
  pendingAction?: {
    actorId: string;
    type: CoupActionType;
    targetId?: string;
    claimedRole?: CoupRole;
  } | null;
  challengeWindowDeadline?: number | null;
  blockWindowDeadline?: number | null;
  pendingBlock?: {
    blockerId: string;
    claimedRole: CoupRole;
  } | null;
}

export interface CoupPrivateState {
  hand: CoupRole[];
}

export interface CoupDeclarePayload {
  code: string;
  type: CoupActionType;
  targetId?: string;
}

export interface CoupRevealPayload {
  code: string;
  roleIndex: number;
}

export interface CoupExchangeSelectPayload {
  code: string;
  keepIndices: number[];
}
