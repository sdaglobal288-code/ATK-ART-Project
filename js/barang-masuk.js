// =====================================
// BARANG MASUK
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;

// =====================================
// LOAD SUPPLIER
// =====================================

async function loadSupplier() {

    try {

        const { data, error } = await supabaseClient
            .from("master_supplier")
            .select("*")
            .order("nama_supplier");

        if (error) throw error;

        const supplier = document.getElementById("supplier");

        supplier.innerHTML = `
            <option value="">-- Pilih Supplier --</option>
        `;

        data.forEach(item => {

            supplier.innerHTML += `
                <option value="${item.nama_supplier}">
                    ${item.nama_supplier}
                </option>
            `;

        });

    } catch (err) {

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// LOAD BARANG
// =====================================

async function loadBarang() {

    try {

        const { data, error } = await supabaseClient
            .from("master_barang")
            .select("*")
            .order("nama_barang");

        if (error) throw error;

        const barang = document.getElementById("barang");

        barang.innerHTML = `
            <option value="">-- Pilih Barang --</option>
        `;

        data.forEach(item => {

            barang.innerHTML += `
                <option value="${item.id}">
                    ${item.nama_barang}
                </option>
            `;

        });

    } catch (err) {

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// AUTO ISI BARANG
// =====================================

document
.getElementById("barang")
.addEventListener("change", async function () {

    const id = this.value;

    if (id === "") {

        document.getElementById("kode_barang").value = "";
        document.getElementById("kategori").value = "";
        document.getElementById("satuan").value = "";

        return;

    }

    try {

        const { data, error } = await supabaseClient
            .from("master_barang")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;

        document.getElementById("kode_barang").value =
            data.kode_barang;

        document.getElementById("kategori").value =
            data.kategori;

        document.getElementById("satuan").value =
            data.satuan;

    } catch (err) {

        console.error(err);
        alert(err.message);

    }

});

// =====================================
// LOAD HISTORI BARANG MASUK
// =====================================

async function loadBarangMasuk() {

    try {

        const { data, error } = await supabaseClient
            .from("barang_masuk")
            .select("*")
            .order("tanggal", { ascending: false })
            .order("id", { ascending: false });

        if (error) throw error;

        tampilBarangMasuk(data);

    } catch (err) {

        console.error(err);

        alert(err.message);

    }

}

// =====================================
// TAMPILKAN DATA
// =====================================

function tampilBarangMasuk(data){

    const tbody =
        document.querySelector("#tableMasuk tbody");

    tbody.innerHTML="";

    let no=1;

    data.forEach(item=>{

        tbody.innerHTML += `

        <tr>

            <td>${no++}</td>

            <td>${item.tanggal}</td>

            <td>${item.supplier}</td>

            <td>

                <span class="kode-badge">

                    ${item.kode_barang}

                </span>

            </td>

            <td>

                <b>${item.nama_barang}</b>

            </td>

            <td>

                <span class="text-success">

                    +${item.qty}

                </span>

            </td>

            <td>

                <span class="satuan-badge">

                    ${item.satuan}

                </span>

            </td>

            <td>

                ${item.gudang}

            </td>

            <td>

                ${item.created_by}

            </td>

            <td>

                <button

                class="btn-edit"

                onclick="editBarangMasuk(${item.id})">

                ✏ Edit

                </button>

                <button

                class="btn-delete"

                onclick="hapusBarangMasuk(${item.id})">

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

function cariBarangMasuk(){

    const keyword =
        document
        .getElementById("search")
        .value
        .toLowerCase();

    const rows =
        document.querySelectorAll("#tableMasuk tbody tr");

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

.addEventListener("keyup",cariBarangMasuk);

// =====================================
// SIMPAN BARANG MASUK
// =====================================

const form = document.getElementById("formMasuk");

if(form){

form.addEventListener("submit",async function(e){

    e.preventDefault();

    try{

        const barangId =
            document.getElementById("barang").value;

        if(barangId==""){

            alert("Pilih barang terlebih dahulu.");

            return;

        }

        const qty =
            parseInt(document.getElementById("qty").value);

        if(qty<=0){

            alert("Qty harus lebih dari 0.");

            return;

        }

        //-------------------------------------------------
        // Ambil data master barang
        //-------------------------------------------------

        const { data:barang,error:errorBarang }

        = await supabaseClient

        .from("master_barang")

        .select("*")

        .eq("id",barangId)

        .single();

        if(errorBarang) throw errorBarang;

        //-------------------------------------------------
        // DATA BARANG MASUK
        //-------------------------------------------------

        const dataMasuk={

            tanggal:

                document.getElementById("tanggal").value,

            supplier:

                document.getElementById("supplier").value,

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

        //-------------------------------------------------
        // INSERT BARANG MASUK
        //-------------------------------------------------

        const { error } = await supabaseClient

        .from("barang_masuk")

        .insert([dataMasuk]);

        if(error) throw error;

        //-------------------------------------------------
        // UPDATE STOK
        //-------------------------------------------------

        const stokBaru =

            (barang.stok || 0) + qty;

        const { error:updateError }

        = await supabaseClient

        .from("master_barang")

        .update({

            stok:stokBaru

        })

        .eq("id",barangId);

        if(updateError) throw updateError;

        //-------------------------------------------------

        alert("Barang Masuk berhasil disimpan.");

        form.reset();

        document.getElementById("kode_barang").value="";

        document.getElementById("kategori").value="";

        document.getElementById("satuan").value="";

        await loadBarangMasuk();

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

});

}
