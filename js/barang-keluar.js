// =====================================
// BARANG KELUAR
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;

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
// LOAD BARANG
// =====================================

async function loadBarang(){

    try{

        const { data,error } = await supabaseClient

        .from("master_barang")

        .select("*")

        .order("nama_barang");

        if(error) throw error;

        const barang =
            document.getElementById("barang");

        barang.innerHTML = `
            <option value="">
                -- Pilih Barang --
            </option>
        `;

        data.forEach(item=>{

            barang.innerHTML += `

            <option value="${item.id}">

                ${item.nama_barang}

            </option>

            `;

        });

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

}

// =====================================
// AUTO ISI BARANG
// =====================================

document
.getElementById("barang")
.addEventListener("change", async function(){

    const id=this.value;

    if(id==""){

        document.getElementById("kategori").value="";

        document.getElementById("satuan").value="";

        return;

    }

    try{

        const { data,error } = await supabaseClient

        .from("master_barang")

        .select("*")

        .eq("id",id)

        .single();

        if(error) throw error;

        document.getElementById("kategori").value =
            data.kategori;

        document.getElementById("satuan").value =
            data.satuan;

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

});

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
// SIMPAN BARANG KELUAR
// =====================================

const form = document.getElementById("formKeluar");

if(form){

form.addEventListener("submit", async function(e){

    e.preventDefault();

    try{

        const barangId =
            document.getElementById("barang").value;

        const pengambilId =
            document.getElementById("pengambil").value;

        if(barangId==""){

            alert("Pilih barang.");

            return;

        }

        if(pengambilId==""){

            alert("Pilih nama pengambil.");

            return;

        }

        const qty =
            parseInt(document.getElementById("qty").value);

        if(qty<=0){

            alert("Qty harus lebih dari 0.");

            return;

        }

        //-----------------------------------------
        // MASTER BARANG
        //-----------------------------------------

        const { data:barang,error:errorBarang }

        = await supabaseClient

        .from("master_barang")

        .select("*")

        .eq("id",barangId)

        .single();

        if(errorBarang) throw errorBarang;

        //-----------------------------------------
        // MASTER KARYAWAN
        //-----------------------------------------

        const { data:karyawan,error:errorKar }

        = await supabaseClient

        .from("master_karyawan")

        .select("*")

        .eq("id",pengambilId)

        .single();

        if(errorKar) throw errorKar;

          //-----------------------------------------
        // HITUNG STOK
        //-----------------------------------------

        const { data:masuk } = await supabaseClient

        .from("barang_masuk")

        .select("qty")

        .eq("kode_barang",barang.kode_barang);

        const { data:keluar } = await supabaseClient

        .from("barang_keluar")

        .select("qty")

        .eq("kode_barang",barang.kode_barang);

        const totalMasuk =
            (masuk || [])
            .reduce((a,b)=>a+b.qty,0);

        const totalKeluar =
            (keluar || [])
            .reduce((a,b)=>a+b.qty,0);

        const stok =
            totalMasuk-totalKeluar;

        if(qty>stok){

            alert(

                "Stok tidak mencukupi.\n\n" +

                "Stok tersedia : " +

                stok

            );

            return;

        }

          //-----------------------------------------
        // INSERT
        //-----------------------------------------

        const transaksi={

            tanggal:

                document.getElementById("tanggal").value,

            nik:karyawan.nik,

            nama_pengambil:

                karyawan.nama,

            departemen:

                karyawan.departemen,

            jabatan:

                karyawan.jabatan,

            kode_barang:

                barang.kode_barang,

            nama_barang:

                barang.nama_barang,

            kategori:

                barang.kategori,

            satuan:

                barang.satuan,

            qty:qty,

            keterangan:

                document.getElementById("keterangan").value,

            gudang:user.gudang,

            created_by:user.nama

        };

        const { error } = await supabaseClient

        .from("barang_keluar")

        .insert([transaksi]);

        if(error) throw error;

          alert("Barang Keluar berhasil disimpan.");

        form.reset();

        document.getElementById("departemen").value="";

        document.getElementById("jabatan").value="";

        document.getElementById("kategori").value="";

        document.getElementById("satuan").value="";

        document.getElementById("tanggal").value =
            new Date().toISOString().split("T")[0];

        await loadBarangKeluar();

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

});

}

// =====================================
// EDIT BARANG KELUAR
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

        document.getElementById("qty").value =
            data.qty;

        document.getElementById("keterangan").value =
            data.keterangan ?? "";

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

    form.reset();

    document.getElementById("tanggal").value =
        new Date().toISOString().split("T")[0];

    document.getElementById("departemen").value="";

    document.getElementById("jabatan").value="";

    document.getElementById("kategori").value="";

    document.getElementById("satuan").value="";

    document.getElementById("judulForm").innerHTML =
        "➖ Barang Keluar";

    document.getElementById("btnSimpan").innerHTML =
        "💾 Simpan Barang Keluar";

    document.getElementById("btnBatal").style.display =
        "none";

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

    await loadBarangKeluar();

});
