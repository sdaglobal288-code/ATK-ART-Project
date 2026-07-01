// =====================================
// BARANG KELUAR (MULTI ITEM + PENCARIAN + STOK REALTIME)
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;

// cache master data supaya tidak query berulang tiap kali user mengetik/pilih
let masterBarangList = [];
let masterKaryawanList = [];

// counter untuk id unik tiap baris detail
let rowCounter = 0;

// =====================================
// LOAD KARYAWAN
// =====================================

async function loadKaryawan() {

    try {

        const { data, error } = await supabaseClient
            .from("master_karyawan")
            .select("*")
            .eq("status", "Aktif")
            .order("nama");

        if (error) throw error;

        masterKaryawanList = data || [];

    } catch (err) {

        console.error(err);

        alert(err.message);

    }

}

// =====================================
// PENGAMBIL - COMBOBOX PENCARIAN
// =====================================

const pengambilSearchInput = document.getElementById("pengambilSearch");
const pengambilHidden      = document.getElementById("pengambil");
const pengambilDropdown    = document.getElementById("pengambilDropdown");

function renderPengambilDropdown(keyword){

    const kw = (keyword || "").trim().toLowerCase();

    const filtered = masterKaryawanList.filter(k =>
        k.nama.toLowerCase().includes(kw)
    );

    pengambilDropdown.innerHTML = "";

    if(filtered.length === 0){

        pengambilDropdown.innerHTML =
            `<div class="combo-empty">Nama tidak ditemukan</div>`;

    } else {

        filtered.forEach(k=>{

            const item = document.createElement("div");

            item.className = "combo-item";
            item.textContent = k.nama;
            item.dataset.id = k.id;

            pengambilDropdown.appendChild(item);

        });

    }

    pengambilDropdown.classList.add("show");

}

pengambilSearchInput.addEventListener("input", function(){

    // reset pilihan sebelumnya sampai user memilih ulang dari daftar
    pengambilHidden.value = "";

    document.getElementById("departemen").value = "";
    document.getElementById("jabatan").value = "";

    renderPengambilDropdown(this.value);

});

pengambilSearchInput.addEventListener("focus", function(){

    renderPengambilDropdown(this.value);

});

pengambilDropdown.addEventListener("click", function(e){

    const item = e.target.closest(".combo-item");

    if(!item || !item.dataset.id) return;

    const karyawan = masterKaryawanList.find(
        k => String(k.id) === String(item.dataset.id)
    );

    if(!karyawan) return;

    pengambilHidden.value = karyawan.id;
    pengambilSearchInput.value = karyawan.nama;

    document.getElementById("departemen").value = karyawan.departemen;
    document.getElementById("jabatan").value = karyawan.jabatan;

    pengambilDropdown.classList.remove("show");

});

// =====================================
// LOAD MASTER BARANG (dicache untuk semua baris)
// =====================================

async function loadBarang(){

    try{

        const { data,error } = await supabaseClient

        .from("master_barang")

        .select("*")

        .order("nama_barang");

        if(error) throw error;

        masterBarangList = data || [];

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

}

function renderBarangDropdown(row, keyword){

    const dropdown = row.querySelector(".input-barang-dropdown");

    const kw = (keyword || "").trim().toLowerCase();

    const filtered = masterBarangList.filter(b =>
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
// HITUNG STOK REALTIME (masuk - keluar)
// =====================================

async function hitungStok(kodeBarang){

    if(!kodeBarang) return 0;

    const { data:masuk } = await supabaseClient

    .from("barang_masuk")

    .select("qty")

    .eq("kode_barang",kodeBarang);

    const { data:keluar } = await supabaseClient

    .from("barang_keluar")

    .select("qty")

    .eq("kode_barang",kodeBarang);

    const totalMasuk =
        (masuk || []).reduce((a,b)=>a+b.qty,0);

    const totalKeluar =
        (keluar || []).reduce((a,b)=>a+b.qty,0);

    return totalMasuk - totalKeluar;

}

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

async function refreshStokBaris(row){

    const kodeBarang = row.dataset.kodeBarang;

    const badge = row.querySelector(".stok-badge");

    if(!kodeBarang){

        badge.textContent = "Stok: -";
        badge.classList.remove("warning");
        row.dataset.stok = "0";

        return;

    }

    const stok = await hitungStok(kodeBarang);

    row.dataset.stok = stok;

    badge.textContent = `Stok: ${stok}`;

    validasiQtyBaris(row);

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

// =====================================
// EVENT DELEGATION UNTUK SEMUA BARIS DI #detailRows
// (supaya baris yang ditambah belakangan tetap berfungsi)
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

        return;

    }

    if(e.target.classList.contains("input-qty")){

        validasiQtyBaris(row);

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

        const barang = masterBarangList.find(
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
// REALTIME STOK (subscribe perubahan barang_masuk & barang_keluar)
// =====================================

function aktifkanRealtimeStok(){

    supabaseClient

    .channel("stok-realtime-barang-keluar")

    .on("postgres_changes",

        { event: "*", schema: "public", table: "barang_masuk" },

        () => refreshSemuaBarisStok()

    )

    .on("postgres_changes",

        { event: "*", schema: "public", table: "barang_keluar" },

        () => refreshSemuaBarisStok()

    )

    .subscribe();

}

function refreshSemuaBarisStok(){

    const rows = document.querySelectorAll("#detailRows .detail-row");

    rows.forEach(row => {

        if(row.dataset.kodeBarang){

            refreshStokBaris(row);

        }

    });

}

// =====================================
// LOAD HISTORI BARANG KELUAR
// =====================================

async function loadBarangKeluar() {

    try {

        const { data, error } = await supabaseClient
            .from("barang_keluar")
            .select("*")
            .order("tanggal", { ascending: false })
            .order("id", { ascending: false });

        if (error) throw error;

        tampilBarangKeluar(data);

    } catch (err) {

        console.error(err);

        alert(err.message);

    }

}

// =====================================
// TAMPILKAN DATA
// =====================================

function tampilBarangKeluar(data){

    const tbody =
        document.querySelector("#tableKeluar tbody");

    tbody.innerHTML="";

    let no=1;

    data.forEach(item=>{

        tbody.innerHTML += `

        <tr>

            <td>${no++}</td>

            <td>${item.tanggal}</td>

            <td>

                <b>${item.nama_pengambil}</b>

            </td>

            <td>${item.departemen}</td>

            <td>${item.jabatan}</td>

            <td>${item.nama_barang}</td>

            <td>

                <span class="text-danger">

                    -${item.qty}

                </span>

            </td>

            <td>

                <span class="satuan-badge">

                    ${item.satuan}

                </span>

            </td>

            <td>${item.created_by}</td>

            <td>

                <button

                    class="btn-edit"

                    onclick="editBarangKeluar(${item.id})">

                    ✏ Edit

                </button>

                <button

                    class="btn-delete"

                    onclick="hapusBarangKeluar(${item.id})">

                    🗑 Hapus

                </button>

            </td>

        </tr>

        `;

    });

}

// =====================================
// SEARCH HISTORI
// =====================================

function cariBarangKeluar(){

    const keyword =
        document
        .getElementById("search")
        .value
        .toLowerCase();

    const rows =
        document.querySelectorAll("#tableKeluar tbody tr");

    rows.forEach(row=>{

        if(

            row.innerText
            .toLowerCase()
            .includes(keyword)

        ){

            row.style.display="";

        }

        else{

            row.style.display="none";

        }

    });

}

document

.getElementById("search")

.addEventListener("keyup",cariBarangKeluar);

// =====================================
// SIMPAN BARANG KELUAR (MULTI ITEM)
// =====================================

const form = document.getElementById("formKeluar");

if(form){

form.addEventListener("submit", async function(e){

    e.preventDefault();

    try{

        // --------------------------------------
        // VALIDASI PENGAMBIL
        // --------------------------------------

        const pengambilId = pengambilHidden.value;

        if(pengambilId===""){

            alert("Pilih nama pengambil dari daftar pencarian.");

            return;

        }

        // --------------------------------------
        // AMBIL SEMUA BARIS DETAIL BARANG
        // --------------------------------------

        const rows =
            document.querySelectorAll("#detailRows .detail-row");

        if(rows.length===0){

            alert("Tambahkan minimal 1 barang.");

            return;

        }

        const itemList = [];
        const kodeSudahDipakai = new Set();

        for(const row of rows){

            const barangId = row.querySelector(".input-barang-id").value;

            const qtyInput = row.querySelector(".input-qty");

            const qty = parseInt(qtyInput.value);

            if(barangId===""){

                alert("Ada baris yang belum memilih barang dari daftar pencarian.");

                return;

            }

            if(!qty || qty<=0){

                alert("Qty harus lebih dari 0 untuk setiap barang.");

                return;

            }

            const barang = masterBarangList.find(

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

            // cek ulang stok realtime saat submit (bukan hanya dari cache)

            const stokSaatIni = await hitungStok(barang.kode_barang);

            if(qty > stokSaatIni){

                alert(

                    `Stok "${barang.nama_barang}" tidak mencukupi.\n\n` +
                    `Stok tersedia : ${stokSaatIni}`

                );

                return;

            }

            itemList.push({ barang, qty });

        }

        // --------------------------------------
        // MASTER KARYAWAN
        // --------------------------------------

        const karyawan = masterKaryawanList.find(
            k => String(k.id) === String(pengambilId)
        );

        if(!karyawan){

            alert("Data pengambil tidak ditemukan, coba muat ulang halaman.");

            return;

        }

        // --------------------------------------
        // SUSUN TRANSAKSI (1 BARIS PER BARANG)
        // --------------------------------------

        const tanggal = document.getElementById("tanggal").value;
        const keterangan = document.getElementById("keterangan").value;

        const transaksiList = itemList.map(({barang, qty}) => ({

            tanggal: tanggal,

            nik: karyawan.nik,

            nama_pengambil: karyawan.nama,

            departemen: karyawan.departemen,

            jabatan: karyawan.jabatan,

            kode_barang: barang.kode_barang,

            nama_barang: barang.nama_barang,

            kategori: barang.kategori,

            satuan: barang.satuan,

            qty: qty,

            keterangan: keterangan,

            gudang: user.gudang,

            created_by: user.nama

        }));

        // --------------------------------------
        // INSERT SEKALIGUS
        // --------------------------------------

        const { error } = await supabaseClient

        .from("barang_keluar")

        .insert(transaksiList);

        if(error) throw error;

        alert(

            `Barang Keluar berhasil disimpan (${transaksiList.length} item).`

        );

        resetFormKeluar();

        await loadBarangKeluar();

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

});

}

// =====================================
// RESET FORM (kembali ke 1 baris kosong)
// =====================================

function resetFormKeluar(){

    form.reset();

    pengambilHidden.value = "";
    pengambilSearchInput.value = "";

    document.getElementById("departemen").value="";
    document.getElementById("jabatan").value="";

    document.getElementById("tanggal").value =
        new Date().toISOString().split("T")[0];

    document.getElementById("detailRows").innerHTML = "";

    tambahBarisBarang();

}

// =====================================
// EDIT BARANG KELUAR (per item / baris histori)
// =====================================

async function editBarangKeluar(id){

    try{

        const { data,error } = await supabaseClient

        .from("barang_keluar")

        .select("*")

        .eq("id",id)

        .single();

        if(error) throw error;

        editId=id;

        document.getElementById("tanggal").value =
            data.tanggal;

        document.getElementById("keterangan").value =
            data.keterangan ?? "";

        // isi pengambil dari data histori (walau tidak dipilih dari dropdown)

        pengambilHidden.value = "";

        const karyawanCocok = masterKaryawanList.find(
            k => k.nama === data.nama_pengambil
        );

        pengambilSearchInput.value = data.nama_pengambil;

        if(karyawanCocok) pengambilHidden.value = karyawanCocok.id;

        document.getElementById("departemen").value = data.departemen;
        document.getElementById("jabatan").value = data.jabatan;

        // kosongkan baris detail, tampilkan 1 baris berisi item yang diedit

        document.getElementById("detailRows").innerHTML = "";

        tambahBarisBarang();

        const row = document.querySelector("#detailRows .detail-row");

        const barang = masterBarangList.find(

            b => b.kode_barang === data.kode_barang

        );

        if(barang){

            row.querySelector(".input-barang-search").value = barang.nama_barang;
            row.querySelector(".input-barang-id").value = barang.id;
            row.querySelector(".input-kategori").value = barang.kategori;
            row.querySelector(".input-satuan").value = barang.satuan;

            row.dataset.kodeBarang = barang.kode_barang;

            await refreshStokBaris(row);

        }

        row.querySelector(".input-qty").value = data.qty;

        document.getElementById("judulForm").innerHTML =
            "✏ Edit Barang Keluar";

        document.getElementById("btnSimpan").innerHTML =
            "💾 Update Barang Keluar";

        document.getElementById("btnBatal").style.display =
            "inline-block";

        window.scrollTo({

            top:0,

            behavior:"smooth"

        });

    }

    catch(err){

        alert(err.message);

    }

}

// =====================================
// BATAL EDIT
// =====================================

function batalEdit(){

    editId=null;

    document.getElementById("judulForm").innerHTML =
        "➖ Barang Keluar";

    document.getElementById("btnSimpan").innerHTML =
        "💾 Simpan Barang Keluar";

    document.getElementById("btnBatal").style.display =
        "none";

    resetFormKeluar();

}

document

.getElementById("btnBatal")

.addEventListener("click",batalEdit);

// =====================================
// HAPUS
// =====================================

async function hapusBarangKeluar(id){

    if(!confirm("Hapus transaksi ini?"))

        return;

    try{

        const { error } = await supabaseClient

        .from("barang_keluar")

        .delete()

        .eq("id",id);

        if(error) throw error;

        alert("Data berhasil dihapus.");

        loadBarangKeluar();

    }

    catch(err){

        alert(err.message);

    }

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

document.addEventListener("DOMContentLoaded", async ()=>{

    document.getElementById("tanggal").value =
        new Date().toISOString().split("T")[0];

    await loadKaryawan();

    await loadBarang();

    tambahBarisBarang();

    await loadBarangKeluar();

    aktifkanRealtimeStok();

});
