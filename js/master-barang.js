// =====================================
// MASTER BARANG
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    window.location.href = "login.html";
}

// =====================================
// LOAD KATEGORI
// =====================================

async function loadKategori() {

    const { data, error } = await supabaseClient
        .from("kategori_barang")
        .select("*")
        .order("nama_kategori");

    if (error) {
        console.error(error);
        return;
    }

    const kategori = document.getElementById("kategori");

    kategori.innerHTML =
        '<option value="">-- Pilih Kategori --</option>';

    data.forEach(item => {

        kategori.innerHTML += `
            <option value="${item.nama_kategori}">
                ${item.nama_kategori}
            </option>
        `;

    });

}

// =====================================
// LOAD SATUAN
// =====================================

async function loadSatuan() {

    const { data, error } = await supabaseClient
        .from("satuan")
        .select("*")
        .order("nama_satuan");

    if (error) {
        console.error(error);
        return;
    }

    const satuan = document.getElementById("satuan");

    satuan.innerHTML =
        '<option value="">-- Pilih Satuan --</option>';

    data.forEach(item => {

        satuan.innerHTML += `
            <option value="${item.nama_satuan}">
                ${item.nama_satuan}
            </option>
        `;

    });

}

// =====================================
// LOAD BARANG
// =====================================

async function loadBarang() {

    const { data, error } = await supabaseClient
        .from("master_barang")
        .select("*")
        .order("kode_barang");

    if (error) {
        console.error(error);
        return;
    }

    const tbody = document.querySelector("#tableBarang tbody");

    tbody.innerHTML = "";

    data.forEach(item => {

        tbody.innerHTML += `
        <tr>

            <td>${item.kode_barang}</td>

            <td>${item.nama_barang}</td>

            <td>${item.kategori}</td>

            <td>${item.satuan}</td>

            <td>

                <button
                    class="btn-edit"
                    onclick="editBarang(${item.id})">

                    ✏ Edit

                </button>

                <button
                    class="btn-delete"
                    onclick="hapusBarang(${item.id})">

                    🗑 Hapus

                </button>

            </td>

        </tr>
        `;

    });

}

// =====================================
// SIMPAN BARANG
// =====================================

document
.getElementById("formBarang")
.addEventListener("submit", async function(e){

    e.preventDefault();

    const kode = document
        .getElementById("kode_barang")
        .value
        .trim()
        .toUpperCase();

    const nama = document
        .getElementById("nama_barang")
        .value
        .trim();

    const kategori =
        document.getElementById("kategori").value;

    const satuan =
        document.getElementById("satuan").value;

    // ============================
    // VALIDASI KODE BARANG
    // ============================

    const { data: cekKode, error: errorCek } =
        await supabaseClient
        .from("master_barang")
        .select("id")
        .eq("kode_barang", kode);

    if (errorCek) {

        alert(errorCek.message);

        return;

    }

    if (cekKode.length > 0) {

        alert("Kode Barang sudah digunakan.");

        return;

    }

    const barang = {

        kode_barang: kode,

        nama_barang: nama,

        kategori: kategori,

        satuan: satuan

    };

    const { error } = await supabaseClient
        .from("master_barang")
        .insert([barang]);

    if (error) {

        alert(error.message);

        return;

    }

    alert("Master Barang berhasil disimpan.");

    document.getElementById("formBarang").reset();

    loadKategori();

    loadSatuan();

    loadBarang();

});

// =====================================
// HAPUS
// =====================================

async function hapusBarang(id){

    if(!confirm("Hapus Master Barang ini?"))
        return;

    const { error } = await supabaseClient
        .from("master_barang")
        .delete()
        .eq("id", id);

    if(error){

        alert(error.message);

        return;

    }

    loadBarang();

}

// =====================================
// EDIT
// =====================================

function editBarang(id){

    alert("Fitur Edit Barang akan dibuat pada tahap berikutnya.");

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
.addEventListener("change", function(){

    alert("Fitur Import Excel akan dibuat pada tahap berikutnya.");

});

// =====================================
// LOAD PERTAMA
// =====================================

document.addEventListener("DOMContentLoaded", function(){

    loadKategori();

    loadSatuan();

    loadBarang();

});
