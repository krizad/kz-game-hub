import type { Language } from './dictionaries';

/**
 * Server error messages are English strings emitted by the API.
 * Map them to localized UI text here instead of hardcoding translations in stores.
 */
const SERVER_ERRORS: Record<Language, Record<string, string>> = {
  en: {
    SPECTATORS_DISABLED: 'This room does not allow spectators.',
    REQUEST_ID_REUSED: 'Request ID already used with different payload.',
    'Cannot propose shuriken.': 'Cannot propose a Breath Break.',
    'Cannot vote on shuriken.': 'Cannot vote on a Breath Break.',
    'Cannot cancel shuriken proposal.': 'Cannot cancel the Breath Break proposal.',
    'Questions are unavailable. Retry or choose another game.':
      'Questions are unavailable. Retry or choose another game.',
  },
  th: {
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
  return SERVER_ERRORS[language][message] ?? message;
}
