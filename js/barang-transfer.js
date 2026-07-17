// =====================================
// TRANSFER BARANG (DENGAN APPROVAL, RETUR + APPROVAL RETUR,
// DAN PERMANENKAN + APPROVAL PERMANENKAN)
// =====================================
//
// SKEMA TABEL YANG DIBUTUHKAN (lihat transfer-barang-schema.sql
// dan retur-schema.sql):
//   - stok_gudang                 (barang_id, gudang, stok, updated_at)
//   - master_gudang               (nama_gudang)            [opsional, ada fallback]
//   - barang_transfer             (header transfer)
//   - barang_transfer_detail      (item per transfer)
//   - barang_transfer_retur       (header permintaan retur)
//   - barang_transfer_retur_detail(item per permintaan retur)
//
// SKEMA TAMBAHAN UNTUK PERMANENKAN (BARU - lihat catatan SQL di bagian
// bawah pada file ini, bagian "PERMANENKAN"):
//   - barang_transfer_permanenkan        (header permintaan permanenkan)
//   - barang_transfer_permanenkan_detail (item per permintaan permanenkan)
//
// ALUR TRANSFER:
//   1. Buat transfer  -> stok gudang asal langsung berkurang, status = "Pending"
//   2. Approve        -> stok gudang tujuan bertambah, status = "Approved"
//   3. Reject          -> stok kembali ke gudang asal, status = "Rejected"
//
// ALUR RETUR (dengan approval, mendukung retur sebagian/partial):
//   1. Gudang TUJUAN (peminjam) klik "Retur" pada transfer berstatus Approved
//      -> muncul modal, pilih qty per item yang mau diretur (bisa sebagian,
//         bisa dicicil beberapa kali retur), tanggal bisa diedit, nomor
//         retur otomatis -> tersimpan dengan status "Menunggu Approval".
//      -> STOK BELUM BERUBAH di tahap ini.
//   2. Gudang ASAL (pemilik awal barang) melihat permintaan ini di panel
//      "Retur Masuk - Menunggu Approval" dan bisa Approve / Reject.
//   3. Approve -> stok gudang tujuan berkurang, stok gudang asal bertambah,
//      status = "Disetujui".
//      Reject  -> status = "Ditolak", stok tidak berubah (barang dianggap
//      tetap dipakai gudang tujuan).
//
// ALUR PERMANENKAN (BARU - kebalikan dari Retur, TIDAK ADA perpindahan stok):
//   1. Gudang TUJUAN (pemegang barang saat ini) klik "🔒 Permanenkan" pada
//      transfer berstatus Approved -> muncul modal, pilih qty per item yang
//      MEMANG tidak akan dikembalikan lagi (bisa sebagian, bisa dicicil).
//      -> tersimpan dengan status "Menunggu Approval". STOK TIDAK BERUBAH
//      sama sekali (barang memang sudah ada secara fisik di gudang tujuan
//      sejak transfer di-approve; permanenkan ini murni mengunci status
//      supaya bagian tsb tidak bisa diretur lagi).
//   2. Gudang ASAL (pengirim / pemilik awal barang) melihat permintaan ini
//      di panel "Permanenkan Masuk - Menunggu Approval" dan bisa
//      Approve / Reject.
//   3. Approve -> status = "Disetujui", qty tsb resmi tidak bisa diretur lagi.
//      Reject  -> status = "Ditolak", qty tsb kembali bisa diretur / diajukan
//      permanenkan lagi.
//
//   Kuota "sisa" antara Retur dan Permanenkan DIBAGI dari qty transfer yang
//   sama: total (sudah diretur + sudah/diminta dipermanenkan) tidak akan
//   pernah melebihi qty transfer aslinya untuk tiap barang.
//
//   Transfer aslinya TETAP berstatus "Approved" walau sudah ada retur/
//   permanenkan (mendukung tindakan bertahap/sebagian); riwayat retur &
//   riwayat permanenkan bisa dilihat di modal Detail Transfer.
//
// NOMOR TRANSFER / RETUR / PERMANENKAN OTOMATIS:
//   Format Transfer     : TRF-0001/VII/2026
//   Format Retur        : RTR-0001/VII/2026
//   Format Permanenkan  : PRM-0001/VII/2026
//   (urut 4 digit / bulan romawi / tahun)
//
//   PENTING: bulan & tahun pada nomor mengikuti TANGGAL YANG DIINPUT di
//   form (bukan tanggal sistem hari ini), dan nomor urutnya dihitung ulang
//   berdasarkan data yang sudah ada di bulan tersebut. Nomor otomatis
//   dibuat ulang setiap kali field tanggalnya diubah.
//   Urut : global lintas gudang, RESET ke 0001 setiap bulan (mengikuti
//          bulan pada tanggal yang diinput, bukan bulan sistem)
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

// Daftar gudang default kalau tabel master_gudang belum ada / kosong
const DAFTAR_GUDANG_FALLBACK = ["Raden Saleh", "Margomulyo"];

// Bulan romawi untuk format nomor transfer / retur / permanenkan
const BULAN_ROMAWI = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

// cache master data
let masterBarang = [];
let daftarGudang = [];

// counter id unik baris detail
let rowCounter = 0;

// transfer yang sedang diajukan returnya lewat modal (null jika modal tertutup)
let returTransferId = null;

// item + sisa qty yang bisa diretur untuk transfer yang sedang dibuka di modal retur
let returItemsState = [];

// transfer yang sedang diajukan permanenkan-nya lewat modal (null jika modal tertutup)
let permanenkanTransferId = null;

// item + sisa qty yang bisa dipermanenkan untuk transfer yang sedang dibuka di modal
let permanenkanItemsState = [];

// =====================================
// NAVIGASI KEYBOARD UNTUK COMBOBOX (helper umum)
// =====================================

function highlightComboItem(dropdown, activeIndex){
    const items = dropdown.querySelectorAll(".combo-item");
    items.forEach((el, idx)=>{
        if(idx === activeIndex){
            el.classList.add("combo-active");
            el.style.background = "rgba(255,255,255,0.15)";
            el.scrollIntoView({ block: "nearest" });
        } else {
            el.classList.remove("combo-active");
            el.style.background = "";
        }
    });
}

function getComboActiveIndex(dropdown){
    const items = Array.from(dropdown.querySelectorAll(".combo-item"));
    return items.findIndex(el => el.classList.contains("combo-active"));
}

// =====================================
// NOMOR OTOMATIS (GENERIK) - dipakai untuk Transfer, Retur, & Permanenkan
// Nomor & urutnya mengikuti BULAN/TAHUN dari tanggal yang diinput di form,
// bukan tanggal sistem hari ini.
// =====================================

function getBulanTahunDariTanggal(tanggalStr){

    if(tanggalStr && /^\d{4}-\d{2}-\d{2}$/.test(tanggalStr)){

        const [y, m] = tanggalStr.split("-").map(Number);

        return {
            bulanRomawi: BULAN_ROMAWI[m - 1],
            tahun: y
        };

    }

    // fallback ke tanggal sistem kalau input kosong / belum valid
    const now = new Date();

    return {
        bulanRomawi: BULAN_ROMAWI[now.getMonth()],
        tahun: now.getFullYear()
    };

}

async function generateNomorOtomatis(prefix, tableName, kolomNomor, tanggalStr){

    const { bulanRomawi, tahun } = getBulanTahunDariTanggal(tanggalStr);

    const pattern = `%/${bulanRomawi}/${tahun}`;

    let urutTerbesar = 0;

    try{

        const { data, error } = await supabaseClient
            .from(tableName)
            .select(kolomNomor)
            .ilike(kolomNomor, pattern);

        if(error) throw error;

        const regex = new RegExp(`^${prefix}-(\\d{4})\\/`);

        (data || []).forEach(row=>{

            const match = (row[kolomNomor] || "").match(regex);

            if(match){

                const angka = parseInt(match[1], 10);

                if(angka > urutTerbesar) urutTerbesar = angka;

            }

        });

    }
    catch(err){

        console.error(`Gagal menghitung nomor otomatis (${prefix}):`, err);

    }

    const urutBaru = urutTerbesar + 1;
    const urutStr = String(urutBaru).padStart(4, "0");

    return `${prefix}-${urutStr}/${bulanRomawi}/${tahun}`;

}

async function generateNoTransfer(tanggalStr){

    return generateNomorOtomatis("TRF", "barang_transfer", "no_transfer", tanggalStr);

}

async function generateNoRetur(tanggalStr){

    return generateNomorOtomatis("RTR", "barang_transfer_retur", "no_retur", tanggalStr);

}

async function generateNoPermanenkan(tanggalStr){

    return generateNomorOtomatis("PRM", "barang_transfer_permanenkan", "no_permanen", tanggalStr);

}

async function isiNomorTransferOtomatis(){

    const noTransferInput = document.getElementById("no_transfer");

    if(!noTransferInput) return;

    noTransferInput.readOnly = true;
    noTransferInput.value = "Memuat nomor...";

    const tanggalInput = document.getElementById("tanggal");

    noTransferInput.value = await generateNoTransfer(tanggalInput ? tanggalInput.value : "");

}

// =====================================
// LOAD DAFTAR GUDANG
// =====================================

async function loadGudang(){

    try{

        const { data, error } = await supabaseClient
            .from("master_gudang")
            .select("*")
            .order("nama_gudang");

        if(error) throw error;

        daftarGudang = (data && data.length > 0)
            ? data.map(g => g.nama_gudang)
            : [...DAFTAR_GUDANG_FALLBACK];

    }
    catch(err){

        console.error("Gagal load master_gudang, pakai daftar bawaan.", err);
        daftarGudang = [...DAFTAR_GUDANG_FALLBACK];

    }

    isiDropdownGudang();

}

function isiDropdownGudang(){

    const gudangAsal = document.getElementById("gudangAsal");
    const gudangTujuan = document.getElementById("gudangTujuan");

    if(!gudangAsal || !gudangTujuan) return;

    // Gudang Asal dikunci = gudang akun yang sedang login, tidak bisa dipilih.
    gudangAsal.value = (user && user.gudang) ? user.gudang : "";
    gudangAsal.readOnly = true;

    // Gudang Tujuan hanya menampilkan gudang LAIN (gudang sendiri dikecualikan)
    const pilihanTujuan = daftarGudang.filter(g => g !== gudangAsal.value);

    gudangTujuan.innerHTML = pilihanTujuan
        .map(g => `<option value="${g}">${g}</option>`)
        .join("");

    if(pilihanTujuan.length > 0){

        gudangTujuan.value = pilihanTujuan[0];

    }

    const labelGudangUser = document.getElementById("labelGudangUser");

    if(labelGudangUser){

        labelGudangUser.textContent = (user && user.gudang) ? user.gudang : "-";

    }

    const labelGudangUserRetur = document.getElementById("labelGudangUserRetur");

    if(labelGudangUserRetur){

        labelGudangUserRetur.textContent = (user && user.gudang) ? user.gudang : "-";

    }

    const labelGudangUserPermanenkan = document.getElementById("labelGudangUserPermanenkan");

    if(labelGudangUserPermanenkan){

        labelGudangUserPermanenkan.textContent = (user && user.gudang) ? user.gudang : "-";

    }

}

// =====================================
// LOAD MASTER BARANG
// =====================================

async function loadBarang(){

    try{

        const { data, error } = await supabaseClient
            .from("master_barang")
            .select("*")
            .order("nama_barang");

        if(error) throw error;

        masterBarang = data || [];

        refreshSemuaBarisStok();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// STOK PER GUDANG
// =====================================

async function ambilStokGudang(barangId, gudang){

    if(!barangId || !gudang) return 0;

    try{

        const { data, error } = await supabaseClient
            .from("stok_gudang")
            .select("stok")
            .eq("barang_id", barangId)
            .eq("gudang", gudang)
            .maybeSingle();

        if(error) throw error;

        return data ? (data.stok || 0) : 0;

    }
    catch(err){

        console.error(err);
        return 0;

    }

}

async function tambahStokGudang(barangId, gudang, delta){

    // ambil baris stok_gudang yang ada (kalau belum ada, anggap 0)
    const { data:existing, error:errGet } = await supabaseClient
        .from("stok_gudang")
        .select("*")
        .eq("barang_id", barangId)
        .eq("gudang", gudang)
        .maybeSingle();

    if(errGet) throw errGet;

    if(existing){

        const stokBaru = (existing.stok || 0) + delta;

        const { error:errUpdate } = await supabaseClient
            .from("stok_gudang")
            .update({
                stok: stokBaru,
                updated_at: new Date().toISOString()
            })
            .eq("id", existing.id);

        if(errUpdate) throw errUpdate;

    } else {

        const { error:errInsert } = await supabaseClient
            .from("stok_gudang")
            .insert([{
                barang_id: barangId,
                gudang: gudang,
                stok: delta,
                updated_at: new Date().toISOString()
            }]);

        if(errInsert) throw errInsert;

    }

}

// Helper: cari barang_id dari kode_barang (dipakai saat kita hanya punya
// data histori barang_transfer_detail yang menyimpan kode_barang, bukan id)
function cariBarangIdDariKode(kodeBarang){

    const barang = masterBarang.find(b => b.kode_barang === kodeBarang);

    return barang ? barang.id : null;

}

// =====================================
// BADGE STOK PER BARIS (mengikuti Gudang Asal yang dipilih)
// =====================================

async function refreshStokBaris(row){

    const badge = row.querySelector(".stok-badge");

    const kodeBarang = row.dataset.kodeBarang;
    const barangId = row.querySelector(".input-barang-id").value;

    const gudangAsal = document.getElementById("gudangAsal").value;

    if(!kodeBarang || !barangId){

        badge.textContent = "Stok: -";
        badge.classList.remove("warning");
        row.dataset.stok = "0";

        return;

    }

    const stok = await ambilStokGudang(barangId, gudangAsal);

    row.dataset.stok = stok;
    badge.textContent = `Stok: ${stok}`;

    validasiQtyBaris(row);

}

function refreshSemuaBarisStok(){

    const rows = document.querySelectorAll("#detailRows .detail-row");

    rows.forEach(row=>{

        if(row.dataset.kodeBarang) refreshStokBaris(row);

    });

}

function validasiQtyBaris(row){

    const badge = row.querySelector(".stok-badge");
    const qtyInput = row.querySelector(".input-qty");

    const stok = parseInt(row.dataset.stok || "0");
    const qty = parseInt(qtyInput.value || "0");

    if(qty > stok){

        row.classList.add("qty-invalid");
        badge.classList.add("warning");

    } else {

        row.classList.remove("qty-invalid");
        badge.classList.remove("warning");

    }

}

// ganti gudang asal -> refresh semua badge stok baris
document.addEventListener("DOMContentLoaded", ()=>{

    const gudangAsalEl = document.getElementById("gudangAsal");

    if(gudangAsalEl){

        gudangAsalEl.addEventListener("change", refreshSemuaBarisStok);

    }

});

// =====================================
// BARIS DETAIL BARANG (MULTI ITEM)
// =====================================

function tambahBarisBarang(){

    rowCounter++;

    const rowId = `row-${rowCounter}`;

    const wrapper = document.getElementById("detailRows");

    if(!wrapper){

        console.error("Elemen #detailRows tidak ditemukan di halaman.");
        return;

    }

    const row = document.createElement("div");

    row.className = "detail-row";
    row.id = rowId;
    row.dataset.stok = "0";
    row.dataset.kodeBarang = "";

    row.innerHTML = `

        <div class="combo-wrapper">
            <input type="text" class="combo-input input-barang-search"
                placeholder="-- Cari Barang --" autocomplete="off" required>
            <input type="hidden" class="input-barang-id">
            <div class="combo-dropdown input-barang-dropdown"></div>
        </div>

        <input type="text" class="input-readonly input-kategori" placeholder="Kategori" readonly>

        <input type="text" class="input-readonly input-satuan" placeholder="Satuan" readonly>

        <span class="stok-badge">Stok: -</span>

        <input type="number" class="input-qty" placeholder="Qty" min="1" required>

        <button type="button" class="btn-hapus-baris" title="Hapus baris">✕</button>

    `;

    wrapper.appendChild(row);

}

function hapusBarisBarang(row){

    const wrapper = document.getElementById("detailRows");

    if(wrapper.children.length <= 1){

        alert("Minimal harus ada 1 baris barang.");
        return;

    }

    row.remove();

}

// =====================================
// COMBOBOX PENCARIAN BARANG PER BARIS
// =====================================

function renderBarangDropdown(row, keyword){

    const dropdown = row.querySelector(".input-barang-dropdown");

    const kw = (keyword || "").trim().toLowerCase();

    const filtered = masterBarang.filter(b =>
        b.nama_barang.toLowerCase().includes(kw)
    );

    dropdown.innerHTML = "";

    if(filtered.length === 0){

        dropdown.innerHTML =
            `<div class="combo-empty">Barang tidak ditemukan</div>`;

    } else {

        filtered.forEach(b=>{

            const item = document.createElement("div");

            item.className = "combo-item";
            item.textContent = b.nama_barang;
            item.dataset.id = b.id;

            dropdown.appendChild(item);

        });

    }

    dropdown.classList.add("show");

}

// =====================================
// EVENT DELEGATION UNTUK SEMUA BARIS DI #detailRows
// Termasuk navigasi keyboard: panah bawah/atas, Enter, Esc.
// =====================================

const detailRowsContainer = document.getElementById("detailRows");

if(detailRowsContainer){

detailRowsContainer.addEventListener("input", function(e){

    const row = e.target.closest(".detail-row");

    if(!row) return;

    if(e.target.classList.contains("input-barang-search")){

        row.querySelector(".input-barang-id").value = "";
        row.querySelector(".input-kategori").value = "";
        row.querySelector(".input-satuan").value = "";
        row.dataset.kodeBarang = "";

        refreshStokBaris(row);

        renderBarangDropdown(row, e.target.value);

        return;

    }

    if(e.target.classList.contains("input-qty")){

        validasiQtyBaris(row);

    }

});

detailRowsContainer.addEventListener("focusin", function(e){

    if(e.target.classList.contains("input-barang-search")){

        const row = e.target.closest(".detail-row");

        if(row) renderBarangDropdown(row, e.target.value);

    }

});

// Navigasi keyboard untuk dropdown pencarian barang
detailRowsContainer.addEventListener("keydown", function(e){

    if(!e.target.classList.contains("input-barang-search")) return;

    const row = e.target.closest(".detail-row");

    if(!row) return;

    const dropdown = row.querySelector(".input-barang-dropdown");

    if(!dropdown || !dropdown.classList.contains("show")) return;

    const items = dropdown.querySelectorAll(".combo-item");

    if(items.length === 0) return;

    let activeIndex = getComboActiveIndex(dropdown);

    if(e.key === "ArrowDown"){
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        highlightComboItem(dropdown, activeIndex);
    } else if(e.key === "ArrowUp"){
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        highlightComboItem(dropdown, activeIndex);
    } else if(e.key === "Enter"){
        if(activeIndex >= 0 && activeIndex < items.length){
            e.preventDefault();
            items[activeIndex].click();
        }
    } else if(e.key === "Escape"){
        dropdown.classList.remove("show");
    }

});

detailRowsContainer.addEventListener("click", function(e){

    if(e.target.classList.contains("btn-hapus-baris")){

        const row = e.target.closest(".detail-row");

        if(row) hapusBarisBarang(row);

        return;

    }

    const comboItem = e.target.closest(".combo-item");

    if(comboItem && comboItem.dataset.id && comboItem.closest(".input-barang-dropdown")){

        const row = e.target.closest(".detail-row");

        if(!row) return;

        const barang = masterBarang.find(
            b => String(b.id) === String(comboItem.dataset.id)
        );

        if(!barang) return;

        row.querySelector(".input-barang-search").value = barang.nama_barang;
        row.querySelector(".input-barang-id").value = barang.id;
        row.querySelector(".input-kategori").value = barang.kategori;
        row.querySelector(".input-satuan").value = barang.satuan;

        row.dataset.kodeBarang = barang.kode_barang;

        row.querySelector(".input-barang-dropdown").classList.remove("show");

        refreshStokBaris(row);

    }

});

}

const btnTambahBarisEl = document.getElementById("btnTambahBaris");

if(btnTambahBarisEl){

    btnTambahBarisEl.addEventListener("click", function(){

        tambahBarisBarang();

    });

}

// tutup dropdown saat klik di luar
document.addEventListener("click", function(e){

    document.querySelectorAll(".combo-wrapper").forEach(wrapper=>{

        if(!wrapper.contains(e.target)){

            const dd = wrapper.querySelector(".combo-dropdown");

            if(dd) dd.classList.remove("show");

        }

    });

});

// =====================================
// SIMPAN TRANSFER BARANG
// =====================================

const formTransfer = document.getElementById("formTransferHeader");
const btnSimpanTransferEl = document.getElementById("btnSimpanTransfer");

if(btnSimpanTransferEl){

btnSimpanTransferEl.addEventListener("click", simpanTransfer);

}

async function simpanTransfer(e){

    if(e) e.preventDefault();

    try{

        //---------------------------------
        // VALIDASI HEADER
        //---------------------------------

        const tanggal = document.getElementById("tanggal").value;
        const noTransfer = document.getElementById("no_transfer").value.trim();
        const gudangAsal = document.getElementById("gudangAsal").value;
        const gudangTujuan = document.getElementById("gudangTujuan").value;
        const keterangan = document.getElementById("keterangan").value.trim();

        if(tanggal==""){
            alert("Tanggal wajib diisi.");
            return;
        }

        if(noTransfer=="" || noTransfer==="Memuat nomor..."){
            alert("Nomor Transfer belum siap, coba tunggu sebentar atau muat ulang halaman.");
            return;
        }

        if(gudangAsal=="" || gudangTujuan==""){
            alert("Gudang Asal dan Gudang Tujuan wajib dipilih.");
            return;
        }

        if(gudangAsal === gudangTujuan){
            alert("Gudang Asal dan Gudang Tujuan tidak boleh sama.");
            return;
        }

        //---------------------------------
        // VALIDASI NOMOR TRANSFER
        // (double check ke DB - jaga-jaga kalau ada nomor bentrok
        // karena dibuat hampir bersamaan oleh user lain)
        //---------------------------------

        const { data:cekNomor } = await supabaseClient
            .from("barang_transfer")
            .select("id")
            .eq("no_transfer", noTransfer);

        if(cekNomor && cekNomor.length>0){

            alert("Nomor Transfer sudah digunakan (kemungkinan dibuat bersamaan oleh user lain). Nomor baru akan dibuatkan otomatis, silakan simpan ulang.");

            await isiNomorTransferOtomatis();

            return;

        }

        //---------------------------------
        // VALIDASI DETAIL BARANG
        //---------------------------------

        const rows = document.querySelectorAll("#detailRows .detail-row");

        if(rows.length===0){
            alert("Tambahkan minimal 1 barang.");
            return;
        }

        const itemList = [];
        const kodeSudahDipakai = new Set();

        for(const row of rows){

            const barangId = row.querySelector(".input-barang-id").value;
            const qty = parseInt(row.querySelector(".input-qty").value);

            if(barangId===""){
                alert("Ada baris yang belum memilih barang dari daftar pencarian.");
                return;
            }

            if(!qty || qty<=0){
                alert("Qty harus lebih dari 0 untuk setiap barang.");
                return;
            }

            const barang = masterBarang.find(
                b => String(b.id) === String(barangId)
            );

            if(!barang){
                alert("Data barang tidak ditemukan, coba muat ulang halaman.");
                return;
            }

            if(kodeSudahDipakai.has(barang.kode_barang)){
                alert(
                    `Barang "${barang.nama_barang}" dipilih lebih dari satu kali.\n` +
                    `Gabungkan qty-nya dalam satu baris saja.`
                );
                return;
            }

            kodeSudahDipakai.add(barang.kode_barang);

            // cek ulang stok realtime di gudang asal saat submit
            const stokSaatIni = await ambilStokGudang(barang.id, gudangAsal);

            if(qty > stokSaatIni){
                alert(
                    `Stok "${barang.nama_barang}" di gudang ${gudangAsal} tidak mencukupi.\n\n` +
                    `Stok tersedia : ${stokSaatIni}`
                );
                return;
            }

            itemList.push({ barang, qty });

        }

        //---------------------------------
        // SIMPAN HEADER (status Pending)
        //---------------------------------

        const { data:header, error:headerError } = await supabaseClient
            .from("barang_transfer")
            .insert([{
                no_transfer: noTransfer,
                tanggal,
                gudang_asal: gudangAsal,
                gudang_tujuan: gudangTujuan,
                status: "Pending",
                keterangan,
                created_by: user.nama
            }])
            .select()
            .single();

        if(headerError) throw headerError;

        //---------------------------------
        // SIMPAN DETAIL + KURANGI STOK GUDANG ASAL
        //---------------------------------

        for(const { barang, qty } of itemList){

            const { error:detailError } = await supabaseClient
                .from("barang_transfer_detail")
                .insert([{
                    transfer_id: header.id,
                    kode_barang: barang.kode_barang,
                    nama_barang: barang.nama_barang,
                    kategori: barang.kategori,
                    satuan: barang.satuan,
                    qty
                }]);

            if(detailError) throw detailError;

            // stok gudang asal langsung berkurang (barang "dalam perjalanan")
            await tambahStokGudang(barang.id, gudangAsal, -qty);

        }

        //---------------------------------
        // SELESAI
        //---------------------------------

        alert(`Transfer Barang berhasil dibuat (${itemList.length} item), menunggu approval dari ${gudangTujuan}.`);

        await resetFormTransfer();

        await loadPendingApproval();
        await loadRiwayatTransfer();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

async function resetFormTransfer(){

    if(formTransfer) formTransfer.reset();

    document.getElementById("tanggal").value =
        new Date().toISOString().split("T")[0];

    isiDropdownGudang();

    document.getElementById("detailRows").innerHTML = "";

    tambahBarisBarang();

    // buatkan nomor transfer baru untuk transaksi berikutnya
    await isiNomorTransferOtomatis();

}

// =====================================
// LOAD TRANSFER PENDING (UNTUK APPROVAL)
// =====================================

async function loadPendingApproval(){

    try{

        if(!user || !user.gudang) return;

        const { data, error } = await supabaseClient
            .from("barang_transfer")
            .select("*")
            .eq("gudang_tujuan", user.gudang)
            .eq("status", "Pending")
            .order("tanggal", { ascending:false })
            .order("id", { ascending:false });

        if(error) throw error;

        await tampilkanPendingApproval(data || []);

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

async function tampilkanPendingApproval(data){

    const tbody = document.querySelector("#tablePending tbody");

    tbody.innerHTML = "";

    if(data.length===0){

        tbody.innerHTML = `
        <tr>
            <td colspan="7" class="empty-state">
                Tidak ada transfer yang menunggu approval.
            </td>
        </tr>
        `;

        return;

    }

    let no=1;

    for(const item of data){

        const jumlahItem = await hitungJumlahItem(item.id);

        tbody.innerHTML += `
        <tr>
            <td>${no++}</td>
            <td><b>${item.no_transfer}</b></td>
            <td>${item.tanggal}</td>
            <td>${item.gudang_asal}</td>
            <td>
                <button class="btn-edit" onclick="lihatDetailTransfer(${item.id})">📦 ${jumlahItem} item</button>
            </td>
            <td>${item.created_by ?? "-"}</td>
            <td>
                <button class="btn-approve" onclick="approveTransfer(${item.id})">✅ Approve</button>
                <button class="btn-reject" onclick="rejectTransfer(${item.id})">❌ Reject</button>
            </td>
        </tr>
        `;

    }

}

async function hitungJumlahItem(transferId){

    const { data } = await supabaseClient
        .from("barang_transfer_detail")
        .select("id")
        .eq("transfer_id", transferId);

    return data ? data.length : 0;

}

// =====================================
// APPROVE TRANSFER
// =====================================

async function approveTransfer(id){

    if(!confirm("Approve transfer ini? Stok akan bertambah di gudang Anda.")) return;

    try{

        const { data:header, error:errHeader } = await supabaseClient
            .from("barang_transfer")
            .select("*")
            .eq("id", id)
            .single();

        if(errHeader) throw errHeader;

        if(header.status !== "Pending"){
            alert("Transfer ini sudah tidak berstatus Pending.");
            return;
        }

        const { data:detail, error:errDetail } = await supabaseClient
            .from("barang_transfer_detail")
            .select("*")
            .eq("transfer_id", id);

        if(errDetail) throw errDetail;

        for(const item of detail){

            const barangId = cariBarangIdDariKode(item.kode_barang);

            if(!barangId){
                console.warn(`Barang dengan kode ${item.kode_barang} tidak ditemukan di master_barang, stok tidak diupdate.`);
                continue;
            }

            await tambahStokGudang(barangId, header.gudang_tujuan, item.qty);

        }

        const { error:errUpdate } = await supabaseClient
            .from("barang_transfer")
            .update({
                status: "Approved",
                approved_by: user.nama,
                approved_at: new Date().toISOString()
            })
            .eq("id", id);

        if(errUpdate) throw errUpdate;

        alert("Transfer berhasil di-approve. Stok gudang Anda sudah bertambah.");

        await loadPendingApproval();
        await loadRiwayatTransfer();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// REJECT TRANSFER
// =====================================

async function rejectTransfer(id){

    if(!confirm("Reject transfer ini? Stok akan dikembalikan ke gudang asal.")) return;

    try{

        const { data:header, error:errHeader } = await supabaseClient
            .from("barang_transfer")
            .select("*")
            .eq("id", id)
            .single();

        if(errHeader) throw errHeader;

        if(header.status !== "Pending"){
            alert("Transfer ini sudah tidak berstatus Pending.");
            return;
        }

        const { data:detail, error:errDetail } = await supabaseClient
            .from("barang_transfer_detail")
            .select("*")
            .eq("transfer_id", id);

        if(errDetail) throw errDetail;

        for(const item of detail){

            const barangId = cariBarangIdDariKode(item.kode_barang);

            if(!barangId){
                console.warn(`Barang dengan kode ${item.kode_barang} tidak ditemukan di master_barang, stok tidak diupdate.`);
                continue;
            }

            await tambahStokGudang(barangId, header.gudang_asal, item.qty);

        }

        const { error:errUpdate } = await supabaseClient
            .from("barang_transfer")
            .update({
                status: "Rejected",
                approved_by: user.nama,
                approved_at: new Date().toISOString()
            })
            .eq("id", id);

        if(errUpdate) throw errUpdate;

        alert("Transfer ditolak. Stok sudah dikembalikan ke gudang asal.");

        await loadPendingApproval();
        await loadRiwayatTransfer();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// HITUNG SISA YANG BISA DIRETUR / DIPERMANENKAN PER ITEM TRANSFER
// (qty transfer - qty yang sudah retur - qty yang sudah/diminta permanenkan)
// Kuota ini DIBAGI antara Retur dan Permanenkan.
// =====================================

async function ambilDetailTransfer(transferId){

    const { data, error } = await supabaseClient
        .from("barang_transfer_detail")
        .select("*")
        .eq("transfer_id", transferId)
        .order("id");

    if(error) throw error;

    return data || [];

}

async function hitungSisaTindakan(transferId, detailTransfer){

    // retur yang masih "menahan kuota": sudah disetujui ATAU masih menunggu approval
    const { data: returHeaders, error: errReturHeader } = await supabaseClient
        .from("barang_transfer_retur")
        .select("id")
        .eq("transfer_id", transferId)
        .in("status", ["Menunggu Approval", "Disetujui"]);

    if(errReturHeader) throw errReturHeader;

    const returIds = (returHeaders || []).map(r => r.id);

    let returDetails = [];

    if(returIds.length > 0){

        const { data, error } = await supabaseClient
            .from("barang_transfer_retur_detail")
            .select("*")
            .in("retur_id", returIds);

        if(error) throw error;

        returDetails = data || [];

    }

    // permanenkan yang masih "menahan kuota": sudah disetujui ATAU masih menunggu approval
    const { data: permHeaders, error: errPermHeader } = await supabaseClient
        .from("barang_transfer_permanenkan")
        .select("id")
        .eq("transfer_id", transferId)
        .in("status", ["Menunggu Approval", "Disetujui"]);

    if(errPermHeader) throw errPermHeader;

    const permIds = (permHeaders || []).map(r => r.id);

    let permDetails = [];

    if(permIds.length > 0){

        const { data, error } = await supabaseClient
            .from("barang_transfer_permanenkan_detail")
            .select("*")
            .in("permanen_id", permIds);

        if(error) throw error;

        permDetails = data || [];

    }

    const sudahDiretur = new Map();

    returDetails.forEach(d=>{

        const key = d.kode_barang;
        sudahDiretur.set(key, (sudahDiretur.get(key) || 0) + Number(d.qty));

    });

    const sudahDipermanenkan = new Map();

    permDetails.forEach(d=>{

        const key = d.kode_barang;
        sudahDipermanenkan.set(key, (sudahDipermanenkan.get(key) || 0) + Number(d.qty));

    });

    return detailTransfer.map(item => {

        const dr = sudahDiretur.get(item.kode_barang) || 0;
        const dp = sudahDipermanenkan.get(item.kode_barang) || 0;

        return {
            ...item,
            sudahDiretur: dr,
            sudahDipermanenkan: dp,
            sisa: Number(item.qty) - dr - dp
        };

    });

}

async function adaSisaTindakan(transferId){

    try{

        const detail = await ambilDetailTransfer(transferId);

        if(detail.length === 0) return false;

        const withSisa = await hitungSisaTindakan(transferId, detail);

        return withSisa.some(d => d.sisa > 0);

    }
    catch(err){

        console.error(err);
        return false;

    }

}

// =====================================
// MODAL PERMINTAAN RETUR (dibuka oleh Gudang Tujuan / peminjam)
// =====================================

async function bukaModalRetur(transferId){

    try{

        const { data: header, error: errHeader } = await supabaseClient
            .from("barang_transfer")
            .select("*")
            .eq("id", transferId)
            .single();

        if(errHeader) throw errHeader;

        if(header.status !== "Approved"){
            alert("Hanya transfer berstatus Approved yang bisa diretur.");
            return;
        }

        if(user.gudang !== header.gudang_tujuan){
            alert("Hanya gudang tujuan (peminjam) yang bisa mengajukan retur.");
            return;
        }

        const detail = await ambilDetailTransfer(transferId);

        const withSisa = await hitungSisaTindakan(transferId, detail);

        const adaSisa = withSisa.filter(d => d.sisa > 0);

        if(adaSisa.length === 0){

            alert("Semua item pada transfer ini sudah diretur / dipermanenkan / sedang menunggu approval.");
            return;

        }

        returTransferId = transferId;
        returItemsState = adaSisa;

        document.getElementById("returHeaderInfo").innerHTML = `
            <div>No. Transfer : <b>${header.no_transfer}</b></div>
            <div>Gudang Asal : <b>${header.gudang_asal}</b></div>
            <div>Gudang Tujuan : <b>${header.gudang_tujuan}</b></div>
        `;

        document.getElementById("returTanggal").value =
            new Date().toISOString().split("T")[0];

        document.getElementById("returKeterangan").value = "";

        const noReturInput = document.getElementById("returNoRetur");

        noReturInput.value = "Memuat nomor...";
        noReturInput.value = await generateNoRetur(document.getElementById("returTanggal").value);

        renderReturItemsTable();

        document.getElementById("modalRetur").classList.add("show");

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

function renderReturItemsTable(){

    const tbody = document.getElementById("returItemsBody");

    tbody.innerHTML = returItemsState.map((item, idx) => `
        <tr>
            <td style="text-align:center;">
                <input type="checkbox" class="retur-select-checkbox" data-idx="${idx}" checked>
            </td>
            <td><span class="kode-pill">${item.kode_barang}</span></td>
            <td>${item.nama_barang}</td>
            <td>${item.satuan ?? "-"}</td>
            <td>${item.qty}</td>
            <td>${item.sudahDiretur + item.sudahDipermanenkan}</td>
            <td><b>${item.sisa}</b></td>
            <td>
                <input type="number" class="input-qty retur-qty-input"
                    data-idx="${idx}" min="0" max="${item.sisa}" value="${item.sisa}">
            </td>
        </tr>
    `).join("");

    // setiap kali tabel di-render ulang (modal dibuka), pastikan
    // checkbox "pilih semua" ikut ter-centang dari awal
    const checkAllEl = document.getElementById("returCheckAll");

    if(checkAllEl) checkAllEl.checked = true;

}

// =====================================
// CENTANG PILIH BARANG PER BARIS (RETUR)
// Barang yang centangnya dilepas akan DIABAIKAN saat submit, walaupun
// Qty Retur-nya masih terisi. Ini memudahkan pengembalian sebagian
// barang saja (misal pinjam 3 barang, baru retur 2, sisanya menyusul).
// =====================================

const returItemsBodyEl = document.getElementById("returItemsBody");

if(returItemsBodyEl){

    returItemsBodyEl.addEventListener("change", function(e){

        if(!e.target.classList.contains("retur-select-checkbox")) return;

        const row = e.target.closest("tr");

        if(!row) return;

        const qtyInput = row.querySelector(".retur-qty-input");

        if(!qtyInput) return;

        if(e.target.checked){

            // dicentang lagi -> kembalikan Qty Retur ke nilai sebelumnya
            // (atau ke sisa maksimal kalau belum pernah diisi)
            qtyInput.disabled = false;
            qtyInput.value = qtyInput.dataset.prevValue || qtyInput.max;

        } else {

            // dilepas centangnya -> simpan Qty Retur saat ini, lalu kosongkan
            // supaya baris ini otomatis diabaikan saat "Ajukan Retur"
            qtyInput.dataset.prevValue = qtyInput.value;
            qtyInput.value = 0;
            qtyInput.disabled = true;

        }

        // sinkronkan status checkbox "pilih semua" di header
        const checkAllEl = document.getElementById("returCheckAll");

        if(checkAllEl){

            const semuaCheckbox = returItemsBodyEl.querySelectorAll(".retur-select-checkbox");
            const semuaTercentang = Array.from(semuaCheckbox).every(cb => cb.checked);

            checkAllEl.checked = semuaTercentang;

        }

    });

}

const returCheckAllEl = document.getElementById("returCheckAll");

if(returCheckAllEl){

    returCheckAllEl.addEventListener("change", function(){

        const checkboxes = document.querySelectorAll(".retur-select-checkbox");

        checkboxes.forEach(cb=>{

            if(cb.checked !== this.checked){

                cb.checked = this.checked;
                cb.dispatchEvent(new Event("change", { bubbles:true }));

            }

        });

    });

}

function tutupModalRetur(){

    const modal = document.getElementById("modalRetur");

    if(modal) modal.classList.remove("show");

    returTransferId = null;
    returItemsState = [];

}

const btnSimpanReturEl = document.getElementById("btnSimpanRetur");

if(btnSimpanReturEl){

    btnSimpanReturEl.addEventListener("click", submitRetur);

}

async function submitRetur(e){

    if(e) e.preventDefault();

    try{

        if(returTransferId === null){
            alert("Tidak ada transfer yang sedang diretur.");
            return;
        }

        const tanggal = document.getElementById("returTanggal").value;
        const noRetur = document.getElementById("returNoRetur").value.trim();
        const keterangan = document.getElementById("returKeterangan").value.trim();

        if(!tanggal){
            alert("Tanggal retur wajib diisi.");
            return;
        }

        if(!noRetur || noRetur === "Memuat nomor..."){
            alert("Nomor Retur belum siap, coba tunggu sebentar.");
            return;
        }

        //---------------------------------
        // AMBIL QTY RETUR DARI INPUT
        //---------------------------------

        const qtyInputs = document.querySelectorAll(".retur-qty-input");

        const itemDipilih = [];

        for(const input of qtyInputs){

            const idx = parseInt(input.dataset.idx);
            const item = returItemsState[idx];

            // baris yang centangnya dilepas dianggap TIDAK diretur sekarang,
            // walaupun input Qty Retur-nya masih ada nilai tersimpan
            const checkboxEl = document.querySelector(
                `.retur-select-checkbox[data-idx="${idx}"]`
            );
            const dipilih = checkboxEl ? checkboxEl.checked : true;

            if(!dipilih) continue;

            const qty = parseInt(input.value);

            if(!qty) continue;

            if(qty < 0){

                alert(`Qty retur "${item.nama_barang}" tidak boleh negatif.`);
                return;

            }

            if(qty > item.sisa){

                alert(
                    `Qty retur "${item.nama_barang}" melebihi sisa yang bisa diretur (${item.sisa}).`
                );
                return;

            }

            if(qty > 0){

                itemDipilih.push({ ...item, qtyRetur: qty });

            }

        }

        if(itemDipilih.length === 0){
            alert("Pilih (centang) minimal 1 barang dan isi qty retur lebih dari 0.");
            return;
        }

        //---------------------------------
        // CEK ULANG NOMOR RETUR (jaga race condition)
        //---------------------------------

        const { data: cekNomor } = await supabaseClient
            .from("barang_transfer_retur")
            .select("id")
            .eq("no_retur", noRetur);

        if(cekNomor && cekNomor.length > 0){

            alert("Nomor Retur sudah digunakan (kemungkinan dibuat bersamaan). Silakan tutup lalu buka ulang modal Retur untuk nomor baru.");
            return;

        }

        const { data: header, error: errHeader } = await supabaseClient
            .from("barang_transfer")
            .select("*")
            .eq("id", returTransferId)
            .single();

        if(errHeader) throw errHeader;

        //---------------------------------
        // SIMPAN HEADER RETUR (status Menunggu Approval, stok BELUM berubah)
        //---------------------------------

        const { data: returHeader, error: returHeaderErr } = await supabaseClient
            .from("barang_transfer_retur")
            .insert([{
                transfer_id: returTransferId,
                no_retur: noRetur,
                tanggal,
                gudang_asal: header.gudang_asal,
                gudang_tujuan: header.gudang_tujuan,
                keterangan,
                status: "Menunggu Approval",
                created_by: user.nama
            }])
            .select()
            .single();

        if(returHeaderErr) throw returHeaderErr;

        for(const item of itemDipilih){

            const { error: detailErr } = await supabaseClient
                .from("barang_transfer_retur_detail")
                .insert([{
                    retur_id: returHeader.id,
                    kode_barang: item.kode_barang,
                    nama_barang: item.nama_barang,
                    kategori: item.kategori,
                    satuan: item.satuan,
                    qty: item.qtyRetur
                }]);

            if(detailErr) throw detailErr;

        }

        alert(`Permintaan Retur berhasil dibuat (${noRetur}), menunggu approval dari ${header.gudang_asal}.`);

        tutupModalRetur();

        await loadRiwayatTransfer();
        await loadPendingReturApproval();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// PANEL RETUR MASUK - MENUNGGU APPROVAL (dilihat oleh Gudang Asal)
// =====================================

async function loadPendingReturApproval(){

    try{

        if(!user || !user.gudang) return;

        const { data, error } = await supabaseClient
            .from("barang_transfer_retur")
            .select("*")
            .eq("gudang_asal", user.gudang)
            .eq("status", "Menunggu Approval")
            .order("tanggal", { ascending:false })
            .order("id", { ascending:false });

        if(error) throw error;

        await tampilkanPendingReturApproval(data || []);

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

async function hitungJumlahItemRetur(returId){

    const { data } = await supabaseClient
        .from("barang_transfer_retur_detail")
        .select("id")
        .eq("retur_id", returId);

    return data ? data.length : 0;

}

async function tampilkanPendingReturApproval(data){

    const tbody = document.querySelector("#tablePendingRetur tbody");

    if(!tbody) return;

    tbody.innerHTML = "";

    if(data.length === 0){

        tbody.innerHTML = `
        <tr>
            <td colspan="7" class="empty-state">
                Tidak ada retur yang menunggu approval.
            </td>
        </tr>
        `;

        return;

    }

    let no = 1;

    for(const item of data){

        const jumlahItem = await hitungJumlahItemRetur(item.id);

        tbody.innerHTML += `
        <tr>
            <td>${no++}</td>
            <td><b>${item.no_retur}</b></td>
            <td>${item.tanggal}</td>
            <td>${item.gudang_tujuan}</td>
            <td>
                <button class="btn-edit" onclick="lihatDetailRetur(${item.id})">📦 ${jumlahItem} item</button>
            </td>
            <td>${item.created_by ?? "-"}</td>
            <td>
                <button class="btn-approve" onclick="approveRetur(${item.id})">✅ Approve</button>
                <button class="btn-reject" onclick="rejectRetur(${item.id})">❌ Reject</button>
            </td>
        </tr>
        `;

    }

}

// =====================================
// APPROVE / REJECT RETUR
// =====================================

async function approveRetur(id){

    if(!confirm("Approve retur ini? Stok akan berpindah kembali ke gudang Anda.")) return;

    try{

        const { data: header, error: errHeader } = await supabaseClient
            .from("barang_transfer_retur")
            .select("*")
            .eq("id", id)
            .single();

        if(errHeader) throw errHeader;

        if(header.status !== "Menunggu Approval"){
            alert("Retur ini sudah tidak berstatus Menunggu Approval.");
            return;
        }

        const { data: detail, error: errDetail } = await supabaseClient
            .from("barang_transfer_retur_detail")
            .select("*")
            .eq("retur_id", id);

        if(errDetail) throw errDetail;

        for(const item of detail){

            const barangId = cariBarangIdDariKode(item.kode_barang);

            if(!barangId){
                console.warn(`Barang dengan kode ${item.kode_barang} tidak ditemukan di master_barang, stok tidak diupdate.`);
                continue;
            }

            // stok berkurang di gudang tujuan (yang mengembalikan)
            await tambahStokGudang(barangId, header.gudang_tujuan, -item.qty);

            // stok bertambah kembali di gudang asal (pemilik awal)
            await tambahStokGudang(barangId, header.gudang_asal, item.qty);

        }

        const { error: errUpdate } = await supabaseClient
            .from("barang_transfer_retur")
            .update({
                status: "Disetujui",
                approved_by: user.nama,
                approved_at: new Date().toISOString()
            })
            .eq("id", id);

        if(errUpdate) throw errUpdate;

        alert("Retur disetujui. Stok sudah berpindah kembali.");

        await loadPendingReturApproval();
        await loadRiwayatTransfer();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

async function rejectRetur(id){

    if(!confirm("Tolak permintaan retur ini? Barang dianggap tetap berada di gudang tujuan.")) return;

    try{

        const { data: header, error: errHeader } = await supabaseClient
            .from("barang_transfer_retur")
            .select("*")
            .eq("id", id)
            .single();

        if(errHeader) throw errHeader;

        if(header.status !== "Menunggu Approval"){
            alert("Retur ini sudah tidak berstatus Menunggu Approval.");
            return;
        }

        const { error: errUpdate } = await supabaseClient
            .from("barang_transfer_retur")
            .update({
                status: "Ditolak",
                approved_by: user.nama,
                approved_at: new Date().toISOString()
            })
            .eq("id", id);

        if(errUpdate) throw errUpdate;

        alert("Permintaan retur ditolak.");

        await loadPendingReturApproval();
        await loadRiwayatTransfer();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================================================
// PERMANENKAN (BARU)
// =====================================================================
//
// SQL yang perlu dijalankan sekali di Supabase (silakan jalankan manual
// di SQL Editor Supabase - lihat juga file transfer-permanenkan-schema.sql):
//
// create table if not exists barang_transfer_permanenkan (
//     id bigint generated always as identity primary key,
//     transfer_id bigint not null references barang_transfer(id) on delete cascade,
//     no_permanen text not null unique,
//     tanggal date not null,
//     gudang_asal text not null,
//     gudang_tujuan text not null,
//     status text not null default 'Menunggu Approval',
//     keterangan text,
//     created_by text,
//     approved_by text,
//     approved_at timestamptz,
//     created_at timestamptz not null default now()
// );
//
// create table if not exists barang_transfer_permanenkan_detail (
//     id bigint generated always as identity primary key,
//     permanen_id bigint not null references barang_transfer_permanenkan(id) on delete cascade,
//     kode_barang text not null,
//     nama_barang text not null,
//     kategori text,
//     satuan text,
//     qty numeric not null
// );
//
// (Aktifkan Realtime untuk tabel barang_transfer_permanenkan kalau mau
//  panel approval-nya update otomatis tanpa refresh.)
// =====================================================================

// =====================================
// MODAL PERMINTAAN PERMANENKAN (dibuka oleh Gudang Tujuan / pemegang barang)
// TIDAK ADA perpindahan stok di alur ini sama sekali - barang memang sudah
// ada secara fisik di gudang tujuan sejak transfer di-approve.
// =====================================

async function bukaModalPermanenkan(transferId){

    try{

        const { data: header, error: errHeader } = await supabaseClient
            .from("barang_transfer")
            .select("*")
            .eq("id", transferId)
            .single();

        if(errHeader) throw errHeader;

        if(header.status !== "Approved"){
            alert("Hanya transfer berstatus Approved yang bisa dipermanenkan.");
            return;
        }

        if(user.gudang !== header.gudang_tujuan){
            alert("Hanya gudang tujuan (pemegang barang saat ini) yang bisa mengajukan Permanenkan.");
            return;
        }

        const detail = await ambilDetailTransfer(transferId);

        const withSisa = await hitungSisaTindakan(transferId, detail);

        const adaSisa = withSisa.filter(d => d.sisa > 0);

        if(adaSisa.length === 0){

            alert("Semua item pada transfer ini sudah diretur / dipermanenkan / sedang menunggu approval.");
            return;

        }

        permanenkanTransferId = transferId;
        permanenkanItemsState = adaSisa;

        document.getElementById("permanenkanHeaderInfo").innerHTML = `
            <div>No. Transfer : <b>${header.no_transfer}</b></div>
            <div>Gudang Asal (Pengirim) : <b>${header.gudang_asal}</b></div>
            <div>Gudang Tujuan (Anda) : <b>${header.gudang_tujuan}</b></div>
        `;

        document.getElementById("permanenkanTanggal").value =
            new Date().toISOString().split("T")[0];

        document.getElementById("permanenkanKeterangan").value = "";

        const noPermanenInput = document.getElementById("permanenkanNoPermanen");

        noPermanenInput.value = "Memuat nomor...";
        noPermanenInput.value = await generateNoPermanenkan(document.getElementById("permanenkanTanggal").value);

        renderPermanenkanItemsTable();

        document.getElementById("modalPermanenkan").classList.add("show");

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

function renderPermanenkanItemsTable(){

    const tbody = document.getElementById("permanenkanItemsBody");

    tbody.innerHTML = permanenkanItemsState.map((item, idx) => `
        <tr>
            <td><span class="kode-pill">${item.kode_barang}</span></td>
            <td>${item.nama_barang}</td>
            <td>${item.satuan ?? "-"}</td>
            <td>${item.qty}</td>
            <td>${item.sudahDiretur + item.sudahDipermanenkan}</td>
            <td><b>${item.sisa}</b></td>
            <td>
                <input type="number" class="input-qty permanenkan-qty-input"
                    data-idx="${idx}" min="0" max="${item.sisa}" value="${item.sisa}">
            </td>
        </tr>
    `).join("");

}

function tutupModalPermanenkan(){

    const modal = document.getElementById("modalPermanenkan");

    if(modal) modal.classList.remove("show");

    permanenkanTransferId = null;
    permanenkanItemsState = [];

}

const btnSimpanPermanenkanEl = document.getElementById("btnSimpanPermanenkan");

if(btnSimpanPermanenkanEl){

    btnSimpanPermanenkanEl.addEventListener("click", submitPermanenkan);

}

async function submitPermanenkan(e){

    if(e) e.preventDefault();

    try{

        if(permanenkanTransferId === null){
            alert("Tidak ada transfer yang sedang dipermanenkan.");
            return;
        }

        const tanggal = document.getElementById("permanenkanTanggal").value;
        const noPermanen = document.getElementById("permanenkanNoPermanen").value.trim();
        const keterangan = document.getElementById("permanenkanKeterangan").value.trim();

        if(!tanggal){
            alert("Tanggal wajib diisi.");
            return;
        }

        if(!noPermanen || noPermanen === "Memuat nomor..."){
            alert("Nomor Permanenkan belum siap, coba tunggu sebentar.");
            return;
        }

        //---------------------------------
        // AMBIL QTY PERMANENKAN DARI INPUT
        //---------------------------------

        const qtyInputs = document.querySelectorAll(".permanenkan-qty-input");

        const itemDipilih = [];

        for(const input of qtyInputs){

            const idx = parseInt(input.dataset.idx);
            const item = permanenkanItemsState[idx];
            const qty = parseInt(input.value);

            if(!qty) continue;

            if(qty < 0){

                alert(`Qty permanenkan "${item.nama_barang}" tidak boleh negatif.`);
                return;

            }

            if(qty > item.sisa){

                alert(
                    `Qty permanenkan "${item.nama_barang}" melebihi sisa yang bisa dipermanenkan (${item.sisa}).`
                );
                return;

            }

            if(qty > 0){

                itemDipilih.push({ ...item, qtyPermanen: qty });

            }

        }

        if(itemDipilih.length === 0){
            alert("Isi minimal 1 qty permanenkan lebih dari 0.");
            return;
        }

        //---------------------------------
        // CEK ULANG NOMOR (jaga race condition)
        //---------------------------------

        const { data: cekNomor } = await supabaseClient
            .from("barang_transfer_permanenkan")
            .select("id")
            .eq("no_permanen", noPermanen);

        if(cekNomor && cekNomor.length > 0){

            alert("Nomor Permanenkan sudah digunakan (kemungkinan dibuat bersamaan). Silakan tutup lalu buka ulang modal untuk nomor baru.");
            return;

        }

        const { data: header, error: errHeader } = await supabaseClient
            .from("barang_transfer")
            .select("*")
            .eq("id", permanenkanTransferId)
            .single();

        if(errHeader) throw errHeader;

        //---------------------------------
        // SIMPAN HEADER PERMANENKAN (status Menunggu Approval, TIDAK ADA
        // perubahan stok di tahap manapun untuk fitur ini)
        //---------------------------------

        const { data: permHeader, error: permHeaderErr } = await supabaseClient
            .from("barang_transfer_permanenkan")
            .insert([{
                transfer_id: permanenkanTransferId,
                no_permanen: noPermanen,
                tanggal,
                gudang_asal: header.gudang_asal,
                gudang_tujuan: header.gudang_tujuan,
                keterangan,
                status: "Menunggu Approval",
                created_by: user.nama
            }])
            .select()
            .single();

        if(permHeaderErr) throw permHeaderErr;

        for(const item of itemDipilih){

            const { error: detailErr } = await supabaseClient
                .from("barang_transfer_permanenkan_detail")
                .insert([{
                    permanen_id: permHeader.id,
                    kode_barang: item.kode_barang,
                    nama_barang: item.nama_barang,
                    kategori: item.kategori,
                    satuan: item.satuan,
                    qty: item.qtyPermanen
                }]);

            if(detailErr) throw detailErr;

        }

        alert(`Permintaan Permanenkan berhasil dibuat (${noPermanen}), menunggu approval dari ${header.gudang_asal}.`);

        tutupModalPermanenkan();

        await loadRiwayatTransfer();
        await loadPendingPermanenkanApproval();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// PANEL PERMANENKAN MASUK - MENUNGGU APPROVAL (dilihat oleh Gudang Asal)
// =====================================

async function loadPendingPermanenkanApproval(){

    try{

        if(!user || !user.gudang) return;

        const { data, error } = await supabaseClient
            .from("barang_transfer_permanenkan")
            .select("*")
            .eq("gudang_asal", user.gudang)
            .eq("status", "Menunggu Approval")
            .order("tanggal", { ascending:false })
            .order("id", { ascending:false });

        if(error) throw error;

        await tampilkanPendingPermanenkanApproval(data || []);

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

async function hitungJumlahItemPermanenkan(permanenId){

    const { data } = await supabaseClient
        .from("barang_transfer_permanenkan_detail")
        .select("id")
        .eq("permanen_id", permanenId);

    return data ? data.length : 0;

}

async function tampilkanPendingPermanenkanApproval(data){

    const tbody = document.querySelector("#tablePendingPermanenkan tbody");

    if(!tbody) return;

    tbody.innerHTML = "";

    if(data.length === 0){

        tbody.innerHTML = `
        <tr>
            <td colspan="7" class="empty-state">
                Tidak ada permintaan Permanenkan yang menunggu approval.
            </td>
        </tr>
        `;

        return;

    }

    let no = 1;

    for(const item of data){

        const jumlahItem = await hitungJumlahItemPermanenkan(item.id);

        tbody.innerHTML += `
        <tr>
            <td>${no++}</td>
            <td><b>${item.no_permanen}</b></td>
            <td>${item.tanggal}</td>
            <td>${item.gudang_tujuan}</td>
            <td>
                <button class="btn-edit" onclick="lihatDetailPermanenkan(${item.id})">📦 ${jumlahItem} item</button>
            </td>
            <td>${item.created_by ?? "-"}</td>
            <td>
                <button class="btn-approve" onclick="approvePermanenkan(${item.id})">✅ Approve</button>
                <button class="btn-reject" onclick="rejectPermanenkan(${item.id})">❌ Reject</button>
            </td>
        </tr>
        `;

    }

}

// =====================================
// APPROVE / REJECT PERMANENKAN
// (TIDAK ADA perubahan stok - murni mengunci status boleh/tidaknya diretur)
// =====================================

async function approvePermanenkan(id){

    if(!confirm("Approve permintaan Permanenkan ini? Barang ini akan RESMI tidak bisa diretur lagi.")) return;

    try{

        const { data: header, error: errHeader } = await supabaseClient
            .from("barang_transfer_permanenkan")
            .select("*")
            .eq("id", id)
            .single();

        if(errHeader) throw errHeader;

        if(header.status !== "Menunggu Approval"){
            alert("Permintaan ini sudah tidak berstatus Menunggu Approval.");
            return;
        }

        const { error: errUpdate } = await supabaseClient
            .from("barang_transfer_permanenkan")
            .update({
                status: "Disetujui",
                approved_by: user.nama,
                approved_at: new Date().toISOString()
            })
            .eq("id", id);

        if(errUpdate) throw errUpdate;

        alert("Permanenkan disetujui. Barang tersebut tidak bisa diretur lagi.");

        await loadPendingPermanenkanApproval();
        await loadRiwayatTransfer();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

async function rejectPermanenkan(id){

    if(!confirm("Tolak permintaan Permanenkan ini? Barang tetap berstatus bisa diretur.")) return;

    try{

        const { data: header, error: errHeader } = await supabaseClient
            .from("barang_transfer_permanenkan")
            .select("*")
            .eq("id", id)
            .single();

        if(errHeader) throw errHeader;

        if(header.status !== "Menunggu Approval"){
            alert("Permintaan ini sudah tidak berstatus Menunggu Approval.");
            return;
        }

        const { error: errUpdate } = await supabaseClient
            .from("barang_transfer_permanenkan")
            .update({
                status: "Ditolak",
                approved_by: user.nama,
                approved_at: new Date().toISOString()
            })
            .eq("id", id);

        if(errUpdate) throw errUpdate;

        alert("Permintaan Permanenkan ditolak.");

        await loadPendingPermanenkanApproval();
        await loadRiwayatTransfer();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// LIHAT DETAIL PERMINTAAN PERMANENKAN (dari panel approval permanenkan)
// =====================================

async function lihatDetailPermanenkan(id){

    try{

        const { data: header, error: errHeader } = await supabaseClient
            .from("barang_transfer_permanenkan")
            .select("*")
            .eq("id", id)
            .single();

        if(errHeader) throw errHeader;

        const { data: detail, error: errDetail } = await supabaseClient
            .from("barang_transfer_permanenkan_detail")
            .select("*")
            .eq("permanen_id", id)
            .order("id");

        if(errDetail) throw errDetail;

        const info = document.getElementById("modalDetailInfo");
        const body = document.getElementById("modalDetailBody");
        const titleEl = document.getElementById("modalDetailTitle");
        const returWrap = document.getElementById("modalReturHistoryWrap");

        if(titleEl) titleEl.textContent = "🔒 Detail Permintaan Permanenkan";
        if(returWrap) returWrap.innerHTML = "";

        info.innerHTML = `
            <div>No. Permanenkan : <b>${header.no_permanen}</b></div>
            <div>Tanggal : <b>${header.tanggal}</b></div>
            <div>Dari Gudang : <b>${header.gudang_tujuan}</b></div>
            <div>Ke Gudang : <b>${header.gudang_asal}</b></div>
            <div>Status : <b>${badgeStatusRetur(header.status)}</b></div>
            <div>Keterangan : <b>${header.keterangan ? header.keterangan : "-"}</b></div>
        `;

        body.innerHTML = (detail && detail.length > 0)
            ? detail.map((d,i) => `
                <tr>
                    <td>${i+1}</td>
                    <td><span class="kode-pill">${d.kode_barang}</span></td>
                    <td><strong>${d.nama_barang}</strong></td>
                    <td>${d.kategori ?? "-"}</td>
                    <td>${d.satuan ?? "-"}</td>
                    <td>${d.qty}</td>
                </tr>
              `).join("")
            : `<tr><td colspan="6" class="empty-state">Tidak ada item pada permintaan ini.</td></tr>`;

        document.getElementById("modalDetailTransfer").classList.add("show");

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// LOAD RIWAYAT TRANSFER (SEMUA STATUS)
// =====================================

async function loadRiwayatTransfer(){

    try{

        const { data, error } = await supabaseClient
            .from("barang_transfer")
            .select("*")
            .order("tanggal", { ascending:false })
            .order("id", { ascending:false });

        if(error) throw error;

        await tampilkanRiwayatTransfer(data || []);

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

function badgeStatus(status){

    const map = {
        "Pending"  : `<span class="status-badge status-pending">⏳ Pending</span>`,
        "Approved" : `<span class="status-badge status-approved">✅ Approved</span>`,
        "Rejected" : `<span class="status-badge status-rejected">❌ Rejected</span>`,
        "Retur"    : `<span class="status-badge status-retur">↩ Retur</span>`
    };

    return map[status] || `<span class="status-badge">${status}</span>`;

}

function badgeStatusRetur(status){

    const map = {
        "Menunggu Approval": `<span class="status-badge status-pending">⏳ Menunggu Approval</span>`,
        "Disetujui"        : `<span class="status-badge status-approved">✅ Disetujui</span>`,
        "Ditolak"          : `<span class="status-badge status-rejected">❌ Ditolak</span>`
    };

    return map[status] || `<span class="status-badge">${status}</span>`;

}

async function tampilkanRiwayatTransfer(data){

    const tbody = document.querySelector("#tableTransfer tbody");

    tbody.innerHTML = "";

    if(data.length===0){

        tbody.innerHTML = `
        <tr>
            <td colspan="9" class="empty-state">
                Belum ada data Transfer Barang.
            </td>
        </tr>
        `;

        return;

    }

    let no=1;

    for(const item of data){

        const jumlahItem = await hitungJumlahItem(item.id);

        let bisaTindakan = false;

        if(item.status === "Approved" && user && user.gudang === item.gudang_tujuan){

            bisaTindakan = await adaSisaTindakan(item.id);

        }

        tbody.innerHTML += `
        <tr>
            <td>${no++}</td>
            <td><b>${item.no_transfer}</b></td>
            <td>${item.tanggal}</td>
            <td>${item.gudang_asal}</td>
            <td>${item.gudang_tujuan}</td>
            <td>
                <button class="btn-edit" onclick="lihatDetailTransfer(${item.id})">📦 ${jumlahItem} item</button>
            </td>
            <td>${badgeStatus(item.status)}</td>
            <td>${item.created_by ?? "-"}</td>
            <td>
                ${bisaTindakan ? `
                    <button class="btn-retur" onclick="bukaModalRetur(${item.id})">↩ Retur</button>
                    <button class="btn-permanenkan" onclick="bukaModalPermanenkan(${item.id})">🔒 Permanenkan</button>
                ` : "-"}
            </td>
        </tr>
        `;

    }

}

// =====================================
// LIHAT DETAIL ITEM TRANSFER (+ riwayat retur & riwayat permanenkan transfer ini)
// =====================================

async function lihatDetailTransfer(id){

    try{

        const { data:header, error:errHeader } = await supabaseClient
            .from("barang_transfer")
            .select("*")
            .eq("id", id)
            .single();

        if(errHeader) throw errHeader;

        const { data:detail, error:errDetail } = await supabaseClient
            .from("barang_transfer_detail")
            .select("*")
            .eq("transfer_id", id)
            .order("id");

        if(errDetail) throw errDetail;

        await tampilkanModalDetailTransfer(header, detail || []);

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

async function tampilkanModalDetailTransfer(header, detail){

    const info = document.getElementById("modalDetailInfo");
    const body = document.getElementById("modalDetailBody");
    const titleEl = document.getElementById("modalDetailTitle");
    const returWrap = document.getElementById("modalReturHistoryWrap");

    if(titleEl) titleEl.textContent = "🔁 Detail Transfer Barang";

    info.innerHTML = `
        <div>No. Transfer : <b>${header.no_transfer}</b></div>
        <div>Tanggal : <b>${header.tanggal}</b></div>
        <div>Gudang Asal : <b>${header.gudang_asal}</b></div>
        <div>Gudang Tujuan : <b>${header.gudang_tujuan}</b></div>
        <div>Status : <b>${badgeStatus(header.status)}</b></div>
        <div>Keterangan : <b>${header.keterangan ? header.keterangan : "-"}</b></div>
    `;

    if(detail.length === 0){

        body.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">Tidak ada item pada transfer ini.</td>
        </tr>
        `;

    } else {

        body.innerHTML = detail.map((d, i) => `
        <tr>
            <td>${i+1}</td>
            <td><span class="kode-pill">${d.kode_barang}</span></td>
            <td><strong>${d.nama_barang}</strong></td>
            <td>${d.kategori ?? "-"}</td>
            <td>${d.satuan ?? "-"}</td>
            <td>${d.qty}</td>
        </tr>
        `).join("");

    }

    // riwayat retur & riwayat permanenkan untuk transfer ini (kalau ada)
    if(returWrap){

        let html = "";

        try{

            const { data: returList, error: errRetur } = await supabaseClient
                .from("barang_transfer_retur")
                .select("*")
                .eq("transfer_id", header.id)
                .order("id", { ascending: false });

            if(errRetur) throw errRetur;

            if(returList && returList.length > 0){

                html += `
                    <h4 style="margin:18px 0 8px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.03em;">↩ Riwayat Retur</h4>
                    <div class="modal-table-wrap">
                    <table class="modal-table">
                        <thead>
                            <tr><th>No Retur</th><th>Tanggal</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            ${returList.map(r => `
                                <tr>
                                    <td><b>${r.no_retur}</b></td>
                                    <td>${r.tanggal}</td>
                                    <td>${badgeStatusRetur(r.status)}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                    </div>
                `;

            }

        }
        catch(err){

            console.error(err);

        }

        try{

            const { data: permList, error: errPerm } = await supabaseClient
                .from("barang_transfer_permanenkan")
                .select("*")
                .eq("transfer_id", header.id)
                .order("id", { ascending: false });

            if(errPerm) throw errPerm;

            if(permList && permList.length > 0){

                html += `
                    <h4 style="margin:18px 0 8px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.03em;">🔒 Riwayat Permanenkan</h4>
                    <div class="modal-table-wrap">
                    <table class="modal-table">
                        <thead>
                            <tr><th>No Permanenkan</th><th>Tanggal</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            ${permList.map(p => `
                                <tr>
                                    <td><b>${p.no_permanen}</b></td>
                                    <td>${p.tanggal}</td>
                                    <td>${badgeStatusRetur(p.status)}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                    </div>
                `;

            }

        }
        catch(err){

            console.error(err);

        }

        returWrap.innerHTML = html;

    }

    document.getElementById("modalDetailTransfer").classList.add("show");

}

// =====================================
// LIHAT DETAIL PERMINTAAN RETUR (dari panel approval retur)
// =====================================

async function lihatDetailRetur(id){

    try{

        const { data: header, error: errHeader } = await supabaseClient
            .from("barang_transfer_retur")
            .select("*")
            .eq("id", id)
            .single();

        if(errHeader) throw errHeader;

        const { data: detail, error: errDetail } = await supabaseClient
            .from("barang_transfer_retur_detail")
            .select("*")
            .eq("retur_id", id)
            .order("id");

        if(errDetail) throw errDetail;

        const info = document.getElementById("modalDetailInfo");
        const body = document.getElementById("modalDetailBody");
        const titleEl = document.getElementById("modalDetailTitle");
        const returWrap = document.getElementById("modalReturHistoryWrap");

        if(titleEl) titleEl.textContent = "↩ Detail Permintaan Retur";
        if(returWrap) returWrap.innerHTML = "";

        info.innerHTML = `
            <div>No. Retur : <b>${header.no_retur}</b></div>
            <div>Tanggal : <b>${header.tanggal}</b></div>
            <div>Dari Gudang : <b>${header.gudang_tujuan}</b></div>
            <div>Ke Gudang : <b>${header.gudang_asal}</b></div>
            <div>Status : <b>${badgeStatusRetur(header.status)}</b></div>
            <div>Keterangan : <b>${header.keterangan ? header.keterangan : "-"}</b></div>
        `;

        body.innerHTML = (detail && detail.length > 0)
            ? detail.map((d,i) => `
                <tr>
                    <td>${i+1}</td>
                    <td><span class="kode-pill">${d.kode_barang}</span></td>
                    <td><strong>${d.nama_barang}</strong></td>
                    <td>${d.kategori ?? "-"}</td>
                    <td>${d.satuan ?? "-"}</td>
                    <td>${d.qty}</td>
                </tr>
              `).join("")
            : `<tr><td colspan="6" class="empty-state">Tidak ada item pada retur ini.</td></tr>`;

        document.getElementById("modalDetailTransfer").classList.add("show");

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

function tutupDetailTransfer(){

    const modal = document.getElementById("modalDetailTransfer");

    if(modal) modal.classList.remove("show");

}

document.addEventListener("keydown", function(e){

    if(e.key === "Escape"){

        tutupDetailTransfer();
        tutupModalRetur();
        tutupModalPermanenkan();

    }

});

// =====================================
// SEARCH RIWAYAT
// =====================================

function cariTransfer(){

    const keyword = document.getElementById("search").value.toLowerCase();

    const rows = document.querySelectorAll("#tableTransfer tbody tr");

    rows.forEach(row=>{

        row.style.display = row.innerText.toLowerCase().includes(keyword) ? "" : "none";

    });

}

const searchEl = document.getElementById("search");

if(searchEl){

    searchEl.addEventListener("keyup", cariTransfer);

}

// =====================================
// REALTIME STOK & STATUS TRANSFER / RETUR / PERMANENKAN
// =====================================

function aktifkanRealtime(){

    supabaseClient

    .channel("realtime-transfer-barang")

    .on("postgres_changes",

        { event: "*", schema: "public", table: "stok_gudang" },

        () => refreshSemuaBarisStok()

    )

    .on("postgres_changes",

        { event: "*", schema: "public", table: "barang_transfer" },

        () => {

            loadPendingApproval();
            loadRiwayatTransfer();

        }

    )

    .on("postgres_changes",

        { event: "*", schema: "public", table: "barang_transfer_retur" },

        () => {

            loadPendingReturApproval();
            loadRiwayatTransfer();

        }

    )

    .on("postgres_changes",

        { event: "*", schema: "public", table: "barang_transfer_permanenkan" },

        () => {

            loadPendingPermanenkanApproval();
            loadRiwayatTransfer();

        }

    )

    .subscribe();

}

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", async ()=>{

    document.getElementById("tanggal").value =
        new Date().toISOString().split("T")[0];

    await isiNomorTransferOtomatis();

    const tanggalEl = document.getElementById("tanggal");
    if(tanggalEl){
        tanggalEl.addEventListener("change", isiNomorTransferOtomatis);
    }

    const returTanggalEl = document.getElementById("returTanggal");
    if(returTanggalEl){
        returTanggalEl.addEventListener("change", async function(){
            if(returTransferId === null) return;
            const noReturInput = document.getElementById("returNoRetur");
            noReturInput.value = "Memuat nomor...";
            noReturInput.value = await generateNoRetur(this.value);
        });
    }

    const permanenkanTanggalEl = document.getElementById("permanenkanTanggal");
    if(permanenkanTanggalEl){
        permanenkanTanggalEl.addEventListener("change", async function(){
            if(permanenkanTransferId === null) return;
            const noPermanenInput = document.getElementById("permanenkanNoPermanen");
            noPermanenInput.value = "Memuat nomor...";
            noPermanenInput.value = await generateNoPermanenkan(this.value);
        });
    }

    await loadGudang();
    await loadBarang();

    tambahBarisBarang();

    await loadPendingApproval();
    await loadPendingReturApproval();
    await loadPendingPermanenkanApproval();
    await loadRiwayatTransfer();

    const modalReturEl = document.getElementById("modalRetur");

    if(modalReturEl){

        modalReturEl.addEventListener("click", function(e){

            if(e.target === modalReturEl) tutupModalRetur();

        });

    }

    const btnTutupModalReturEl = document.getElementById("btnTutupModalRetur");

    if(btnTutupModalReturEl){

        btnTutupModalReturEl.addEventListener("click", tutupModalRetur);

    }

    const modalPermanenkanEl = document.getElementById("modalPermanenkan");

    if(modalPermanenkanEl){

        modalPermanenkanEl.addEventListener("click", function(e){

            if(e.target === modalPermanenkanEl) tutupModalPermanenkan();

        });

    }

    const btnTutupModalPermanenkanEl = document.getElementById("btnTutupModalPermanenkan");

    if(btnTutupModalPermanenkanEl){

        btnTutupModalPermanenkanEl.addEventListener("click", tutupModalPermanenkan);

    }

    aktifkanRealtime();

});
