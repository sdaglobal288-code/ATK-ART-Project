// =====================================
// DATABASE BARANG (Rekap Stok + Foto + Set Stok Awal + Reset Stok + Sinkron Ulang)
// =====================================
//
// master_barang -> katalog barang BERSAMA (dipakai Margomulyo & Raden Saleh)
// stok_gudang   -> stok AKTUAL per gudang (barang_id, gudang, stok) - sumber
//                  kebenaran untuk kolom SISA STOK, difilter user.gudang
// stok_awal     -> catatan angka stok awal per barang per gudang (untuk
//                  ditampilkan di kolom STOK AWAL). Mengisi/mengubah nilai
//                  ini JUGA langsung menimpa stok_gudang.stok (opname) -
//                  TAPI HANYA untuk barang yang BELUM PERNAH ada transaksi
//                  Masuk/Keluar. Kalau barang sudah punya histori transaksi,
//                  proses SATU-ITEM akan minta konfirmasi eksplisit sebelum
//                  menimpa, dan proses IMPORT MASSAL akan otomatis
//                  MELEWATI barang tersebut (lihat catatan di bagian
//                  "IMPORT STOK AWAL (MASSAL)" di bawah).
//
// PENTING: stok_awal dan stok_gudang adalah DUA TABEL TERPISAH. Begitu juga,
// kolom MASUK dan KELUAR di tabel ini SELALU dihitung ulang dari histori
// barang_masuk_detail / barang_keluar yang MASIH ADA saat ini - sedangkan
// SISA STOK cuma "mengingat" angka terakhir yang pernah ditulis ke
// stok_gudang. Konsekuensinya:
//   - Kalau Barang Masuk/Keluar dihapus lewat tombol Hapus di halamannya,
//     stok_gudang ikut di-rollback otomatis -> semua tetap sinkron.
//   - Kalau data dihapus LANGSUNG dari Supabase (Table Editor / SQL), atau
//     lewat cara lain di luar tombol Hapus aplikasi, stok_gudang TIDAK ikut
//     berubah -> Sisa Stok bisa "nyangkut" tidak sesuai histori yang tersisa.
//   - Tombol "Reset Stok" MEMANG SENGAJA cuma menghapus stok_awal +
//     stok_gudang jadi 0, TIDAK menghitung ulang dari histori yang tersisa.
// Kalau Sisa Stok pernah nyangkut seperti di atas, pakai tombol
// "🔄 Sinkronkan Ulang Sisa Stok" di halaman ini untuk menghitung ulang
// Sisa Stok = Stok Awal + Total Masuk - Total Keluar, KHUSUS untuk gudang
// yang sedang login (gudang lain tidak tersentuh).
//
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
        tutupModalReset();
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

        // Set Stok Awal satu-item (manual) TETAP boleh menimpa stok_gudang,
        // karena user sudah eksplisit memilih barang ini & sudah dikonfirmasi
        // di atas kalau barang tersebut sudah ada transaksinya.
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
// (dipakai oleh modal satu-item; JUGA dipakai import massal HANYA untuk
// barang yang belum punya transaksi Masuk/Keluar - lihat pemanggilnya)
//
// Fungsi ini menyimpan/update tabel stok_awal DAN ikut menimpa
// stok_gudang.stok (opname langsung). Pemanggil bertanggung jawab
// memastikan penimpaan stok_gudang ini aman dilakukan.
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
// FUNGSI KHUSUS IMPORT STOK AWAL MASSAL:
// hanya menyimpan angka ke tabel stok_awal (kolom "STOK AWAL" saja),
// TANPA menyentuh stok_gudang.stok sama sekali.
//
// Dipakai untuk barang yang SUDAH punya histori transaksi Masuk/Keluar,
// supaya import massal tidak pernah mempengaruhi Sisa Stok yang sudah
// terbentuk dari Barang Masuk / Barang Keluar.
// =====================================

async function setStokAwalSajaTanpaTimpaSisaStok(barangId, kodeBarang, gudang, nilai){

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

    // SENGAJA tidak menyentuh stok_gudang di sini.

}

// =====================================
// MODAL RESET STOK (SATU GUDANG - HAPUS stok_awal + stok_gudang)
// =====================================

function bukaModalReset(){

    document.getElementById("resetGudangNama").textContent = user.gudang;
    document.getElementById("resetKonfirmasiInput").value = "";

    document.getElementById("modalResetStok").classList.add("active");

    setTimeout(()=>{
        document.getElementById("resetKonfirmasiInput").focus();
    }, 50);

}

function tutupModalReset(){

    document.getElementById("modalResetStok").classList.remove("active");

}

document
.getElementById("modalResetStok")
.addEventListener("click", function(e){
    if(e.target === this) tutupModalReset();
});

document
.getElementById("formResetStok")
.addEventListener("submit", async function(e){

    e.preventDefault();

    const teks = document.getElementById("resetKonfirmasiInput").value.trim();

    if(teks !== "RESET"){
        alert('Ketik persis "RESET" (huruf besar semua) untuk konfirmasi.');
        return;
    }

    const btn = document.getElementById("btnKonfirmasiReset");
    const teksAsliBtn = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = "⏳ Mereset...";

    try{

        await resetStokGudangIni();

        alert(
            `Stok gudang ${user.gudang} berhasil direset ke 0.\n\n` +
            `Silakan import ulang Stok Awal, atau input ulang transaksi sesuai kebutuhan.\n\n` +
            `Kalau di gudang ini masih ada histori Barang Masuk/Keluar yang tersisa dan kamu ` +
            `ingin Sisa Stok langsung mengikuti histori tersebut (bukan mulai dari 0), pakai ` +
            `tombol "🔄 Sinkronkan Ulang Sisa Stok" setelah ini.`
        );

        tutupModalReset();

        await loadBarang();

    }
    catch(err){

        console.error(err);
        alert("Gagal reset stok: " + err.message);

    }
    finally{

        btn.disabled = false;
        btn.innerHTML = teksAsliBtn;

    }

});

// =====================================
// FUNGSI INTI: RESET stok_awal + stok_gudang UNTUK GUDANG YANG SEDANG LOGIN
// =====================================

async function resetStokGudangIni(){

    // hapus seluruh catatan stok_awal utk gudang ini
    const { error: delAwalErr } = await supabaseClient
        .from("stok_awal")
        .delete()
        .eq("gudang", user.gudang);

    if(delAwalErr) throw delAwalErr;

    // hapus seluruh baris stok_gudang utk gudang ini
    // (barang tanpa baris di stok_gudang otomatis dianggap Sisa Stok = 0,
    // lihat loadStokGudangMap() di bawah)
    const { error: delStokErr } = await supabaseClient
        .from("stok_gudang")
        .delete()
        .eq("gudang", user.gudang);

    if(delStokErr) throw delStokErr;

}

// =====================================
// SINKRONKAN ULANG SISA STOK (KHUSUS GUDANG YANG SEDANG LOGIN)
// =====================================
// Menghitung ulang Sisa Stok setiap barang dengan rumus:
//
//     Sisa Stok = Stok Awal + Total Masuk - Total Keluar
//
// lalu menimpa stok_gudang.stok dengan hasilnya - HANYA untuk baris
// dengan gudang = user.gudang, jadi gudang lain (mis. Raden Saleh)
// TIDAK PERNAH tersentuh oleh fungsi ini.
//
// Berguna untuk memperbaiki Sisa Stok yang "nyangkut" karena data Barang
// Masuk/Keluar sebelumnya dihapus di luar tombol Hapus aplikasi (misalnya
// langsung lewat Supabase Table Editor), sehingga stok_gudang tidak ikut
// ter-rollback otomatis.
// =====================================

async function sinkronkanUlangSisaStok(){

    if(!dataBarang || dataBarang.length === 0){
        alert("Data belum termuat, coba muat ulang halaman dulu.");
        return;
    }

    const konfirmasi = confirm(
        `Ini akan menghitung ulang SISA STOK setiap barang di gudang ${user.gudang} dengan rumus:\n\n` +
        `Sisa Stok = Stok Awal + Total Masuk − Total Keluar\n\n` +
        `Berguna kalau Sisa Stok "nyangkut" tidak sesuai histori - misalnya karena data Barang ` +
        `Masuk/Keluar pernah dihapus langsung dari Supabase (bukan lewat tombol Hapus di halaman ` +
        `Barang Masuk / Barang Keluar).\n\n` +
        `Gudang lain (mis. Raden Saleh) TIDAK akan terpengaruh sama sekali, karena hanya barang ` +
        `di gudang ${user.gudang} yang diproses.\n\n` +
        `Lanjutkan?`
    );

    if(!konfirmasi) return;

    const btn = document.getElementById("btnSinkronStok");
    const teksAsliBtn = btn ? btn.innerHTML : null;

    if(btn){
        btn.disabled = true;
        btn.innerHTML = "⏳ Menyinkronkan...";
    }

    sedangImportStokAwal = true; // pinjam flag yang sama supaya tab tidak ditutup di tengah proses
    tampilkanOverlayImportProgress(
        dataBarang.length,
        "🔄 Sedang Menyinkronkan Ulang Sisa Stok..."
    );

    let sudahDiproses = 0;
    let diperbarui = 0;
    let dilewatiSudahSesuai = 0;
    let gagal = 0;

    try{

        for(const item of dataBarang){

            sudahDiproses++;
            updateOverlayImportProgress(sudahDiproses, dataBarang.length);

            const nilaiSeharusnya = item.stok_awal + item.masuk - item.keluar;

            if(nilaiSeharusnya === item.sisa){

                dilewatiSudahSesuai++;
                continue;

            }

            try{

                const { data: existingStok, error: selErr } = await supabaseClient
                    .from("stok_gudang")
                    .select("id")
                    .eq("barang_id", item.id)
                    .eq("gudang", user.gudang)
                    .maybeSingle();

                if(selErr) throw selErr;

                if(existingStok){

                    const { error: updErr } = await supabaseClient
                        .from("stok_gudang")
                        .update({
                            stok: nilaiSeharusnya,
                            updated_at: new Date().toISOString()
                        })
                        .eq("id", existingStok.id);

                    if(updErr) throw updErr;

                } else {

                    const { error: insErr } = await supabaseClient
                        .from("stok_gudang")
                        .insert([{
                            barang_id: item.id,
                            gudang: user.gudang,
                            stok: nilaiSeharusnya,
                            updated_at: new Date().toISOString()
                        }]);

                    if(insErr) throw insErr;

                }

                diperbarui++;

            }
            catch(err){

                console.error(`Gagal sinkron stok untuk ${item.kode_barang}:`, err);
                gagal++;

            }

        }

        alert(
            `Sinkronisasi Sisa Stok selesai untuk gudang ${user.gudang}.\n\n` +
            `Diperbarui        : ${diperbarui}\n` +
            `Sudah sesuai (dilewati) : ${dilewatiSudahSesuai}\n` +
            `Gagal             : ${gagal}\n` +
            `Total barang      : ${dataBarang.length}`
        );

        await loadBarang();

    }
    finally{

        sedangImportStokAwal = false;
        sembunyikanOverlayImportProgress();

        if(btn){
            btn.disabled = false;
            btn.innerHTML = teksAsliBtn;
        }

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
            // (Kalau angka ini "nyangkut" tidak sesuai histori, gunakan
            // tombol "🔄 Sinkronkan Ulang Sisa Stok".)
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
//
// PENTING - PERILAKU BARU (perbaikan):
// Import ini KHUSUS untuk mengisi kolom "Stok Awal" barang yang BELUM
// PERNAH ada transaksi Barang Masuk / Barang Keluar. Untuk barang yang
// sudah punya histori transaksi, import massal TIDAK AKAN menimpa Sisa
// Stok-nya sama sekali (baris tersebut otomatis "Dilewati" dan dicatat
// di laporan) - supaya import Stok Awal tidak pernah menghapus/menimpa
// hasil Barang Masuk atau Barang Keluar yang sudah tercatat.
//
// Kalau memang ingin sengaja menimpa Sisa Stok barang yang sudah ada
// transaksinya (misal untuk opname manual), gunakan tombol "✏ Stok Awal"
// per-item di tabel - di situ akan ada konfirmasi eksplisit sebelum
// menimpa.
//
// Setelah selesai, laporan hasil import (baris mana yang Berhasil /
// Dilewati (sudah ada transaksi) / Tidak Ditemukan / Gagal beserta
// alasannya) bisa didownload sebagai Excel supaya mudah dicek kalau ada
// yang tidak masuk semua.
// =====================================

// =====================================
// OVERLAY PROGRESS (dipakai Import Stok Awal Massal & Sinkronkan Ulang
// Sisa Stok). Dibuat lewat JS (tidak perlu ubah file HTML) supaya user
// tahu proses masih berjalan, dan tidak menutup/pindah tab di tengah jalan.
// =====================================

let sedangImportStokAwal = false;

function tampilkanOverlayImportProgress(totalBaris, judul){

    const judulTampil = judul || "⏳ Sedang Import Stok Awal...";

    let overlay = document.getElementById("overlayImportStokAwal");

    if(!overlay){

        overlay = document.createElement("div");
        overlay.id = "overlayImportStokAwal";
        overlay.style.cssText = `
            position:fixed; inset:0; background:rgba(8,9,15,.75);
            z-index:2000; display:flex; align-items:center; justify-content:center;
            padding:20px;
        `;

        overlay.innerHTML = `
            <div style="
                background:var(--db-surface,#171926); border:1px solid var(--db-border,#2a2d3d);
                border-radius:14px; padding:26px 28px; width:380px; max-width:100%;
                box-shadow:0 20px 50px rgba(0,0,0,.5); text-align:center;
                font-family:'Inter',sans-serif; color:var(--db-text,#e9eaf2);
            ">
                <div id="overlayImportStokAwalJudul" style="font-size:15px; font-weight:700; margin-bottom:6px;">
                    ${judulTampil}
                </div>
                <div id="overlayImportStokAwalTeks" style="font-size:13px; color:var(--db-muted,#9498ab); margin-bottom:14px;">
                    Memproses 0 dari ${totalBaris} barang...
                </div>
                <div style="background:var(--db-surface-2,#1e2130); border-radius:999px; height:10px; overflow:hidden;">
                    <div id="overlayImportStokAwalBar" style="
                        height:100%; width:0%;
                        background:linear-gradient(135deg,var(--db-purple,#6c5dd3),var(--db-purple-dark,#5a4cc0));
                        transition:width .15s ease;
                    "></div>
                </div>
                <div style="font-size:12px; color:var(--db-muted,#9498ab); margin-top:14px; line-height:1.5;">
                    ⚠ Jangan tutup atau pindah tab sampai proses ini selesai,
                    supaya tidak ada barang yang terlewat.
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

    } else {

        const judulEl = document.getElementById("overlayImportStokAwalJudul");
        if(judulEl) judulEl.textContent = judulTampil;

        const tekxEl = document.getElementById("overlayImportStokAwalTeks");
        if(tekxEl) tekxEl.textContent = `Memproses 0 dari ${totalBaris} barang...`;

        const barEl = document.getElementById("overlayImportStokAwalBar");
        if(barEl) barEl.style.width = "0%";

    }

    overlay.style.display = "flex";

}

function updateOverlayImportProgress(sudahDiproses, totalBaris){

    const teks = document.getElementById("overlayImportStokAwalTeks");
    const bar  = document.getElementById("overlayImportStokAwalBar");

    if(teks) teks.textContent = `Memproses ${sudahDiproses} dari ${totalBaris} barang...`;
    if(bar)  bar.style.width  = `${totalBaris > 0 ? Math.round((sudahDiproses / totalBaris) * 100) : 0}%`;

}

function sembunyikanOverlayImportProgress(){

    const overlay = document.getElementById("overlayImportStokAwal");

    if(overlay) overlay.style.display = "none";

}

// Peringatan browser kalau user coba tutup/refresh/pindah tab
// SELAGI proses import massal / sinkronisasi masih berjalan.
window.addEventListener("beforeunload", function(e){

    if(sedangImportStokAwal){

        e.preventDefault();
        e.returnValue = "";
        return "";

    }

});

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
                stok_awal_mentah:
                    row["Stok Awal"] ?? row["stok_awal"] ?? row["STOK AWAL"] ?? ""
            }));

            // pisahkan baris yang formatnya sudah tidak valid dari awal
            // (kode kosong, atau stok bukan angka >= 0) supaya tetap
            // muncul di laporan sebagai "Dilewati", bukan hilang diam-diam
            const reportRows = [];
            const dataValid = [];

            dataMasuk.forEach(row => {

                const stokAwal = Number(row.stok_awal_mentah);

                if(row.kode_barang === ""){

                    reportRows.push({
                        "Kode Barang": "(kosong)",
                        "Stok Awal Diminta": row.stok_awal_mentah,
                        "Status": "Dilewati",
                        "Keterangan": "Baris tidak punya Kode Barang"
                    });

                    return;

                }

                if(isNaN(stokAwal) || stokAwal < 0){

                    reportRows.push({
                        "Kode Barang": row.kode_barang,
                        "Stok Awal Diminta": row.stok_awal_mentah,
                        "Status": "Dilewati",
                        "Keterangan": "Stok Awal bukan angka >= 0"
                    });

                    return;

                }

                dataValid.push({
                    kode_barang: row.kode_barang,
                    stok_awal: stokAwal
                });

            });

            if(dataValid.length === 0){
                alert("Tidak ditemukan baris valid. Pastikan ada kolom 'Kode Barang' dan 'Stok Awal' berisi angka.");
                return;
            }

            if(!confirm(
                `Ditemukan ${dataValid.length} baris valid dari total ${rows.length} baris di file.\n\n` +
                `Proses ini akan mengisi Stok Awal barang-barang tersebut di gudang ${user.gudang}.\n` +
                `Barang yang SUDAH punya histori transaksi Masuk/Keluar akan otomatis DILEWATI ` +
                `(Sisa Stok-nya TIDAK akan ditimpa), supaya import ini tidak mempengaruhi data ` +
                `Barang Masuk / Barang Keluar yang sudah tercatat.\n\n` +
                `Lanjutkan import?`
            )){
                return;
            }

            let berhasil = 0;
            let dilewatiSudahAdaTransaksi = 0;
            let tidakDitemukan = 0;
            let gagal = 0;

            sedangImportStokAwal = true;
            tampilkanOverlayImportProgress(dataValid.length, "⏳ Sedang Import Stok Awal...");

            let sudahDiproses = 0;

            for(const row of dataValid){

                sudahDiproses++;
                updateOverlayImportProgress(sudahDiproses, dataValid.length);

                const item = dataBarang.find(b =>
                    b.kode_barang.trim().toLowerCase() === row.kode_barang.toLowerCase()
                );

                if(!item){

                    tidakDitemukan++;

                    reportRows.push({
                        "Kode Barang": row.kode_barang,
                        "Stok Awal Diminta": row.stok_awal,
                        "Status": "Tidak Ditemukan",
                        "Keterangan": "Kode barang tidak ada di master_barang gudang ini"
                    });

                    continue;

                }

                const sudahAdaTransaksi = (item.masuk > 0 || item.keluar > 0);

                try{

                    if(sudahAdaTransaksi){

                        // Barang sudah punya histori Barang Masuk/Keluar -
                        // import massal TIDAK BOLEH menimpa Sisa Stok-nya.
                        // Kalau memang ingin menimpa, harus lewat tombol
                        // "✏ Stok Awal" per-item (ada konfirmasi eksplisit).
                        dilewatiSudahAdaTransaksi++;

                        reportRows.push({
                            "Kode Barang": row.kode_barang,
                            "Stok Awal Diminta": row.stok_awal,
                            "Status": "Dilewati (sudah ada transaksi)",
                            "Keterangan":
                                `Barang ini sudah punya histori transaksi ` +
                                `(Masuk: ${item.masuk}, Keluar: ${item.keluar}). ` +
                                `Sisa Stok TIDAK ditimpa oleh import massal. ` +
                                `Gunakan tombol "✏ Stok Awal" per-item jika Anda ` +
                                `yakin ingin menimpanya secara manual.`
                        });

                        continue;

                    }

                    // Belum ada transaksi sama sekali -> aman diisi langsung,
                    // karena Sisa Stok saat ini pasti masih 0/kosong (belum
                    // pernah disentuh Barang Masuk / Barang Keluar).
                    await setStokAwalSatuItem(item.id, item.kode_barang, user.gudang, row.stok_awal);

                    berhasil++;

                    reportRows.push({
                        "Kode Barang": row.kode_barang,
                        "Stok Awal Diminta": row.stok_awal,
                        "Status": "Berhasil",
                        "Keterangan": ""
                    });

                }
                catch(err){

                    console.error(`Gagal set stok awal untuk ${row.kode_barang}:`, err);

                    gagal++;

                    reportRows.push({
                        "Kode Barang": row.kode_barang,
                        "Stok Awal Diminta": row.stok_awal,
                        "Status": "Gagal",
                        "Keterangan": err.message || "Kesalahan tidak diketahui"
                    });

                }

            }

            sedangImportStokAwal = false;
            sembunyikanOverlayImportProgress();

            const totalDilewatiFormat = reportRows.length - berhasil - dilewatiSudahAdaTransaksi - tidakDitemukan - gagal;

            alert(
                `Import Stok Awal selesai.\n\n` +
                `Berhasil                                         : ${berhasil}\n` +
                `Dilewati (sudah ada transaksi Masuk/Keluar)      : ${dilewatiSudahAdaTransaksi}\n` +
                `Tidak ditemukan (kode tidak cocok)                : ${tidakDitemukan}\n` +
                `Gagal (error saat simpan)                         : ${gagal}\n` +
                `Dilewati (format baris tidak valid)               : ${totalDilewatiFormat}`
            );

            // kalau ada yang bermasalah / dilewati, tawarkan laporan detail
            // supaya gampang dicek baris mana saja yang tidak masuk & kenapa
            if((dilewatiSudahAdaTransaksi + tidakDitemukan + gagal + totalDilewatiFormat) > 0){

                const mauLaporan = confirm(
                    "Ada baris yang tidak diisi otomatis (dilewati/gagal/tidak ditemukan).\n\n" +
                    "Download laporan detail (Excel) supaya bisa dicek satu-satu?"
                );

                if(mauLaporan){

                    downloadLaporanImport(reportRows);

                }

            }

            await loadBarang();

        }
        catch(err){

            console.error(err);
            alert("Gagal import Excel: " + err.message);

        }
        finally{

            sedangImportStokAwal = false;
            sembunyikanOverlayImportProgress();

            e.target.value = "";

        }

    };

    reader.readAsArrayBuffer(file);

});

// =====================================
// DOWNLOAD LAPORAN HASIL IMPORT STOK AWAL
// =====================================

function downloadLaporanImport(reportRows){

    if(typeof XLSX === "undefined"){
        alert("Library Excel belum termuat, tidak bisa membuat laporan.");
        return;
    }

    const ws = XLSX.utils.json_to_sheet(reportRows);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Laporan Import Stok Awal");

    const tanggal = new Date().toISOString().slice(0, 10);

    XLSX.writeFile(wb, `Laporan_Import_StokAwal_${user.gudang}_${tanggal}.xlsx`);

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
