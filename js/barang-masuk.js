// =====================================
// BARANG MASUK (BTB)
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;

// Menyimpan master data di memory
let masterBarang = [];
let masterSupplier = [];

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

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// CARI BARANG (exact match, dipakai saat simpan)
// =====================================

function cariBarang(namaBarang){

    return masterBarang.find(item=>
        item.nama_barang.toLowerCase() === namaBarang.toLowerCase()
    );

}

// =====================================
// BARANG - COMBOBOX PENCARIAN PER BARIS
// =====================================

function renderBarangDropdown(row, keyword){

    const dropdown = row.querySelector(".barang-dropdown");

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

function pilihBarangDariDropdown(row, barang){

    row.querySelector(".barang-search").value = barang.nama_barang;
    row.querySelector(".kode_barang").value = barang.kode_barang;
    row.querySelector(".kategori").value = barang.kategori;
    row.querySelector(".satuan").value = barang.satuan;

}

// =====================================
// TAMBAH BARIS BARANG
// =====================================

function tambahBarisBarang(){

    const tbody = document.getElementById("detailBarangBody");
    const no = tbody.rows.length + 1;

    const tr = document.createElement("tr");

    tr.innerHTML = `
    <td>${no}</td>
    <td>
        <div class="combo-wrapper">
            <input
            type="text"
            class="combo-input barang-search"
            placeholder="-- Cari Barang --"
            autocomplete="off">
            <div class="combo-dropdown barang-dropdown"></div>
        </div>
    </td>
    <td>
        <input type="text" class="kode_barang" readonly>
    </td>
    <td>
        <input type="text" class="kategori" readonly>
    </td>
    <td>
        <input type="text" class="satuan" readonly>
    </td>
    <td>
        <input type="number" class="qty" min="1" value="1">
    </td>
    <td>
        <button type="button" class="btn-hapus-baris" onclick="hapusBaris(this)">🗑</button>
    </td>
    `;

    tbody.appendChild(tr);

}

// =====================================
// HAPUS BARIS
// =====================================

function hapusBaris(btn){

    const tbody = document.getElementById("detailBarangBody");

    if(tbody.rows.length==1){

        alert("Minimal harus ada satu barang.");
        return;

    }

    btn.closest("tr").remove();
    nomorUlang();

}

// =====================================
// NOMOR ULANG
// =====================================

function nomorUlang(){

    const rows = document.querySelectorAll("#detailBarangBody tr");

    rows.forEach((row,index)=>{
        row.cells[0].innerHTML = index+1;
    });

}

// =====================================
// EVENT DELEGATION UNTUK BARIS BARANG
// (supaya baris yang ditambah belakangan tetap berfungsi)
// =====================================

const detailBarangBody = document.getElementById("detailBarangBody");

detailBarangBody.addEventListener("input", function(e){

    if(e.target.classList.contains("barang-search")){

        const row = e.target.closest("tr");

        if(!row) return;

        // reset pilihan sampai user memilih ulang dari daftar
        row.querySelector(".kode_barang").value = "";
        row.querySelector(".kategori").value = "";
        row.querySelector(".satuan").value = "";

        renderBarangDropdown(row, e.target.value);

    }

});

// focus tidak bubbling, gunakan focusin untuk delegasi
detailBarangBody.addEventListener("focusin", function(e){

    if(e.target.classList.contains("barang-search")){

        const row = e.target.closest("tr");

        if(row) renderBarangDropdown(row, e.target.value);

    }

});

detailBarangBody.addEventListener("click", function(e){

    const comboItem = e.target.closest(".combo-item");

    if(comboItem && comboItem.dataset.id && comboItem.closest(".barang-dropdown")){

        const row = e.target.closest("tr");

        if(!row) return;

        const barang = masterBarang.find(
            b => String(b.id) === String(comboItem.dataset.id)
        );

        if(!barang) return;

        pilihBarangDariDropdown(row, barang);

        row.querySelector(".barang-dropdown").classList.remove("show");

    }

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
// SIMPAN BTB
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

        if(noBTB==""){
            alert("Nomor BTB wajib diisi.");
            return;
        }

        if(tanggal==""){
            alert("Tanggal wajib diisi.");
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
        // SIMPAN DETAIL
        //---------------------------------

        const rows = document.querySelectorAll("#detailBarangBody tr");

        for(const row of rows){

            const namaBarang = row.querySelector(".barang-search").value.trim();
            const kode = row.querySelector(".kode_barang").value;
            const kategori = row.querySelector(".kategori").value;
            const satuan = row.querySelector(".satuan").value;
            const qty = parseInt(row.querySelector(".qty").value);

            if(namaBarang=="" || kode==""){
                alert("Masih ada barang yang belum dipilih dari daftar pencarian.");
                return;
            }

            if(!qty || qty<=0){
                alert("Qty harus lebih dari 0.");
                return;
            }

            // =====================================
            // SIMPAN DETAIL
            // =====================================

            const { error:detailError } = await supabaseClient
                .from("barang_masuk_detail")
                .insert([{
                    barang_masuk_id : header.id,
                    kode_barang : kode,
                    nama_barang : namaBarang,
                    kategori,
                    satuan,
                    qty
                }]);

            if(detailError) throw detailError;

            // =====================================
            // UPDATE STOK
            // =====================================

            const barang = masterBarang.find(item=>item.kode_barang===kode);

            if(barang){

                await supabaseClient
                    .from("master_barang")
                    .update({
                        stok:(barang.stok || 0) + qty
                    })
                    .eq("id",barang.id);

            }

        }

        //---------------------------------
        // SELESAI
        //---------------------------------

        alert("BTB berhasil disimpan.");

        document.getElementById("formMasukHeader").reset();

        supplierHidden.value = "";
        supplierSearchInput.value = "";

        const tbody = document.getElementById("detailBarangBody");
        tbody.innerHTML="";
        tambahBarisBarang();

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
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded",async()=>{

    document.getElementById("tanggal").value =
        new Date().toISOString().split("T")[0];

    await loadSupplier();
    await loadBarang();
    await loadBarangMasuk();
    tambahBarisBarang();

});
