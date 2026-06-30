// ======================================
// DATABASE BARANG
// ======================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {

    location.href = "login.html";

}

// ======================================
// LOAD KATEGORI
// ======================================

async function loadKategori() {

    try {

        const { data, error } = await supabaseClient

            .from("kategori_barang")

            .select("*")

            .order("nama_kategori");

        if (error) throw error;

        const kategori =
            document.getElementById("filterKategori");

        kategori.innerHTML = `
            <option value="">Semua Kategori</option>
        `;

        data.forEach(item => {

            kategori.innerHTML += `

            <option value="${item.nama_kategori}">

                ${item.nama_kategori}

            </option>

            `;

        });

    }

    catch(err){

        console.error(err);

    }

}

// ======================================
// LOAD DATABASE BARANG
// ======================================

async function loadBarang(){

    try{

        const {

            data,

            error

        } = await supabaseClient

        .from("master_barang")

        .select("*")

        .order("nama_barang");

        if(error) throw error;

        tampilBarang(data);

    }

    catch(err){

        console.error(err);

    }

}

// ======================================
// SEARCH
// ======================================

document

.getElementById("search")

.addEventListener("keyup",async()=>{

    await loadBarang();

});

document

.getElementById("filterKategori")

.addEventListener("change",async()=>{

    await loadBarang();

});

// ======================================
// TAMPILKAN DATABASE BARANG
// ======================================

function tampilBarang(data){

    const tbody = document.querySelector("#tableBarang tbody");

    tbody.innerHTML = "";

    const keyword =
        document.getElementById("search")
        .value
        .toLowerCase();

    const kategori =
        document.getElementById("filterKategori")
        .value;

    let no = 1;

    data

    .filter(item=>{

        const cocokNama =
            item.nama_barang
            .toLowerCase()
            .includes(keyword);

        const cocokKode =
            item.kode_barang
            .toLowerCase()
            .includes(keyword);

        const cocokKategori =
            kategori=="" ||
            item.kategori==kategori;

        return (cocokNama || cocokKode)
            && cocokKategori;

    })

    .forEach(item=>{

        const stokAwal =
            item.stok || 0;

        const masuk = 0;

        const keluar = 0;

        const sisa =
            stokAwal + masuk - keluar;

        let badge="stok-success";

        if(sisa<=0){

            badge="stok-danger";

        }

        else if(
            sisa<=item.stok_minimum
        ){

            badge="stok-warning";

        }

        tbody.innerHTML += `

        <tr>

            <td>${no++}</td>

            <td>

                <span class="kode-badge">

                    ${item.kode_barang}

                </span>

            </td>

            <td>

                <b>${item.nama_barang}</b>

            </td>

            <td>${item.kategori}</td>

            <td>

                <span class="satuan-badge">

                    ${item.satuan}

                </span>

            </td>

            <td>

                <span class="text-success">

                    ${stokAwal}

                </span>

            </td>

            <td>

                <span class="text-primary">

                    ${masuk}

                </span>

            </td>

            <td>

                <span class="text-danger">

                    ${keluar}

                </span>

            </td>

            <td>

                <span class="${badge}">

                    ${sisa} ${item.satuan}

                </span>

            </td>

        </tr>

        `;

    });

}
