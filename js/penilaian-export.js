// Export rekap penilaian ke Excel, memakai template templates/REKAP_PENILAIAN_TEMPLATE.xlsx
// Sheet 1 = Form A (worker/operator), Sheet 2 = Form B & C (staff up).
// Dipakai di browser (ExcelJS global) dan bisa diuji di Node (module.exports).
(function (root) {
  const TEMPLATE_ROWS = [23, 97];   // jumlah baris contoh pada template (sheet 1, sheet 2)
  const START_ROW = 8;

  function parseTgl(t) {
    if (!t) return null;
    const [y, m, d] = String(t).slice(0, 10).split('-').map(Number);
    return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : null;
  }
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const sum = a => a.reduce((x, y) => x + y, 0);

  // skor per kolom: { kode: skor } dikelompokkan per kategori -> array sesuai urutan kolom
  function skorOf(det, prefix, kodes) {
    return kodes.map(k => {
      const r = (det || []).find(d => d.kode === k && String(d.kategori).trim().startsWith(prefix));
      return r && r.skor != null ? Number(r.skor) : null;
    });
  }
  const f = v => v == null ? '' : v;

  // Tanggal masuk: utamakan Master Karyawan (terbaru), cadangan snapshot saat penilaian dibuat
  function tglMasukOf(p, kar) {
    const m = kar && ((p.karyawan_id != null && kar.byId[p.karyawan_id]) || kar.byNik[String(p.nik_snapshot || '').trim()]);
    return parseTgl((m && m.tanggal_masuk) || p.tgl_masuk_kerja);
  }

  // Kedisiplinan dari hr_absensi: I = Izin, A = Alpha, C = Cuti Tahunan saja (Cuti Khusus tidak dihitung),
  // T = jumlah kode T + T1 + T2. Karyawan tanpa data absensi sama sekali -> null (sel dikosongkan).
  function hitungDisiplin(absensi) {
    const m = {};
    (absensi || []).forEach(a => {
      const nik = String(a.nik || '').trim();
      const d = m[nik] = m[nik] || { I: 0, A: 0, C: 0, T: 0 };
      if (a.status === 'Izin') d.I++;
      else if (a.status === 'Alpha') d.A++;
      else if (a.status === 'Cuti' && a.kategori === 'Cuti Tahunan') d.C++;
      if (a.kode === 'T' || a.kode === 'T1' || a.kode === 'T2' || (!a.kode && a.status === 'Terlambat')) d.T++;
    });
    return m;
  }
  function tulisDisiplin(row, firstCol, p, disiplin) {
    const d = disiplin[String(p.nik_snapshot || '').trim()];
    if (!d) return;
    [d.I, d.A, d.C, d.T].forEach((v, j) => { row.getCell(firstCol + j).value = v; });
  }

  // Tambah baris (salin gaya) bila data melebihi template, atau kosongkan baris template yang tidak terpakai.
  // Catatan teks "Surabaya, ..." di bawah tabel ikut dipindah agar tetap menempel di bawah data.
  function trimOrGrow(ws, n, templateRows) {
    if (n > templateRows) { ws.duplicateRow(START_ROW + templateRows - 1, n - templateRows, true); return; }
    if (n === templateRows) return;
    let footer = null;
    for (let r = START_ROW + templateRows; r <= START_ROW + templateRows + 15; r++) {
      const c = ws.getRow(r).getCell(1);
      if (typeof c.value === 'string' && c.value.trim().startsWith('Surabaya')) { footer = { r, value: c.value, style: c.style }; break; }
    }
    for (let r = START_ROW + n; r < START_ROW + templateRows; r++) {
      const row = ws.getRow(r);
      row.eachCell({ includeEmpty: true }, c => { c.value = null; c.style = {}; });
    }
    if (footer) {
      const old = ws.getRow(footer.r).getCell(1);
      old.value = null; old.style = {};
      const nw = ws.getRow(START_ROW + n + 2).getCell(1);
      nw.value = footer.value; nw.style = footer.style;
    }
  }

  function fillWorker(ws, rows, detMap, cutoff, kar, disiplin) {
    trimOrGrow(ws, rows.length, TEMPLATE_ROWS[0]);
    rows.forEach((p, i) => {
      const r = START_ROW + i, row = ws.getRow(r);
      const sk = skorOf(detMap[p.id], '', ['a', 'b', 'c', 'd', 'e']);
      sk[3] = null;   // kolom merah "Disiplin / absensi" dikosongkan (diisi manual)
      const ada = sk.filter(v => v != null);
      const tgl = tglMasukOf(p, kar);
      row.getCell(1).value = i + 1;
      row.getCell(2).value = p.nama_snapshot || '';
      row.getCell(3).value = p.nik_snapshot || '';
      row.getCell(4).value = p.departemen_snapshot || '';
      row.getCell(5).value = p.sub_departemen_snapshot || '';
      row.getCell(6).value = p.jabatan_snapshot || '';
      row.getCell(7).value = tgl;
      row.getCell(8).value = tgl ? { formula: `IF(G${r}="","",ROUND((H$4-G${r})/365.25,2))`, result: Math.round((cutoff - tgl) / 864e5 / 365.25 * 100) / 100 } : '';
      sk.forEach((v, j) => { row.getCell(9 + j).value = v; });
      row.getCell(14).value = { formula: `IF(COUNT(I${r}:M${r})=0,"",SUM(I${r}:M${r}))`, result: ada.length ? sum(ada) : '' };
      const c15 = row.getCell(15);
      c15.value = { formula: `IF(COUNT(I${r}:M${r})=0,"",AVERAGE(I${r}:M${r}))`, result: ada.length ? avg(ada) : '' };
      c15.numFmt = '0.00';
      tulisDisiplin(row, 18, p, disiplin);   // R..U
      row.commit && row.commit();
    });
  }

  function fillStaff(ws, rows, detMap, cutoff, kar, disiplin) {
    trimOrGrow(ws, rows.length, TEMPLATE_ROWS[1]);
    rows.forEach((p, i) => {
      const r = START_ROW + i, row = ws.getRow(r);
      const sikap = skorOf(detMap[p.id], 'I -', ['a', 'b', 'c', 'd', 'e']);
      sikap[4] = null;   // kolom merah "Disiplin" dikosongkan (diisi manual)
      const kuasa = skorOf(detMap[p.id], 'II -', ['a', 'b']);
      const people = skorOf(detMap[p.id], 'III -', ['a', 'b', 'c', 'd']);
      const all = [...sikap, ...kuasa, ...people];
      const ada = all.filter(v => v != null);
      const secAvgs = [sikap, kuasa, people].map(s => avg(s.filter(v => v != null))).filter(v => v != null);
      const tgl = tglMasukOf(p, kar);
      row.getCell(1).value = i + 1;
      row.getCell(2).value = p.nama_snapshot || '';
      row.getCell(3).value = p.nik_snapshot || '';
      row.getCell(4).value = p.departemen_snapshot || '';
      row.getCell(5).value = p.sub_departemen_snapshot || '';
      row.getCell(6).value = p.jabatan_snapshot || '';
      const bawahan = p.tipe_form === 'C' ? 2 : 1;   // 1 = tidak punya bawahan (Form B), 2 = punya bawahan (Form C)
      row.getCell(7).value = bawahan;
      row.getCell(8).value = { formula: `VLOOKUP(G${r},Sheet1!$A$1:$B$2,2,0)`, result: bawahan === 2 ? 'punya bawahan' : 'tidak punya bawahan' };
      row.getCell(9).value = tgl;
      row.getCell(10).value = tgl ? { formula: `IF(I${r}="","",ROUND((J$4-I${r})/365.25,1))`, result: Math.round((cutoff - tgl) / 864e5 / 365.25 * 10) / 10 } : '';
      all.forEach((v, j) => { row.getCell(11 + j).value = v; });   // K..U
      row.getCell(22).value = { formula: `IF(COUNT(K${r}:U${r})=0,"",SUM(K${r}:U${r}))`, result: ada.length ? sum(ada) : '' };
      // rata-rata = rata-rata dari rata-rata tiap bagian (sama dengan "Total Rata-rata" di aplikasi)
      const fx = `IF(COUNT(K${r}:U${r})=0,"",(IFERROR(AVERAGE(K${r}:O${r}),0)+IFERROR(AVERAGE(P${r}:Q${r}),0)+IFERROR(AVERAGE(R${r}:U${r}),0))/((COUNT(K${r}:O${r})>0)+(COUNT(P${r}:Q${r})>0)+(COUNT(R${r}:U${r})>0)))`;
      row.getCell(23).value = { formula: fx, result: secAvgs.length ? avg(secAvgs) : '' };
      tulisDisiplin(row, 26, p, disiplin);   // Z..AC
      row.commit && row.commit();
    });
  }

  // rows: baris penilaian_karyawan (sudah difilter periode); details: baris penilaian_detail
  // extra (opsional): { karyawan: { byId, byNik }, absensi: [baris hr_absensi periode tsb] }
  async function buildRekapWorkbook(ExcelJS, templateBuffer, periode, rows, details, extra) {
    extra = extra || {};
    const kar = extra.karyawan || { byId: {}, byNik: {} };
    const disiplin = hitungDisiplin(extra.absensi);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(templateBuffer);
    const detMap = {};
    (details || []).forEach(d => { (detMap[d.penilaian_id] = detMap[d.penilaian_id] || []).push(d); });
    const byTime = (a, b) => new Date(a.created_at) - new Date(b.created_at);
    const worker = rows.filter(r => r.tipe_form === 'WORKER').sort(byTime);
    const staff = rows.filter(r => r.tipe_form === 'B' || r.tipe_form === 'C').sort(byTime);
    const y = Number(periode);
    const cutoff = new Date(Date.UTC(y, 11, 31));
    const [s1, s2] = wb.worksheets;
    s1.getCell('A2').value = y; s1.getCell('H4').value = cutoff;
    s2.getCell('A2').value = y; s2.getCell('J4').value = cutoff;
    fillWorker(s1, worker, detMap, cutoff, kar, disiplin);
    fillStaff(s2, staff, detMap, cutoff, kar, disiplin);
    return { wb, jumlahWorker: worker.length, jumlahStaff: staff.length };
  }

  root.buildRekapWorkbook = buildRekapWorkbook;
  if (typeof module !== 'undefined') module.exports = { buildRekapWorkbook };
})(typeof window !== 'undefined' ? window : globalThis);
