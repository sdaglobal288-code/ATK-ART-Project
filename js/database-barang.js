// =====================================
// DATABASE BARANG (Rekap Stok + Foto)
// =====================================
//
// Asumsi nama tabel/kolom Supabase:
//   master_barang   -> kode_barang, nama_barang, kategori, satuan, foto_url
//   stok_awal       -> kode_barang, jumlah
//   barang_masuk    -> kode_barang, jumlah  (atau sesuai tabel transaksi masuk)
//   barang_keluar   -> kode_barang, jumlah  (atau sesuai tabel transaksi keluar)
//
// Sesuaikan 3 konstanta di bawah jika nama tabel/kolom berbeda:

const TABLE_STOK_AWAL = "stok_awal";
const TABLE_MASUK     = "barang_masuk";
const TABLE_KELUAR    = "barang_keluar";
const KOLOM_JUMLAH    = "jumlah";

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
// HELPER: jumlahkan kolom per kode_barang
// =====================================

async function sumPerKode(tableName) {
    const totals = new Map();
    try {
        const { data, error } = await supabaseClient
            .from(tableName)
            .select(`kode_barang, ${KOLOM_JUMLAH}`);

        if (error) throw error;

        (data || []).forEach(row => {
            const kode = row.kode_barang;
            const jml  = Number(row[KOLOM_JUMLAH]) || 0;
            totals.set(kode, (totals.get(kode) || 0) + jml);
        });
    } catch (err) {
        console.warn(`Tabel "${tableName}" tidak bisa dibaca:`, err.message);
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

        const [awalMap, masukMap, keluarMap] = await Promise.all([
            sumPerKode(TABLE_STOK_AWAL),
            sumPerKode(TABLE_MASUK),
            sumPerKode(TABLE_KELUAR)
        ]);

        dataBarang = (master || []).map(item => {
            const stokAwal = awalMap.get(item.kode_barang)  || 0;
            const masuk    = masukMap.get(item.kode_barang)  || 0;
            const keluar   = keluarMap.get(item.kode_barang) || 0;
            const sisa     = stokAwal + masuk - keluar;
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
    XLSX.utils.book_append_sheet(wb, ws, "Database Barang");

    const tanggal = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Database_Barang_${tanggal}.xlsx`);
}

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", async () => {
    await loadKategoriFilter();
    await loadBarang();
});
