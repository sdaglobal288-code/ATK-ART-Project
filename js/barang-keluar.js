// =====================================
// BARANG KELUAR (MULTI ITEM + STOK REALTIME)
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;

// cache master barang, dipakai untuk isi opsi tiap baris tanpa query berulang
let masterBarangList = [];

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

        const pengambil = document.getElementById("pengambil");

        pengambil.innerHTML = `
            <option value="">-- Pilih Nama Pengambil --</option>
        `;

        data.forEach(item => {

            pengambil.innerHTML += `

                <option value="${item.id}">
                    ${item.nama}
                </option>

            `;

        });

    } catch (err) {

        console.error(err);

        alert(err.message);

    }

}

// =====================================
// AUTO ISI KARYAWAN
// =====================================

document
.getElementById("pengambil")
.addEventListener("change", async function(){

    const id = this.value;

    if(id==""){

        document.getElementById("departemen").value="";

        document.getElementById("jabatan").value="";

        return;

    }

    try{

        const { data,error } = await supabaseClient

        .from("master_karyawan")

        .select("*")

        .eq("id",id)

        .single();

        if(error) throw error;

        document.getElementById("departemen").value =
            data.departemen;

        document.getElementById("jabatan").value =
            data.jabatan;

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

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

function buildOpsiBarang(){

    let html = `<option value="">-- Pilih Barang --</option>`;

    masterBarangList.forEach(item=>{

        html += `<option value="${item.id}">${item.nama_barang}</option>`;

    });

    return html;

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

    const row = document.createElement("div");

    row.className = "detail-row";
    row.id = rowId;
    row.dataset.stok = "0";
    row.dataset.kodeBarang = "";

    row.innerHTML = `

        <select class="input-barang" required>
            ${buildOpsiBarang()}
        </select>

        <input type="text" class="input-kategori" placeholder="Kategori" readonly>

        <input type="text" class="input-satuan" placeholder="Satuan" readonly>

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

// event delegation untuk semua baris di dalam #detailRows
document
.getElementById("detailRows")
.addEventListener("change", async function(e){

    const row = e.target.closest(".detail-row");

    if(!row) return;

    if(e.target.classList.contains("input-barang")){

        const id = e.target.value;

        const kategoriInput = row.querySelector(".input-kategori");
        const satuanInput   = row.querySelector(".input-satuan");

        if(id==""){

            kategoriInput.value = "";
            satuanInput.value   = "";
            row.dataset.kodeBarang = "";

            await refreshStokBaris(row);

            return;

        }

        const barang = masterBarangList.find(b => String(b.id) === String(id));

        if(!barang) return;

        kategoriInput.value = barang.kategori;
        satuanInput.value   = barang.satuan;
        row.dataset.kodeBarang = barang.kode_barang;

        await refreshStokBaris(row);

    }

});

document
.getElementById("detailRows")
.addEventListener("input", function(e){

    if(e.target.classList.contains("input-qty")){

        const row = e.target.closest(".detail-row");

        if(row) validasiQtyBaris(row);

    }

});

document
.getElementById("detailRows")
.addEventListener("click", function(e){

    if(e.target.classList.contains("btn-hapus-baris")){

        const row = e.target.closest(".detail-row");

        if(row) hapusBarisBarang(row);

    }

});

document
.getElementById("btnTambahBaris")
.addEventListener("click", tambahBarisBarang);

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
// SEARCH
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

        const pengambilId =
            document.getElementById("pengambil").value;

        if(pengambilId==""){

            alert("Pilih nama pengambil.");

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

            const barangSelect = row.querySelector(".input-barang");

            const qtyInput = row.querySelector(".input-qty");

            const barangId = barangSelect.value;

            const qty = parseInt(qtyInput.value);

            if(barangId===""){

                alert("Ada baris yang belum memilih barang.");

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

        const { data:karyawan,error:errorKar }

        = await supabaseClient

        .from("master_karyawan")

        .select("*")

        .eq("id",pengambilId)

        .single();

        if(errorKar) throw errorKar;

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

        // set pengambil sesuai data (jika masih ada di master_karyawan)

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

            row.querySelector(".input-barang").value = barang.id;

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

document.addEventListener("DOMContentLoaded",async()=>{

    document.getElementById("tanggal").value =
        new Date().toISOString().split("T")[0];

    await loadKaryawan();

    await loadBarang();

    tambahBarisBarang();

    await loadBarangKeluar();

    aktifkanRealtimeStok();

});
