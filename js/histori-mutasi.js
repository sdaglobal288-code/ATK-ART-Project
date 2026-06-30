// =====================================
// HISTORI MUTASI
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {

    location.href = "login.html";

}

// =====================================

async function loadHistori() {

    let query = supabaseClient
        .from("mutasi_karyawan")
        .select("*")
        .order("created_at", {
            ascending: false
        });

    const keyword =
        document.getElementById("keyword").value.trim();

    const awal =
        document.getElementById("tglAwal").value;

    const akhir =
        document.getElementById("tglAkhir").value;

    if (awal) {

        query = query.gte("created_at", awal);

    }

    if (akhir) {

        query = query.lte(
            "created_at",
            akhir + "T23:59:59"
        );

    }

    const { data, error } = await query;

    if (error) {

        console.error(error);

        return;

    }

    let hasil = data;

    if (keyword !== "") {

        hasil = hasil.filter(item =>

            item.nama
            .toLowerCase()
            .includes(keyword.toLowerCase())

            ||

            item.nik.includes(keyword)

        );

    }

    const tbody =
        document.querySelector("#tableHistori tbody");

    tbody.innerHTML = "";

    hasil.forEach(item => {

        tbody.innerHTML += `

<tr>

<td>

${new Date(item.created_at)
.toLocaleString("id-ID")}

</td>

<td>${item.nik}</td>

<td>${item.nama}</td>

<td>${item.gudang_lama}</td>

<td>${item.gudang_baru}</td>

<td>${item.departemen_lama}</td>

<td>${item.departemen_baru}</td>

<td>${item.jabatan_lama}</td>

<td>${item.jabatan_baru}</td>

<td>${item.keterangan ?? "-"}</td>

<td>${item.created_by}</td>

</tr>

`;

    });

}

// =====================================

function exportExcel(){

alert("Export Excel akan dibuat tahap berikutnya.");

}

// =====================================

document.addEventListener("DOMContentLoaded",()=>{

loadHistori();

});
