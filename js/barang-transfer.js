// =====================================
// TRANSFER BARANG (DENGAN APPROVAL & RETUR)
// =====================================
//
// SKEMA TABEL YANG DIBUTUHKAN (lihat transfer-barang-schema.sql):
//   - stok_gudang          (barang_id, gudang, stok, updated_at)
//   - master_gudang        (nama_gudang)            [opsional, ada fallback]
//   - barang_transfer      (header transfer)
//   - barang_transfer_detail (item per transfer)
//
// ALUR:
//   1. Buat transfer  -> stok gudang asal langsung berkurang, status = "Pending"
//   2. Approve        -> stok gudang tujuan bertambah, status = "Approved"
//   3. Reject          -> stok kembali ke gudang asal, status = "Rejected"
//   4. Retur (setelah Approved) -> stok gudang tujuan berkurang,
//                                   stok gudang asal bertambah lagi, status = "Retur"
//
// NOMOR TRANSFER OTOMATIS:
//   Format  : TRF-0001/VII/2026  (urut 4 digit / bulan romawi / tahun,
//             bulan & tahun mengikuti tanggal sistem saat ini)
//   Urut    : global lintas gudang, RESET ke 0001 setiap bulan baru
//             (dihitung dari no_transfer yang polanya cocok bulan+tahun berjalan)
//   Field no_transfer bersifat readonly, diisi otomatis oleh sistem.
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

// Daftar gudang default kalau tabel master_gudang belum ada / kosong
const DAFTAR_GUDANG_FALLBACK = ["Raden Saleh", "Margomulyo"];

// Bulan romawi untuk format nomor transfer
const BULAN_ROMAWI = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

// cache master data
let masterBarang = [];
let daftarGudang = [];

// counter id unik baris detail
let rowCounter = 0;

// =====================================
// NOMOR TRANSFER OTOMATIS
// =====================================

async function generateNoTransfer(){

    const now = new Date();

    const bulanRomawi = BULAN_ROMAWI[now.getMonth()];
    const tahun = now.getFullYear();

    // pola nomor bulan+tahun berjalan, contoh: "%/VII/2026"
    const pattern = `%/${bulanRomawi}/${tahun}`;

    let urutTerbesar = 0;

    try{

        const { data, error } = await supabaseClient
            .from("barang_transfer")
            .select("no_transfer")
            .ilike("no_transfer", pattern);

        if(error) throw error;

        (data || []).forEach(row=>{

            const match = (row.no_transfer || "").match(/^TRF-(\d{4})\//);

            if(match){

                const angka = parseInt(match[1], 10);

                if(angka > urutTerbesar) urutTerbesar = angka;

            }

        });

    }
    catch(err){

        console.error("Gagal menghitung nomor transfer otomatis:", err);

    }

    const urutBaru = urutTerbesar + 1;
    const urutStr = String(urutBaru).padStart(4, "0");

    return `TRF-${urutStr}/${bulanRomawi}/${tahun}`;

}

async function isiNomorTransferOtomatis(){

    const noTransferInput = document.getElementById("no_transfer");

    if(!noTransferInput) return;

    noTransferInput.readOnly = true;
    noTransferInput.value = "Memuat nomor...";

    noTransferInput.value = await generateNoTransfer();

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
// RETUR TRANSFER (setelah Approved, kembalikan ke gudang asal)
// =====================================

async function returTransfer(id){

    if(!confirm("Kembalikan seluruh barang di transfer ini ke gudang asal (peminjam)?")) return;

    try{

        const { data:header, error:errHeader } = await supabaseClient
            .from("barang_transfer")
            .select("*")
            .eq("id", id)
            .single();

        if(errHeader) throw errHeader;

        if(header.status !== "Approved"){
            alert("Hanya transfer berstatus Approved yang bisa diretur.");
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

            // stok berkurang di gudang tujuan (yang sekarang punya barang)
            await tambahStokGudang(barangId, header.gudang_tujuan, -item.qty);

            // stok bertambah kembali di gudang asal (yang meminjami)
            await tambahStokGudang(barangId, header.gudang_asal, item.qty);

        }

        const { error:errUpdate } = await supabaseClient
            .from("barang_transfer")
            .update({
                status: "Retur",
                retur_by: user.nama,
                retur_at: new Date().toISOString()
            })
            .eq("id", id);

        if(errUpdate) throw errUpdate;

        alert(`Barang berhasil diretur ke gudang ${header.gudang_asal}.`);

        await loadRiwayatTransfer();

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

        const bisaRetur = (item.status === "Approved") &&
                           user && user.gudang === item.gudang_tujuan;

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
                ${bisaRetur ? `<button class="btn-retur" onclick="returTransfer(${item.id})">↩ Retur</button>` : "-"}
            </td>
        </tr>
        `;

    }

}

// =====================================
// LIHAT DETAIL ITEM TRANSFER
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

        tampilkanModalDetailTransfer(header, detail || []);

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

function tampilkanModalDetailTransfer(header, detail){

    const info = document.getElementById("modalDetailInfo");
    const body = document.getElementById("modalDetailBody");

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

    document.getElementById("modalDetailTransfer").classList.add("show");

}

function tutupDetailTransfer(){

    const modal = document.getElementById("modalDetailTransfer");

    if(modal) modal.classList.remove("show");

}

document.addEventListener("keydown", function(e){

    if(e.key === "Escape") tutupDetailTransfer();

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
// REALTIME STOK & STATUS TRANSFER
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

    .subscribe();

}

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", async ()=>{

    document.getElementById("tanggal").value =
        new Date().toISOString().split("T")[0];

    await isiNomorTransferOtomatis();

    await loadGudang();
    await loadBarang();

    tambahBarisBarang();

    await loadPendingApproval();
    await loadRiwayatTransfer();

    aktifkanRealtime();

});
