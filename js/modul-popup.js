// Popup pengingat per modul (dipakai kontrak.html & penilaian.html)
// Pemakaian: tampilPopupModul({ judul, sub, items:[{judul, sub, kanan, lewat, href, aksi}] })
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const css = `
  #mpOverlay{position:fixed;inset:0;background:rgba(10,6,3,.72);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;padding:24px 16px;z-index:300}
  #mpOverlay.show{display:flex}
  #mpBox{background:#3a2b1e;border:1px solid rgba(232,135,58,.55);border-radius:16px;width:100%;max-width:640px;padding:26px 28px;box-shadow:0 24px 70px rgba(0,0,0,.55);color:#f2e9dc;font-family:'Segoe UI',system-ui,sans-serif}
  #mpBox h2{margin:0 0 4px;font-size:19px;font-weight:700}
  #mpBox .mp-sub{color:#b6a48c;font-size:13px}
  .mp-h{display:flex;align-items:center;gap:14px}
  .mp-ico{width:46px;height:46px;border-radius:12px;display:grid;place-items:center;font-size:24px;background:rgba(232,135,58,.15);animation:mpPulse 1.8s ease-in-out infinite}
  @keyframes mpPulse{0%,100%{box-shadow:0 0 0 0 rgba(232,135,58,.45)}50%{box-shadow:0 0 0 9px rgba(232,135,58,0)}}
  .mp-list{margin-top:18px;display:flex;flex-direction:column;gap:10px;max-height:52vh;overflow-y:auto}
  .mp-item{display:flex;align-items:center;gap:12px;background:#302213;border:1px solid #4f3d29;border-left:3px solid #e8873a;border-radius:10px;padding:11px 14px}
  .mp-item.lewat{border-left-color:#e06b8b}
  .mp-inf{flex:1;min-width:0;font-size:13px}.mp-inf small{display:block;color:#b6a48c;font-size:11.5px;margin-top:2px}
  .mp-kanan{font-weight:700;font-size:12.5px;color:#e8873a;white-space:nowrap}.mp-item.lewat .mp-kanan{color:#e06b8b}
  .mp-item a{font-size:12px;font-weight:600;color:#7aa2f7;text-decoration:none;border:1px solid rgba(122,162,247,.4);border-radius:8px;padding:6px 11px;white-space:nowrap}
  .mp-item a:hover{background:rgba(122,162,247,.14);border-color:#7aa2f7}
  .mp-foot{display:flex;justify-content:flex-end;margin-top:22px;padding-top:16px;border-top:1px solid #4f3d29}
  .mp-foot button{background:linear-gradient(135deg,#d4a24c,#e8873a);color:#241a12;font-weight:700;font-size:13px;border:0;border-radius:10px;padding:9px 20px;cursor:pointer}`;

  function ensure() {
    if (document.getElementById('mpOverlay')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const el = document.createElement('div'); el.id = 'mpOverlay';
    el.innerHTML = `<div id="mpBox"><div class="mp-h"><div class="mp-ico">⏰</div><div><h2 id="mpJudul"></h2><div class="mp-sub" id="mpSub"></div></div></div>
      <div class="mp-list" id="mpList"></div><div class="mp-foot"><button type="button" id="mpOk">Mengerti</button></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) tutup(); });
    document.getElementById('mpOk').onclick = tutup;
    document.addEventListener('keydown', e => { if (e.key === 'Escape') tutup(); });
  }
  function tutup() { const o = document.getElementById('mpOverlay'); if (o) o.classList.remove('show'); }

  window.tampilPopupModul = function ({ judul, sub, items }) {
    if (!items || !items.length || window.__mpShown) return;   // sekali per kali halaman dibuka
    window.__mpShown = true; ensure();
    document.getElementById('mpJudul').textContent = judul;
    document.getElementById('mpSub').textContent = sub || '';
    document.getElementById('mpList').innerHTML = items.map(i => `<div class="mp-item ${i.lewat ? 'lewat' : ''}">
      <div class="mp-inf"><b>${esc(i.judul)}</b><small>${esc(i.sub || '')}</small></div>
      <div class="mp-kanan">${esc(i.kanan || '')}</div>${i.href ? `<a href="${esc(i.href)}">${esc(i.aksi || 'Buka')}</a>` : ''}</div>`).join('');
    document.getElementById('mpOverlay').classList.add('show');
  };
})();
