// =====================================
// BARANG MASUK (BTB) - SAMA PERSIS DENGAN BARANG KELUAR
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;

// Menyimpan master data di memory
let masterBarang = [];
let masterSupplier = [];

// counter untuk id unik tiap baris detail
let rowCounter = 0;

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
// SUPPLIER - COMBOBOX PENCARIAN
// =====================================

const supplierSearchInput = document.getElementById("supplierSearch");
const supplierHidden      = document.getElementById("supplier");
const supplierDropdown    = document.getElementById("supplierDropdown");

function renderSupplierDropdown(keyword){

    const kw = (keyword || "").trim().toLowerCase();

    const filtered = masterSupplier.filter(s =>
        s.nama_toko.toLowerCase().includes(kw)
    );

    supplierDropdown.innerHTML = "";

    if(filtered.length === 0){

        supplierDropdown.innerHTML =
            `<div class="combo-empty">Supplier tidak ditemukan</div>`;

    } else {

        filtered.forEach(s=>{

            const item = document.createElement("div");

            item.className = "combo-item";
            item.textContent = s.nama_toko;
            item.dataset.id = s.id;
            item.dataset.nama = s.nama_toko;

            supplierDropdown.appendChild(item);

        });

    }

    supplierDropdown.classList.add("show");

}

supplierSearchInput.addEventListener("input", function(){

    // reset pilihan sebelumnya sampai user memilih ulang dari daftar
    supplierHidden.value = "";

    renderSupplierDropdown(this.value);

});

supplierSearchInput.addEventListener("focus", function(){

    renderSupplierDropdown(this.value);

});

supplierDropdown.addEventListener("click", function(e){

    const item = e.target.closest(".combo-item");

    if(!item || !item.dataset.nama) return;

    supplierHidden.value = item.dataset.nama;
    supplierSearchInput.value = item.dataset.nama;

    supplierDropdown.classList.remove("show");

});

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

        // sinkronkan badge stok pada baris yang barangnya sudah dipilih
        refreshSemuaBarisStok();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// STOK REALTIME PER BARIS
// =====================================

function refreshStokBaris(row){

    const badge = row.querySelector(".stok-badge");

    const kodeBarang = row.dataset.kodeBarang;

    if(!kodeBarang){

        badge.textContent = "Stok: -";
        return;

    }

    const barang = masterBarang.find(b => b.kode_barang === kodeBarang);

    const stok = barang ? (barang.stok || 0) : 0;

    badge.textContent = `Stok: ${stok}`;

}

function refreshSemuaBarisStok(){

    const rows = document.querySelectorAll("#detailRows .detail-row");

    rows.forEach(row=>{

        if(row.dataset.kodeBarang) refreshStokBaris(row);

    });

}

// =====================================
// REALTIME SUBSCRIBE STOK MASTER BARANG
// =====================================

function aktifkanRealtimeStok(){

    supabaseClient

    .channel("stok-realtime-barang-masuk")

    .on("postgres_changes",

        { event: "*", schema: "public", table: "master_barang" },

        async () => {

            await loadBarang();

        }

    )

    .subscribe();

}

// =====================================
// BARIS DETAIL BARANG (MULTI ITEM, SAMA PERSIS DENGAN BARANG KELUAR)
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
// EVENT DELEGATION UNTUK SEMUA BARIS DI #detailRows
// =====================================

const detailRowsContainer = document.getElementById("detailRows");

detailRowsContainer.addEventListener("input", function(e){

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
detailRowsContainer.addEventListener("focusin", function(e){

    if(e.target.classList.contains("input-barang-search")){

        const row = e.target.closest(".detail-row");

        if(row) renderBarangDropdown(row, e.target.value);

    }

});

detailRowsContainer.addEventListener("click", function(e){

    // hapus baris
    if(e.target.classList.contains("btn-hapus-baris")){

        const row = e.target.closest(".detail-row");

        if(row) hapusBarisBarang(row);

        return;

    }

    // pilih barang dari dropdown pencarian
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

document
.getElementById("btnTambahBaris")
.addEventListener("click", function(){

    tambahBarisBarang();

});

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
// SIMPAN BARANG MASUK (BTB)
// =====================================

document
.getElementById("btnSimpanBTB")
.addEventListener("click", simpanBTB);

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

            itemList.push({ barang, qty });

        }

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
        // SIMPAN DETAIL + UPDATE STOK
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
            // UPDATE STOK
            // =====================================

            await supabaseClient
                .from("master_barang")
                .update({
                    stok:(barang.stok || 0) + qty
                })
                .eq("id",barang.id);

        }

        //---------------------------------
        // SELESAI
        //---------------------------------

        alert(`Barang Masuk berhasil disimpan (${itemList.length} item).`);

        resetFormMasuk();

        // muat ulang master barang supaya stok terbaru terpakai untuk transaksi berikutnya
        await loadBarang();

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

    tambahBarisBarang();

}

// =====================================
// LOAD HISTORI BTB
// =====================================

async function loadBarangMasuk(){

    try{

        const { data,error } = await supabaseClient
            .from("barang_masuk")
            .select("*")
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

document
.getElementById("search")
.addEventListener("keyup",cariBarangMasuk);

// =====================================
// DETAIL BTB
// =====================================

function lihatDetail(id){
    alert("Fitur Detail BTB akan dibuat pada tahap berikutnya.");
}

// =====================================
// EDIT BTB
// =====================================

function editBTB(id){
    alert("Fitur Edit BTB akan dibuat pada tahap berikutnya.");
}

// =====================================
// HAPUS BTB
// =====================================

function hapusBTB(id){
    alert("Fitur Hapus BTB akan dibuat pada tahap berikutnya.");
}

// =====================================
// EXPORT
// =====================================

function exportExcel(){

    alert("Fitur Export Excel akan dibuat pada tahap berikutnya.");

}

// =====================================
// IMPORT
// =====================================

document

.getElementById("fileImport")

.addEventListener("change",function(){

    alert("Fitur Import Excel akan dibuat pada tahap berikutnya.");

});

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded",async()=>{

    document.getElementById("tanggal").value =
        new Date().toISOString().split("T")[0];

    await loadSupplier();
    await loadBarang();
    tambahBarisBarang();
    await loadBarangMasuk();

    aktifkanRealtimeStok();

});
