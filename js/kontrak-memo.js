// Tampilan Internal Memo (IM) Masa Berakhirnya Kontrak Kerja.
// Dipakai bersama oleh kontrak-approval.html (pratinjau) dan kontrak-cetak.html (cetak),
// format mengikuti contoh IM resmi (PDF) dari HCS.
(function (root) {
  const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // 'YYYY-MM-DD' (atau ISO) -> '02 Mei 2025' ; pad=false -> '2 Mei 2025'
  function tgl(d, pad) {
    if (!d) return '-';
    let y, m, dd;
    const mt = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
    if (mt) { y = +mt[1]; m = +mt[2] - 1; dd = +mt[3]; }
    else { const x = new Date(d); if (isNaN(x)) return '-'; y = x.getFullYear(); m = x.getMonth(); dd = x.getDate(); }
    return (pad === false ? dd : String(dd).padStart(2, '0')) + ' ' + BULAN[m] + ' ' + y;
  }

  // "Pimpinan Dept. Hcs" -> "Pimpinan Dept <b>HCS</b>"
  function kepadaHtml(v) {
    const t = String(v || '').trim();
    if (!t) return '-';
    const m = /^(Pimpinan\s+Dept)\.?\s+(.+)$/i.exec(t);
    return m ? esc(m[1]) + ' <b>' + esc(m[2].toUpperCase()) + '</b>' : esc(t);
  }

  const CSS = `
  .im-memo{ font-family:'Times New Roman', Times, serif; color:#111; font-size:12pt; line-height:1.3; }
  .im-memo .im-title{ font-weight:700; font-size:14pt; text-decoration:underline; letter-spacing:.3px; margin:2px 0 0; line-height:1.2; }
  .im-memo .im-number{ font-weight:700; font-size:12pt; color:#111; margin:0 0 14px; }
  .im-memo table.im-t{ border-collapse:collapse; width:auto; table-layout:auto; margin:0 0 12px 0; }
  .im-memo table.im-t td{ padding:0 0 1px; font-size:12pt; line-height:1.3; vertical-align:top; text-align:left; border:none; }
  .im-memo table.im-t td.l{ width:128px; white-space:nowrap; padding-right:4px; }
  .im-memo table.im-t td.c{ width:16px; text-align:center; }
  .im-memo .im-blank{ display:inline-block; width:230px; border-bottom:1px solid #111; height:14px; }
  .im-memo p{ margin:0 0 12px; text-align:justify; }
  .im-memo .im-sign{ margin-top:26px; text-align:left; }
  .im-memo .im-sign .im-sigspace{ display:block; height:70px; }
  .im-memo .im-sign img.im-sigimg{ display:block; height:90px; margin:0 0 -16px 10px; }
  .im-memo .im-sign .im-name{ font-weight:700; text-decoration:underline; }
  .im-memo .im-sign .im-role{ font-style:italic; }
  `;

  // k: baris im_kontrak (+ hcs_penandatangan_nama, hcs_signature_data). Mengembalikan HTML mulai dari judul sampai tanda tangan
  // (kop surat/logo ditambahkan oleh masing-masing halaman).
  function html(k) {
    const riwayat = (Array.isArray(k.riwayat_kontrak) ? k.riwayat_kontrak : []).slice(-3);   // 3 kontrak terakhir
    const rows = riwayat.map(r => `<tr><td class="l">Kontrak ke ${esc(r.ke ?? '-')}</td><td class="c">:</td><td>${tgl(r.mulai)} &ndash; ${tgl(r.selesai)}</td></tr>`).join('');
    const nextKe = (k.kontrak_ke_terakhir != null ? k.kontrak_ke_terakhir : riwayat.length) + 1;
    const nextRow = `<tr><td class="l">Kontrak ke ${nextKe}</td><td class="c">:</td><td><span class="im-blank">&nbsp;</span></td></tr>`;

    // Belum ada keputusan -> semua pilihan ditebalkan seperti di IM resmi; sudah ada -> hanya yang dipilih
    const rekom = k.rekomendasi, dur = String(k.durasi_perpanjangan || '');
    const decided = !!rekom;
    const bd = (on, t) => (!decided || on) ? `<b>${t}</b>` : t;

    return `
    <div class="im-memo">
      <div class="im-title">INTERNAL MEMO</div>
      <div class="im-number">${esc(k.nomor_memo || '—/A.01/HRD/—/—')}</div>

      <table class="im-t">
        <tr><td class="l">Kepada</td><td class="c">:</td><td>${kepadaHtml(k.kepada_jabatan)}${k.kepada_nama ? '<br>Up. <b>' + esc(k.kepada_nama) + '</b>' : ''}</td></tr>
        <tr><td class="l">Dari</td><td class="c">:</td><td>${esc(k.dari || 'Dept. HCS')}</td></tr>
        <tr><td class="l">Perihal</td><td class="c">:</td><td>Masa Berakhirnya Kontrak Kerja</td></tr>
      </table>

      <p>Dengan hormat,<br>Dengan ini kami informasikan, bahwa berdasarkan data perjanjian kerja karyawan yang tersebut di bawah ini telah berakhir masa perjanjian kontraknya;</p>

      <table class="im-t">
        <tr><td class="l">Nama</td><td class="c">:</td><td><b>${esc(k.nama_snapshot)}</b></td></tr>
        <tr><td class="l">Unit</td><td class="c">:</td><td>${esc(k.unit_snapshot || '-')}</td></tr>
        <tr><td class="l">Bagian</td><td class="c">:</td><td>${esc(k.bagian_snapshot || '-')}</td></tr>
        <tr><td class="l">Tanggal Masuk</td><td class="c">:</td><td>${tgl(k.tanggal_masuk)}</td></tr>
        ${rows}
        ${nextRow}
      </table>

      <p>Untuk selanjutnya apabila ${bd(rekom === 'diperpanjang', 'diperpanjang')} ( ${bd(dur === '3', '3')} / ${bd(dur === '6', '6')} / ${bd(dur === '12', '12')} bulan ) / ${bd(rekom === 'tidak_diperpanjang', 'Tidak diperpanjang')} / ${bd(rekom === 'karyawan_tetap', 'Diusulkan sebagai karyawan tetap')}, dilengkapi dengan pengisian form sebagaimana terlampir. Balasan internal memo maksimal 30 hari sebelum kontrak karyawan berakhir, jika melebihi batas waktu yang telah ditetapkan maka hal - hal yang berkaitan dengan legalitas karyawan (status kekaryawanan) menjadi tanggungan Departemen.</p>
      <p>Demikian pemberitahuan dari kami atas perhatian dan kerjasamanya kami sampaikan terima kasih.</p>

      <div class="im-sign">
        <div>Surabaya, ${tgl(k.tanggal_memo || new Date().toISOString(), false)}<br>Hormat Saya,</div>
        ${k.hcs_signature_data ? `<img class="im-sigimg" src="${k.hcs_signature_data}" alt="Tanda tangan">` : '<span class="im-sigspace"></span>'}
        <div class="im-name">${esc(k.hcs_penandatangan_nama || '____________________')}</div>
        <div class="im-role">HCS Supervisor</div>
      </div>
    </div>`;
  }

  if (typeof document !== 'undefined') { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
  root.KontrakMemo = { css: CSS, html, tgl };
  if (typeof module !== 'undefined') module.exports = root.KontrakMemo;
})(typeof window !== 'undefined' ? window : globalThis);
