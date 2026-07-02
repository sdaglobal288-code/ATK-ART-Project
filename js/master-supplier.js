// =====================================
// MASTER SUPPLIER
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;

// cache data supplier di memory (dipakai untuk search & export)
let daftarSupplier = [];

// =====================================
// LOAD DATA
// =====================================

async function loadSupplier() {

    try {

        const { data, error } = await supabaseClient
            .from("master_supplier")
            .select("*")
            .order("nama_toko");

        if (error) throw error;

        daftarSupplier = data || [];

        tampilkanSupplier(daftarSupplier);

    } catch (err) {

        console.error(err);

        alert(err.message);

    }

}

// =====================================
// TAMPILKAN DATA
// =====================================

function tampilkanSupplier(data){

    const tbody = document.querySelector("#tableSupplier tbody");

    tbody.innerHTML = "";

    if(!data || data.length === 0){

        tbody.innerHTML = `
        <tr>
            <td colspan="4" class="empty-state">
                Belum ada data Supplier.
            </td>
        </tr>
        `;

        return;

    }

    data.forEach(item => {

        tbody.innerHTML += `
        <tr>

            <td>${item.kode_supplier}</td>

            <td>${item.nama_toko}</td>

            <td>${item.created_by ?? "-"}</td>

            <td>

                <button
                    class="btn-edit"
                    onclick="editSupplier(${item.id})">

                    ✏ Edit

                </button>

                <button
                    class="btn-delete"
                    onclick="hapusSupplier(${item.id})">

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

function cariSupplier(){

    const keyword = document
        .getElementById("searchSupplier")
        .value
        .toLowerCase()
        .trim();

    if(keyword === ""){

        tampilkanSupplier(daftarSupplier);
        return;

    }

    const hasil = daftarSupplier.filter(item =>
        (item.kode_supplier || "").toLowerCase().includes(keyword) ||
        (item.nama_toko || "").toLowerCase().includes(keyword)
    );

    tampilkanSupplier(hasil);

}

const searchEl = document.getElementById("searchSupplier");

if(searchEl){

    searchEl.addEventListener("keyup", cariSupplier);

}

// =====================================
// SIMPAN / UPDATE
// =====================================

const form = document.getElementById("formSupplier");

form.addEventListener("submit", async function(e){

    e.preventDefault();

    try{

        const kode = document
            .getElementById("kode_supplier")
            .value
            .trim()
            .toUpperCase();

        const supplier = {

            kode_supplier : kode,

            nama_toko : document
                .getElementById("nama_toko")
                .value
                .trim(),

            created_by : user.nama

        };

        // =====================================
        // UPDATE
        // =====================================

        if(editId !== null){

            const { error } = await supabaseClient

                .from("master_supplier")

                .update({

                    nama_toko : supplier.nama_toko

                })

                .eq("id", editId);

            if(error) throw error;

            alert("Supplier berhasil diupdate.");

            batalEdit();

            loadSupplier();

            return;

        }

        // =====================================
        // VALIDASI KODE
        // =====================================

        const { data: cek } = await supabaseClient

            .from("master_supplier")

            .select("id")

            .eq("kode_supplier", kode);

        if(cek.length > 0){

            alert("Kode Supplier sudah digunakan.");

            return;

        }

        // =====================================
        // INSERT
        // =====================================

        const { error } = await supabaseClient

            .from("master_supplier")

            .insert([supplier]);

        if(error) throw error;

        alert("Supplier berhasil disimpan.");

        form.reset();

        loadSupplier();

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

});

// =====================================
// EDIT
// =====================================

async function editSupplier(id){

    try{

        const { data, error } = await supabaseClient

            .from("master_supplier")

            .select("*")

            .eq("id", id)

            .single();

        if(error) throw error;

        editId = id;

        document.getElementById("kode_supplier").value =
            data.kode_supplier;

        document.getElementById("nama_toko").value =
            data.nama_toko;

        document.getElementById("kode_supplier").readOnly = true;

        document.getElementById("judulForm").innerHTML =
            "✏ Edit Supplier";

        document.getElementById("btnSimpan").innerHTML =
            "💾 Update Supplier";

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

    editId = null;

    form.reset();

    document.getElementById("kode_supplier").readOnly = false;

    document.getElementById("judulForm").innerHTML =
        "➕ Tambah Supplier";

    document.getElementById("btnSimpan").innerHTML =
        "💾 Simpan Supplier";

    document.getElementById("btnBatal").style.display =
        "none";

}

document
.getElementById("btnBatal")
.addEventListener("click", batalEdit);

// =====================================
// HAPUS
// =====================================

async function hapusSupplier(id){

    if(!confirm("Hapus Supplier ini?"))
        return;

    try{

        const { error } = await supabaseClient

            .from("master_supplier")

            .delete()

            .eq("id", id);

        if(error) throw error;

        alert("Supplier berhasil dihapus.");

        loadSupplier();

    }

    catch(err){

        alert(err.message);

    }

}

// =====================================
// EXPORT EXCEL (SheetJS)
// =====================================

function exportExcel(){

    try{

        if(!daftarSupplier || daftarSupplier.length === 0){

            alert("Tidak ada data Supplier untuk diexport.");
            return;

        }

        if(typeof XLSX === "undefined"){

            alert("Library Excel belum termuat. Coba refresh halaman lalu ulangi.");
            return;

        }

        // ambil data yang sedang tampil (mengikuti hasil search kalau ada)
        const keyword = document
            .getElementById("searchSupplier")
            .value
            .toLowerCase()
            .trim();

        const dataUntukExport = keyword === ""
            ? daftarSupplier
            : daftarSupplier.filter(item =>
                (item.kode_supplier || "").toLowerCase().includes(keyword) ||
                (item.nama_toko || "").toLowerCase().includes(keyword)
              );

        const rows = dataUntukExport.map((item, index) => ({
            "No"             : index + 1,
            "Kode Supplier"  : item.kode_supplier,
            "Nama Toko"      : item.nama_toko,
            "Created By"     : item.created_by ?? "-"
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);

        worksheet["!cols"] = [
            { wch: 5 },
            { wch: 18 },
            { wch: 35 },
            { wch: 20 }
        ];

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Master Supplier");

        const tanggalFile = new Date().toISOString().split("T")[0];

        XLSX.writeFile(workbook, `Master-Supplier-${tanggalFile}.xlsx`);

    }
    catch(err){

        console.error(err);
        alert("Gagal export Excel: " + err.message);

    }

}

// =====================================
// IMPORT EXCEL (SheetJS)
// =====================================

document
.getElementById("fileImport")
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

            // deteksi nama kolom secara fleksibel
            const dataMasuk = rows.map(row => ({
                kode_supplier: String(
                    row["Kode Supplier"] ?? row["kode_supplier"] ?? ""
                ).trim().toUpperCase(),
                nama_toko: String(
                    row["Nama Toko"] ?? row["nama_toko"] ?? ""
                ).trim(),
                created_by: user.nama
            })).filter(row => row.kode_supplier !== "" && row.nama_toko !== "");

            if(dataMasuk.length === 0){
                alert("Tidak ditemukan baris valid. Pastikan kolom bernama 'Kode Supplier' dan 'Nama Toko'.");
                return;
            }

            if(!confirm(`Ditemukan ${dataMasuk.length} baris supplier. Import sekarang?`)){
                return;
            }

            let berhasil = 0;
            let dilewati = 0;

            for(const row of dataMasuk){

                const { data: cek } = await supabaseClient
                    .from("master_supplier")
                    .select("id")
                    .eq("kode_supplier", row.kode_supplier);

                if(cek && cek.length > 0){
                    dilewati++;
                    continue;
                }

                const { error } = await supabaseClient
                    .from("master_supplier")
                    .insert([row]);

                if(!error) berhasil++;

            }

            alert(`Import selesai.\nBerhasil: ${berhasil}\nDilewati (kode sudah ada): ${dilewati}`);

            loadSupplier();

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
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", function(){

    loadSupplier();

});
