export function DetectiveClubRules() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-3">🔍 Detective Club</h3>
        <p className="leading-relaxed">
          เกมแนว Bluffing + Dixit ที่ต้องใช้ภาพตีความ ผู้เล่นทุกคนจะได้รู้ "คำศัพท์" ยกเว้น Conspirator (ผู้สมรู้ร่วมคิด) ที่ต้องเนียนตามน้ำให้ทัน
        </p>
      </div>

      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-3">บทบาท (Roles)</h3>
        <ul className="space-y-4">
          <li className="flex gap-3">
            <span className="text-indigo-400 mt-0.5 flex-shrink-0 text-xl leading-none">📝</span>
            <div>
              <strong className="text-slate-800 block mb-1">Informer (คนใบ้)</strong>
              เลือกคำศัพท์จากบนมือ แล้วเขียนลงในสมุดบันทึก ยกเว้นเล่มของ Conspirator ที่จะเป็นหน้าว่าง เป็นคนวาง Card ก่อนเสมอ
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-rose-400 mt-0.5 flex-shrink-0 text-xl leading-none">🕵️</span>
            <div>
              <strong className="text-slate-800 block mb-1">Conspirator (ผู้สมรู้ร่วมคิด)</strong>
              ไม่รู้คำศัพท์! ต้องเนียนวางการ์ดให้กลมกลืน ห้ามให้คนอื่นจับได้
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-400 mt-0.5 flex-shrink-0 text-xl leading-none">🔎</span>
            <div>
              <strong className="text-slate-800 block mb-1">Detective (นักสืบ)</strong>
              รู้คำศัพท์ วางการ์ดตามปกติ พยายามหาว่าใครเป็น Conspirator
            </div>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-3">ขั้นตอนการเล่น</h3>
        <ul className="space-y-4">
          <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">1️⃣</span>
            <div>
              <strong className="text-slate-800 block mb-1">Setup</strong>
              สุ่มบทบาท → Informer เลือกคำศัพท์ → ทุกคนจะเห็นคำ ยกเว้น Conspirator
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">2️⃣</span>
            <div>
              <strong className="text-slate-800 block mb-1">Card Playing (2 รอบ)</strong>
              แต่ละคนเลือกการ์ดจากมือวางลงบนโต๊ะ Informer เริ่มก่อน จากนั้นวนตามลำดับ ทั้งหมด 2 รอบ
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">3️⃣</span>
            <div>
              <strong className="text-slate-800 block mb-1">Discussion</strong>
              Informer อธิบายก่อนว่าวางการ์ดเพราะอะไร จากนั้นทุกคนผลัดกันอธิบาย Conspirator ต้อง Bluff ให้เนียน!
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">4️⃣</span>
            <div>
              <strong className="text-slate-800 block mb-1">Voting</strong>
              ทุกคน (ยกเว้น Informer) โหวตว่าใครคือ Conspirator
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">5️⃣</span>
            <div>
              <strong className="text-slate-800 block mb-1">Scoring</strong>
              เปิดเผยผลลัพธ์ คิดแต้มตามว่าจับ Conspirator ได้หรือไม่
            </div>
          </li>
        </ul>
      </div>
      
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-3">การให้คะแนน</h3>
        <ul className="space-y-4 border-l-2 border-amber-200 pl-4 py-1">
          <li className="text-slate-700"><span className="text-emerald-400 font-bold">✅</span> <strong>จับ Conspirator ได้:</strong> Detective ที่โหวตถูกได้ 3 แต้ม, Informer ได้ 3 แต้ม</li>
          <li className="text-slate-700"><span className="text-rose-400 font-bold">❌</span> <strong>Conspirator หนีรอด:</strong> Conspirator ได้ 5 แต้ม, Informer ได้ 0 แต้ม</li>
        </ul>
      </div>
    </div>
  );
}
