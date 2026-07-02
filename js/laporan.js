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
// - stok_gudang + master_barang                            -> untuk stok saat ini
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

const NAMA_BULAN = [
    "Jan","Feb","Mar","Apr","Mei","Jun",
    "Jul","Agu","Sep","Okt","Nov","Des"
];

// instance Chart.js aktif, disimpan supaya bisa di-destroy sebelum render ulang
let chartTrenInstance = null;
let chartKategoriInstance = null;
let chartTopKeluarInstance = null;

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
// Mengembalikan array item flat: { tanggal, nama_barang, qty }
// =====================================

async function ambilItemKeluarPeriode(tanggalDari, tanggalSampai){

    const { data, error } = await supabaseClient
        .from("barang_keluar")
        .select("*")
        .eq("gudang", user.gudang)
        .gte("tanggal", tanggalDari)
        .lte("tanggal", tanggalSampai);

    if(error) throw error;

    const items = (data || []).map(d => ({
        tanggal : d.tanggal,
        nama_barang : d.nama_barang,
        qty : Number(d.qty) || 0
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

    const ctx = document.getElementById("chartTren").getContext("2d");

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

    const palet = [
        "#60a5fa", "#4ade80", "#f87171", "#facc15",
        "#a78bfa", "#38bdf8", "#fb923c", "#f472b6",
        "#2dd4bf", "#94a3b8"
    ];

    const ctx = document.getElementById("chartKategori").getContext("2d");

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
                backgroundColor: labels.map((_, i) => palet[i % palet.length]),
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
                }
            }
        }
    });

}

// =====================================
// RENDER GRAFIK TOP 5 BARANG KELUAR TERBANYAK
// =====================================

function renderChartTopKeluar(itemsKeluar){

    const qtyPerBarang = new Map();

    itemsKeluar.forEach(it => {

        qtyPerBarang.set(
            it.nama_barang,
            (qtyPerBarang.get(it.nama_barang) || 0) + it.qty
        );

    });

    const top5 = Array.from(qtyPerBarang.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const labels = top5.map(t => t[0]);
    const data = top5.map(t => t[1]);

    const ctx = document.getElementById("chartTopKeluar").getContext("2d");

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
                legend: { display: false }
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
// LOAD & RENDER TABEL STOK SAAT INI (tidak dipengaruhi filter tanggal)
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

        tampilkanTabelStok(stokRowsCache);

        renderChartKategori(stokRowsCache);

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

function tampilkanTabelStok(rows){

    const tbody = document.querySelector("#tableStok tbody");

    tbody.innerHTML = "";

    if(rows.length === 0){

        tbody.innerHTML = `
        <tr>
            <td colspan="6" class="stok-empty">Belum ada data stok.</td>
        </tr>
        `;

        return;

    }

    let no = 1;

    rows.forEach(r => {

        tbody.innerHTML += `
        <tr>
            <td>${no++}</td>
            <td>${r.kode_barang}</td>
            <td>${r.nama_barang}</td>
            <td>${r.kategori}</td>
            <td>${r.satuan}</td>
            <td><b>${formatAngka(r.stok)}</b></td>
        </tr>
        `;

    });

}

const searchStokEl = document.getElementById("searchStok");

if(searchStokEl){

    searchStokEl.addEventListener("keyup", function(){

        const kw = this.value.toLowerCase();

        const filtered = stokRowsCache.filter(r =>
            r.nama_barang.toLowerCase().includes(kw) ||
            r.kode_barang.toLowerCase().includes(kw) ||
            r.kategori.toLowerCase().includes(kw)
        );

        tampilkanTabelStok(filtered);

    });

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
// EXPORT LAPORAN EXCEL (Ringkasan + Tren Bulanan + Stok Saat Ini)
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

        // ---------- SHEET 3: STOK SAAT INI ----------

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
