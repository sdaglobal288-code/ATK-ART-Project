// =====================================
// BARANG MASUK (BTB) - SAMA PERSIS DENGAN BARANG KELUAR
// =====================================
//
// SUMBER STOK: tabel "stok_gudang" (barang_id, gudang, stok, updated_at)
// adalah SATU-SATUNYA sumber kebenaran stok saat ini, dan selalu
// difilter berdasarkan gudang akun yang sedang login (user.gudang).
// master_barang tetap satu tabel bersama (dipakai kedua gudang) untuk
// data katalog (nama, kategori, satuan) saja - bukan untuk stok.
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

// id BTB yang sedang dibuka di modal Edit (null jika tidak ada)
let editId = null;

// item asli (sebelum diedit) milik BTB yang sedang dibuka di modal Edit,
// dipakai untuk menghitung selisih stok saat disimpan
let editOriginalItems = [];

// Menyimpan master data di memory
let masterBarang = [];
let masterSupplier = [];

// stok per barang UNTUK GUDANG YANG SEDANG LOGIN (key: barang_id -> stok)
let stokGudangMap = new Map();

// =====================================
// LOAD SUPPLIER
// =====================================

async function loadSupplier(){

    try{

        const { data, error } = await supabaseClient
            .from("master_supplier")
            .select("*")
            .order("nama_toko");

        if(error) throw error;

        masterSupplier = data || [];

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// SUPPLIER - COMBOBOX PENCARIAN (GENERIK, DIPAKAI FORM UTAMA & FORM EDIT)
// =====================================

const supplierSearchInput = document.getElementById("supplierSearch");
const supplierHidden      = document.getElementById("supplier");
const supplierDropdown    = document.getElementById("supplierDropdown");

function setupSupplierCombo(searchInput, hiddenInput, dropdown){

    if(!searchInput || !hiddenInput || !dropdown){

        console.error("Elemen combobox supplier tidak lengkap ditemukan di halaman.");
        return;

    }

    function render(keyword){

        const kw = (keyword || "").trim().toLowerCase();

        const filtered = masterSupplier.filter(s =>
            s.nama_toko.toLowerCase().includes(kw)
        );

        dropdown.innerHTML = "";

        if(filtered.length === 0){

            dropdown.innerHTML =
                `<div class="combo-empty">Supplier tidak ditemukan</div>`;

        } else {

            filtered.forEach(s=>{

                const item = document.createElement("div");

                item.className = "combo-item";
                item.textContent = s.nama_toko;
                item.dataset.id = s.id;
                item.dataset.nama = s.nama_toko;

                dropdown.appendChild(item);

            });

        }

        dropdown.classList.add("show");

    }

    searchInput.addEventListener("input", function(){

        // reset pilihan sebelumnya sampai user memilih ulang dari daftar
        hiddenInput.value = "";

        render(this.value);

    });

    searchInput.addEventListener("focus", function(){

        render(this.value);

    });

    dropdown.addEventListener("click", function(e){

        const item = e.target.closest(".combo-item");

        if(!item || !item.dataset.nama) return;

        hiddenInput.value = item.dataset.nama;
        searchInput.value = item.dataset.nama;

        dropdown.classList.remove("show");

    });

}

// =====================================
// LOAD MASTER BARANG (katalog bersama, TANPA info stok)
// =====================================

async function loadBarang(){

    try{

        const { data, error } = await supabaseClient
            .from("master_barang")
            .select("*")
            .order("nama_barang");

        if(error) throw error;

        masterBarang = data || [];

        // sinkronkan badge stok pada baris yang barangnya sudah dipilih
        refreshSemuaBarisStok();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

function findBarangById(id){

    return masterBarang.find(b => String(b.id) === String(id));

}

function findBarangByKode(kode){

    return masterBarang.find(b => b.kode_barang === kode);

}

// =====================================
// LOAD STOK GUDANG (khusus gudang yang sedang login)
// =====================================

async function loadStokGudang(){

    try{

        const { data, error } = await supabaseClient
            .from("stok_gudang")
            .select("barang_id, stok")
            .eq("gudang", user.gudang);

        if(error) throw error;

        stokGudangMap = new Map();

        (data || []).forEach(row=>{
            stokGudangMap.set(String(row.barang_id), Number(row.stok) || 0);
        });

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// UBAH STOK GUDANG (dipanggil saat simpan / edit BTB)
// delta boleh positif (tambah) atau negatif (kurangi, saat edit).
// Upsert manual: kalau baris (barang_id, gudang) sudah ada -> update,
// kalau belum ada -> insert baru (hanya masuk akal untuk delta positif).
// =====================================

async function tambahStokGudang(barangId, delta){

    if(!delta) return;

    const { data: existing, error: selErr } = await supabaseClient
        .from("stok_gudang")
        .select("*")
        .eq("barang_id", barangId)
        .eq("gudang", user.gudang)
        .maybeSingle();

    if(selErr) throw selErr;

    if(existing){

        const stokBaru = (Number(existing.stok) || 0) + delta;

        const { error: updErr } = await supabaseClient
            .from("stok_gudang")
            .update({
                stok: stokBaru,
                updated_at: new Date().toISOString()
            })
            .eq("id", existing.id);

        if(updErr) throw updErr;

    } else {

        const { error: insErr } = await supabaseClient
            .from("stok_gudang")
            .insert([{
                barang_id: barangId,
                gudang: user.gudang,
                stok: delta,
                updated_at: new Date().toISOString()
            }]);

        if(insErr) throw insErr;

    }

}

// =====================================
// STOK REALTIME PER BARIS
// =====================================

function refreshStokBaris(row){

    const badge = row.querySelector(".stok-badge");

    const barangId = row.querySelector(".input-barang-id").value;

    if(!barangId){

        badge.textContent = "Stok: -";
        return;

    }

    const stok = stokGudangMap.get(String(barangId)) || 0;

    badge.textContent = `Stok: ${stok}`;

}

function refreshSemuaBarisStok(){

    const rows = document.querySelectorAll(
        "#detailRows .detail-row, #editDetailRows .detail-row"
    );

    rows.forEach(row=>{

        if(row.querySelector(".input-barang-id").value) refreshStokBaris(row);

    });

}

// =====================================
// REALTIME SUBSCRIBE STOK (stok_gudang, difilter gudang login)
// =====================================

function aktifkanRealtimeStok(){

    supabaseClient

    .channel("stok-realtime-barang-masuk")

    .on("postgres_changes",

        {
            event: "*",
            schema: "public",
            table: "stok_gudang",
            filter: `gudang=eq.${user.gudang}`
        },

        async () => {

            await loadStokGudang();
            refreshSemuaBarisStok();

        }

    )

    .on("postgres_changes",

        { event: "*", schema: "public", table: "master_barang" },

        async () => {

            await loadBarang();

        }

    )

    .subscribe();

}

// =====================================
// BARIS DETAIL BARANG (MULTI ITEM, DIPAKAI FORM UTAMA & FORM EDIT)
// =====================================

function templateBarisBarang(){

    return `

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

}

function tambahBarisBarangKe(containerId){

    const wrapper = document.getElementById(containerId);

    if(!wrapper){

        console.error(`Elemen #${containerId} tidak ditemukan di halaman.`);
        return null;

    }

    const row = document.createElement("div");

    row.className = "detail-row";
    row.dataset.kodeBarang = "";

    row.innerHTML = templateBarisBarang();

    wrapper.appendChild(row);

    return row;

}

function tambahBarisBarang(){

    tambahBarisBarangKe("detailRows");

}

function hapusBarisBarang(row, containerId){

    const wrapper = document.getElementById(containerId);

    if(wrapper.children.length <= 1){

        alert("Minimal harus ada 1 baris barang.");
        return;

    }

    row.remove();

}

// =====================================
// EVENT DELEGATION UNTUK BARIS DI DALAM SATU CONTAINER
// (dipakai untuk #detailRows dan #editDetailRows)
// =====================================

function setupDetailRowsDelegation(containerId){

    const container = document.getElementById(containerId);

    if(!container){

        console.error(`Elemen #${containerId} tidak ditemukan di halaman.`);
        return;

    }

    container.addEventListener("input", function(e){

        const row = e.target.closest(".detail-row");

        if(!row) return;

        if(e.target.classList.contains("input-barang-search")){

            // reset pilihan sampai user memilih ulang dari daftar
            row.querySelector(".input-barang-id").value = "";
            row.querySelector(".input-kategori").value = "";
            row.querySelector(".input-satuan").value = "";
            row.dataset.kodeBarang = "";

            refreshStokBaris(row);

            renderBarangDropdown(row, e.target.value);

        }

    });

    // focus tidak bubbling, gunakan focusin untuk delegasi
    container.addEventListener("focusin", function(e){

        if(e.target.classList.contains("input-barang-search")){

            const row = e.target.closest(".detail-row");

            if(row) renderBarangDropdown(row, e.target.value);

        }

    });

    container.addEventListener("click", function(e){

        // hapus baris
        if(e.target.classList.contains("btn-hapus-baris")){

            const row = e.target.closest(".detail-row");

            if(row) hapusBarisBarang(row, containerId);

            return;

        }

        // pilih barang dari dropdown pencarian
        const comboItem = e.target.closest(".combo-item");

        if(comboItem && comboItem.dataset.id && comboItem.closest(".input-barang-dropdown")){

            const row = e.target.closest(".detail-row");

            if(!row) return;

            const barang = findBarangById(comboItem.dataset.id);

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

const btnTambahBarisEl = document.getElementById("btnTambahBaris");

if(btnTambahBarisEl){

    btnTambahBarisEl.addEventListener("click", function(){

        tambahBarisBarangKe("detailRows");

    });

} else {

    console.error("Elemen #btnTambahBaris tidak ditemukan di halaman.");

}

const btnTambahBarisEditEl = document.getElementById("btnTambahBarisEdit");

if(btnTambahBarisEditEl){

    btnTambahBarisEditEl.addEventListener("click", function(){

        tambahBarisBarangKe("editDetailRows");

    });

}

// =====================================
// TUTUP DROPDOWN SAAT KLIK DI LUAR
// =====================================

document.addEventListener("click", function(e){

    document.querySelectorAll(".combo-wrapper").forEach(wrapper=>{

        if(!wrapper.contains(e.target)){

            const dd = wrapper.querySelector(".combo-dropdown");

            if(dd) dd.classList.remove("show");

        }

    });

});

// =====================================
// VALIDASI + AMBIL DAFTAR ITEM DARI SATU CONTAINER DETAIL
// (dipakai simpan BTB baru & simpan hasil edit BTB)
// =====================================

function validasiDanAmbilItem(containerId){

    const rows = document.querySelectorAll(`#${containerId} .detail-row`);

    if(rows.length === 0){

        alert("Tambahkan minimal 1 barang.");
        return null;

    }

    const itemList = [];
    const kodeSudahDipakai = new Set();

    for(const row of rows){

        const barangId = row.querySelector(".input-barang-id").value;
        const qty = parseInt(row.querySelector(".input-qty").value);

        if(barangId===""){

            alert("Ada baris yang belum memilih barang dari daftar pencarian.");
            return null;

        }

        if(!qty || qty<=0){

            alert("Qty harus lebih dari 0 untuk setiap barang.");
            return null;

        }

        const barang = findBarangById(barangId);

        if(!barang){

            alert("Data barang tidak ditemukan, coba muat ulang halaman.");
            return null;

        }

        if(kodeSudahDipakai.has(barang.kode_barang)){

            alert(
                `Barang "${barang.nama_barang}" dipilih lebih dari satu kali.\n` +
                `Gabungkan qty-nya dalam satu baris saja.`
            );
            return null;

        }

        kodeSudahDipakai.add(barang.kode_barang);

        itemList.push({ barang, qty });

    }

    return itemList;

}

// =====================================
// SIMPAN BARANG MASUK (BTB) - TAMBAH BARU
// =====================================

const btnSimpanBTBEl = document.getElementById("btnSimpanBTB");

if(btnSimpanBTBEl){

    btnSimpanBTBEl.addEventListener("click", simpanBTB);

} else {

    console.error("Elemen #btnSimpanBTB tidak ditemukan di halaman.");

}

async function simpanBTB(){

    try{

        //---------------------------------
        // VALIDASI HEADER
        //---------------------------------

        const noBTB = document.getElementById("no_btb").value.trim();
        const tanggal = document.getElementById("tanggal").value;
        const supplier = supplierHidden.value.trim();
        const keterangan = document.getElementById("keterangan").value.trim();

        if(tanggal==""){
            alert("Tanggal wajib diisi.");
            return;
        }

        if(noBTB==""){
            alert("Nomor BTB wajib diisi.");
            return;
        }

        if(supplier==""){
            alert("Supplier wajib dipilih dari daftar pencarian.");
            return;
        }

        //---------------------------------
        // VALIDASI NOMOR BTB
        //---------------------------------

        const { data:cekBTB } = await supabaseClient
            .from("barang_masuk")
            .select("id")
            .eq("no_btb", noBTB);

        if(cekBTB.length>0){
            alert("Nomor BTB sudah digunakan.");
            return;
        }

        //---------------------------------
        // VALIDASI DETAIL SEBELUM SIMPAN
        //---------------------------------

        const itemList = validasiDanAmbilItem("detailRows");

        if(!itemList) return;

        //---------------------------------
        // SIMPAN HEADER
        //---------------------------------

        const { data:header, error:headerError } = await supabaseClient
            .from("barang_masuk")
            .insert([{
                no_btb : noBTB,
                tanggal,
                supplier,
                keterangan,
                gudang : user.gudang,
                created_by : user.nama
            }])
            .select()
            .single();

        if(headerError) throw headerError;

        //---------------------------------
        // SIMPAN DETAIL + TAMBAH STOK GUDANG
        //---------------------------------

        for(const { barang, qty } of itemList){

            // =====================================
            // SIMPAN DETAIL
            // =====================================

            const { error:detailError } = await supabaseClient
                .from("barang_masuk_detail")
                .insert([{
                    barang_masuk_id : header.id,
                    kode_barang : barang.kode_barang,
                    nama_barang : barang.nama_barang,
                    kategori : barang.kategori,
                    satuan : barang.satuan,
                    qty
                }]);

            if(detailError) throw detailError;

            // =====================================
            // TAMBAH STOK DI stok_gudang (hanya utk gudang user.gudang)
            // =====================================

            await tambahStokGudang(barang.id, qty);

        }

        //---------------------------------
        // SELESAI
        //---------------------------------

        alert(`Barang Masuk berhasil disimpan (${itemList.length} item).`);

        resetFormMasuk();

        // muat ulang master barang & stok gudang supaya angka terbaru terpakai
        await loadBarang();
        await loadStokGudang();
        refreshSemuaBarisStok();

        loadBarangMasuk();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// RESET FORM (kembali ke 1 baris kosong)
// =====================================

function resetFormMasuk(){

    document.getElementById("formMasukHeader").reset();

    supplierHidden.value = "";
    supplierSearchInput.value = "";

    document.getElementById("tanggal").value =
        new Date().toISOString().split("T")[0];

    document.getElementById("detailRows").innerHTML = "";

    tambahBarisBarangKe("detailRows");

}

// =====================================
// LOAD HISTORI BTB
// =====================================
// Histori difilter sesuai gudang akun yang sedang login (user.gudang),
// jadi akun Margomulyo hanya melihat transaksi Margomulyo, dan akun
// Raden Saleh hanya melihat transaksi Raden Saleh.
// =====================================

async function loadBarangMasuk(){

    try{

        const { data,error } = await supabaseClient
            .from("barang_masuk")
            .select("*")
            .eq("gudang", user.gudang)
            .order("tanggal",{ascending:false})
            .order("id",{ascending:false});

        if(error) throw error;

        tampilBarangMasuk(data);

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// TAMPILKAN HISTORI
// =====================================

function tampilBarangMasuk(data){

    const tbody = document.querySelector("#tableMasuk tbody");

    tbody.innerHTML="";

    if(data.length===0){

        tbody.innerHTML = `
        <tr>
            <td colspan="8" class="empty-state">
                Belum ada data Barang Masuk.
            </td>
        </tr>
        `;

        return;

    }

    let no=1;

    data.forEach(item=>{

        tbody.innerHTML += `
        <tr>
            <td>${no++}</td>
            <td><b>${item.no_btb}</b></td>
            <td>${item.tanggal}</td>
            <td>${item.supplier}</td>
            <td>
                <button class="btn-edit" onclick="lihatDetail(${item.id})">📦 Detail</button>
            </td>
            <td>${item.gudang}</td>
            <td>${item.created_by}</td>
            <td>
                <button class="btn-edit" onclick="editBTB(${item.id})">✏ Edit</button>
                <button class="btn-delete" onclick="hapusBTB(${item.id})">🗑 Hapus</button>
            </td>
        </tr>
        `;

    });

}

// =====================================
// SEARCH
// =====================================

function cariBarangMasuk(){

    const keyword = document.getElementById("search").value.toLowerCase();

    const rows = document.querySelectorAll("#tableMasuk tbody tr");

    rows.forEach(row=>{

        row.style.display = row.innerText.toLowerCase().includes(keyword) ? "" : "none";

    });

}

const searchInputEl = document.getElementById("search");

if(searchInputEl){

    searchInputEl.addEventListener("keyup",cariBarangMasuk);

}

// =====================================
// DETAIL BTB (MODAL - HANYA LIHAT)
// =====================================

async function lihatDetail(id){

    try{

        const { data: header, error: headerErr } = await supabaseClient
            .from("barang_masuk")
            .select("*")
            .eq("id", id)
            .single();

        if(headerErr) throw headerErr;

        const { data: details, error: detailErr } = await supabaseClient
            .from("barang_masuk_detail")
            .select("*")
            .eq("barang_masuk_id", id)
            .order("id");

        if(detailErr) throw detailErr;

        document.getElementById("modalNoBTB").textContent = header.no_btb;
        document.getElementById("modalTanggal").textContent = header.tanggal;
        document.getElementById("modalSupplier").textContent = header.supplier;
        document.getElementById("modalKeterangan").textContent = header.keterangan || "-";

        const tbody = document.querySelector("#tableDetailBTB tbody");
        tbody.innerHTML = "";

        if(!details || details.length === 0){

            tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">Tidak ada detail barang.</td>
            </tr>
            `;

        } else {

            let no = 1;

            details.forEach(d=>{

                tbody.innerHTML += `
                <tr>
                    <td>${no++}</td>
                    <td>${d.kode_barang}</td>
                    <td>${d.nama_barang}</td>
                    <td>${d.kategori}</td>
                    <td>${d.satuan}</td>
                    <td>${d.qty}</td>
                </tr>
                `;

            });

        }

        document.getElementById("modalDetailBTB").classList.add("show");

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

function tutupModalDetail(){

    document.getElementById("modalDetailBTB").classList.remove("show");

}

const btnTutupModalDetailEl = document.getElementById("btnTutupModalDetail");

if(btnTutupModalDetailEl){

    btnTutupModalDetailEl.addEventListener("click", tutupModalDetail);

}

const modalDetailBTBEl = document.getElementById("modalDetailBTB");

if(modalDetailBTBEl){

    // klik di luar box -> tutup modal
    modalDetailBTBEl.addEventListener("click", function(e){

        if(e.target === modalDetailBTBEl) tutupModalDetail();

    });

}

// =====================================
// EDIT BTB (MODAL - UBAH HEADER & DETAIL)
// =====================================

async function editBTB(id){

    try{

        const { data: header, error: headerErr } = await supabaseClient
            .from("barang_masuk")
            .select("*")
            .eq("id", id)
            .single();

        if(headerErr) throw headerErr;

        const { data: details, error: detailErr } = await supabaseClient
            .from("barang_masuk_detail")
            .select("*")
            .eq("barang_masuk_id", id)
            .order("id");

        if(detailErr) throw detailErr;

        editId = id;

        // simpan item asli (untuk hitung selisih stok saat disimpan nanti)
        editOriginalItems = (details || []).map(d=>{

            const barang = findBarangByKode(d.kode_barang);

            return {
                barang_id : barang ? barang.id : null,
                qty : Number(d.qty) || 0
            };

        });

        //---------------------------------
        // ISI FORM HEADER EDIT
        //---------------------------------

        document.getElementById("editTanggal").value = header.tanggal;
        document.getElementById("editNoBTB").value = header.no_btb;
        document.getElementById("editSupplier").value = header.supplier;
        document.getElementById("editSupplierSearch").value = header.supplier;
        document.getElementById("editKeterangan").value = header.keterangan || "";

        //---------------------------------
        // ISI BARIS DETAIL EDIT
        //---------------------------------

        const editWrapper = document.getElementById("editDetailRows");
        editWrapper.innerHTML = "";

        if(details && details.length > 0){

            details.forEach(d=>{

                const row = tambahBarisBarangKe("editDetailRows");

                const barang = findBarangByKode(d.kode_barang);

                if(barang){

                    row.querySelector(".input-barang-search").value = barang.nama_barang;
                    row.querySelector(".input-barang-id").value = barang.id;
                    row.querySelector(".input-kategori").value = barang.kategori;
                    row.querySelector(".input-satuan").value = barang.satuan;
                    row.dataset.kodeBarang = barang.kode_barang;

                } else {

                    // barang sudah tidak ada di master, tampilkan datanya saja (tanpa id)
                    row.querySelector(".input-barang-search").value = d.nama_barang;
                    row.querySelector(".input-kategori").value = d.kategori;
                    row.querySelector(".input-satuan").value = d.satuan;

                }

                row.querySelector(".input-qty").value = d.qty;

                refreshStokBaris(row);

            });

        } else {

            tambahBarisBarangKe("editDetailRows");

        }

        document.getElementById("modalEditBTB").classList.add("show");

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

function tutupModalEdit(){

    document.getElementById("modalEditBTB").classList.remove("show");

    editId = null;
    editOriginalItems = [];

}

const btnTutupModalEditEl = document.getElementById("btnTutupModalEdit");

if(btnTutupModalEditEl){

    btnTutupModalEditEl.addEventListener("click", tutupModalEdit);

}

const modalEditBTBEl = document.getElementById("modalEditBTB");

if(modalEditBTBEl){

    modalEditBTBEl.addEventListener("click", function(e){

        if(e.target === modalEditBTBEl) tutupModalEdit();

    });

}

// =====================================
// SIMPAN PERUBAHAN HASIL EDIT BTB
// =====================================

const btnSimpanEditBTBEl = document.getElementById("btnSimpanEditBTB");

if(btnSimpanEditBTBEl){

    btnSimpanEditBTBEl.addEventListener("click", simpanEditBTB);

}

async function simpanEditBTB(){

    try{

        if(editId === null){

            alert("Tidak ada data yang sedang diedit.");
            return;

        }

        //---------------------------------
        // VALIDASI HEADER
        //---------------------------------

        const noBTB = document.getElementById("editNoBTB").value.trim();
        const tanggal = document.getElementById("editTanggal").value;
        const supplier = document.getElementById("editSupplier").value.trim();
        const keterangan = document.getElementById("editKeterangan").value.trim();

        if(tanggal===""){
            alert("Tanggal wajib diisi.");
            return;
        }

        if(noBTB===""){
            alert("Nomor BTB wajib diisi.");
            return;
        }

        if(supplier===""){
            alert("Supplier wajib dipilih dari daftar pencarian.");
            return;
        }

        //---------------------------------
        // VALIDASI NOMOR BTB (kecuali milik sendiri)
        //---------------------------------

        const { data: cekBTB, error: cekErr } = await supabaseClient
            .from("barang_masuk")
            .select("id")
            .eq("no_btb", noBTB)
            .neq("id", editId);

        if(cekErr) throw cekErr;

        if(cekBTB.length > 0){
            alert("Nomor BTB sudah digunakan.");
            return;
        }

        //---------------------------------
        // VALIDASI DETAIL
        //---------------------------------

        const itemList = validasiDanAmbilItem("editDetailRows");

        if(!itemList) return;

        //---------------------------------
        // HITUNG SELISIH STOK (qty baru - qty lama per barang)
        //---------------------------------

        const oldQtyMap = new Map();

        editOriginalItems.forEach(o=>{

            if(o.barang_id !== null){

                const key = String(o.barang_id);
                oldQtyMap.set(key, (oldQtyMap.get(key) || 0) + o.qty);

            }

        });

        const newQtyMap = new Map();

        itemList.forEach(({barang, qty})=>{

            const key = String(barang.id);
            newQtyMap.set(key, (newQtyMap.get(key) || 0) + qty);

        });

        const semuaBarangId = new Set([
            ...oldQtyMap.keys(),
            ...newQtyMap.keys()
        ]);

        for(const barangId of semuaBarangId){

            const oldQty = oldQtyMap.get(barangId) || 0;
            const newQty = newQtyMap.get(barangId) || 0;
            const delta = newQty - oldQty;

            if(delta !== 0){

                await tambahStokGudang(barangId, delta);

            }

        }

        //---------------------------------
        // UPDATE HEADER
        //---------------------------------

        const { error: updHeaderErr } = await supabaseClient
            .from("barang_masuk")
            .update({
                no_btb : noBTB,
                tanggal,
                supplier,
                keterangan
            })
            .eq("id", editId);

        if(updHeaderErr) throw updHeaderErr;

        //---------------------------------
        // GANTI DETAIL (hapus lama, insert baru)
        //---------------------------------

        const { error: delErr } = await supabaseClient
            .from("barang_masuk_detail")
            .delete()
            .eq("barang_masuk_id", editId);

        if(delErr) throw delErr;

        for(const { barang, qty } of itemList){

            const { error: insErr } = await supabaseClient
                .from("barang_masuk_detail")
                .insert([{
                    barang_masuk_id : editId,
                    kode_barang : barang.kode_barang,
                    nama_barang : barang.nama_barang,
                    kategori : barang.kategori,
                    satuan : barang.satuan,
                    qty
                }]);

            if(insErr) throw insErr;

        }

        //---------------------------------
        // SELESAI
        //---------------------------------

        alert("Perubahan Barang Masuk berhasil disimpan.");

        tutupModalEdit();

        await loadBarang();
        await loadStokGudang();
        refreshSemuaBarisStok();

        loadBarangMasuk();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// HAPUS BTB
// =====================================

async function hapusBTB(id){

    if(!confirm("Yakin ingin menghapus BTB ini?\nSemua detail barang dan perubahan stok akan dibatalkan.")){
        return;
    }

    try{

        // 1. Ambil detail untuk rollback stok
        const { data: details, error: detailErr } = await supabaseClient
            .from("barang_masuk_detail")
            .select("*")
            .eq("barang_masuk_id", id);

        if(detailErr) throw detailErr;

        // 2. Rollback stok (kurangi qty yang sudah pernah masuk)
        for(const d of (details || [])){

            const barang = findBarangByKode(d.kode_barang);

            if(barang){

                await tambahStokGudang(barang.id, -(Number(d.qty) || 0));

            }

        }

        // 3. Hapus detail
        const { error: delDetailErr } = await supabaseClient
            .from("barang_masuk_detail")
            .delete()
            .eq("barang_masuk_id", id);

        if(delDetailErr) throw delDetailErr;

        // 4. Hapus header
        const { error: delHeaderErr } = await supabaseClient
            .from("barang_masuk")
            .delete()
            .eq("id", id);

        if(delHeaderErr) throw delHeaderErr;

        alert("BTB berhasil dihapus dan stok telah disesuaikan.");

        await loadStokGudang();
        refreshSemuaBarisStok();
        loadBarangMasuk();

    }
    catch(err){

        console.error(err);
        alert("Gagal menghapus BTB: " + err.message);

    }

}

// =====================================
// EXPORT EXCEL
// =====================================
// Mengekspor seluruh histori Barang Masuk untuk gudang yang sedang
// login, satu baris per item barang (header BTB diulang tiap baris
// itemnya supaya mudah dibaca / diolah di Excel).
// =====================================

async function exportExcel(){

    try{

        if(typeof XLSX === "undefined"){

            alert("Library Excel belum termuat, silakan refresh halaman lalu coba lagi.");
            return;

        }

        const { data: headers, error: hErr } = await supabaseClient
            .from("barang_masuk")
            .select("*")
            .eq("gudang", user.gudang)
            .order("tanggal", {ascending:false})
            .order("id", {ascending:false});

        if(hErr) throw hErr;

        if(!headers || headers.length === 0){

            alert("Tidak ada data Barang Masuk untuk diexport.");
            return;

        }

        const ids = headers.map(h => h.id);

        const { data: details, error: dErr } = await supabaseClient
            .from("barang_masuk_detail")
            .select("*")
            .in("barang_masuk_id", ids);

        if(dErr) throw dErr;

        const detailMap = new Map();

        (details || []).forEach(d=>{

            const key = String(d.barang_masuk_id);

            if(!detailMap.has(key)) detailMap.set(key, []);

            detailMap.get(key).push(d);

        });

        const rows = [];

        headers.forEach(h=>{

            const items = detailMap.get(String(h.id)) || [];

            if(items.length === 0){

                rows.push({
                    "No BTB": h.no_btb,
                    "Tanggal": h.tanggal,
                    "Supplier": h.supplier,
                    "Keterangan": h.keterangan || "",
                    "Kode Barang": "",
                    "Nama Barang": "",
                    "Kategori": "",
                    "Satuan": "",
                    "Qty": "",
                    "Gudang": h.gudang,
                    "Created By": h.created_by
                });

            } else {

                items.forEach(d=>{

                    rows.push({
                        "No BTB": h.no_btb,
                        "Tanggal": h.tanggal,
                        "Supplier": h.supplier,
                        "Keterangan": h.keterangan || "",
                        "Kode Barang": d.kode_barang,
                        "Nama Barang": d.nama_barang,
                        "Kategori": d.kategori,
                        "Satuan": d.satuan,
                        "Qty": d.qty,
                        "Gudang": h.gudang,
                        "Created By": h.created_by
                    });

                });

            }

        });

        const ws = XLSX.utils.json_to_sheet(rows);

        // lebar kolom biar enak dibaca
        ws["!cols"] = [
            {wch:22}, {wch:12}, {wch:22}, {wch:24},
            {wch:14}, {wch:26}, {wch:16}, {wch:10},
            {wch:8}, {wch:14}, {wch:18}
        ];

        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(wb, ws, "Barang Masuk");

        const tanggalFile = new Date().toISOString().split("T")[0];
        const namaFile = `Barang-Masuk-${user.gudang}-${tanggalFile}.xlsx`;

        XLSX.writeFile(wb, namaFile);

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// IMPORT
// =====================================

const fileImportEl = document.getElementById("fileImport");

if(fileImportEl){

    fileImportEl.addEventListener("change",function(){

        alert("Fitur Import Excel akan dibuat pada tahap berikutnya.");

    });

}

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded",async()=>{

    document.getElementById("tanggal").value =
        new Date().toISOString().split("T")[0];

    await loadSupplier();
    await loadBarang();
    await loadStokGudang();

    setupSupplierCombo(supplierSearchInput, supplierHidden, supplierDropdown);

    setupSupplierCombo(
        document.getElementById("editSupplierSearch"),
        document.getElementById("editSupplier"),
        document.getElementById("editSupplierDropdown")
    );

    setupDetailRowsDelegation("detailRows");
    setupDetailRowsDelegation("editDetailRows");

    tambahBarisBarangKe("detailRows");

    await loadBarangMasuk();

    aktifkanRealtimeStok();

});
