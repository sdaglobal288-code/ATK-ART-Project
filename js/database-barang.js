// =====================================
// DATABASE BARANG (Rekap Stok + Foto)
// =====================================
//
// master_barang -> katalog barang BERSAMA (dipakai Margomulyo & Raden Saleh)
// stok_gudang   -> stok AKTUAL per gudang (barang_id, gudang, stok) - sumber
//                  kebenaran untuk kolom SISA STOK, difilter user.gudang
// barang_masuk / barang_masuk_detail -> histori masuk, difilter via header.gudang
// barang_keluar -> histori keluar, punya kolom gudang sendiri per baris
//
// STOK AWAL saat ini selalu 0 (tabel stok_awal belum dipakai / masih kosong).
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));
if (!user) { location.href = "login.html"; }

let dataBarang = [];

// =====================================
// LIGHTBOX
// =====================================

function bukaLightbox(url, nama) {
    document.getElementById("lightboxImg").src = url;
    document.getElementById("lightboxCaption").textContent = nama;
    document.getElementById("lightbox").classList.add("active");
}

function tutupLightbox() {
    document.getElementById("lightbox").classList.remove("active");
    document.getElementById("lightboxImg").src = "";
}

document.addEventListener("keydown", e => {
    if (e.key === "Escape") tutupLightbox();
});

// =====================================
// LOAD KATEGORI (dropdown filter)
// =====================================

async function loadKategoriFilter() {
    try {
        const { data, error } = await supabaseClient
            .from("kategori_barang")
            .select("*")
            .order("nama_kategori");

        if (error) throw error;

        const sel = document.getElementById("filterKategori");
        sel.innerHTML = `<option value="">Semua Kategori</option>`;
        (data || []).forEach(item => {
            sel.innerHTML += `<option value="${item.nama_kategori}">${item.nama_kategori}</option>`;
        });
    } catch (err) {
        console.warn("Gagal memuat kategori:", err.message);
    }
}

// =====================================
// STOK SAAT INI (stok_gudang), KHUSUS GUDANG YANG SEDANG LOGIN
// key: barang_id -> stok
// =====================================

async function loadStokGudangMap() {

    const map = new Map();

    try {
        const { data, error } = await supabaseClient
            .from("stok_gudang")
            .select("barang_id, stok")
            .eq("gudang", user.gudang);

        if (error) throw error;

        (data || []).forEach(row => {
            map.set(String(row.barang_id), Number(row.stok) || 0);
        });

    } catch (err) {
        console.warn("Gagal memuat stok_gudang:", err.message);
    }

    return map;

}

// =====================================
// TOTAL MASUK PER KODE BARANG, KHUSUS GUDANG YANG SEDANG LOGIN
// (barang_masuk_detail tidak punya kolom gudang sendiri, jadi ambil
// dulu daftar id header barang_masuk milik gudang ini, baru jumlahkan
// qty di barang_masuk_detail yang barang_masuk_id-nya ada di daftar itu)
// =====================================

async function sumMasukPerKode() {

    const totals = new Map();

    try {

        const { data: headers, error: hErr } = await supabaseClient
            .from("barang_masuk")
            .select("id")
            .eq("gudang", user.gudang);

        if (hErr) throw hErr;

        const ids = (headers || []).map(h => h.id);

        if (ids.length === 0) return totals;

        const { data: details, error: dErr } = await supabaseClient
            .from("barang_masuk_detail")
            .select("kode_barang, qty, barang_masuk_id")
            .in("barang_masuk_id", ids);

        if (dErr) throw dErr;

        (details || []).forEach(row => {
            const kode = row.kode_barang;
            const jml  = Number(row.qty) || 0;
            totals.set(kode, (totals.get(kode) || 0) + jml);
        });

    } catch (err) {
        console.warn("Gagal menghitung total Masuk:", err.message);
    }

    return totals;

}

// =====================================
// TOTAL KELUAR PER KODE BARANG, KHUSUS GUDANG YANG SEDANG LOGIN
// (barang_keluar punya kolom gudang langsung di tiap baris)
// =====================================

async function sumKeluarPerKode() {

    const totals = new Map();

    try {

        const { data, error } = await supabaseClient
            .from("barang_keluar")
            .select("kode_barang, qty")
            .eq("gudang", user.gudang);

        if (error) throw error;

        (data || []).forEach(row => {
            const kode = row.kode_barang;
            const jml  = Number(row.qty) || 0;
            totals.set(kode, (totals.get(kode) || 0) + jml);
        });

    } catch (err) {
        console.warn("Gagal menghitung total Keluar:", err.message);
    }

    return totals;

}

// =====================================
// LOAD & GABUNGKAN DATA
// =====================================

async function loadBarang() {
    const tbody = document.querySelector("#tableBarang tbody");

    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="loading-state">
                <span class="spinner"></span> Memuat data...
            </td>
        </tr>
    `;

    try {
        const { data: master, error } = await supabaseClient
            .from("master_barang")
            .select("*")
            .order("kode_barang");

        if (error) throw error;

        const [masukMap, keluarMap, stokMap] = await Promise.all([
            sumMasukPerKode(),
            sumKeluarPerKode(),
            loadStokGudangMap()
        ]);

        dataBarang = (master || []).map(item => {
            // Stok Awal belum dipakai (tabel stok_awal masih kosong) -> 0
            const stokAwal = 0;
            const masuk    = masukMap.get(item.kode_barang)  || 0;
            const keluar   = keluarMap.get(item.kode_barang) || 0;
            // Sisa Stok = angka aktual dari stok_gudang (sumber kebenaran),
            // BUKAN hasil hitung ulang stokAwal + masuk - keluar, supaya
            // selalu konsisten dengan halaman Barang Masuk / Barang Keluar.
            const sisa = stokMap.get(String(item.id)) || 0;
            return { ...item, stok_awal: stokAwal, masuk, keluar, sisa };
        });

        applyFilter();

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    ⚠ Gagal memuat data: ${err.message}
                </td>
            </tr>
        `;
    }
}

// =====================================
// RENDER TABEL
// =====================================

function renderBarang(list) {
    const tbody      = document.querySelector("#tableBarang tbody");
    const totalBadge = document.getElementById("totalBadge");

    totalBadge.textContent = `${list.length} item`;

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    Tidak ada data barang yang cocok.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    list.forEach(item => {

        // Foto
        const fotoHtml = item.foto_url
            ? `<img src="${item.foto_url}" alt="${item.nama_barang}"
                    class="tbl-foto" loading="lazy"
                    onclick="bukaLightbox('${item.foto_url}','${item.nama_barang}')">`
            : `<div class="tbl-foto-empty">📦</div>`;

        // Stok badge
        let sisaClass = "ok";
        if (item.sisa <= 0) sisaClass = "low";
        else if (item.sisa < 10) sisaClass = "mid";

        const sisaHtml = `<span class="stok-badge ${sisaClass}">${item.sisa.toLocaleString("id-ID")}</span>`;

        tbody.innerHTML += `
            <tr>
                <td>${fotoHtml}</td>
                <td><span class="kode-pill">${item.kode_barang}</span></td>
                <td><strong>${item.nama_barang}</strong></td>
                <td>${item.kategori ?? "-"}</td>
                <td>${item.satuan ?? "-"}</td>
                <td class="num">${item.stok_awal.toLocaleString("id-ID")}</td>
                <td class="num val-masuk">+${item.masuk.toLocaleString("id-ID")}</td>
                <td class="num val-keluar">-${item.keluar.toLocaleString("id-ID")}</td>
                <td class="num">${sisaHtml}</td>
            </tr>
        `;
    });
}

// =====================================
// SEARCH + FILTER KATEGORI
// =====================================

function applyFilter() {
    const keyword  = (document.getElementById("search").value || "").trim().toLowerCase();
    const kategori = document.getElementById("filterKategori").value;

    const filtered = dataBarang.filter(item => {
        const cocokKeyword =
            !keyword ||
            item.kode_barang.toLowerCase().includes(keyword) ||
            item.nama_barang.toLowerCase().includes(keyword);
        const cocokKategori = !kategori || item.kategori === kategori;
        return cocokKeyword && cocokKategori;
    });

    renderBarang(filtered);
}

document.getElementById("search").addEventListener("input", applyFilter);
document.getElementById("filterKategori").addEventListener("change", applyFilter);

// =====================================
// EXPORT EXCEL
// =====================================

function exportExcel() {
    if (!dataBarang.length) {
        alert("Tidak ada data untuk diexport.");
        return;
    }

    if (typeof XLSX === "undefined") {
        alert("Library SheetJS (xlsx) belum dimuat.");
        return;
    }

    const rows = dataBarang.map(item => ({
        "KODE"      : item.kode_barang,
        "NAMA"      : item.nama_barang,
        "KATEGORI"  : item.kategori ?? "-",
        "SATUAN"    : item.satuan ?? "-",
        "STOK AWAL" : item.stok_awal,
        "MASUK"     : item.masuk,
        "KELUAR"    : item.keluar,
        "SISA STOK" : item.sisa
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Database Barang - ${user.gudang}`);

    const tanggal = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Database_Barang_${user.gudang}_${tanggal}.xlsx`);
}

// =====================================
// REALTIME: kalau stok_gudang gudang ini berubah, muat ulang
// =====================================

function aktifkanRealtimeStok(){

    supabaseClient

    .channel("stok-realtime-database-barang")

    .on("postgres_changes",

        {
            event: "*",
            schema: "public",
            table: "stok_gudang",
            filter: `gudang=eq.${user.gudang}`
        },

        () => loadBarang()

    )

    .subscribe();

}

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", async () => {
    await loadKategoriFilter();
    await loadBarang();
    aktifkanRealtimeStok();
});
