// =====================================
// BARANG MASUK (BTB)
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;

// Menyimpan master barang di memory
let masterBarang = [];

// =====================================
// LOAD SUPPLIER
// =====================================

async function loadSupplier(){

    try{

        const { data, error } = await supabaseClient
            .from("master_supplier")
            .select("*")
            .order("nama_supplier");

        if(error) throw error;

        const list = document.getElementById("listSupplier");

        list.innerHTML = "";

        data.forEach(item=>{

            list.innerHTML += `<option value="${item.nama_supplier}"></option>`;

        });

    }
    catch(err){

        console.error(err);
        alert(err.message);

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

        masterBarang = data;

        const list = document.getElementById("listBarang");

        list.innerHTML = "";

        data.forEach(item=>{

            list.innerHTML += `<option value="${item.nama_barang}"></option>`;

        });

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// CARI BARANG
// =====================================

function cariBarang(namaBarang){

    return masterBarang.find(item=>
        item.nama_barang.toLowerCase() === namaBarang.toLowerCase()
    );

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
        <input
        type="text"
        class="barang-search"
        list="listBarang"
        placeholder="Cari Barang..."
        autocomplete="off"
        oninput="pilihBarang(this)">
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
        <button type="button" class="btn-delete" onclick="hapusBaris(this)">🗑</button>
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
// PILIH BARANG
// =====================================

function pilihBarang(input){

    const barang = cariBarang(input.value);

    if(!barang) return;

    const row = input.closest("tr");

    row.querySelector(".kode_barang").value = barang.kode_barang;
    row.querySelector(".kategori").value = barang.kategori;
    row.querySelector(".satuan").value = barang.satuan;

}

document.addEventListener("input",function(e){

    if(e.target.classList.contains("barang-search")){
        pilihBarang(e.target);
    }

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
        const supplier = document.getElementById("supplier").value.trim();
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
            alert("Supplier wajib dipilih.");
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

            if(namaBarang==""){
                alert("Masih ada barang yang belum dipilih.");
                return;
            }

            if(qty<=0){
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

        const tbody = document.getElementById("detailBarangBody");
        tbody.innerHTML="";
        tambahBarisBarang();

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

    await loadSupplier();
    await loadBarang();
    await loadBarangMasuk();
    tambahBarisBarang();

});
