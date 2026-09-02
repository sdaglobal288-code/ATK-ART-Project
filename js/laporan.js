// =====================================
// LAPORAN (RINGKASAN + GRAFIK + TABEL STOK)
// =====================================
//
// Semua data difilter berdasarkan gudang akun yang sedang login
// (user.gudang), konsisten dengan halaman Barang Masuk & Barang Keluar.
//
// SUMBER DATA:
// - barang_masuk (header) + barang_masuk_detail (item)  -> untuk tren masuk
// - barang_keluar (flat, 1 baris = 1 item keluar)         -> untuk tren keluar
//   & untuk grafik per departemen (kolom "departemen" per baris)
// - stok_gudang + master_barang                            -> untuk stok saat ini
//
// KHUSUS "Export Rekap ATK/ART (Semua Gudang)": laporan ini SENGAJA
// TIDAK difilter ke user.gudang, karena memang menggabungkan Raden Saleh
// & Margomulyo sekaligus (lihat bagian exportRekapATKART di bawah).
//
// CATATAN STATUS BARANG KELUAR: sama seperti halaman Barang Keluar
// (js/barang-keluar.js), SEMUA query ke tabel "barang_keluar" di file
// ini hanya mengambil baris berstatus "Disetujui" (atau baris lama yang
// belum punya kolom "status" sama sekali / NULL -> dianggap "Disetujui").
// Baris yang berasal dari Formulir Permintaan ATK/ART dan masih
// berstatus "Menunggu Approval" ataupun sudah "Ditolak" TIDAK dihitung
// di laporan ini (ringkasan, grafik, highlight, maupun Rekap ATK/ART),
// karena baris tersebut bukan transaksi keluar yang sah.
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

const NAMA_BULAN = [
    "Jan","Feb","Mar","Apr","Mei","Jun",
    "Jul","Agu","Sep","Okt","Nov","Des"
];

const PALET_WARNA = [
    "#60a5fa", "#4ade80", "#f87171", "#facc15",
    "#a78bfa", "#38bdf8", "#fb923c", "#f472b6",
    "#2dd4bf", "#94a3b8"
];

// instance Chart.js aktif, disimpan supaya bisa di-destroy sebelum render ulang
let chartTrenInstance = null;
let chartKategoriInstance = null;
let chartTopKeluarInstance = null;
let chartDepartemenInstance = null;

// cache master barang (untuk join kategori pada tabel stok)
let masterBarangList = [];

// =====================================
// HELPER TANGGAL
// =====================================

function getMonthKey(tanggalStr){

    // tanggalStr format "YYYY-MM-DD" -> ambil "YYYY-MM"
    return (tanggalStr || "").slice(0, 7);

}

function getMonthLabel(monthKey){

    const [tahun, bulan] = monthKey.split("-");

    const idxBulan = parseInt(bulan, 10) - 1;

    return `${NAMA_BULAN[idxBulan] || bulan} ${tahun}`;

}

function formatAngka(n){

    return (Number(n) || 0).toLocaleString("id-ID");

}

// =====================================
// LOAD MASTER BARANG (untuk join kategori di tabel stok)
// =====================================

async function loadMasterBarang(){

    try{

        const { data, error } = await supabaseClient
            .from("master_barang")
            .select("*");

        if(error) throw error;

        masterBarangList = data || [];

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

function findBarangById(id){

    return masterBarangList.find(b => String(b.id) === String(id));

}

// =====================================
// AMBIL DATA BARANG MASUK (HEADER + DETAIL) UNTUK PERIODE TERTENTU
// Mengembalikan array item flat: { tanggal, nama_barang, qty }
// =====================================

async function ambilItemMasukPeriode(tanggalDari, tanggalSampai){

    const { data: headers, error: hErr } = await supabaseClient
        .from("barang_masuk")
        .select("*")
        .eq("gudang", user.gudang)
        .gte("tanggal", tanggalDari)
        .lte("tanggal", tanggalSampai);

    if(hErr) throw hErr;

    if(!headers || headers.length === 0){

        return { items: [], totalTransaksi: 0 };

    }

    const ids = headers.map(h => h.id);

    const { data: details, error: dErr } = await supabaseClient
        .from("barang_masuk_detail")
        .select("*")
        .in("barang_masuk_id", ids);

    if(dErr) throw dErr;

    const headerMap = new Map();

    headers.forEach(h => headerMap.set(String(h.id), h));

    const items = (details || []).map(d => {

        const header = headerMap.get(String(d.barang_masuk_id));

        return {
            tanggal : header ? header.tanggal : null,
            nama_barang : d.nama_barang,
            qty : Number(d.qty) || 0
        };

    }).filter(it => it.tanggal !== null);

    return { items, totalTransaksi: headers.length };

}

// =====================================
// AMBIL DATA BARANG KELUAR UNTUK PERIODE TERTENTU
// Mengembalikan array item flat: { tanggal, nama_barang, qty, departemen }
//
// CATATAN: hanya baris berstatus "Disetujui" (atau NULL, baris lama
// sebelum kolom "status" ditambahkan) yang dihitung sebagai barang
// keluar yang sah. Baris "Menunggu Approval" dan "Ditolak" dari
// Formulir Permintaan ATK/ART sengaja dikecualikan, konsisten dengan
// halaman Barang Keluar (js/barang-keluar.js).
// =====================================

async function ambilItemKeluarPeriode(tanggalDari, tanggalSampai){

    const { data, error } = await supabaseClient
        .from("barang_keluar")
        .select("*")
        .eq("gudang", user.gudang)
        .or("status.is.null,status.eq.Disetujui")
        .gte("tanggal", tanggalDari)
        .lte("tanggal", tanggalSampai);

    if(error) throw error;

    const items = (data || []).map(d => ({
        tanggal : d.tanggal,
        nama_barang : d.nama_barang,
        qty : Number(d.qty) || 0,
        departemen : d.departemen || "Tanpa Departemen"
    }));

    return { items, totalTransaksi: (data || []).length };

}

// =====================================
// RENDER KARTU RINGKASAN
// =====================================

function renderRingkasan(ringkasan){

    const {
        totalTransaksiMasuk, totalQtyMasuk,
        totalTransaksiKeluar, totalQtyKeluar
    } = ringkasan;

    const selisih = totalQtyMasuk - totalQtyKeluar;
    const selisihClass = selisih >= 0 ? "selisih-positif" : "selisih-negatif";
    const selisihTanda = selisih >= 0 ? "+" : "";

    const grid = document.getElementById("summaryGrid");

    grid.innerHTML = `

        <div class="summary-card">
            <div class="label">Transaksi Barang Masuk</div>
            <div class="value">${formatAngka(totalTransaksiMasuk)}</div>
            <div class="sub">jumlah BTB pada periode ini</div>
        </div>

        <div class="summary-card">
            <div class="label">Qty Barang Masuk</div>
            <div class="value masuk">+${formatAngka(totalQtyMasuk)}</div>
            <div class="sub">total unit masuk</div>
        </div>

        <div class="summary-card">
            <div class="label">Transaksi Barang Keluar</div>
            <div class="value">${formatAngka(totalTransaksiKeluar)}</div>
            <div class="sub">jumlah transaksi pada periode ini</div>
        </div>

        <div class="summary-card">
            <div class="label">Qty Barang Keluar</div>
            <div class="value keluar">-${formatAngka(totalQtyKeluar)}</div>
            <div class="sub">total unit keluar</div>
        </div>

        <div class="summary-card">
            <div class="label">Selisih (Masuk - Keluar)</div>
            <div class="value ${selisihClass}">${selisihTanda}${formatAngka(selisih)}</div>
            <div class="sub">pergerakan stok bersih periode ini</div>
        </div>

    `;

}

// =====================================
// RENDER GRAFIK TREN MASUK VS KELUAR PER BULAN
// =====================================

function renderChartTren(itemsMasuk, itemsKeluar){

    const masukPerBulan = new Map();
    const keluarPerBulan = new Map();

    itemsMasuk.forEach(it => {

        const key = getMonthKey(it.tanggal);

        masukPerBulan.set(key, (masukPerBulan.get(key) || 0) + it.qty);

    });

    itemsKeluar.forEach(it => {

        const key = getMonthKey(it.tanggal);

        keluarPerBulan.set(key, (keluarPerBulan.get(key) || 0) + it.qty);

    });

    const semuaBulan = Array.from(
        new Set([...masukPerBulan.keys(), ...keluarPerBulan.keys()])
    ).sort();

    const labels = semuaBulan.map(getMonthLabel);
    const dataMasuk = semuaBulan.map(b => masukPerBulan.get(b) || 0);
    const dataKeluar = semuaBulan.map(b => keluarPerBulan.get(b) || 0);

    const canvasTren = document.getElementById("chartTren");

    if(!canvasTren){
        console.error("Elemen #chartTren tidak ditemukan di halaman.");
        return;
    }

    const ctx = canvasTren.getContext("2d");

    if(chartTrenInstance) chartTrenInstance.destroy();

    if(semuaBulan.length === 0){

        chartTrenInstance = null;
        return;

    }

    chartTrenInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Barang Masuk",
                    data: dataMasuk,
                    backgroundColor: "rgba(74, 222, 128, .55)",
                    borderColor: "rgba(74, 222, 128, 1)",
                    borderWidth: 1,
                    borderRadius: 6
                },
                {
                    label: "Barang Keluar",
                    data: dataKeluar,
                    backgroundColor: "rgba(248, 113, 113, .55)",
                    borderColor: "rgba(248, 113, 113, 1)",
                    borderWidth: 1,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: "#e2e8f0" }
                }
            },
            scales: {
                x: {
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(148,163,184,.1)" }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(148,163,184,.1)" }
                }
            }
        }
    });

}

// =====================================
// RENDER GRAFIK DISTRIBUSI STOK PER KATEGORI
// =====================================

function renderChartKategori(stokRows){

    const stokPerKategori = new Map();

    stokRows.forEach(row => {

        const kategori = row.kategori || "Tanpa Kategori";

        stokPerKategori.set(
            kategori,
            (stokPerKategori.get(kategori) || 0) + row.stok
        );

    });

    const labels = Array.from(stokPerKategori.keys());
    const data = Array.from(stokPerKategori.values());

    const canvasKategori = document.getElementById("chartKategori");

    if(!canvasKategori){
        console.error("Elemen #chartKategori tidak ditemukan di halaman.");
        return;
    }

    const ctx = canvasKategori.getContext("2d");

    if(chartKategoriInstance) chartKategoriInstance.destroy();

    if(labels.length === 0){

        chartKategoriInstance = null;
        return;

    }

    chartKategoriInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: labels.map((_, i) => PALET_WARNA[i % PALET_WARNA.length]),
                borderColor: "#0f172a",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { color: "#e2e8f0", boxWidth: 12, padding: 12 }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx){
                            const total = ctx.dataset.data.reduce((a,b)=>a+b, 0);
                            const persen = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                            return `${ctx.label}: ${formatAngka(ctx.parsed)} (${persen}%)`;
                        }
                    }
                }
            }
        }
    });

}

// =====================================
// RENDER GRAFIK BARANG KELUAR TERBANYAK (SEMUA BARANG, TIDAK DIBATASI)
// =====================================

function renderChartTopKeluar(itemsKeluar){

    const qtyPerBarang = new Map();

    itemsKeluar.forEach(it => {

        qtyPerBarang.set(
            it.nama_barang,
            (qtyPerBarang.get(it.nama_barang) || 0) + it.qty
        );

    });

    const semuaBarang = Array.from(qtyPerBarang.entries())
        .sort((a, b) => b[1] - a[1]);

    const labels = semuaBarang.map(t => t[0]);
    const data = semuaBarang.map(t => t[1]);
    const totalKeseluruhan = data.reduce((a, b) => a + b, 0);

    // cari departemen dengan qty terbanyak untuk masing-masing barang,
    // supaya bisa ditampilkan di tooltip ("diambil paling banyak oleh...")
    const deptPerBarang = new Map();

    itemsKeluar.forEach(it => {

        if(!deptPerBarang.has(it.nama_barang)){
            deptPerBarang.set(it.nama_barang, new Map());
        }

        const inner = deptPerBarang.get(it.nama_barang);

        inner.set(it.departemen, (inner.get(it.departemen) || 0) + it.qty);

    });

    const topDeptPerBarang = new Map();

    deptPerBarang.forEach((deptMap, barang) => {

        const top = Array.from(deptMap.entries())
            .sort((a, b) => b[1] - a[1])[0];

        topDeptPerBarang.set(barang, { departemen: top[0], qty: top[1] });

    });

    // sesuaikan tinggi canvas mengikuti jumlah barang, supaya tidak
    // terlalu padat kalau barangnya banyak (tidak dibatasi 5 lagi)
    const canvasTopKeluar = document.getElementById("chartTopKeluar");
    const wrap = canvasTopKeluar ? canvasTopKeluar.closest(".chart-canvas-wrap") : null;

    if(wrap){
        const tinggi = Math.max(280, labels.length * 26);
        wrap.style.height = `${tinggi}px`;
    }

    if(!canvasTopKeluar){
        console.error("Elemen #chartTopKeluar tidak ditemukan di halaman.");
        return;
    }

    const ctx = canvasTopKeluar.getContext("2d");

    if(chartTopKeluarInstance) chartTopKeluarInstance.destroy();

    if(labels.length === 0){

        chartTopKeluarInstance = null;
        return;

    }

    chartTopKeluarInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Qty Keluar",
                data,
                backgroundColor: "rgba(96, 165, 250, .55)",
                borderColor: "rgba(96, 165, 250, 1)",
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(ctx){

                            const persen = totalKeseluruhan > 0
                                ? ((ctx.parsed.x / totalKeseluruhan) * 100).toFixed(1)
                                : 0;

                            const baris1 = `Qty: ${formatAngka(ctx.parsed.x)} (${persen}% dari total keluar)`;

                            const namaBarang = ctx.label;
                            const infoDept = topDeptPerBarang.get(namaBarang);

                            if(!infoDept){
                                return baris1;
                            }

                            const persenDept = ctx.parsed.x > 0
                                ? ((infoDept.qty / ctx.parsed.x) * 100).toFixed(1)
                                : 0;

                            const baris2 = `Diambil paling banyak oleh: ${infoDept.departemen} (${formatAngka(infoDept.qty)} unit, ${persenDept}%)`;

                            return [baris1, baris2];

                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(148,163,184,.1)" }
                },
                y: {
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(148,163,184,.1)" }
                }
            }
        }
    });

}

// =====================================
// RENDER GRAFIK TOTAL QTY KELUAR PER DEPARTEMEN
// =====================================

function renderChartDepartemen(itemsKeluar){

    const qtyPerDept = new Map();

    itemsKeluar.forEach(it => {

        qtyPerDept.set(
            it.departemen,
            (qtyPerDept.get(it.departemen) || 0) + it.qty
        );

    });

    const sorted = Array.from(qtyPerDept.entries())
        .sort((a, b) => b[1] - a[1]);

    const labels = sorted.map(s => s[0]);
    const data = sorted.map(s => s[1]);
    const totalKeseluruhan = data.reduce((a, b) => a + b, 0);

    const canvasDepartemen = document.getElementById("chartDepartemen");

    if(!canvasDepartemen){
        console.error("Elemen #chartDepartemen tidak ditemukan di halaman.");
        return;
    }

    const ctx = canvasDepartemen.getContext("2d");

    if(chartDepartemenInstance) chartDepartemenInstance.destroy();

    if(labels.length === 0){

        chartDepartemenInstance = null;
        return;

    }

    // Plugin kecil (khusus dipakai di chart ini saja, tidak didaftarkan
    // secara global) untuk menampilkan label persentase di atas tiap batang.
    const labelPersenDiAtasBatang = {
        id: "labelPersenDiAtasBatang",
        afterDatasetsDraw(chart){

            const { ctx } = chart;

            chart.data.datasets.forEach((dataset, datasetIndex) => {

                const meta = chart.getDatasetMeta(datasetIndex);

                meta.data.forEach((bar, index) => {

                    const nilai = dataset.data[index];

                    const persen = totalKeseluruhan > 0
                        ? ((nilai / totalKeseluruhan) * 100).toFixed(1)
                        : 0;

                    ctx.save();
                    ctx.fillStyle = "#e2e8f0";
                    ctx.font = "700 12px Inter, sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "bottom";
                    ctx.fillText(`${persen}%`, bar.x, bar.y - 6);
                    ctx.restore();

                });

            });

        }
    };

    chartDepartemenInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Qty Keluar",
                data,
                backgroundColor: labels.map((_, i) => PALET_WARNA[i % PALET_WARNA.length] + "cc"),
                borderColor: labels.map((_, i) => PALET_WARNA[i % PALET_WARNA.length]),
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        plugins: [labelPersenDiAtasBatang],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 22 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(ctx){
                            const persen = totalKeseluruhan > 0
                                ? ((ctx.parsed.y / totalKeseluruhan) * 100).toFixed(1)
                                : 0;
                            return `Qty: ${formatAngka(ctx.parsed.y)} (${persen}% dari total keluar)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(148,163,184,.1)" }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(148,163,184,.1)" }
                }
            }
        }
    });

}

// =====================================
// HIGHLIGHT: KOMBINASI BARANG + DEPARTEMEN DENGAN QTY TERTINGGI
// =====================================

function renderHighlightDepartemen(itemsKeluar){

    const box = document.getElementById("highlightDepartemen");

    if(!box) return;

    if(itemsKeluar.length === 0){

        box.innerHTML = "Tidak ada data Barang Keluar pada periode ini.";
        return;

    }

    const totalQtyKeseluruhan = itemsKeluar.reduce((s, it) => s + it.qty, 0);

    // qty per departemen (untuk departemen dengan pengeluaran terbanyak)
    const qtyPerDept = new Map();

    itemsKeluar.forEach(it => {
        qtyPerDept.set(it.departemen, (qtyPerDept.get(it.departemen) || 0) + it.qty);
    });

    const topDeptEntry = Array.from(qtyPerDept.entries())
        .sort((a, b) => b[1] - a[1])[0];

    const persenDept = totalQtyKeseluruhan > 0
        ? ((topDeptEntry[1] / totalQtyKeseluruhan) * 100).toFixed(1)
        : 0;

    // kombinasi barang+departemen dengan qty tertinggi
    const qtyPerBarangDept = new Map();

    itemsKeluar.forEach(it => {

        const key = `${it.nama_barang}||${it.departemen}`;

        qtyPerBarangDept.set(key, (qtyPerBarangDept.get(key) || 0) + it.qty);

    });

    const topComboEntry = Array.from(qtyPerBarangDept.entries())
        .sort((a, b) => b[1] - a[1])[0];

    const [comboBarang, comboDept] = topComboEntry[0].split("||");
    const comboQty = topComboEntry[1];

    // total qty barang ini (di semua departemen) -> persentase kontribusi departemen tsb
    const totalQtyBarangIni = itemsKeluar
        .filter(it => it.nama_barang === comboBarang)
        .reduce((s, it) => s + it.qty, 0);

    const persenCombo = totalQtyBarangIni > 0
        ? ((comboQty / totalQtyBarangIni) * 100).toFixed(1)
        : 0;

    box.innerHTML = `
        🏢 Departemen dengan pengeluaran barang terbanyak: <b>${topDeptEntry[0]}</b>
        (total ${formatAngka(topDeptEntry[1])} unit, <b>${persenDept}%</b> dari seluruh pengeluaran periode ini).
        <br>
        📦 Barang yang paling banyak diambil: <b>${comboBarang}</b>,
        paling sering diambil oleh departemen <b>${comboDept}</b>
        (${formatAngka(comboQty)} unit, <b>${persenCombo}%</b> dari total barang ini yang keluar).
    `;

}

// =====================================
// AMBIL DATA STOK SAAT INI (dipakai untuk grafik distribusi kategori;
// tabel "Stok Barang Saat Ini" sudah dihapus dari halaman ini)
// =====================================

let stokRowsCache = [];

async function loadTabelStok(){

    try{

        const { data, error } = await supabaseClient
            .from("stok_gudang")
            .select("barang_id, stok")
            .eq("gudang", user.gudang);

        if(error) throw error;

        stokRowsCache = (data || []).map(row => {

            const barang = findBarangById(row.barang_id);

            return {
                kode_barang : barang ? barang.kode_barang : "-",
                nama_barang : barang ? barang.nama_barang : "(barang tidak ditemukan)",
                kategori : barang ? barang.kategori : "-",
                satuan : barang ? barang.satuan : "-",
                stok : Number(row.stok) || 0
            };

        }).sort((a, b) => a.nama_barang.localeCompare(b.nama_barang));

        renderChartKategori(stokRowsCache);

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// MUAT SELURUH LAPORAN (ringkasan + grafik) UNTUK PERIODE TERPILIH
// =====================================

let laporanTerakhir = {
    itemsMasuk: [],
    itemsKeluar: [],
    ringkasan: null,
    tanggalDari: "",
    tanggalSampai: ""
};

async function muatLaporan(){

    try{

        const tanggalDari = document.getElementById("filterDari").value;
        const tanggalSampai = document.getElementById("filterSampai").value;

        if(!tanggalDari || !tanggalSampai){

            alert("Tanggal Dari dan Tanggal Sampai wajib diisi.");
            return;

        }

        if(tanggalDari > tanggalSampai){

            alert("Tanggal Dari tidak boleh lebih besar dari Tanggal Sampai.");
            return;

        }

        const [masukResult, keluarResult] = await Promise.all([
            ambilItemMasukPeriode(tanggalDari, tanggalSampai),
            ambilItemKeluarPeriode(tanggalDari, tanggalSampai)
        ]);

        const totalQtyMasuk = masukResult.items.reduce((s, it) => s + it.qty, 0);
        const totalQtyKeluar = keluarResult.items.reduce((s, it) => s + it.qty, 0);

        const ringkasan = {
            totalTransaksiMasuk : masukResult.totalTransaksi,
            totalQtyMasuk,
            totalTransaksiKeluar : keluarResult.totalTransaksi,
            totalQtyKeluar
        };

        renderRingkasan(ringkasan);
        renderChartTren(masukResult.items, keluarResult.items);
        renderChartTopKeluar(keluarResult.items);
        renderChartDepartemen(keluarResult.items);
        renderHighlightDepartemen(keluarResult.items);

        laporanTerakhir = {
            itemsMasuk : masukResult.items,
            itemsKeluar : keluarResult.items,
            ringkasan,
            tanggalDari,
            tanggalSampai
        };

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

const btnTerapkanFilterEl = document.getElementById("btnTerapkanFilter");

if(btnTerapkanFilterEl){

    btnTerapkanFilterEl.addEventListener("click", muatLaporan);

}

// =====================================
// EXPORT LAPORAN EXCEL (Ringkasan + Tren Bulanan + Per Departemen + Stok Saat Ini)
// =====================================

async function exportLaporanExcel(){

    try{

        if(typeof XLSX === "undefined"){

            alert("Library Excel belum termuat, silakan refresh halaman lalu coba lagi.");
            return;

        }

        if(!laporanTerakhir.ringkasan){

            alert("Terapkan filter periode terlebih dahulu sebelum export.");
            return;

        }

        const { ringkasan, itemsMasuk, itemsKeluar, tanggalDari, tanggalSampai } = laporanTerakhir;

        // ---------- SHEET 1: RINGKASAN ----------

        const selisih = ringkasan.totalQtyMasuk - ringkasan.totalQtyKeluar;

        const ringkasanRows = [
            { "Keterangan": "Periode Dari", "Nilai": tanggalDari },
            { "Keterangan": "Periode Sampai", "Nilai": tanggalSampai },
            { "Keterangan": "Gudang", "Nilai": user.gudang },
            { "Keterangan": "Transaksi Barang Masuk", "Nilai": ringkasan.totalTransaksiMasuk },
            { "Keterangan": "Qty Barang Masuk", "Nilai": ringkasan.totalQtyMasuk },
            { "Keterangan": "Transaksi Barang Keluar", "Nilai": ringkasan.totalTransaksiKeluar },
            { "Keterangan": "Qty Barang Keluar", "Nilai": ringkasan.totalQtyKeluar },
            { "Keterangan": "Selisih (Masuk - Keluar)", "Nilai": selisih }
        ];

        // ---------- SHEET 2: TREN PER BULAN ----------

        const masukPerBulan = new Map();
        const keluarPerBulan = new Map();

        itemsMasuk.forEach(it => {
            const key = getMonthKey(it.tanggal);
            masukPerBulan.set(key, (masukPerBulan.get(key) || 0) + it.qty);
        });

        itemsKeluar.forEach(it => {
            const key = getMonthKey(it.tanggal);
            keluarPerBulan.set(key, (keluarPerBulan.get(key) || 0) + it.qty);
        });

        const semuaBulan = Array.from(
            new Set([...masukPerBulan.keys(), ...keluarPerBulan.keys()])
        ).sort();

        const trenRows = semuaBulan.map(key => ({
            "Bulan": getMonthLabel(key),
            "Qty Masuk": masukPerBulan.get(key) || 0,
            "Qty Keluar": keluarPerBulan.get(key) || 0
        }));

        // ---------- SHEET 3: PENGELUARAN PER DEPARTEMEN ----------

        const qtyPerDept = new Map();

        itemsKeluar.forEach(it => {
            qtyPerDept.set(it.departemen, (qtyPerDept.get(it.departemen) || 0) + it.qty);
        });

        const totalQtyKeluarSemua = itemsKeluar.reduce((s, it) => s + it.qty, 0);

        const departemenRows = Array.from(qtyPerDept.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([dept, qty]) => ({
                "Departemen": dept,
                "Qty Keluar": qty,
                "Persentase": totalQtyKeluarSemua > 0
                    ? `${((qty / totalQtyKeluarSemua) * 100).toFixed(1)}%`
                    : "0%"
            }));

        // ---------- SHEET 4: TOP BARANG PER DEPARTEMEN (KOMBINASI) ----------

        const qtyPerBarangDept = new Map();
        const qtyPerBarangTotal = new Map();

        itemsKeluar.forEach(it => {

            const key = `${it.nama_barang}||${it.departemen}`;

            qtyPerBarangDept.set(key, (qtyPerBarangDept.get(key) || 0) + it.qty);

            qtyPerBarangTotal.set(
                it.nama_barang,
                (qtyPerBarangTotal.get(it.nama_barang) || 0) + it.qty
            );

        });

        const barangDeptRows = Array.from(qtyPerBarangDept.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([key, qty]) => {

                const [barang, dept] = key.split("||");

                const totalBarangIni = qtyPerBarangTotal.get(barang) || 0;

                return {
                    "Nama Barang": barang,
                    "Departemen": dept,
                    "Qty Keluar": qty,
                    "Persentase dari Barang Ini": totalBarangIni > 0
                        ? `${((qty / totalBarangIni) * 100).toFixed(1)}%`
                        : "0%"
                };

            });

        // ---------- SHEET 5: STOK SAAT INI ----------

        const stokRows = stokRowsCache.map(r => ({
            "Kode Barang": r.kode_barang,
            "Nama Barang": r.nama_barang,
            "Kategori": r.kategori,
            "Satuan": r.satuan,
            "Stok": r.stok
        }));

        // ---------- SUSUN WORKBOOK ----------

        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            wb, XLSX.utils.json_to_sheet(ringkasanRows), "Ringkasan"
        );

        XLSX.utils.book_append_sheet(
            wb, XLSX.utils.json_to_sheet(trenRows), "Tren Bulanan"
        );

        XLSX.utils.book_append_sheet(
            wb, XLSX.utils.json_to_sheet(departemenRows), "Per Departemen"
        );

        XLSX.utils.book_append_sheet(
            wb, XLSX.utils.json_to_sheet(barangDeptRows), "Barang per Departemen"
        );

        XLSX.utils.book_append_sheet(
            wb, XLSX.utils.json_to_sheet(stokRows), "Stok Saat Ini"
        );

        const tanggalFile = new Date().toISOString().split("T")[0];
        const namaFile = `Laporan-${user.gudang}-${tanggalFile}.xlsx`;

        XLSX.writeFile(wb, namaFile);

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

const btnExportLaporanEl = document.getElementById("btnExportLaporan");

if(btnExportLaporanEl){

    btnExportLaporanEl.addEventListener("click", exportLaporanExcel);

}

// =====================================
// EXPORT REKAP ATK/ART (SEMUA GUDANG DIGABUNG)
// =====================================
// Format mengikuti contoh:
//
//              REKAPAN PENGELUARAN ATK/ART SDA GLOBAL
//   PERIODE   : 01-30 JUNI 2026
//   NAMA BARANG | RADEN SALEH | MARGOMULYO | JUMLAH QTY | HARGA | JUMLAH HARGA
//   TOTAL       | <jumlah RS> | <jumlah MG>| <jumlah>   |       | <jumlah>
//
// CATATAN: kolom HARGA diambil dari master_barang.harga. Kalau kolom
// "harga" belum ada di tabel master_barang, nilainya akan tampil 0 -
// tambahkan kolom "harga" (angka) di tabel master_barang dulu supaya
// kolom HARGA & JUMLAH HARGA di laporan ini terisi benar.
//
// Laporan ini menggabungkan data dari SEMUA gudang (Raden Saleh +
// Margomulyo), berbeda dengan laporan lain di halaman ini yang
// selalu difilter khusus gudang yang sedang login.
//
// CATATAN STATUS: seperti seluruh laporan lain di file ini, rekap ini
// hanya menghitung baris "barang_keluar" berstatus "Disetujui" (atau
// NULL untuk baris lama). Baris "Menunggu Approval" / "Ditolak" dari
// Formulir Permintaan ATK/ART tidak dihitung, baik di sheet rekap
// gabungan maupun sheet histori per gudang.
//
// FILE INI TERDIRI DARI 5 SHEET:
//   1. "Rekap ATK-ART"                  -> rekap gabungan (format contoh)
//   2. "Histori Keluar - Raden Saleh"   -> histori Barang Keluar Raden
//                                          Saleh sesuai filter tanggal
//   3. "Histori Keluar - Margomulyo"    -> histori Barang Keluar
//                                          Margomulyo sesuai filter tanggal
//   4. "Stok Saat Ini - Raden Saleh"    -> stok REALTIME (saat export
//                                          dijalankan) gudang Raden Saleh,
//                                          TIDAK dipengaruhi filter tanggal
//   5. "Stok Saat Ini - Margomulyo"     -> stok REALTIME (saat export
//                                          dijalankan) gudang Margomulyo,
//                                          TIDAK dipengaruhi filter tanggal
// =====================================

const NAMA_BULAN_PANJANG = [
    "JANUARI","FEBRUARI","MARET","APRIL","MEI","JUNI",
    "JULI","AGUSTUS","SEPTEMBER","OKTOBER","NOVEMBER","DESEMBER"
];

function formatPeriodeRekap(tanggalDari, tanggalSampai){

    const [yD, mD, dD] = tanggalDari.split("-").map(Number);
    const [yS, mS, dS] = tanggalSampai.split("-").map(Number);

    const namaBulanDari = NAMA_BULAN_PANJANG[mD - 1];
    const namaBulanSampai = NAMA_BULAN_PANJANG[mS - 1];

    if(yD === yS && mD === mS){

        // contoh: 01-30 JUNI 2026
        return `${String(dD).padStart(2,"0")}-${String(dS).padStart(2,"0")} ${namaBulanDari} ${yD}`;

    }

    // beda bulan/tahun -> tampilkan lengkap dua-duanya
    return `${String(dD).padStart(2,"0")} ${namaBulanDari} ${yD} - ${String(dS).padStart(2,"0")} ${namaBulanSampai} ${yS}`;

}

async function ambilItemKeluarSemuaGudang(tanggalDari, tanggalSampai){

    // TIDAK difilter .eq("gudang", ...) karena laporan ini memang
    // menggabungkan seluruh gudang, beda dari fungsi lain di halaman ini.
    // Tetap difilter status "Disetujui"/NULL supaya permintaan yang
    // masih menunggu approval atau sudah ditolak tidak ikut terhitung.
    const { data, error } = await supabaseClient
        .from("barang_keluar")
        .select("*")
        .or("status.is.null,status.eq.Disetujui")
        .gte("tanggal", tanggalDari)
        .lte("tanggal", tanggalSampai);

    if(error) throw error;

    return (data || []).map(d => ({
        nama_barang : d.nama_barang,
        kode_barang : d.kode_barang,
        gudang : d.gudang || "-",
        qty : Number(d.qty) || 0
    }));

}

// =====================================
// AMBIL HISTORI BARANG KELUAR LENGKAP UNTUK SATU GUDANG TERTENTU
// (dipakai untuk sheet "Histori Keluar - <gudang>")
// =====================================

async function ambilHistoriKeluarLengkapPerGudang(gudang, tanggalDari, tanggalSampai){

    const { data, error } = await supabaseClient
        .from("barang_keluar")
        .select("*")
        .eq("gudang", gudang)
        .or("status.is.null,status.eq.Disetujui")
        .gte("tanggal", tanggalDari)
        .lte("tanggal", tanggalSampai)
        .order("tanggal", { ascending: true })
        .order("id", { ascending: true });

    if(error) throw error;

    return (data || []).map(item => ({
        "Tanggal": item.tanggal,
        "NIK": item.nik,
        "Nama Pengambil": item.nama_pengambil,
        "Departemen": item.departemen,
        "Jabatan": item.jabatan,
        "Kode Barang": item.kode_barang,
        "Nama Barang": item.nama_barang,
        "Kategori": item.kategori,
        "Satuan": item.satuan,
        "Qty": item.qty,
        "Keterangan": item.keterangan || "",
        "Created By": item.created_by
    }));

}

// =====================================
// AMBIL STOK REALTIME UNTUK SATU GUDANG TERTENTU
// (dipakai untuk sheet "Stok Saat Ini - <gudang>")
// Diambil langsung dari stok_gudang PADA SAAT export dijalankan, jadi
// selalu mencerminkan angka realtime, TIDAK dipengaruhi filter tanggal.
// =====================================

async function ambilStokRealtimePerGudang(gudang){

    const { data, error } = await supabaseClient
        .from("stok_gudang")
        .select("barang_id, stok")
        .eq("gudang", gudang);

    if(error) throw error;

    // pastikan master_barang sudah termuat untuk join kode/nama/kategori/satuan
    if(masterBarangList.length === 0){

        await loadMasterBarang();

    }

    return (data || [])
        .map(row => {

            const barang = findBarangById(row.barang_id);

            return {
                "Kode Barang": barang ? barang.kode_barang : "-",
                "Nama Barang": barang ? barang.nama_barang : "(barang tidak ditemukan)",
                "Kategori": barang ? barang.kategori : "-",
                "Satuan": barang ? barang.satuan : "-",
                "Stok": Number(row.stok) || 0
            };

        })
        .sort((a, b) => a["Nama Barang"].localeCompare(b["Nama Barang"]));

}

async function exportRekapATKART(){

    try{

        if(typeof XLSX === "undefined"){

            alert("Library Excel belum termuat, silakan refresh halaman lalu coba lagi.");
            return;

        }

        const tanggalDari = document.getElementById("filterDari").value;
        const tanggalSampai = document.getElementById("filterSampai").value;

        if(!tanggalDari || !tanggalSampai){

            alert("Isi dulu Dari Tanggal dan Sampai Tanggal di atas.");
            return;

        }

        if(tanggalDari > tanggalSampai){

            alert("Tanggal Dari tidak boleh lebih besar dari Tanggal Sampai.");
            return;

        }

        const items = await ambilItemKeluarSemuaGudang(tanggalDari, tanggalSampai);

        if(items.length === 0){

            alert("Tidak ada data Barang Keluar pada rentang tanggal tersebut (semua gudang).");
            return;

        }

        // pastikan master_barang sudah termuat (untuk kode_barang -> harga)
        if(masterBarangList.length === 0){

            await loadMasterBarang();

        }

        // rekap per nama_barang: qty per gudang + total
        const rekapMap = new Map();

        items.forEach(it => {

            if(!rekapMap.has(it.nama_barang)){

                rekapMap.set(it.nama_barang, {
                    nama_barang: it.nama_barang,
                    kode_barang: it.kode_barang,
                    per_gudang: new Map()
                });

            }

            const entri = rekapMap.get(it.nama_barang);

            entri.per_gudang.set(
                it.gudang,
                (entri.per_gudang.get(it.gudang) || 0) + it.qty
            );

        });

        const daftarGudangDitemukan = Array.from(
            new Set(items.map(it => it.gudang))
        );

        // urutan kolom gudang: prioritaskan "Raden Saleh" & "Margomulyo" dulu
        // (sesuai format contoh), lalu gudang lain (kalau ada) menyusul.
        const urutanUtama = ["Raden Saleh", "Margomulyo"];

        const kolomGudang = [
            ...urutanUtama.filter(g => daftarGudangDitemukan.includes(g)),
            ...daftarGudangDitemukan.filter(g => !urutanUtama.includes(g)).sort()
        ];

        const dataRekap = Array.from(rekapMap.values())
            .sort((a, b) => a.nama_barang.localeCompare(b.nama_barang));

        // ---------- SUSUN BARIS EXCEL (array of array, biar bisa merge cell) ----------

        const periodeText = formatPeriodeRekap(tanggalDari, tanggalSampai);

        const aoa = [];

        // baris 1: judul (nanti di-merge full lebar)
        const totalKolom = 1 + kolomGudang.length + 3;
        const barisJudul = new Array(totalKolom).fill("");
        barisJudul[0] = "REKAPAN PENGELUARAN ATK/ART SDA GLOBAL";
        aoa.push(barisJudul);

        // baris 2: PERIODE
        const barisPeriode = new Array(totalKolom).fill("");
        barisPeriode[0] = "PERIODE";
        barisPeriode[1] = `: ${periodeText}`;
        aoa.push(barisPeriode);

        // baris 3: header kolom
        const barisHeader = [
            "NAMA BARANG",
            ...kolomGudang.map(g => g.toUpperCase()),
            "JUMLAH QTY",
            "HARGA",
            "JUMLAH HARGA"
        ];
        aoa.push(barisHeader);

        // baris data
        dataRekap.forEach(entri => {

            const barangMaster = masterBarangList.find(
                b => b.kode_barang === entri.kode_barang
            );

            const harga = Number(barangMaster?.harga) || 0;

            const qtyPerGudang = kolomGudang.map(g => entri.per_gudang.get(g) || 0);

            const jumlahQty = qtyPerGudang.reduce((a, b) => a + b, 0);

            const jumlahHarga = jumlahQty * harga;

            aoa.push([
                entri.nama_barang,
                ...qtyPerGudang,
                jumlahQty,
                harga,
                jumlahHarga
            ]);

        });

        // ---------- BARIS TOTAL (sekarang ikut menjumlah tiap kolom gudang) ----------

        const totalPerGudangArr = kolomGudang.map(g =>
            dataRekap.reduce(
                (sum, entri) => sum + (entri.per_gudang.get(g) || 0),
                0
            )
        );

        const totalSemuaQty = totalPerGudangArr.reduce((a, b) => a + b, 0);

        const totalSemuaHarga = dataRekap.reduce((sum, entri) => {

            const barangMaster = masterBarangList.find(
                b => b.kode_barang === entri.kode_barang
            );

            const harga = Number(barangMaster?.harga) || 0;
            const qtyPerGudang = kolomGudang.map(g => entri.per_gudang.get(g) || 0);
            const jumlahQty = qtyPerGudang.reduce((a, b) => a + b, 0);

            return sum + (jumlahQty * harga);

        }, 0);

        const barisTotal = new Array(totalKolom).fill("");
        barisTotal[0] = "TOTAL";

        kolomGudang.forEach((g, idx) => {
            barisTotal[1 + idx] = totalPerGudangArr[idx];
        });

        barisTotal[totalKolom - 3] = totalSemuaQty;
        barisTotal[totalKolom - 1] = totalSemuaHarga;
        aoa.push(barisTotal);

        // ---------- BUAT SHEET 1: REKAP GABUNGAN ----------

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // merge judul & periode (baris 1 & 2) selebar seluruh kolom
        ws["!merges"] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: totalKolom - 1 } },
            { s: { r: 1, c: 1 }, e: { r: 1, c: totalKolom - 1 } }
        ];

        // lebar kolom
        ws["!cols"] = [
            { wch: 30 },
            ...kolomGudang.map(() => ({ wch: 14 })),
            { wch: 12 },
            { wch: 14 },
            { wch: 16 }
        ];

        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(wb, ws, "Rekap ATK-ART");

        // ---------- SHEET 2 & 3: HISTORI KELUAR PER GUDANG ----------

        const [historiRadenSaleh, historiMargomulyo] = await Promise.all([
            ambilHistoriKeluarLengkapPerGudang("Raden Saleh", tanggalDari, tanggalSampai),
            ambilHistoriKeluarLengkapPerGudang("Margomulyo", tanggalDari, tanggalSampai)
        ]);

        const wsHistoriRS = XLSX.utils.json_to_sheet(historiRadenSaleh);
        wsHistoriRS["!cols"] = [
            {wch:12}, {wch:14}, {wch:22}, {wch:18}, {wch:16},
            {wch:14}, {wch:26}, {wch:16}, {wch:10}, {wch:8},
            {wch:24}, {wch:18}
        ];
        XLSX.utils.book_append_sheet(wb, wsHistoriRS, "Histori Keluar - Raden Saleh");

        const wsHistoriMG = XLSX.utils.json_to_sheet(historiMargomulyo);
        wsHistoriMG["!cols"] = [
            {wch:12}, {wch:14}, {wch:22}, {wch:18}, {wch:16},
            {wch:14}, {wch:26}, {wch:16}, {wch:10}, {wch:8},
            {wch:24}, {wch:18}
        ];
        XLSX.utils.book_append_sheet(wb, wsHistoriMG, "Histori Keluar - Margomulyo");

        // ---------- SHEET 4 & 5: STOK REALTIME PER GUDANG ----------
        // (diambil saat export dijalankan, TIDAK dipengaruhi filter tanggal)

        const [stokRadenSaleh, stokMargomulyo] = await Promise.all([
            ambilStokRealtimePerGudang("Raden Saleh"),
            ambilStokRealtimePerGudang("Margomulyo")
        ]);

        const wsStokRS = XLSX.utils.json_to_sheet(stokRadenSaleh);
        wsStokRS["!cols"] = [
            {wch:14}, {wch:30}, {wch:18}, {wch:12}, {wch:10}
        ];
        XLSX.utils.book_append_sheet(wb, wsStokRS, "Stok Saat Ini - Raden Saleh");

        const wsStokMG = XLSX.utils.json_to_sheet(stokMargomulyo);
        wsStokMG["!cols"] = [
            {wch:14}, {wch:30}, {wch:18}, {wch:12}, {wch:10}
        ];
        XLSX.utils.book_append_sheet(wb, wsStokMG, "Stok Saat Ini - Margomulyo");

        // ---------- SIMPAN FILE ----------

        const namaFile = `Rekap-Pengeluaran-ATK-ART-${tanggalDari}_sd_${tanggalSampai}.xlsx`;

        XLSX.writeFile(wb, namaFile);

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

const btnExportRekapATKEl = document.getElementById("btnExportRekapATK");

if(btnExportRekapATKEl){

    btnExportRekapATKEl.addEventListener("click", exportRekapATKART);

}

// =====================================
// LOAD AWAL
// =====================================

function tanggalHariIni(){

    return new Date().toISOString().split("T")[0];

}

function tanggalAwalBulanIni(){

    const now = new Date();

    const awal = new Date(now.getFullYear(), now.getMonth(), 1);

    return awal.toISOString().split("T")[0];

}

document.addEventListener("DOMContentLoaded", async () => {

    document.getElementById("filterDari").value = tanggalAwalBulanIni();
    document.getElementById("filterSampai").value = tanggalHariIni();

    await loadMasterBarang();

    await loadTabelStok();

    await muatLaporan();

});
