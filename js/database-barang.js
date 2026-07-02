// =====================================
// DATABASE BARANG (Rekap Stok + Foto + Set Stok Awal)
// =====================================
//
// master_barang -> katalog barang BERSAMA (dipakai Margomulyo & Raden Saleh)
// stok_gudang   -> stok AKTUAL per gudang (barang_id, gudang, stok) - sumber
//                  kebenaran untuk kolom SISA STOK, difilter user.gudang
// stok_awal     -> catatan angka stok awal per barang per gudang (untuk
//                  ditampilkan di kolom STOK AWAL). Mengisi/mengubah nilai
//                  ini JUGA langsung menimpa stok_gudang.stok (opname).
// barang_masuk / barang_masuk_detail -> histori masuk, difilter via header.gudang
// barang_keluar -> histori keluar, punya kolom gudang sendiri per baris
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));
if (!user) { location.href = "login.html"; }

let dataBarang = [];

// item yang sedang dibuka di modal Set Stok Awal
let itemSedangDiatur = null;

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
    if (e.key === "Escape") {
        tutupLightbox();
        tutupModalStok();
    }
});

// =====================================
// MODAL SET STOK AWAL (SATU ITEM)
// =====================================

function bukaModalStok(barangId){

    const item = dataBarang.find(b => String(b.id) === String(barangId));

    if(!item){
        alert("Data barang tidak ditemukan, coba muat ulang halaman.");
        return;
    }

    itemSedangDiatur = item;

    document.getElementById("stokBarangNama").value =
        `${item.kode_barang} - ${item.nama_barang}`;

    document.getElementById("stokGudangNama").value = user.gudang;

    document.getElementById("stokAwalInput").value = item.stok_awal || 0;

    document.getElementById("modalStokAwal").classList.add("active");

    setTimeout(()=>{
        document.getElementById("stokAwalInput").focus();
        document.getElementById("stokAwalInput").select();
    }, 50);

}

function tutupModalStok(){

    document.getElementById("modalStokAwal").classList.remove("active");
    itemSedangDiatur = null;

}

document
.getElementById("modalStokAwal")
.addEventListener("click", function(e){
    if(e.target === this) tutupModalStok();
});

document
.getElementById("formStokAwal")
.addEventListener("submit", async function(e){

    e.preventDefault();

    if(!itemSedangDiatur) return;

    const nilaiBaru = parseInt(document.getElementById("stokAwalInput").value);

    if(isNaN(nilaiBaru) || nilaiBaru < 0){
        alert("Masukkan angka stok yang valid (0 atau lebih).");
        return;
    }

    const item = itemSedangDiatur;

    const sudahAdaTransaksi = (item.masuk > 0 || item.keluar > 0);

    if(sudahAdaTransaksi){

        const lanjut = confirm(
            `Barang "${item.nama_barang}" sudah punya histori transaksi ` +
            `(Masuk: ${item.masuk}, Keluar: ${item.keluar}).\n\n` +
            `Melanjutkan akan MENIMPA Sisa Stok saat ini (${item.sisa}) menjadi ${nilaiBaru}.\n` +
            `Yakin lanjutkan?`
        );

        if(!lanjut) return;

    }

    try{

        await setStokAwalSatuItem(item.id, item.kode_barang, user.gudang, nilaiBaru);

        alert("Stok awal berhasil disimpan.");

        tutupModalStok();

        await loadBarang();

    }
    catch(err){

        console.error(err);
        alert("Gagal menyimpan stok awal: " + err.message);

    }

});

// =====================================
// FUNGSI INTI: SET STOK AWAL 1 KOMBINASI barang+gudang
// (dipakai baik oleh modal satu-item maupun import massal)
// =====================================

async function setStokAwalSatuItem(barangId, kodeBarang, gudang, nilai){

    // 1) simpan/update ke tabel stok_awal (untuk kolom "STOK AWAL")
    const { data: existingAwal } = await supabaseClient
        .from("stok_awal")
        .select("id")
        .eq("barang_id", barangId)
        .eq("gudang", gudang)
        .maybeSingle();

    if(existingAwal){

        const { error } = await supabaseClient
            .from("stok_awal")
            .update({
                stok_awal: nilai,
                set_by: user.nama,
                set_at: new Date().toISOString()
            })
            .eq("id", existingAwal.id);

        if(error) throw error;

    } else {

        const { error } = await supabaseClient
            .from("stok_awal")
            .insert([{
                barang_id: barangId,
                kode_barang: kodeBarang,
                gudang: gudang,
                stok_awal: nilai,
                set_by: user.nama
            }]);

        if(error) throw error;

    }

    // 2) timpa langsung stok_gudang.stok (sumber kebenaran Sisa Stok)
    const { data: existingStok } = await supabaseClient
        .from("stok_gudang")
        .select("id")
        .eq("barang_id", barangId)
        .eq("gudang", gudang)
        .maybeSingle();

    if(existingStok){

        const { error } = await supabaseClient
            .from("stok_gudang")
            .update({ stok: nilai })
            .eq("id", existingStok.id);

        if(error) throw error;

    } else {

        const { error } = await supabaseClient
            .from("stok_gudang")
            .insert([{
                barang_id: barangId,
                gudang: gudang,
                stok: nilai
            }]);

        if(error) throw error;

    }

}

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
// STOK AWAL (tabel stok_awal), KHUSUS GUDANG YANG SEDANG LOGIN
// key: barang_id -> stok_awal
// =====================================

async function loadStokAwalMap() {

    const map = new Map();

    try {
        const { data, error } = await supabaseClient
            .from("stok_awal")
            .select("barang_id, stok_awal")
            .eq("gudang", user.gudang);

        if (error) throw error;

        (data || []).forEach(row => {
            map.set(String(row.barang_id), Number(row.stok_awal) || 0);
        });

    } catch (err) {
        // tabel mungkin belum dibuat -> jangan hentikan halaman, cukup log
        console.warn("Gagal memuat stok_awal (tabel mungkin belum dibuat):", err.message);
    }

    return map;

}

// =====================================
// TOTAL MASUK PER KODE BARANG, KHUSUS GUDANG YANG SEDANG LOGIN
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
            <td colspan="10" class="loading-state">
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

        const [masukMap, keluarMap, stokMap, stokAwalMap] = await Promise.all([
            sumMasukPerKode(),
            sumKeluarPerKode(),
            loadStokGudangMap(),
            loadStokAwalMap()
        ]);

        dataBarang = (master || []).map(item => {
            const stokAwal = stokAwalMap.get(String(item.id)) || 0;
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
                <td colspan="10" class="empty-state">
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
                <td colspan="10" class="empty-state">
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
                <td>
                    <button class="btn-set-stok" onclick="bukaModalStok(${item.id})">
                        ✏ Stok Awal
                    </button>
                </td>
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
// IMPORT STOK AWAL (MASSAL, VIA EXCEL)
// Kolom yang dibaca: "Kode Barang" dan "Stok Awal"
// (fleksibel: juga menerima "kode_barang" / "stok_awal")
// =====================================

document
.getElementById("fileImportStok")
.addEventListener("change", function(e){

    const file = e.target.files[0];

    if(!file) return;

    if(typeof XLSX === "undefined"){
        alert("Library Excel belum termuat. Coba refresh halaman lalu ulangi.");
        e.target.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = async function(evt){

        try{

            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: "array" });

            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

            if(rows.length === 0){
                alert("File Excel kosong atau format tidak sesuai.");
                return;
            }

            const dataMasuk = rows.map(row => ({
                kode_barang: String(
                    row["Kode Barang"] ?? row["kode_barang"] ?? row["KODE"] ?? ""
                ).trim(),
                stok_awal: Number(
                    row["Stok Awal"] ?? row["stok_awal"] ?? row["STOK AWAL"] ?? ""
                )
            })).filter(row =>
                row.kode_barang !== "" && !isNaN(row.stok_awal) && row.stok_awal >= 0
            );

            if(dataMasuk.length === 0){
                alert("Tidak ditemukan baris valid. Pastikan ada kolom 'Kode Barang' dan 'Stok Awal' berisi angka.");
                return;
            }

            if(!confirm(
                `Ditemukan ${dataMasuk.length} baris.\n\n` +
                `Proses ini akan MENIMPA Sisa Stok barang-barang tersebut di gudang ${user.gudang}.\n` +
                `Lanjutkan import?`
            )){
                return;
            }

            let berhasil = 0;
            let tidakDitemukan = 0;
            let gagal = 0;

            for(const row of dataMasuk){

                const item = dataBarang.find(b =>
                    b.kode_barang.toLowerCase() === row.kode_barang.toLowerCase()
                );

                if(!item){
                    tidakDitemukan++;
                    continue;
                }

                try{

                    await setStokAwalSatuItem(item.id, item.kode_barang, user.gudang, row.stok_awal);
                    berhasil++;

                }
                catch(err){
                    console.error(`Gagal set stok awal untuk ${row.kode_barang}:`, err);
                    gagal++;
                }

            }

            alert(
                `Import Stok Awal selesai.\n\n` +
                `Berhasil     : ${berhasil}\n` +
                `Tidak ditemukan (kode tidak cocok) : ${tidakDitemukan}\n` +
                `Gagal        : ${gagal}`
            );

            await loadBarang();

        }
        catch(err){

            console.error(err);
            alert("Gagal import Excel: " + err.message);

        }
        finally{

            e.target.value = "";

        }

    };

    reader.readAsArrayBuffer(file);

});

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
