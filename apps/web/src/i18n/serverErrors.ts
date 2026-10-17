import type { Language } from './dictionaries';

/**
 * Server error messages are English strings emitted by the API.
 * Map them to localized UI text here instead of hardcoding translations in stores.
 */
const SERVER_ERRORS: Record<Language, Record<string, string>> = {
  en: {
    'Cannot cancel round.': 'Only the host can cancel the current live round.',
    NOT_TEAM_SETUP: 'Team setup is required.',
    HOST_ONLY: 'Only the host can do that.',
    TEAM_INVALID: 'Choose a valid team.',
    ROLE_INVALID: 'Choose a valid role.',
    NOT_A_PLAYER: 'Only seated players can do that.',
    TEAM_NEEDS_LEAD: 'Each team needs a Lead.',
    TEAM_NEEDS_TRACKER: 'Each team needs a Tracker.',
    TEAM_DISCONNECTED: 'Wait for players to reconnect.',
    NOT_ROUND_END: 'The round has not ended.',
    NOT_CLUE_PHASE: 'Wait for the clue phase.',
    NOT_YOUR_TURN: 'It is not your turn.',
    CLUE_INVALID: 'Enter one clue of at most 30 characters.',
    CLUE_MULTIPLE_WORDS: 'Use a single word.',
    CLUE_COUNT_INVALID: 'Choose a count from 0 to 9 or infinity.',
    CLUE_ON_BOARD: 'That word is on the board.',
    NO_BOARD: 'No board is available.',
    NOT_DECODING: 'Wait for decoding.',
    MUST_GUESS_FIRST: 'Reveal at least one card first.',
    NOT_OPPONENT: 'Only the opposing team can challenge.',
    ALREADY_CHALLENGED: 'This clue was already challenged.',
    CHALLENGE_EXPIRED: 'This challenge has expired.',
    NOT_CLUE_GIVER: 'Only the clue giver can respond.',
    INVALID_RESPONSE: 'Choose accept or reject.',
    BAD_CARD: 'Choose a valid card.',
    CARD_REVEALED: 'That card is already revealed.',

    DOG_RELAY_ROOM_FULL: 'This room already has nine players.',
    DOG_RELAY_PLAYER_COUNT: 'Who Barks needs 5–9 players.',
    DOG_RELAY_DISCONNECTED_PLAYER: 'Wait until every seated player is connected.',
    SPECTATORS_DISABLED: 'This room does not allow spectators.',
    REQUEST_ID_REUSED: 'Request ID already used with different payload.',
    'Cannot propose shuriken.': 'Cannot propose a Breath Break.',
    'Cannot vote on shuriken.': 'Cannot vote on a Breath Break.',
    'Cannot cancel shuriken proposal.': 'Cannot cancel the Breath Break proposal.',
    'Questions are unavailable. Retry or choose another game.':
      'Questions are unavailable. Retry or choose another game.',
  },
  th: {
    'Cannot cancel round.': 'เฉพาะโฮสต์เท่านั้นที่ยกเลิกรอบที่กำลังเล่นได้',
    NOT_TEAM_SETUP: 'ต้องอยู่ในช่วงจัดทีม',
    HOST_ONLY: 'เฉพาะโฮสต์เท่านั้น',
    TEAM_INVALID: 'กรุณาเลือกทีมที่ถูกต้อง',
    ROLE_INVALID: 'กรุณาเลือกบทบาทที่ถูกต้อง',
    NOT_A_PLAYER: 'เฉพาะผู้เล่นในรอบเท่านั้น',
    TEAM_NEEDS_LEAD: 'แต่ละทีมต้องมีหัวหน้าสายลับ',
    TEAM_NEEDS_TRACKER: 'แต่ละทีมต้องมีผู้ถอดรหัส',
    TEAM_DISCONNECTED: 'รอผู้เล่นเชื่อมต่อกลับมา',
    NOT_ROUND_END: 'รอบยังไม่จบ',
    NOT_CLUE_PHASE: 'รอช่วงให้คำใบ้',
    NOT_YOUR_TURN: 'ยังไม่ถึงตาของคุณ',
    CLUE_INVALID: 'กรอกคำใบ้ไม่เกิน 30 ตัวอักษร',
    CLUE_MULTIPLE_WORDS: 'ใช้คำเดียวโดยไม่มีช่องว่าง',
    CLUE_COUNT_INVALID: 'เลือกจำนวน 0 ถึง 9 หรือไม่จำกัด',
    CLUE_ON_BOARD: 'คำใบ้นี้อยู่บนกระดาน',
    NO_BOARD: 'ยังไม่มีกระดาน',
    NOT_DECODING: 'รอช่วงถอดรหัส',
    MUST_GUESS_FIRST: 'ต้องเปิดการ์ดอย่างน้อยหนึ่งใบก่อน',
    NOT_OPPONENT: 'เฉพาะอีกทีมจึงทักท้วงได้',
    ALREADY_CHALLENGED: 'คำใบ้นี้ถูกทักท้วงแล้ว',
    CHALLENGE_EXPIRED: 'คำทักท้วงนี้หมดอายุแล้ว',
    NOT_CLUE_GIVER: 'เฉพาะผู้ให้คำใบ้จึงตอบได้',
    INVALID_RESPONSE: 'กรุณาเลือกยอมรับหรือปฏิเสธ',
    BAD_CARD: 'กรุณาเลือกการ์ดที่ถูกต้อง',
    CARD_REVEALED: 'การ์ดนี้เปิดแล้ว',

    DOG_RELAY_ROOM_FULL: 'ห้องนี้มีผู้เล่นครบ 9 คนแล้ว',
    DOG_RELAY_PLAYER_COUNT: 'หมาตัวไหนต้องมีผู้เล่น 5–9 คน',
    DOG_RELAY_DISCONNECTED_PLAYER: 'รอให้ผู้เล่นทุกที่นั่งเชื่อมต่อก่อน',
    SPECTATORS_DISABLED: 'ห้องนี้ไม่อนุญาตให้เข้าชม',
    REQUEST_ID_REUSED: 'คำขอนี้ถูกส่งซ้ำด้วยข้อมูลที่ต่างกัน',
    'The Room Host has left. Room has been closed.': 'โฮสต์ออก ห้องถูกปิดลงแล้ว',
    'Please enter your name first': 'กรุณากรอกชื่อก่อน',
    'Room not found or player name is already in use': 'ไม่พบห้องนี้ หรือมีคนใช้ชื่อนี้แล้ว',
    'Room not found': 'ไม่พบห้องที่ระบุ',
    'Player name is already in use': 'มีผู้เล่นใช้ชื่อนี้แล้ว',
    'Internal server error': 'เกิดข้อผิดพลาดในระบบ',
    'Invalid request payload': 'ข้อมูลไม่ถูกต้อง',
    'Failed to submit vote.': 'ส่งผลโหวตไม่สำเร็จ',
    'Not authorized or slot already taken.': 'ไม่มีสิทธิ์ หรือช่องถูกจองแล้ว',
    'Invalid move.': 'การเดินไม่ถูกต้อง',
    'Not authorized to reset game.': 'ไม่มีสิทธิ์เริ่มเกมใหม่',
    'Invalid choice or not your turn.': 'ไม่สามารถเลือกได้ หรือยังไม่ถึงตาของคุณ',
    'Invalid move or not your turn.': 'การเดินไม่ถูกต้อง หรือยังไม่ถึงตาของคุณ',
    'Invalid answer or not in submission phase.': 'คำตอบไม่ถูกต้อง หรือไม่อยู่ในช่วงส่งคำตอบ',
    'Cannot reveal player.': 'ไม่สามารถเปิดเผยผู้เล่นได้',
    'Cannot eliminate player.': 'ไม่สามารถคัดผู้เล่นออกได้',
    'Cannot bank points.': 'ไม่สามารถเก็บคะแนนได้',
    'Cannot go to next round.': 'ไม่สามารถไปรอบถัดไปได้',
    'Cannot submit word': 'ไม่สามารถส่งคำได้',
    'Invalid card play': 'เล่นไพ่ใบนี้ไม่ได้',
    'Cannot move to next phase': 'ไม่สามารถข้ามช่วงได้',
    'Invalid vote': 'การโหวตไม่ถูกต้อง',
    'Not authorized to move to next round': 'ไม่มีสิทธิ์ข้ามไปรอบถัดไป',
    'Cannot start Host Input mode': 'ไม่สามารถเริ่มโหมดพิมพ์คำเองได้',
    'Invalid action': 'การกระทำไม่ถูกต้อง',
    'Game action not supported for this game type': 'เกมประเภทนี้ไม่รองรับการกระทำนี้',
    'Cannot ready for game.': 'ไม่สามารถกดพร้อมได้',
    'Cannot play card right now.': 'ยังไม่สามารถเล่นการ์ดได้',
    'Cannot advance to next level.': 'ไม่สามารถไปเลเวลถัดไปได้',
    'Cannot propose shuriken.': 'ไม่สามารถเสนอใช้จังหวะพักได้',
    'Cannot vote on shuriken.': 'ไม่สามารถโหวตจังหวะพักได้',
    'Cannot cancel shuriken proposal.': 'ไม่สามารถยกเลิกการเสนอใช้จังหวะพักได้',
    'This game is currently disabled.': 'เกมนี้ถูกปิดใช้งานชั่วคราว',
    'Unauthorized.': 'ไม่ได้รับอนุญาต',
    'Failed to update the game setting.': 'อัปเดตการตั้งค่าเกมไม่สำเร็จ',
    'Questions are unavailable. Retry or choose another game.':
      'คลังคำถามยังใช้งานไม่ได้ ลองใหม่หรือเลือกเกมอื่น',
  },
};

export function translateServerError(message: string, language: Language): string {
  if (message.startsWith('Duplicate word "')) {
    const match = message.match(/^Duplicate word "(.*?)"! Please submit a different word\.$/);
    if (match) {
      const word = match[1];
      return language === 'th'
        ? `คำว่า "${word}" ซ้ำกับผู้เล่นอื่น! กรุณาเลือกคำใหม่`
        : `Duplicate word "${word}"! Please submit a different word.`;
    }
  }
  if (message.startsWith('Questions are unavailable')) {
    return language === 'th'
      ? 'คลังคำถามยังใช้งานไม่ได้ ลองใหม่หรือเลือกเกมอื่น'
      : 'Questions are unavailable. Retry or choose another game.';
  }
  return (
    SERVER_ERRORS[language][message] ??
    (message.startsWith('DOG_RELAY_')
      ? language === 'th'
        ? 'ทำรายการไม่สำเร็จ กรุณาลองใหม่'
        : 'This action could not be accepted. Please try again.'
      : message)
  );
}
